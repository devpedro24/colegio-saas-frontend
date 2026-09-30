/**
 * Cliente HTTP tipado hacia la API del backend.
 *
 * Todas las llamadas van a `/api`; Vite las redirige al backend Laravel.
 * La sesión se envía en cookies HttpOnly del mismo origen y los errores se
 * normalizan en una `ApiError`.
 *
 * Suplantación (superadmin administrando un colegio desde localhost, SIN subdominio):
 * la cookie de suplantación se aplica en el servidor a rutas del colegio y la
 * cookie de plataforma a rutas centrales. El navegador nunca lee esas cookies.
 */

import {clearImpersonation, getImpersonation} from '@/app/modules/impersonation/impersonation.store';
import {queryClient} from './query-client';
import {notifyLocalChange, resourceForPath} from '../realtime';

const CSRF_COOKIE = 'school_saas_csrf';
let sessionGeneration = 0;
const expiredListeners = new Set<() => void>();

// Captura y borra las credenciales legadas de forma síncrona. La revocación en
// segundo plano es best effort; no bloquea la nueva sesión con cookie HttpOnly.
function takeLegacySession(): string | null {
  try {
    const platform = localStorage.getItem('colegio-saas.auth-token');
    localStorage.removeItem('colegio-saas.auth-token');
    localStorage.removeItem('colegio-saas.impersonation-token');
    localStorage.removeItem('colegio-saas.active-colegio');
    return platform;
  } catch { return null; }
}

async function revokeLegacySession(platform: string | null) {
  if (!platform) return;
  const headers = {Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${platform}`};
  try { await fetch('/api/logout', {method: 'POST', credentials: 'omit', headers}); }
  catch { /* La limpieza local ya ocurrió. */ }
}

void revokeLegacySession(takeLegacySession());

/**
 * Prefijos de rutas de plataforma: se atienden con la cookie de plataforma
 * aunque el superadministrador tenga una suplantación activa.
 */
const PLATFORM_PATH_PREFIXES = ['/platform', '/colegios', '/plans', '/planes', '/rbac', '/login', '/logout', '/me', '/account', '/mfa', '/forgot-password', '/reset-password'];

/** ¿El path corresponde a una ruta de plataforma (por prefijo, con límite de segmento)? */
function isPlatformPath(path: string): boolean {
  return PLATFORM_PATH_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`),
  );
}

export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie.split('; ').find(part => part.startsWith(`${CSRF_COOKIE}=`));
  if (!value) return null;
  try { return decodeURIComponent(value.slice(CSRF_COOKIE.length + 1)); }
  catch { return null; }
}

/** Invalida respuestas de la sesión anterior y descarta sus datos cacheados. */
export function advanceSessionGeneration(): void {
  sessionGeneration += 1;
  queryClient.clear();
}

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => { expiredListeners.delete(listener); };
}

/** Error de API con el estado HTTP y (si aplica) los errores de validacion por campo. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
    /** Cuerpo JSON crudo de la respuesta (para leer banderas fuera de `errors`, ej. mfa_required). */
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Primer mensaje de error de un campo, util para pintar formularios. */
  fieldError(field: string): string | undefined {
    return this.errors?.[field]?.[0];
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<TResponse>(method: HttpMethod, path: string, body?: unknown): Promise<TResponse> {
  const context = getImpersonation();
  const generation = sessionGeneration;
  const csrf = method === 'GET' ? null : getCsrfToken();

  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(csrf ? {'X-CSRF-Token': csrf} : {}),
    },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  // Una respuesta del contexto anterior nunca debe actualizar el colegio nuevo.
  if (getImpersonation() !== context || sessionGeneration !== generation) {
    throw new DOMException('Authentication context changed', 'AbortError');
  }

  if (!response.ok) {
    const message = (data?.message as string | undefined) ?? `Error ${response.status}`;

    if (response.status === 401 && !['/login', '/register', '/me', '/platform/impersonar/estado'].includes(path)) {
      if (context.activeColegio && !isPlatformPath(path)) clearImpersonation();
      else expiredListeners.forEach(listener => listener());
    }

    throw new ApiError(response.status, message, data?.errors, data);
  }

  if (method !== 'GET' && !['/login', '/logout', '/forgot-password', '/broadcasting/auth', '/tenant-broadcasting/auth'].includes(path)) {
    notifyLocalChange({resource: resourceForPath(path),
      scope: isPlatformPath(path) ? 'platform' : 'tenant',
      tenantKey: context.activeColegio?.slug});
  }
  return data as TResponse;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

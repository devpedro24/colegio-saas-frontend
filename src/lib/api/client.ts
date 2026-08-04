/**
 * Cliente HTTP tipado hacia la API del backend.
 *
 * Todas las llamadas van a `/api`; Vite las redirige al backend Laravel.
 * El cliente inyecta el token de autenticacion y normaliza los errores en una `ApiError`.
 *
 * Suplantación (superadmin administrando un colegio desde localhost, SIN subdominio):
 * cuando hay una suplantación activa (token + colegio en el store), las peticiones a rutas
 * del COLEGIO usan el token de impersonación y añaden el header 'X-Tenant: <colegio.id>'
 * (asi InitializeTenancyByRequestData resuelve el tenant por header). Las rutas de PLATAFORMA
 * (ver PLATFORM_PATH_PREFIXES) siempre usan el token normal del superadmin y NO llevan X-Tenant.
 * Para un usuario real de colegio no hay suplantación activa -> comportamiento normal.
 */

import {clearImpersonation, getActiveImpersonation} from '@/app/modules/impersonation/impersonation.store';

const TOKEN_STORAGE_KEY = 'colegio-saas.auth-token';

/**
 * Prefijos de rutas de PLATAFORMA: aunque haya un colegio activo, estas siguen con el token
 * normal del superadmin y SIN X-Tenant (incluye entrar/salir de la suplantación en /platform).
 * '/me' es de plataforma: valida SIEMPRE la sesión del superadmin (si fuera tratada como ruta
 * de colegio, llevaría el token de impersonación + X-Tenant y el backend central respondería 401).
 */
const PLATFORM_PATH_PREFIXES = ['/platform', '/colegios', '/planes', '/rbac', '/login', '/logout', '/me', '/account'];

/** ¿El path corresponde a una ruta de plataforma (por prefijo, con límite de segmento)? */
function isPlatformPath(path: string): boolean {
  return PLATFORM_PATH_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`),
  );
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
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
  // Suplantación activa (colegio + token). En rutas de plataforma se ignora a propósito.
  const impersonation = getActiveImpersonation();
  const useImpersonation = impersonation !== null && !isPlatformPath(path);

  // Token: el de impersonación para rutas del colegio bajo suplantación; el normal en el resto.
  const authToken = useImpersonation ? impersonation!.token : getToken();

  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      // Header que resuelve el tenant por request data (ID/uuid del colegio) sin subdominio.
      ...(useImpersonation ? { 'X-Tenant': impersonation!.colegioId } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = (data?.message as string | undefined) ?? `Error ${response.status}`;

    // 401 = token inválido o sesión caducada. Se limpia el estado que lo causó para que
    // la app pueda volver a autenticarse SIN quedar atascada con tokens muertos:
    //   - bajo suplantación (ruta de colegio): se sale del colegio pero se conserva la
    //     sesión de plataforma (el token del superadmin sigue siendo válido);
    //   - sin suplantación: se invalida el token de autenticación local.
    // Se excluyen /login y /register porque allí un 401/422 es parte del flujo normal (MFA).
    if (response.status === 401 && path !== '/login' && path !== '/register') {
      if (useImpersonation) {
        clearImpersonation()
      } else {
        setToken(null)
      }
    }

    throw new ApiError(response.status, message, data?.errors, data);
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

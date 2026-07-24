/**
 * Cliente HTTP tipado hacia la API del backend.
 *
 * Todas las llamadas van a `/api`; Vite las redirige al backend Laravel
 * conservando el subdominio del colegio (tenant). El cliente inyecta el token
 * de autenticacion y normaliza los errores en una `ApiError`.
 */

const TOKEN_STORAGE_KEY = 'colegio-saas.auth-token';

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
  const token = getToken();

  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = (data?.message as string | undefined) ?? `Error ${response.status}`;
    throw new ApiError(response.status, message, data?.errors);
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

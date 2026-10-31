import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuth} from '@/app/modules/auth/core/Auth'

export interface TenantRole {
  key: string
  label: string
  custom: boolean
  locked_by_plan: boolean
}

export interface TenantRoleCell {
  type: 'structural' | 'configurable' | 'denied'
  level: string | null
  granted: boolean
  locked_by_plan: boolean
  required_feature: string | null
}

export interface TenantRoleModule {
  module: string
  permissions: Array<{key: string; action: string; feature_key: string | null; cells: Record<string, TenantRoleCell>}>
}

export interface TenantRolesResponse {
  data: TenantRoleModule[]
  roles: TenantRole[]
  custom_role_limit: number | null
  custom_role_count: number
  plan_features: string[]
}

export const TENANT_ROLES_KEY = ['tenant-roles'] as const

export function useTenantRoles(enabled = true) {
  const {currentUser} = useAuth()
  return useQuery({
    queryKey: [...TENANT_ROLES_KEY, currentUser?.tenant_channel],
    queryFn: () => api.get<TenantRolesResponse>('/rbac/roles?per_page=1000'),
    enabled: enabled && !!currentUser?.tenant_channel,
  })
}

export function useTenantRoleActions() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({queryKey: TENANT_ROLES_KEY})
  const create = useMutation({mutationFn: (label: string) => api.post('/rbac/roles', {label}), onSuccess: refresh})
  const rename = useMutation({mutationFn: ({key, label}: {key: string; label: string}) =>
    api.put(`/rbac/roles/${encodeURIComponent(key)}`, {label}), onSuccess: refresh})
  const remove = useMutation({mutationFn: (key: string) => api.delete(`/rbac/roles/${encodeURIComponent(key)}`), onSuccess: refresh})
  const toggle = useMutation({mutationFn: ({role, permission, granted}: {role: string; permission: string; granted: boolean}) =>
    api.put(`/rbac/roles/${encodeURIComponent(role)}/permissions/${encodeURIComponent(permission)}`, {granted}), onSuccess: refresh})
  const assign = useMutation({mutationFn: ({userToken, roles, sedeUrlToken}: {userToken: string; roles: string[]; sedeUrlToken?: string | null}) =>
    api.put(`/rbac/usuarios/${encodeURIComponent(userToken)}/roles-adicionales`, {roles, sede_url_token: sedeUrlToken ?? null}),
    onSuccess: () => {refresh(); client.invalidateQueries({queryKey: ['usuarios']})}})
  return {create, rename, remove, toggle, assign}
}

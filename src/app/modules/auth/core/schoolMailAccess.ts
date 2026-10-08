import type {UserModel} from './_models'

export function canAccessSchoolMail(user: UserModel | undefined, hasActiveSchool: boolean): boolean {
  return !!user && !user.is_platform && !user.is_superadmin && !hasActiveSchool &&
    (user.role === undefined || user.role === 'rector') &&
    user.roles.includes('rector') && user.permissions.includes('config.correo')
}

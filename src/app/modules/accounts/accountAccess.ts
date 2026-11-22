import type {UserModel} from '../auth/core/_models'

export const canManageSchoolSubscription = (user?: UserModel) => !!user && !user.is_platform && !user.is_superadmin && user.roles.includes('rector')

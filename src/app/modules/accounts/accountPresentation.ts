import type {IntlShape} from 'react-intl'
import type {UserModel} from '../auth/core/_models'

export const userInitials = (name?: string) => (name?.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join('') || '?').toLocaleUpperCase()

export function roleLabels(user: UserModel | undefined, intl: IntlShape) {
  return (user?.roles ?? []).map(role => intl.messages[`account.role.${role}`] ? intl.formatMessage({id: `account.role.${role}`}) : role.replace(/_/g, ' ')).join(' · ')
}

export const escapeUserHtml = (value: string) => value.replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]!))

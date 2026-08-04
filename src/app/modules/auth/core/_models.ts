export interface AuthModel {
  api_token: string
  refreshToken?: string
}

export interface UserAddressModel {
  addressLine: string
  city: string
  state: string
  postCode: string
}

export interface UserCommunicationModel {
  email: boolean
  sms: boolean
  phone: boolean
}

export interface UserEmailSettingsModel {
  emailNotification?: boolean
  sendCopyToPersonalEmail?: boolean
  activityRelatesEmail?: {
    youHaveNewNotifications?: boolean
    youAreSentADirectMessage?: boolean
    someoneAddsYouAsAsAConnection?: boolean
    uponNewOrder?: boolean
    newMembershipApproval?: boolean
    memberRegistration?: boolean
  }
  updatesFromKeenthemes?: {
    newsAboutKeenthemesProductsAndFeatureUpdates?: boolean
    tipsOnGettingMoreOutOfKeen?: boolean
    thingsYouMissedSindeYouLastLoggedIntoKeen?: boolean
    newsAboutStartOnPartnerProductsAndOtherServices?: boolean
    tipsOnStartBusinessProducts?: boolean
  }
}

export interface UserSocialNetworksModel {
  linkedIn: string
  facebook: string
  twitter: string
  instagram: string
}

/**
 * Usuario autenticado tal como lo devuelve el backend (POST /login y GET /me).
 * Se conservan los campos de presentacion de la plantilla Metronic como
 * opcionales para no romper los componentes que ya los consumen.
 */
export interface UserModel {
  id: number
  /** Nombre completo del usuario tal como lo devuelve el backend. */
  name: string
  email: string
  /** Obliga a cambiar la contrasena en el primer ingreso. */
  must_change_password: boolean
  /** Roles asignados (slugs), ej: ['rector']. */
  roles: string[]
  /** Permisos efectivos del usuario. */
  permissions: string[]
  /** true si es usuario de PLATAFORMA (superadministrador). */
  is_platform?: boolean
  /** UUID del colegio (solo usuarios de colegio); usado para el canal WS privado. */
  tenant_id?: string | null
  /** true si el usuario ya activó la verificación en dos pasos (MFA/TOTP). */
  mfa_enabled?: boolean
  /** Correo de la cuenta de Google vinculada (si la hay). */
  google_email?: string | null

  // --- Campos de presentacion heredados de la plantilla Metronic (opcionales) ---
  username?: string
  password?: string
  first_name?: string
  last_name?: string
  fullname?: string
  occupation?: string
  companyName?: string
  /** Teléfono de contacto (persistido en el backend: PUT /account/profile). */
  phone?: string | null
  pic?: string
  language?: 'en' | 'de' | 'es' | 'fr' | 'ja' | 'zh' | 'ru'
  timeZone?: string
  website?: 'https://keenthemes.com'
  emailSettings?: UserEmailSettingsModel
  auth?: AuthModel
  communication?: UserCommunicationModel
  address?: UserAddressModel
  socialNetworks?: UserSocialNetworksModel
}

// Datos MOCK estaticos del feature Planes (solo diseno, SIN backend).
// Alimentan las tarjetas de la pagina y la lista de features editable del formulario.
//
// El catalogo de features (PLAN_FEATURES) y los 3 planes son fieles a
// colegio-saas-backend/app/Plans/PlanCatalog.php (features(), defaultPlans()).

import {Plan, PlanFeatureOption} from './planes.types'

/**
 * Catalogo CERRADO de features vendibles por plan (clave -> etiqueta).
 * Fiel a PlanCatalog::features(). El formulario togglea estas; el mock las referencia
 * por su `key`.
 */
export const PLAN_FEATURES: PlanFeatureOption[] = [
  // Academico y operacion
  {key: 'academico', label: 'Gestion academica'},
  {key: 'asistencia', label: 'Control de asistencia'},
  // Pagos y facturacion
  {key: 'pagos_pension', label: 'Pagos de pension'},
  {key: 'multi_pasarela', label: 'Multiples pasarelas de pago'},
  {key: 'pagos_sin_friccion', label: 'Pagos sin friccion'},
  {key: 'dian', label: 'Facturacion electronica DIAN'},
  // Comunicacion
  {key: 'comunicacion_basica', label: 'Comunicacion basica'},
  {key: 'app_acudientes', label: 'App para acudientes'},
  {key: 'whatsapp', label: 'Notificaciones por WhatsApp'},
  // Academico avanzado
  {key: 'boletines_personalizables', label: 'Boletines personalizables'},
  {key: 'multi_sede', label: 'Gestion multi-sede'},
  {key: 'firma_electronica', label: 'Firma electronica'},
  {key: 'carne_qr', label: 'Carne estudiantil con QR'},
  {key: 'generador_horarios', label: 'Generador de horarios'},
  // Reportes y analitica
  {key: 'reportes_financieros', label: 'Reportes financieros'},
  {key: 'bi_avanzado', label: 'Business Intelligence avanzado'},
  // Soporte e integraciones
  {key: 'soporte_prioritario', label: 'Soporte prioritario'},
  {key: 'sso', label: 'Inicio de sesion unico (SSO)'},
]

/** Etiqueta de una feature por su clave (para las tarjetas). */
export const featureLabel = (key: string): string =>
  PLAN_FEATURES.find((f) => f.key === key)?.label ?? key

// Subconjuntos de features por plan (fieles a PlanCatalog::defaultPlans()).
const ESENCIAL = ['academico', 'asistencia', 'comunicacion_basica', 'pagos_pension']

const ESTANDAR = [
  ...ESENCIAL,
  'multi_pasarela',
  'pagos_sin_friccion',
  'app_acudientes',
  'boletines_personalizables',
  'multi_sede',
  'firma_electronica',
  'carne_qr',
  'reportes_financieros',
]

const PREMIUM = [
  ...ESTANDAR,
  'dian',
  'whatsapp',
  'generador_horarios',
  'bi_avanzado',
  'soporte_prioritario',
  'sso',
]

/** Los 3 planes comerciales por defecto. */
export const planes: Plan[] = [
  {
    id: 1,
    key: 'esencial',
    name: 'Esencial',
    description: 'Colegios pequenos (menos de 300 estudiantes).',
    price: 149000,
    period: 'mensual',
    active: true,
    features: ESENCIAL,
  },
  {
    id: 2,
    key: 'estandar',
    name: 'Estandar',
    description: 'Colegios medianos (300 a 800 estudiantes).',
    price: 349000,
    period: 'mensual',
    active: true,
    features: ESTANDAR,
  },
  {
    id: 3,
    key: 'premium',
    name: 'Premium',
    description: 'Colegios grandes (800+ estudiantes) o con necesidades avanzadas.',
    price: 690000,
    period: 'mensual',
    active: true,
    features: PREMIUM,
  },
]

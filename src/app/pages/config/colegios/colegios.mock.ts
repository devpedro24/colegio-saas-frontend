// Datos MOCK estaticos del feature Colegios (Fase 1 - solo diseno, SIN backend).
// Alimentan la tabla y los selects de los formularios.

import {Colegio, PlanOption} from './colegios.types'

/** Planes disponibles para el select de Crear/Editar colegio (solo UI). */
export const PLAN_OPTIONS: PlanOption[] = [
  {key: 'esencial', label: 'Esencial'},
  {key: 'estandar', label: 'Estandar'},
  {key: 'premium', label: 'Premium'},
]

/** ~6 colegios de ejemplo con distintos planes y estados. */
export const colegios: Colegio[] = [
  {
    id: 1,
    name: 'Colegio San Jose',
    subdomain: 'sanjose',
    plan: 'premium',
    status: 'active',
    rector: {name: 'Maria Fernanda Ruiz', email: 'rector@sanjose.edu.co'},
  },
  {
    id: 2,
    name: 'Gimnasio Los Andes',
    subdomain: 'losandes',
    plan: 'estandar',
    status: 'active',
    rector: {name: 'Carlos Alberto Gomez', email: 'rector@losandes.edu.co'},
  },
  {
    id: 3,
    name: 'Institucion Educativa La Merced',
    subdomain: 'lamerced',
    plan: 'esencial',
    status: 'configuring',
    rector: {name: 'Ana Lucia Torres', email: 'rector@lamerced.edu.co'},
  },
  {
    id: 4,
    name: 'Liceo Moderno del Norte',
    subdomain: 'liceonorte',
    plan: 'estandar',
    status: 'provisioning',
    rector: {name: 'Jorge Enrique Patino', email: 'rector@liceonorte.edu.co'},
  },
  {
    id: 5,
    name: 'Colegio Santa Teresa',
    subdomain: 'santateresa',
    plan: 'premium',
    status: 'active',
    rector: {name: 'Beatriz Helena Marin', email: 'rector@santateresa.edu.co'},
  },
  {
    id: 6,
    name: 'Colegio Nueva Granada',
    subdomain: 'nuevagranada',
    plan: 'esencial',
    status: 'suspended',
    rector: {name: 'Ricardo Andres Vega', email: 'rector@nuevagranada.edu.co'},
  },
]

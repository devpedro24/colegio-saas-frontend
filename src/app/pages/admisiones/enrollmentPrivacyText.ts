export function privacyLabels(locale: string) {
  return locale.startsWith('es') ? {
    title: 'Política de tratamiento de datos personales',
    consult: 'Consultar la política de tratamiento de datos',
    help: 'Incluye el responsable y su contacto, finalidades, derechos, protección de menores, consultas, reclamos y conservación. Se mostrará completa a las familias y se conservará la versión aceptada.',
  } : {
    title: 'Personal data processing policy',
    consult: 'Read the data processing policy',
    help: 'Include the controller and contact details, purposes, rights, child protection, requests, complaints and retention. Families can read the full policy and the accepted version is retained.',
  }
}

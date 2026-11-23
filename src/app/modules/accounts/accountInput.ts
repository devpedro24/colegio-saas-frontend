// Scoped account messages keep validation copy out of the initial application bundle.
const messages = {
  es: {
    nameInvalid: 'Ingresa un nombre válido, sin números ni símbolos ajenos al nombre.',
    emailMax: 'Máximo 255 caracteres.',
    passwordMax: 'La contraseña supera la longitud permitida.',
  },
  en: {
    nameInvalid: 'Enter a valid name, without numbers or unrelated symbols.',
    emailMax: 'Maximum 255 characters.',
    passwordMax: 'The password exceeds the allowed length.',
  },
}

export const accountInputText = (locale: string) => messages[locale.startsWith('en') ? 'en' : 'es']

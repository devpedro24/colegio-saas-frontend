export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export const passwordChecks = (value: string) => ({
  length: value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
  upper: /[A-Z]/u.test(value),
  lower: /[a-z]/u.test(value),
  number: /[0-9]/u.test(value),
  symbol: /[\p{P}\p{S}]/u.test(value),
})

export const passwordMeetsPolicy = (value: string) => Object.values(passwordChecks(value)).every(Boolean)

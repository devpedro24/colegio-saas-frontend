import test from 'node:test'
import assert from 'node:assert/strict'
import {passwordMeetsPolicy, passwordChecks} from '../src/app/shared/passwordPolicy.ts'

test('password policy accepts eight characters with every required category', () => {
  assert.equal(passwordMeetsPolicy('Abcde1!x'), true)
  assert.equal(passwordMeetsPolicy('Aa1!' + 'x'.repeat(124)), true)
})

test('password policy rejects missing categories and lengths outside the limits', () => {
  for (const candidate of ['Ab1!', 'abcdefgh1!', 'ABCDEFGH1!', 'Abcdefgh!', 'Abcdefgh1', 'Aa1!' + 'x'.repeat(125)]) {
    assert.equal(passwordMeetsPolicy(candidate), false, candidate)
    assert.equal(Object.values(passwordChecks(candidate)).some(valid => !valid), true)
  }
})

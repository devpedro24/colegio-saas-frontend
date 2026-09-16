import assert from 'node:assert/strict'
import test from 'node:test'
import {isPlatformPath} from '../src/lib/api/request-scope.ts'
import {buildTenantOrigin, matchesCentralHost} from '../src/lib/subdomain-core.ts'
import {isFutureExpiration} from '../src/app/modules/impersonation/impersonation-session.ts'
import {
  AUTH_SESSION_INVALIDATED_EVENT,
  notifyAuthSessionInvalidated,
} from '../src/lib/api/auth-session.ts'

test('planes y MFA conservan el contexto central durante una suplantación', () => {
  assert.equal(isPlatformPath('/plans'), true)
  assert.equal(isPlatformPath('/plans/2'), true)
  assert.equal(isPlatformPath('/mfa/setup'), true)
  assert.equal(isPlatformPath('/anos-lectivos'), false)
  assert.equal(isPlatformPath('/accounting'), false)
})

test('construye dominios tenant sin duplicar sufijo y conserva puerto explícito', () => {
  assert.equal(
    buildTenantOrigin('norte.colegio', {baseDomain: 'localhost', scheme: 'http', port: '5173'}),
    'http://norte.colegio.localhost:5173',
  )
  assert.equal(
    buildTenantOrigin('norte.colegios.example.com', {
      baseDomain: 'colegios.example.com',
      scheme: 'https',
    }),
    'https://norte.colegios.example.com',
  )
  assert.equal(matchesCentralHost('localhost', ['localhost', '127.0.0.1']), true)
  assert.equal(matchesCentralHost('colegio.localhost', ['localhost', '127.0.0.1']), false)
  assert.equal(matchesCentralHost('app.example.com', ['app.example.com']), true)
  assert.equal(matchesCentralHost('colegio.example.com', ['app.example.com']), false)
})

test('descarta expiraciones inválidas o vencidas', () => {
  const now = Date.parse('2026-08-13T12:00:00Z')
  assert.equal(isFutureExpiration('2026-08-13T12:01:00Z', now), true)
  assert.equal(isFutureExpiration('2026-08-13T11:59:00Z', now), false)
  assert.equal(isFutureExpiration('no-es-fecha', now), false)
  assert.equal(isFutureExpiration(null, now), false)
})

test('notifica a React cuando la sesión principal es invalidada', () => {
  const target = new EventTarget()
  let notifications = 0
  target.addEventListener(AUTH_SESSION_INVALIDATED_EVENT, () => notifications++)

  notifyAuthSessionInvalidated(target)

  assert.equal(notifications, 1)
})

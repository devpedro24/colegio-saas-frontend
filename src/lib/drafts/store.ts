import {api, ApiError} from '@/lib/api/client'
import {decryptDraft, DRAFT_TTL, encryptDraft, importDraftKey, newDraftToken, safeDraftPath} from './crypto'
import {type EncryptedDraft, listLocalDrafts, putLocalDraft, pruneLocalFiles, getLocalFile, putLocalFile} from './database'

export type DraftContent = {schema: 1; context: string; title: string; path: string; base: string; value: unknown; files?: string[]}
export type WorkDraft = DraftContent & {token: string; editedAt: number; expiresAt: number; status: 'local' | 'synced' | 'saving' | 'error'}
type Bootstrap = {scope: string; key: string; drafts: EncryptedDraft[]; server_time: string}
export class DraftStore {
  scope = ''; key?: CryptoKey; ready = false; error = false; stopped = false
  entries = new Map<string, WorkDraft>()
  records = new Map<string, EncryptedDraft>()
  private listeners = new Set<() => void>(); private revision = 0
  private writes = new Map<string, Promise<void>>()
  private timer?: ReturnType<typeof setTimeout>; private syncing = false
  private channel?: BroadcastChannel
  private clockOffset = 0
  private started = false
  private retryDelay = 10000
  constructor(readonly endpoint: string) {}
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener)}}
  snapshot = () => this.revision
  private emit() {if (!this.stopped) {this.revision++; this.listeners.forEach(listener => listener())}}
  now() {return Date.now() + this.clockOffset}
  async start() {
    if (this.started) return
    this.started = true
    try {
      const remote = await api.get<Bootstrap>(this.endpoint)
      if (this.stopped) return
      this.scope = remote.scope; this.clockOffset = Date.parse(remote.server_time) - Date.now()
      const key = await importDraftKey(remote.key)
      if (this.stopped) return
      this.key = key
      let local: EncryptedDraft[] = []
      try {local = await listLocalDrafts(this.scope, this.now())} catch {this.error = true}
      await pruneLocalFiles(this.now()).catch(() => {})
      const combined = new Map(local.map(row => [row.token, row]))
      for (const row of remote.drafts) {
        const previous = combined.get(row.token)
        // Server tombstones win. Newer local edits can only replace the same server revision.
        if (!previous || row.discarded || (!previous.pending && row.version >= previous.version)) combined.set(row.token, {...row, scope: this.scope})
        else if (previous.version !== row.version) {
          // A response may have been lost after the server saved. Keep genuinely
          // different offline work as a separate branch, never silently replace it.
          if (!previous.discarded && (previous.pending || previous.failed)
            && (previous.ciphertext !== row.ciphertext || previous.iv !== row.iv)) {
            const content = await decryptDraft<DraftContent>(key, this.scope, previous.token, previous)
            const token = newDraftToken()
            combined.set(token, {...previous, token, version: 0, pending: true, failed: false,
              ...await encryptDraft(key, this.scope, token, content)})
          }
          combined.set(row.token, {...row, scope: this.scope})
        }
      }
      for (const row of combined.values()) {
        this.records.set(row.token, row)
        await this.decode(row)
        await putLocalDraft(row).catch(() => {this.error = true})
      }
      this.ready = true; this.emit(); this.schedule()
      this.channel = new BroadcastChannel(`school-drafts:${this.scope}`)
      this.channel.onmessage = () => {void this.refreshLocal()}
    } catch {this.error = true; this.ready = true; this.emit()}
  }
  private async decode(row: EncryptedDraft) {
    if (row.discarded || Date.parse(row.expires_at) <= this.now()) {this.entries.delete(row.token); return}
    try {
      const content = await decryptDraft<DraftContent>(this.key!, this.scope, row.token, row)
      if (content.schema !== 1 || !safeDraftPath(content.path)) return
      this.entries.set(row.token, {...content, token: row.token, editedAt: Date.parse(row.edited_at),
        expiresAt: Date.parse(row.expires_at), status: row.failed ? 'error' : row.pending ? 'local' : 'synced'})
    } catch {this.error = true}
  }
  private async refreshLocal() {
    if (this.stopped) return
    for (const row of await listLocalDrafts(this.scope, this.now()).catch(() => [])) {
      const current = this.records.get(row.token)
      if (!current || row.discarded || row.version > current.version
        || (row.version === current.version && Date.parse(row.edited_at) > Date.parse(current.edited_at))) {
        this.records.set(row.token, row); await this.decode(row)
      }
    }
    this.emit()
  }
  write(token: string, content: DraftContent, originalEditTime?: number) {
    if (this.stopped || !this.key) return
    const editedAt = originalEditTime ?? this.now()
    this.entries.set(token, {...content, token, editedAt, expiresAt: editedAt + DRAFT_TTL, status: 'saving'}); this.emit()
    const operation = (this.writes.get(token) ?? Promise.resolve()).then(async () => {
      if (!this.key || this.stopped) return
      const encrypted = await encryptDraft(this.key, this.scope, token, content)
      if (encrypted.ciphertext.length > 700000) throw new Error('Draft too large')
      const active = [...this.records.values()].filter(row => !row.discarded && Date.parse(row.expires_at) > this.now() && row.token !== token)
      if (active.length >= 100 || active.reduce((sum, row) => sum + row.ciphertext.length, encrypted.ciphertext.length) > 8000000) throw new Error('Draft quota')
      const row: EncryptedDraft = {token, scope: this.scope, version: this.records.get(token)?.version ?? 0,
        ...encrypted, edited_at: new Date(editedAt).toISOString(), expires_at: new Date(editedAt + DRAFT_TTL).toISOString(),
        discarded: false, pending: true}
      let localSaved = true
      await putLocalDraft(row).catch(() => {localSaved = false; this.error = true})
      for (const fileToken of content.files ?? []) {
        const file = await getLocalFile(this.scope, fileToken).catch(() => undefined)
        if (file) await putLocalFile({...file, expires_at: row.expires_at}).catch(() => {this.error = true})
      }
      this.records.set(token, row)
      if (content.context === '$route') {
        const oldRoutes = [...this.entries.values()].filter(item => item.context === '$route')
          .sort((a, b) => b.editedAt - a.editedAt).slice(10)
        for (const old of oldRoutes) if (old.token !== token) void this.discard(old.token).catch(() => {this.error = true})
      }
      const latest = this.entries.get(token)
      if (latest?.editedAt === editedAt) latest.status = localSaved ? 'local' : 'error'
      this.channel?.postMessage('changed'); this.emit(); this.schedule()
    }).catch(() => {const row = this.entries.get(token); if (row) row.status = 'error'; this.error = true; this.emit()})
    this.writes.set(token, operation)
  }
  private schedule() {
    if (!this.timer && !this.stopped) this.timer = setTimeout(() => {this.timer = undefined; void this.flush()}, this.retryDelay)
  }
  async flush() {
    if (this.stopped || this.syncing || !this.scope) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {this.schedule(); return}
    this.syncing = true
    try {
      await Promise.all(this.writes.values())
      for (const [token, pending] of this.records) {
        if (!pending.pending || Date.parse(pending.expires_at) <= this.now()) continue
        const operation = (this.writes.get(token) ?? Promise.resolve()).then(async () => {
        const captured = this.records.get(token)!
        if (!captured.pending || this.stopped) return
        try {
          const saved = captured.discarded
            ? await api.post<EncryptedDraft>(`${this.endpoint}/${token}/discard`, {version: captured.version}, {notifyLocalChange: false})
            : await api.put<EncryptedDraft>(`${this.endpoint}/${token}`, {version: captured.version, iv: captured.iv,
              ciphertext: captured.ciphertext, edited_at: captured.edited_at, files: this.entries.get(token)?.files ?? []}, {notifyLocalChange: false})
          if (this.stopped) return
          const latest = this.records.get(token)!
          const record = latest === captured ? {...saved, scope: this.scope, pending: false} : {...latest, version: saved.version}
          this.records.set(token, record); await putLocalDraft(record).catch(() => {this.error = true})
          this.retryDelay = 10000
          const entry = this.entries.get(token)
          if (entry && entry.editedAt === Date.parse(captured.edited_at) && latest === captured) entry.status = 'synced'
          this.channel?.postMessage('changed'); this.emit()
        } catch (error) {
          // Never retry a stale branch over a new revision or resurrect a tombstone.
          if (error instanceof ApiError && [409, 410, 404].includes(error.status)) {
            captured.pending = false; captured.failed = true
            const entry = this.entries.get(token); if (entry) entry.status = 'error'
          }
          if (error instanceof ApiError && [413, 422].includes(error.status)) {this.error = true; captured.pending = false; captured.failed = true}
          if (captured.failed) await putLocalDraft(captured).catch(() => {this.error = true})
          else this.retryDelay = Math.min(this.retryDelay * 2, 120000)
          this.emit()
        }
        })
        this.writes.set(token, operation)
        await operation
      }
    } finally {
      this.syncing = false
      if ([...this.records.values()].some(row => row.pending)) this.schedule()
    }
  }
  async discard(token: string) {
    const operation = (this.writes.get(token) ?? Promise.resolve()).then(async () => {
    const current = this.records.get(token)
    if (!current || this.stopped) return
    const row = {...current, discarded: true, ciphertext: '', iv: '', pending: true, expires_at: new Date(this.now() + DRAFT_TTL).toISOString()}
    await putLocalDraft(row).catch(() => {this.error = true}); this.records.set(token, row); this.entries.delete(token)
    this.channel?.postMessage('changed'); this.emit()
    })
    this.writes.set(token, operation)
    await operation; void this.flush()
  }
  stop() {
    this.stopped = true; clearTimeout(this.timer); this.channel?.close()
    this.key = undefined; this.entries.clear(); this.records.clear(); this.listeners.clear()
    this.writes.clear()
  }
}

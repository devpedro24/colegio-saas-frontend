export type EncryptedDraft = {
  token: string; version: number; iv: string; ciphertext: string; edited_at: string; expires_at: string
  discarded: boolean; scope: string; pending?: boolean; failed?: boolean
}
let opening: Promise<IDBDatabase> | undefined
function database() {
  return opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('school-work-drafts', 2)
    request.onupgradeneeded = () => {
      for (const name of ['drafts', 'files']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, {keyPath: ['scope', 'token']})
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {opening = undefined; reject(request.error)}
  })
}
async function transaction<T>(mode: 'readonly' | 'readwrite', operation: (store: IDBObjectStore) => IDBRequest<T>, name = 'drafts'): Promise<T> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode); const request = operation(tx.objectStore(name))
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error)
  })
}
export const putLocalFile = (file: EncryptedDraft) => transaction('readwrite', store => store.put(file), 'files')
export const getLocalFile = (scope: string, token: string) => transaction('readonly', store => store.get([scope, token]), 'files') as Promise<EncryptedDraft | undefined>
export async function pruneLocalFiles(now = Date.now()) {
  const all = await transaction('readonly', store => store.getAll(), 'files') as EncryptedDraft[]
  for (const item of all) if (Date.parse(item.expires_at) <= now) await transaction('readwrite', store => store.delete([item.scope, item.token]), 'files')
  return all.filter(item => Date.parse(item.expires_at) > now)
}
export const putLocalDraft = (draft: EncryptedDraft) => transaction('readwrite', store => store.put(draft))
export const deleteLocalDraft = (scope: string, token: string) => transaction('readwrite', store => store.delete([scope, token]))
export async function listLocalDrafts(scope: string, now = Date.now()) {
  const all = await transaction('readonly', store => store.getAll()) as EncryptedDraft[]
  await Promise.all(all.filter(item => Date.parse(item.expires_at) <= now).map(item => deleteLocalDraft(item.scope, item.token)))
  return all.filter(item => item.scope === scope && Date.parse(item.expires_at) > now)
}

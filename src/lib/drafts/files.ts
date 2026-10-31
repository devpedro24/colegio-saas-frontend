import {useEffect, useRef, useState} from 'react'
import {api} from '@/lib/api/client'
import {useDraftStore} from './WorkDrafts'
import {decode64, decryptDraft, DRAFT_TTL, encode64, encryptDraft, newDraftToken} from './crypto'
import {getLocalFile, pruneLocalFiles, putLocalFile} from './database'

export type DraftFile = {token: string; name: string; size: number; local: boolean; remote: boolean}
type FileData = {name: string; type: string; data: string}
export function useDraftFiles(files: File[], section: string, response = false) {
  const store = useDraftStore()
  const identities = useRef(new WeakMap<File, DraftFile>())
  const jobs = useRef(new WeakSet<File>())
  const [revision, setRevision] = useState(0)
  const [running, setRunning] = useState(0); const [restoring, setRestoring] = useState(false)
  const [failed, setFailed] = useState(false); const [retry, setRetry] = useState(0)
  useEffect(() => {
    const online = () => setRetry(value => value + 1)
    window.addEventListener('online', online)
    return () => window.removeEventListener('online', online)
  }, [])
  const references = files.map(file => {
    let item = identities.current.get(file)
    if (!item) {item = {token: newDraftToken(), name: file.name, size: file.size, local: false, remote: false}; identities.current.set(file, item)}
    return item
  })
  useEffect(() => {
    if (!store?.key) return
    const pending = files.filter(file => !jobs.current.has(file))
    if (!pending.length) return
    pending.forEach(file => jobs.current.add(file))
    setRunning(value => value + 1)
    void (async () => {
      for (const file of pending) {
        const item = identities.current.get(file)!
        if (!item.local) try {
          const existing = await pruneLocalFiles(store.now())
          if (existing.reduce((sum, row) => sum + row.ciphertext.length, 0) + file.size * 2 > 140 * 1024 * 1024) throw new Error('File draft quota')
          if (!store.key || store.stopped) return
          const content: FileData = {name: file.name, type: file.type, data: encode64(await file.arrayBuffer())}
          const encrypted = await encryptDraft(store.key, store.scope, item.token, content)
          await putLocalFile({scope: store.scope, token: item.token, version: 0, ...encrypted, discarded: false,
            edited_at: new Date(store.now()).toISOString(), expires_at: new Date(store.now() + DRAFT_TTL).toISOString()})
          item.local = true; setRevision(value => value + 1)
        } catch {setFailed(true)}
        if (!item.remote) try {
          if (store.stopped) return
          const data = new FormData(); data.append('archivo', file)
          await api.post(`/work-draft-files/${response ? 'response/' : ''}${section}/${item.token}`, data, {notifyLocalChange: false})
          item.remote = true; setRevision(value => value + 1)
        } catch {setFailed(true); jobs.current.delete(file)}
      }
    })().finally(() => setRunning(value => value - 1))
  }, [store, store?.ready, files, section, response, retry])
  const restore = async (refs: DraftFile[]) => {
    const restored: File[] = []; setRestoring(true); setFailed(false)
    try {
      for (const item of refs) {
        try {
          let data: FileData | undefined
          const local = store ? await getLocalFile(store.scope, item.token).catch(() => undefined) : undefined
          if (local && store?.key && Date.parse(local.expires_at) > store.now()) {
            try {data = await decryptDraft<FileData>(store.key, store.scope, item.token, local)} catch { /* try private server copy */ }
          }
          data ??= await api.get<FileData>(`/work-draft-files/${item.token}`)
          const file = new File([decode64(data.data)], data.name, {type: data.type})
          identities.current.set(file, item); if (item.remote) jobs.current.add(file); restored.push(file)
        } catch {setFailed(true)}
      }
    } finally {setRestoring(false)}
    return restored
  }
  return {references: references.map(item => ({...item})), busy: running > 0 || restoring, restoring, failed, restore, revision}
}

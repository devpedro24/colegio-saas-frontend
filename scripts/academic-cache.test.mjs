import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import {QueryClient, QueryObserver} from '@tanstack/react-query'

const source = fs.readFileSync(new URL('../src/lib/api/academic-cache.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const {configureAcademicCache, trackQueryReads, academicCacheRoots, completeAcademicPage} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const makeClient = () => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: 30_000}}})
  configureAcademicCache(client)
  return client
}

test('academic navigation reuses old data until invalidation; unrelated queries keep their policy', async () => {
  const client = makeClient()
  try {
    for (const root of academicCacheRoots) {
      let reads = 0
      const options = {queryKey: [root, 'year-token'], queryFn: async () => ++reads}
      client.setQueryData(options.queryKey, 99, {updatedAt: Date.now() - 10 * 60_000})
      assert.equal(await client.fetchQuery(options), 99)
      const observer = new QueryObserver(client, options)
      const stop = observer.subscribe(() => {})
      assert.equal(reads, 0, `${root}: remount must not refetch after 30 seconds`)
      await client.invalidateQueries({queryKey: options.queryKey})
      assert.equal(reads, 1, `${root}: a change must refresh the active view`)
      stop()
    }
    assert.equal(client.defaultQueryOptions({queryKey: ['account']}).staleTime, 30_000)
  } finally {client.clear()}
})

test('local hook plus batched invalidation fetches once, but a later write refreshes again', async () => {
  const client = makeClient(), tracker = trackQueryReads(client)
  let reads = 0
  const options = {queryKey: ['horarios', 'year'], queryFn: async () => ++reads}
  try {
    await client.fetchQuery(options)
    const checkpoint = tracker.checkpoint()
    await client.invalidateQueries({queryKey: options.queryKey})
    await client.fetchQuery(options) // the mutation hook's refresh
    const query = client.getQueryCache().find({queryKey: options.queryKey})
    assert.equal(tracker.needsRefresh(query, checkpoint), false)
    await client.invalidateQueries({predicate: q => tracker.needsRefresh(q, checkpoint)})
    await client.fetchQuery(options)
    assert.equal(reads, 2)
    assert.equal(tracker.needsRefresh(query, tracker.checkpoint()), true)
  } finally {tracker.unsubscribe(); client.clear()}
})

test('pre-write requests completing afterwards are still stale, even in the same millisecond', async () => {
  const client = makeClient(), tracker = trackQueryReads(client)
  let finish
  try {
    const request = client.fetchQuery({queryKey: ['anos-lectivos'], queryFn: () => new Promise(resolve => {finish = resolve})})
    const checkpoint = tracker.checkpoint()
    finish(['old-year'])
    await request
    const query = client.getQueryCache().find({queryKey: ['anos-lectivos']})
    assert.equal(tracker.needsRefresh(query, checkpoint), true)
    await client.invalidateQueries({predicate: q => tracker.needsRefresh(q, checkpoint)})
    assert.equal(query.state.isInvalidated, true)
  } finally {tracker.unsubscribe(); client.clear()}
})

test('years and filters have separate cache entries; clearing context removes all private data', async () => {
  const client = makeClient()
  try {
    client.setQueryData(['horarios', '2026-token', 'group-a'], ['class-a'])
    client.setQueryData(['horarios', '2027-token', 'group-a'], [])
    assert.deepEqual(client.getQueryData(['horarios', '2026-token', 'group-a']), ['class-a'])
    assert.deepEqual(client.getQueryData(['horarios', '2027-token', 'group-a']), [])
    assert.equal(client.getQueryData(['horarios', '2026-token', 'group-b']), undefined)
    client.clear()
    assert.equal(client.getQueryCache().getAll().length, 0)
  } finally {client.clear()}
})

test('only complete unfiltered fresh tables can supply selectors, including an empty catalog', async () => {
  const client = makeClient(), prefix = ['estructura', 'niveles', 'year']
  const key = [...prefix, '', {}, 20, 1]
  const full = {data: [{nombre: 'Primaria'}], meta: {current_page: 1, total: 1}}
  try {
    client.setQueryData([...prefix, 'Pri', {}, 20, 1], full)
    client.setQueryData([...prefix, '', {estado: 'activo'}, 20, 1], full)
    client.setQueryData(key, {...full, meta: {current_page: 1, total: 25}})
    assert.equal(completeAcademicPage(client, prefix), undefined)
    client.setQueryData(key, full)
    assert.deepEqual(completeAcademicPage(client, prefix), full)
    assert.equal(completeAcademicPage(client, ['estructura', 'niveles', 'other-year']), undefined)
    await client.invalidateQueries({queryKey: prefix})
    assert.equal(completeAcademicPage(client, prefix), undefined)
    client.setQueryData(key, {data: [], meta: {current_page: 1, total: 0}})
    assert.deepEqual(completeAcademicPage(client, prefix).data, [])
  } finally {client.clear()}
})

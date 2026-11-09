import {Fragment, useEffect, useRef, useState} from 'react'
import {useIntl} from 'react-intl'
import {useToast} from '@/lib/ui/toast'
import {ApiError} from '@/lib/api/client'
import {useDeleteGroupIndicatorSheet, useGroupIndicatorSheet, useSaveGroupIndicatorSheet, type GroupIndicatorSheet as Sheet} from '../indicadores.api'
import {safeIndicatorHtml} from './indicatorHtml'
import './group-indicator-sheet.css'
import {useWorkDraft} from '@/lib/drafts/WorkDrafts'

type Row = Sheet['materias'][number]
type FormatCommand = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList'
const formatCommands: FormatCommand[] = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList']
const emptyFormats = () => ({bold: false, italic: false, underline: false, insertUnorderedList: false, insertOrderedList: false})

function EditableDescription({row, group, period}: {row: Row; group: string; period: string}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const save = useSaveGroupIndicatorSheet()
  const remove = useDeleteGroupIndicatorSheet()
  const editor = useRef<HTMLDivElement>(null)
  const draft = useRef('')
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [source, setSource] = useState(false)
  const [sourceHtml, setSourceHtml] = useState('')
  const [activeFormats, setActiveFormats] = useState(emptyFormats)
  const displayed = safeIndicatorHtml(row.texto_html)
  const [pendingHtml, setPendingHtml] = useState(displayed)
  const recovery = useWorkDraft({context: `indicator:${group}:${period}:${row.materia_token}`, title: row.materia,
    value: pendingHtml, dirty: editing && pendingHtml !== displayed, base: String(row.version), enabled: row.puede_editar,
    restore: value => {draft.current = safeIndicatorHtml(value); setPendingHtml(draft.current); setSource(false); setEditing(true)},
    reset: () => {draft.current = displayed; setPendingHtml(displayed); setEditing(false)},
  })
  const refreshFormats = () => {
    const selection = window.getSelection()
    if (!selection?.anchorNode || !editor.current?.contains(selection.anchorNode)) {
      setActiveFormats(emptyFormats())
      return
    }
    const next = emptyFormats()
    for (const name of formatCommands) next[name] = document.queryCommandState(name)
    setActiveFormats(current => formatCommands.every(name => current[name] === next[name]) ? current : next)
  }
  useEffect(() => {
    // Like AulaRichEditor, initialize the editable DOM only on entry. React must not repaint it after each keystroke.
    if (editing && !source && editor.current) editor.current.innerHTML = draft.current
  }, [editing, source])
  useEffect(() => {
    if (!editing || source) return
    document.addEventListener('selectionchange', refreshFormats)
    return () => document.removeEventListener('selectionchange', refreshFormats)
  }, [editing, source])
  const start = () => {draft.current = displayed; setPendingHtml(displayed); setSource(false); setEditing(true)}
  const sync = () => {draft.current = editor.current?.innerHTML ?? draft.current; setPendingHtml(draft.current)}
  const command = (name: FormatCommand) => {
    editor.current?.focus()
    document.execCommand(name, false)
    sync()
    refreshFormats()
  }
  const toggleSource = () => {
    if (source) {draft.current = safeIndicatorHtml(sourceHtml); setSource(false)}
    else {sync(); setSourceHtml(draft.current); setSource(true)}
  }
  const submit = () => {
    const html = safeIndicatorHtml(source ? sourceHtml : (editor.current?.innerHTML ?? draft.current))
    const plain = new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim()
    if (!plain) {toast.error(t('indicators.sheet.required')); return}
    if (html.length > 12000) {toast.error(t('indicators.sheet.tooLong')); return}
    const finishDraft = recovery.afterSave()
    save.mutate({group, period, subject: row.materia_token, html, version: row.version}, {
      onSuccess: () => {finishDraft(); setEditing(false); toast.success(t('indicators.saved'), displayed ? 'updated' : 'success')},
      onError: error => toast.error(error instanceof ApiError ? Object.values(error.errors ?? {}).flat()[0] ?? error.message : error.message),
    })
  }
  const deleteIndicator = () => {
    remove.mutate({group, period, subject: row.materia_token, version: row.version}, {
      onSuccess: () => {setConfirmingDelete(false); toast.success(t('common.toast.deleted'), 'deleted')},
      onError: error => toast.error(error instanceof ApiError ? Object.values(error.errors ?? {}).flat()[0] ?? error.message : error.message),
    })
  }
  return <div className='group-indicator-description'>
    {recovery.notice}
    {editing ? <Fragment key='editing'>
      <div className='group-indicator-toolbar' role='toolbar' aria-label={t('indicators.sheet.format')}>
        {!source && <>
          <button type='button' className={`btn btn-sm btn-light${activeFormats.bold ? ' group-indicator-tool-active' : ''}`}
            aria-label={t('indicators.sheet.bold')} aria-pressed={activeFormats.bold}
            onMouseDown={event => event.preventDefault()} onClick={() => command('bold')}><strong>B</strong></button>
          <button type='button' className={`btn btn-sm btn-light${activeFormats.italic ? ' group-indicator-tool-active' : ''}`}
            aria-label={t('indicators.sheet.italic')} aria-pressed={activeFormats.italic}
            onMouseDown={event => event.preventDefault()} onClick={() => command('italic')}><em>I</em></button>
          <button type='button' className={`btn btn-sm btn-light${activeFormats.underline ? ' group-indicator-tool-active' : ''}`}
            aria-label={t('indicators.sheet.underline')} aria-pressed={activeFormats.underline}
            onMouseDown={event => event.preventDefault()} onClick={() => command('underline')}><u>U</u></button>
          <button type='button' className={`btn btn-sm btn-light${activeFormats.insertUnorderedList ? ' group-indicator-tool-active' : ''}`}
            aria-label={t('indicators.sheet.bullets')} aria-pressed={activeFormats.insertUnorderedList}
            onMouseDown={event => event.preventDefault()} onClick={() => command('insertUnorderedList')}>• {t('indicators.sheet.list')}</button>
          <button type='button' className={`btn btn-sm btn-light${activeFormats.insertOrderedList ? ' group-indicator-tool-active' : ''}`}
            aria-label={t('indicators.sheet.numbers')} aria-pressed={activeFormats.insertOrderedList}
            onMouseDown={event => event.preventDefault()} onClick={() => command('insertOrderedList')}>1. {t('indicators.sheet.list')}</button>
        </>}
        <button type='button' className={`btn btn-sm btn-light group-indicator-source${source ? ' group-indicator-tool-active' : ''}`} aria-pressed={source}
          onClick={toggleSource}>{source ? t('indicators.sheet.visual') : 'HTML'}</button>
      </div>
      {source ? <textarea className='group-indicator-source-editor' aria-label={t('indicators.sheet.htmlSource')}
        value={sourceHtml} onChange={event => {setSourceHtml(event.target.value); setPendingHtml(event.target.value)}} />
        : <div ref={editor} className='group-indicator-editor' contentEditable suppressContentEditableWarning
          role='textbox' aria-multiline='true' aria-label={`${t('indicators.sheet.description')}: ${row.materia}`}
          onInput={() => {sync(); refreshFormats()}} onKeyUp={refreshFormats} onMouseUp={refreshFormats}
          onPaste={event => {
            event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); sync(); refreshFormats()
          }} />}
      <div className='group-indicator-actions'>
        <button type='button' className='btn btn-sm btn-light' onClick={() => setEditing(false)}
          disabled={save.isPending}>{t('common.cancel')}</button>
        <button type='button' className='btn btn-sm btn-primary' onClick={submit}
          disabled={save.isPending}>{t('indicators.saveGroup')}</button>
      </div>
    </Fragment> : <Fragment key='preview'>
      {displayed ? <div className='group-indicator-rich' dangerouslySetInnerHTML={{__html: displayed}} />
        : <span className='text-muted'>{t('indicators.sheet.empty')}</span>}
      {row.puede_editar && (confirmingDelete ? <div className='group-indicator-delete-confirm' role='alert'>
        <span>{t('indicators.sheet.deleteConfirm')}</span>
        <button type='button' className='btn btn-sm btn-light' onClick={() => setConfirmingDelete(false)}
          disabled={remove.isPending}>{t('common.cancel')}</button>
        <button type='button' className='btn btn-sm btn-danger' onClick={deleteIndicator}
          disabled={remove.isPending}>{t('common.confirm')}</button>
      </div> : <div className='group-indicator-row-actions'>
        <button type='button' className='btn btn-sm btn-light-primary group-indicator-edit'
          onClick={start}>{displayed ? t('indicators.edit') : t('indicators.create')}</button>
        {displayed && <button type='button' className='btn btn-sm btn-light-danger' onClick={() => setConfirmingDelete(true)}>
          {t('indicators.sheet.delete')}</button>}
      </div>)}
    </Fragment>}
  </div>
}

export function GroupIndicatorSheet({group, period, subject, title}: {group: string; period: string; subject?: string; title?: string}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const sheet = useGroupIndicatorSheet(group, period)
  if (sheet.isLoading) return <div className='card card-body' role='status'>{t('common.pleaseWait')}</div>
  if (sheet.isError) return <div className='alert alert-danger' role='alert'>{sheet.error.message}</div>
  const rows = sheet.data?.materias.filter(row => !subject || row.materia_token === subject) ?? []
  return <div className='card'>
    {title && <div className='card-header'><h3 className='card-title'>{title}</h3></div>}
    <div className='card-body'>
    <div className='table-responsive group-indicator-frame'><table className='table align-middle group-indicator-table'>
      <thead><tr><th scope='col'>{t('indicators.subject')}</th><th scope='col'>{t('indicators.sheet.description')}</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.materia_token}>
        <th scope='row'>{row.materia}</th>
        <td><EditableDescription key={`${group}:${period}:${row.materia_token}:${row.version}`}
          row={row} group={group} period={period} /></td>
      </tr>)}</tbody>
    </table></div>
    {!rows.length && <div className='alert alert-info mb-0'>{t('indicators.noCurriculum')}</div>}
  </div></div>
}

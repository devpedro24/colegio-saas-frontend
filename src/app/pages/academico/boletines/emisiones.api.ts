import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuth} from '@/app/modules/auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'

export type IssueSelection = {contexto: 'periodo' | 'final'; periodo_token?: string; plantilla_token?: string | null}
export type BulletinIssue = {token: string; matricula_token: string; contexto: 'periodo' | 'final';
  periodo_token: string | null; revision: number; estado: 'preparado' | 'aprobado' | 'publicado' | 'sustituido' | 'descartado';
  plantilla: string | null; preparado_en: string | null; aprobado_en: string | null;
  publicado_en: string | null; pdf_disponible: boolean}
export type BulletinIssuesPage = {data: BulletinIssue[]; pagina: number; ultima_pagina: number; total: number}
export type IssuePreview = {contexto: string; huella_insumos: string; plantilla: string;
  resumen: {estudiante: {nombre: string; grado: string; grupo: string}; asignaturas: number;
    indicadores: number; observacion: boolean}}

function useScope() {
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  return [currentUser?.tenant_channel ?? '', activeColegio?.slug ?? '', currentUser?.id ?? ''] as const
}

export function useBulletinIssues(enrollmentToken: string, page = 1) {
  const scope = useScope()
  return useQuery({queryKey: ['boletines', 'emisiones', ...scope, enrollmentToken, page], enabled: !!enrollmentToken,
    queryFn: () => api.get<BulletinIssuesPage>(`/boletines/emisiones/${encodeURIComponent(enrollmentToken)}?opaque=1&page=${page}`)})
}

export function useIssueActions(enrollmentToken: string) {
  const client = useQueryClient()
  const scope = useScope()
  const refresh = () => {void client.invalidateQueries({queryKey: ['boletines', 'emisiones', ...scope, enrollmentToken]})}
  const base = `/boletines/emisiones/${encodeURIComponent(enrollmentToken)}`
  const document = (token: string) => `/boletines/emisiones/documentos/${encodeURIComponent(token)}`
  return {
    preview: useMutation({mutationFn: (selection: IssueSelection) => {
      const params = new URLSearchParams({opaque: '1', contexto: selection.contexto})
      if (selection.periodo_token) params.set('periodo_token', selection.periodo_token)
      if (selection.plantilla_token) params.set('plantilla_token', selection.plantilla_token)
      return api.get<{data: IssuePreview}>(`${base}/preparacion?${params}`).then(result => result.data)
    }}),
    prepare: useMutation({mutationFn: (selection: IssueSelection) =>
      api.post<{data: BulletinIssue}>(`${base}/preparar?opaque=1`, selection).then(result => result.data), onSuccess: refresh}),
    approve: useMutation({mutationFn: (token: string) =>
      api.post<{data: BulletinIssue}>(`${document(token)}/aprobar?opaque=1`).then(result => result.data), onSuccess: refresh}),
    publish: useMutation({mutationFn: (token: string) =>
      api.post<{data: BulletinIssue}>(`${document(token)}/publicar?opaque=1`).then(result => result.data), onSuccess: refresh}),
  }
}

export function bulletinPdfUrl(token: string) {
  return `/api/boletines/emisiones/documentos/${encodeURIComponent(token)}/pdf?opaque=1`
}

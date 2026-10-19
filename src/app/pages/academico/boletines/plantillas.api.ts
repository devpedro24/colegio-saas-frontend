import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuth} from '@/app/modules/auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'

export type TemplateScope = 'periodo' | 'final'
export type TemplateSectionKey = 'student' | 'areas' | 'subjects' | 'indicators' | 'observations' | 'attendance' | 'signature'
export type TemplateSection = {key: TemplateSectionKey; visible: boolean}
export type TemplateDesign = {
  accent: string
  font: 'sans' | 'serif' | 'rounded'
  density: 'comfortable' | 'compact'
  heading: string
  subheading: string
  sections: TemplateSection[]
}
export type SavedTemplate = {token: string; nombre: string; ambito: TemplateScope; configuracion: TemplateDesign;
  version: number; revision_publicada: number | null; actualizado_en: string}
export type TemplateCatalog = {colegio: string; puede_editar: boolean;
  base: Record<TemplateScope, TemplateDesign>; plantillas: SavedTemplate[];
  pagina: number; ultima_pagina: number; total: number}
export type TemplateInput = {nombre: string; ambito: TemplateScope; configuracion: TemplateDesign}

function useScope() {
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  return [currentUser?.tenant_channel ?? '', activeColegio?.slug ?? '', currentUser?.id ?? ''] as const
}

export function useTemplateCatalog(page = 1, enabled = true) {
  const scope = useScope()
  return useQuery({queryKey: ['boletines', 'plantillas', ...scope, page], enabled,
    queryFn: () => api.get<{data: TemplateCatalog}>(`/boletines/plantillas?opaque=1&page=${page}`).then(result => result.data)})
}

export function useTemplateActions() {
  const client = useQueryClient()
  const refresh = () => {void client.invalidateQueries({queryKey: ['boletines', 'plantillas']})}
  return {
    create: useMutation({mutationFn: (input: TemplateInput) => api.post<{data: SavedTemplate}>('/boletines/plantillas?opaque=1', input)
      .then(result => result.data), onSuccess: refresh}),
    save: useMutation({mutationFn: ({token, input}: {token: string; input: TemplateInput & {version: number}}) =>
      api.put<{data: SavedTemplate}>(`/boletines/plantillas/${encodeURIComponent(token)}?opaque=1`, input)
        .then(result => result.data), onSuccess: refresh}),
    publish: useMutation({mutationFn: ({token, input}: {token: string; input: TemplateInput & {version: number}}) =>
      api.post<{data: SavedTemplate}>(`/boletines/plantillas/${encodeURIComponent(token)}/publicar?opaque=1`, input)
        .then(result => result.data), onSuccess: refresh}),
  }
}

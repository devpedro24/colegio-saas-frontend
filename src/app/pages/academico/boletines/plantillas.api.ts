import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
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
  canvas?: CanvasDocument
}
export type CanvasDocument = {id: string; name?: string; scope: TemplateScope; pages: unknown[]; assets?: Record<string, string>; [key: string]: unknown}
export type TemplateInstitution = {name: string; logo?: string; nit?: string; dane?: string; resolution?: string;
  address?: string; phone?: string; email?: string; principal?: string; year?: string; periods?: number; annual?: boolean;
  scaleLegend?: string; performanceRanges?: {nombre: string; desde: string; hasta: string}[]}
export type SavedTemplate = {token: string; nombre: string; ambito: TemplateScope; configuracion: TemplateDesign;
  version: number; revision_publicada: number | null; actualizado_en: string}
export type TemplateCatalog = {colegio: string; puede_editar: boolean;
  institucion?: TemplateInstitution;
  plantillas: SavedTemplate[];
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

export function usePublishedTemplates(context: TemplateScope, enabled = true) {
  const scope = useScope()
  return useInfiniteQuery({queryKey: ['boletines', 'plantillas', ...scope, 'published', context], enabled,
    initialPageParam: 1,
    queryFn: ({pageParam}) => api.get<{data: TemplateCatalog}>(`/boletines/plantillas?opaque=1&publicadas=1&ambito=${context}&page=${pageParam}`).then(result => result.data),
    getNextPageParam: page => page.pagina < page.ultima_pagina ? page.pagina + 1 : undefined})
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
    remove: useMutation({mutationFn: ({token, version}: {token: string; version: number}) =>
      api.delete<{data: {eliminada: boolean}}>(`/boletines/plantillas/${encodeURIComponent(token)}?opaque=1&version=${version}`)
        .then(result => result.data), onSuccess: refresh}),
  }
}

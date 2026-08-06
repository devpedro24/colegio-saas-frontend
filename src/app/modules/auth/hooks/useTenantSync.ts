import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../core/Auth'
import { getEcho } from '@/lib/echo'
import { SEDES_KEY } from '@/app/pages/academico/estructura/estructura.api'
import { ANOS_LECTIVOS_KEY } from '@/app/pages/academico/anos-lectivos/anos-lectivos.api'
import { USUARIOS_KEY } from '@/app/pages/usuarios/usuarios.api'

type EntityQueryMap = Record<string, readonly string[]>

/**
 * Escucha el canal privado del tenant y reacciona a eventos `.changed`
 * (CRUD genérico de cualquier entidad) y `.configuracion.heredada`
 * (herencia de configuración del colegio a sede).
 *
 * @param extraKeys — query keys adicionales específicas de la página.
 *   Ej: { ano_lectivo: ANOS_LECTIVOS_KEY, periodo: PERIODOS_KEY }
 */
export function useTenantSync(extraKeys: EntityQueryMap = {}) {
  const { currentUser } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    const tenantId = currentUser?.tenant_id
    if (!tenantId) return

    const echo = getEcho()
    if (!echo) return

    const channel = echo.private(`tenant.${tenantId}`)

    const entityKeys: Record<string, readonly string[]> = {
      sede: SEDES_KEY,
      usuario: USUARIOS_KEY,
      ano_lectivo: ANOS_LECTIVOS_KEY,
      periodo: ANOS_LECTIVOS_KEY,
      nivel: ['estructura', 'niveles'],
      grado: ['estructura', 'grados'],
      grupo: ['estructura', 'grupos'],
      jornada: ['estructura', 'jornadas'],
      bloque_horario: ['estructura', 'bloques-horarios'],
      espacio_fisico: ['estructura', 'espacios-fisicos'],
      escala: ['config', 'escalas'],
      metodo: ['config', 'metodos-aprobacion'],
      modelo: ['config', 'modelos-pedagogicos'],
      datos_institucionales: ['config', 'datos-institucionales'],
      ...extraKeys,
    }

    const handleChanged = (payload: { entity?: string; action?: string }) => {
      if (!payload.entity) return
      const key = entityKeys[payload.entity]
      if (key) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    }

    const handleHeredada = () => {
      for (const key of Object.values(entityKeys)) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    }

    channel.listen('.changed', handleChanged)
    channel.listen('.configuracion.heredada', handleHeredada)
    channel.listen('.sede.creada', handleHeredada)

    return () => {
      channel.stopListening('.changed', handleChanged)
      channel.stopListening('.configuracion.heredada', handleHeredada)
      channel.stopListening('.sede.creada', handleHeredada)
      echo.leaveChannel(`tenant.${tenantId}`)
    }
  }, [currentUser?.tenant_id, queryClient]) // eslint-disable-line react-hooks/exhaustive-deps
}

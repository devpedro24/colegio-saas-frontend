import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import es from './feedback.es.json'
import en from './feedback.en.json'

type Message = keyof typeof es

export function aulaErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError) {
    const reason = Object.values(cause.errors ?? {}).flat().find(message => message.trim())
    if (reason) return reason
  }
  return cause instanceof Error && cause.message.trim() ? cause.message : fallback
}

/** Aula is lazy loaded with EvaluacionPage; these dictionaries stay out of global messages. */
export function useAulaFeedback() {
  const {locale} = useIntl()
  const toast = useToast()
  const messages: Record<Message, string> = locale.startsWith('en') ? en : es
  const text = (id: Message) => messages[id]
  return {
    text,
    success: (id: Message, variant: 'success' | 'updated' | 'deleted' = 'updated') => toast.success(text(id), variant),
    error: (cause: unknown, fallback: Message) => toast.error(aulaErrorMessage(cause, text(fallback))),
  }
}

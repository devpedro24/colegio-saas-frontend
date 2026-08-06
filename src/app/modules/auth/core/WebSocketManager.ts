import { useWebSocketSync } from '../hooks/useWebSocketSync'
import { usePlatformSync } from '../hooks/usePlatformSync'

export function WebSocketManager() {
  useWebSocketSync()
  usePlatformSync()

  return null
}

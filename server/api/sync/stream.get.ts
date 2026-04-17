import { getSubscriber, cacheKeys } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const query = getQuery(event)
  const clientDeviceId = query.deviceId ? String(query.deviceId) : null

  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  const channel = cacheKeys.syncChannel(userId)
  const subscriber = getSubscriber()

  const responseStream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null

      function send(eventType: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Controller may be closed
        }
      }

      // Subscribe to sync channel
      subscriber.subscribe(channel).catch((err) => {
        console.error('SSE subscribe error:', err)
      })

      subscriber.on('message', (ch, message) => {
        if (ch !== channel) return
        try {
          const parsed = JSON.parse(message)
          // Skip echo-back: don't notify the device that sent the change
          if (clientDeviceId && parsed.deviceId === clientDeviceId) return
          send('sync', parsed)
        } catch {
          // Malformed message
        }
      })

      // Heartbeat every 30s
      heartbeatTimer = setInterval(() => {
        send('ping', { time: Date.now() })
      }, 30000)

      // Send initial connected event (no internal details)
      send('connected', { status: 'ok' })

      // Cleanup on disconnect
      event.node.req.on('close', () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer)
        subscriber.unsubscribe(channel).catch(() => {})
      })
    }
  })

  return sendStream(event, responseStream as unknown as ReadableStream<any>)
})

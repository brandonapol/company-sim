import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { chat, listModels } from './providers.ts'

const SHUTDOWN_GRACE_MS = 10_000

const emit = (event: string, fields: Record<string, unknown> = {}) => {
  console.info(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }))
}

const config = loadConfig(process.env)

const app = createApp({
  config,
  upstream: { chat, listModels },
  log: (entry) => emit('request', entry),
})

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, () => {
  emit('listening', { host: config.host, port: config.port, version: config.version, auth: config.password !== '' })
  if (!config.password)
    emit('warning', { message: 'APP_PASSWORD is not set: auth is off and only localhost can connect' })
})

const shutdown = (signal: string) => {
  emit('shutdown', { signal })
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { basicAuth } from 'hono/basic-auth'
import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { REAL_PROVIDERS } from '../src/shared/api.ts'
import type { ChatRequest, ChatResponse, HealthResponse, RealProvider } from '../src/shared/api.ts'
import type { Config } from './config.ts'

export type Upstream = {
  chat: (key: string, request: ChatRequest) => Promise<ChatResponse>
  listModels: (provider: RealProvider, key: string) => Promise<string[]>
}

export type LogEntry = { method: string; path: string; status: number; ms: number }

export type Deps = { config: Config; upstream: Upstream; log: (entry: LogEntry) => void }

const MAX_BODY_BYTES = 512 * 1024

const isProvider = (value: unknown): value is RealProvider =>
  typeof value === 'string' && (REAL_PROVIDERS as string[]).includes(value)

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

export const createApp = ({ config, upstream, log }: Deps) => {
  const app = new Hono()
  const resolveKey = (provider: RealProvider, header: string | undefined) => header?.trim() || config.keys[provider]

  app.use('*', secureHeaders())

  app.get('/healthz', (c) => c.json({ ok: true, version: config.version }))

  app.use('/api/*', async (c, next) => {
    const started = performance.now()
    await next()
    log({ method: c.req.method, path: c.req.path, status: c.res.status, ms: Math.round(performance.now() - started) })
  })

  if (config.password) {
    app.use('*', basicAuth({ username: config.username, password: config.password, realm: 'company-sim' }))
  }

  app.use('/api/*', bodyLimit({ maxSize: MAX_BODY_BYTES }))

  app.get('/api/health', (c) =>
    c.json<HealthResponse>({
      ok: true,
      version: config.version,
      serverKeys: { anthropic: !!config.keys.anthropic, openai: !!config.keys.openai, xai: !!config.keys.xai },
    }),
  )

  app.post('/api/chat', async (c) => {
    const body = (await c.req.json().catch(() => null)) as Partial<ChatRequest> | null
    if (!body || !isProvider(body.provider) || !body.model || typeof body.prompt !== 'string') {
      return c.json({ error: 'Bad request' }, 400)
    }
    const key = resolveKey(body.provider, c.req.header('x-llm-key'))
    if (!key) return c.json({ error: `No API key configured for ${body.provider}` }, 400)
    const request: ChatRequest = {
      provider: body.provider,
      model: body.model,
      system: typeof body.system === 'string' ? body.system : '',
      prompt: body.prompt,
      maxTokens: Math.min(Math.max(Number(body.maxTokens) || 300, 50), 8000),
      effort: body.effort === 'medium' || body.effort === 'high' ? body.effort : 'low',
    }
    try {
      return c.json(await upstream.chat(key, request))
    } catch (err) {
      return c.json({ error: errorMessage(err) }, 502)
    }
  })

  app.post('/api/models', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { provider?: unknown } | null
    if (!body || !isProvider(body.provider)) return c.json({ error: 'Bad request' }, 400)
    const key = resolveKey(body.provider, c.req.header('x-llm-key'))
    if (!key) return c.json({ error: `No API key configured for ${body.provider}` }, 400)
    try {
      return c.json({ models: await upstream.listModels(body.provider, key) })
    } catch (err) {
      return c.json({ error: errorMessage(err) }, 502)
    }
  })

  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404))

  app.use('/*', serveStatic({ root: config.staticRoot }))
  app.get('*', async (c) => {
    const html = await readFile(join(config.staticRoot, 'index.html'), 'utf8').catch(() => null)
    return html ? c.html(html) : c.text('UI not built yet. Run `make build`, or use `make watch`.', 404)
  })

  return app
}

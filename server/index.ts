import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { basicAuth } from 'hono/basic-auth'
import { bodyLimit } from 'hono/body-limit'
import { readFile } from 'node:fs/promises'
import { REAL_PROVIDERS } from '../src/shared/api.ts'
import type { ChatRequest, HealthResponse, RealProvider } from '../src/shared/api.ts'
import { chat, listModels } from './providers.ts'

const env = process.env
const password = env.APP_PASSWORD ?? ''
const username = env.APP_USER ?? 'ceo'
const port = Number(env.PORT ?? 8787)
const host = env.HOST ?? (password ? '0.0.0.0' : '127.0.0.1')

const ENV_KEYS: Record<RealProvider, string | undefined> = {
  anthropic: env.ANTHROPIC_API_KEY,
  openai: env.OPENAI_API_KEY,
  xai: env.XAI_API_KEY,
}

const isProvider = (value: unknown): value is RealProvider =>
  typeof value === 'string' && (REAL_PROVIDERS as string[]).includes(value)

const resolveKey = (provider: RealProvider, header: string | undefined) => header?.trim() || ENV_KEYS[provider] || ''

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

const app = new Hono()

if (password) app.use('*', basicAuth({ username, password, realm: 'company-sim' }))

app.use('/api/*', bodyLimit({ maxSize: 512 * 1024 }))

app.get('/api/health', (c) =>
  c.json<HealthResponse>({
    ok: true,
    serverKeys: { anthropic: !!ENV_KEYS.anthropic, openai: !!ENV_KEYS.openai, xai: !!ENV_KEYS.xai },
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
    model: String(body.model),
    system: String(body.system ?? ''),
    prompt: body.prompt,
    maxTokens: Math.min(Math.max(Number(body.maxTokens) || 300, 50), 8000),
    effort: body.effort === 'medium' || body.effort === 'high' ? body.effort : 'low',
  }
  try {
    return c.json(await chat(key, request))
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
    return c.json({ models: await listModels(body.provider, key) })
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 502)
  }
})

app.use('/*', serveStatic({ root: './dist' }))
app.get('*', async (c) => {
  const html = await readFile('./dist/index.html', 'utf8').catch(() => null)
  return html ? c.html(html) : c.text('UI not built yet. Run `npm run build`, or use `npm run dev`.', 404)
})

serve({ fetch: app.fetch, port, hostname: host }, () => {
  console.log(`company-sim listening on http://${host}:${port}`)
  if (!password) console.log('APP_PASSWORD is not set: auth is off and the server only listens on localhost.')
})

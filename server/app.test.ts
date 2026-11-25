import { describe, expect, it } from 'vitest'
import type { ChatRequest } from '../src/shared/api.ts'
import { createApp } from './app.ts'
import type { LogEntry, Upstream } from './app.ts'
import { loadConfig } from './config.ts'

const basic = (user: string, pass: string) => ({ authorization: `Basic ${btoa(`${user}:${pass}`)}` })

const setup = (env: Record<string, string> = {}, upstream: Partial<Upstream> = {}) => {
  const calls: { key: string; request: ChatRequest }[] = []
  const logs: LogEntry[] = []
  const app = createApp({
    config: loadConfig({ APP_PASSWORD: 'pw', APP_VERSION: '1.2.3', STATIC_ROOT: './does-not-exist', ...env }),
    upstream: {
      chat: (key, request) => {
        calls.push({ key, request })
        return Promise.resolve({ text: 'hi', inputTokens: 3, outputTokens: 2 })
      },
      listModels: () => Promise.resolve(['model-a']),
      ...upstream,
    },
    log: (entry) => logs.push(entry),
  })
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...basic('ceo', 'pw'), ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  return { app, calls, logs, post }
}

const chatBody = { provider: 'anthropic', model: 'm', system: 's', prompt: 'p', maxTokens: 100, effort: 'low' }

describe('auth', () => {
  it('rejects requests without credentials', async () => {
    const { app } = setup()
    expect((await app.request('/api/health')).status).toBe(401)
    expect((await app.request('/')).status).toBe(401)
  })

  it('rejects a wrong password', async () => {
    const { app } = setup()
    expect((await app.request('/api/health', { headers: basic('ceo', 'nope') })).status).toBe(401)
  })

  it('keeps /healthz open for probes and leaks nothing but the version', async () => {
    const { app } = setup({ ANTHROPIC_API_KEY: 'server-key' })
    const res = await app.request('/healthz')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, version: '1.2.3' })
  })

  it('reports which providers have a server key without revealing the key', async () => {
    const { app } = setup({ ANTHROPIC_API_KEY: 'server-key' })
    const res = await app.request('/api/health', { headers: basic('ceo', 'pw') })
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({
      ok: true,
      version: '1.2.3',
      serverKeys: { anthropic: true, openai: false, xai: false },
    })
    expect(text).not.toContain('server-key')
  })
})

describe('config', () => {
  it('binds to localhost when there is no password', () => {
    expect(loadConfig({}).host).toBe('127.0.0.1')
    expect(loadConfig({ APP_PASSWORD: 'x' }).host).toBe('0.0.0.0')
  })

  it('refuses a nonsense port', () => {
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/PORT/)
  })
})

describe('POST /api/chat', () => {
  it('forwards the browser key and returns the reply', async () => {
    const { post, calls } = setup()
    const res = await post('/api/chat', chatBody, { 'x-llm-key': ' browser-key ' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'hi', inputTokens: 3, outputTokens: 2 })
    expect(calls[0]?.key).toBe('browser-key')
  })

  it('falls back to the server key', async () => {
    const { post, calls } = setup({ ANTHROPIC_API_KEY: 'server-key' })
    await post('/api/chat', chatBody)
    expect(calls[0]?.key).toBe('server-key')
  })

  it('says so when no key exists anywhere', async () => {
    const { post, calls } = setup()
    const res = await post('/api/chat', chatBody)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'No API key configured for anthropic' })
    expect(calls).toHaveLength(0)
  })

  it('only talks to known providers', async () => {
    const { post } = setup()
    expect(
      (await post('/api/chat', { ...chatBody, provider: 'https://evil.example' }, { 'x-llm-key': 'k' })).status,
    ).toBe(400)
  })

  it('rejects malformed JSON', async () => {
    const { post } = setup()
    expect((await post('/api/chat', '{not json', { 'x-llm-key': 'k' })).status).toBe(400)
  })

  it('clamps the token limit and defaults effort', async () => {
    const { post, calls } = setup()
    await post('/api/chat', { ...chatBody, maxTokens: 9_999_999, effort: 'max' }, { 'x-llm-key': 'k' })
    expect(calls[0]?.request.maxTokens).toBe(8000)
    expect(calls[0]?.request.effort).toBe('low')
  })

  it('turns an upstream failure into a 502 with the reason', async () => {
    const { post } = setup({}, { chat: () => Promise.reject(new Error('xai 429: slow down')) })
    const res = await post('/api/chat', chatBody, { 'x-llm-key': 'k' })
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: 'xai 429: slow down' })
  })

  it('refuses oversized bodies', async () => {
    const { post } = setup()
    const res = await post('/api/chat', { ...chatBody, prompt: 'x'.repeat(600 * 1024) }, { 'x-llm-key': 'k' })
    expect(res.status).toBe(413)
  })

  it('logs each API request without the key or the prompt', async () => {
    const { post, logs } = setup()
    await post('/api/chat', { ...chatBody, prompt: 'secret plan' }, { 'x-llm-key': 'browser-key' })
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ method: 'POST', path: '/api/chat', status: 200 })
    expect(JSON.stringify(logs)).not.toMatch(/browser-key|secret plan/)
  })
})

describe('other routes', () => {
  it('lists models', async () => {
    const { post } = setup()
    const res = await post('/api/models', { provider: 'xai' }, { 'x-llm-key': 'k' })
    expect(await res.json()).toEqual({ models: ['model-a'] })
  })

  it('returns JSON 404 for unknown API paths', async () => {
    const { app } = setup()
    const res = await app.request('/api/nope', { headers: basic('ceo', 'pw') })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
  })

  it('sets security headers', async () => {
    const { app } = setup()
    const res = await app.request('/healthz')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
  })

  it('explains itself when the UI has not been built', async () => {
    const { app } = setup()
    const res = await app.request('/', { headers: basic('ceo', 'pw') })
    expect(res.status).toBe(404)
    expect(await res.text()).toContain('make build')
  })
})

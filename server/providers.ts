import Anthropic from '@anthropic-ai/sdk'
import type { ChatRequest, ChatResponse, RealProvider } from '../src/shared/api.ts'

const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

const supportsFallbacks = (model: string) =>
  ['claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5'].includes(model)

const THINKING_HEADROOM = 3000

const anthropicChat = async (key: string, req: ChatRequest): Promise<ChatResponse> => {
  const client = new Anthropic({ apiKey: key, maxRetries: 1 })
  const base = {
    model: req.model,
    max_tokens: req.maxTokens + THINKING_HEADROOM,
    system: req.system,
    messages: [{ role: 'user' as const, content: req.prompt }],
  }
  const send = (withEffort: boolean) =>
    client.beta.messages.create({
      ...base,
      ...(withEffort ? { output_config: { effort: req.effort } } : {}),
      ...(supportsFallbacks(req.model) ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
    })
  const response = await send(true).catch((err: unknown) => {
    if (err instanceof Anthropic.BadRequestError && /effort|output_config/i.test(err.message)) return send(false)
    throw err
  })
  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
    .trim()
  const usage = response.usage
  return {
    text: response.stop_reason === 'refusal' && !text ? '(declined to answer this one)' : text,
    inputTokens:
      usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
  }
}

const anthropicModels = async (key: string): Promise<string[]> => {
  const client = new Anthropic({ apiKey: key, maxRetries: 1 })
  const ids: string[] = []
  for await (const model of client.models.list()) ids.push(model.id)
  return ids
}

const OPENAI_STYLE_BASE: Record<Exclude<RealProvider, 'anthropic'>, string> = {
  openai: 'https://api.openai.com/v1',
  xai: 'https://api.x.ai/v1',
}

type ResponsesPayload = {
  output?: { type: string; content?: { type: string; text?: string }[] }[]
  usage?: { input_tokens?: number; output_tokens?: number }
  error?: { message?: string } | string | null
}

const upstreamError = async (provider: string, res: Response) => {
  const body = await res.text()
  const message = (() => {
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } | string }
      return typeof parsed.error === 'string' ? parsed.error : (parsed.error?.message ?? body)
    } catch {
      return body
    }
  })()
  return new Error(`${provider} ${res.status}: ${message.slice(0, 400)}`)
}

const openaiStyleChat = async (
  provider: Exclude<RealProvider, 'anthropic'>,
  key: string,
  req: ChatRequest,
): Promise<ChatResponse> => {
  const res = await fetch(`${OPENAI_STYLE_BASE[provider]}/responses`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: req.model,
      input: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.prompt },
      ],
      max_output_tokens: req.maxTokens + THINKING_HEADROOM,
      ...(provider === 'openai' ? { store: false } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw await upstreamError(provider, res)
  const data = (await res.json()) as ResponsesPayload
  const text = (data.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .flatMap((part) => (part.type === 'output_text' && part.text ? [part.text] : []))
    .join('')
    .trim()
  return {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  }
}

const openaiStyleModels = async (provider: Exclude<RealProvider, 'anthropic'>, key: string) => {
  const res = await fetch(`${OPENAI_STYLE_BASE[provider]}/models`, {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw await upstreamError(provider, res)
  const data = (await res.json()) as { data?: { id: string }[] }
  return (data.data ?? []).map((model) => model.id).sort()
}

export const chat = (key: string, req: ChatRequest): Promise<ChatResponse> =>
  req.provider === 'anthropic' ? anthropicChat(key, req) : openaiStyleChat(req.provider, key, req)

export const listModels = (provider: RealProvider, key: string): Promise<string[]> =>
  provider === 'anthropic' ? anthropicModels(key) : openaiStyleModels(provider, key)

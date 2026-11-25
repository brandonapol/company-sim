import type { ChatRequest, ChatResponse, HealthResponse, ModelsResponse, RealProvider } from '../shared/api.ts'

const post = async <T,>(path: string, body: unknown, key: string): Promise<T> => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key.trim() ? { 'x-llm-key': key.trim() } : {}) },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({ error: `Server returned ${res.status}` }))) as T & { error?: string }
  if (!res.ok || data.error) throw new Error(data.error ?? `Server returned ${res.status}`)
  return data
}

export const postChat = (request: ChatRequest, key: string) => post<ChatResponse>('/api/chat', request, key)

export const postModels = (provider: RealProvider, key: string) =>
  post<ModelsResponse>('/api/models', { provider }, key).then((r) => r.models)

export const getHealth = async (): Promise<HealthResponse | null> => {
  try {
    const res = await fetch('/api/health')
    return res.ok ? ((await res.json()) as HealthResponse) : null
  } catch {
    return null
  }
}

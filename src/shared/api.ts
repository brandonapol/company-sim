export type RealProvider = 'anthropic' | 'openai' | 'xai'

export type Effort = 'low' | 'medium' | 'high'

export type ChatRequest = {
  provider: RealProvider
  model: string
  system: string
  prompt: string
  maxTokens: number
  effort: Effort
}

export type ChatResponse = {
  text: string
  inputTokens: number
  outputTokens: number
}

export type HealthResponse = {
  ok: true
  version: string
  serverKeys: Record<RealProvider, boolean>
}

export type ModelsResponse = { models: string[] }

export type ErrorResponse = { error: string }

export const REAL_PROVIDERS: RealProvider[] = ['anthropic', 'openai', 'xai']

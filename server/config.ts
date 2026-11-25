import { readFileSync } from 'node:fs'
import type { RealProvider } from '../src/shared/api.ts'

export type Config = {
  username: string
  password: string
  port: number
  host: string
  version: string
  staticRoot: string
  keys: Record<RealProvider, string>
}

type Env = Record<string, string | undefined>

const packageVersion = (): string => {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export const loadConfig = (env: Env): Config => {
  const password = env.APP_PASSWORD ?? ''
  const port = Number(env.PORT ?? 8787)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a number between 1 and 65535, got "${env.PORT ?? ''}"`)
  }
  return {
    username: env.APP_USER ?? 'ceo',
    password,
    port,
    host: env.HOST ?? (password ? '0.0.0.0' : '127.0.0.1'),
    version: env.APP_VERSION?.trim() || `${packageVersion()}-dev`,
    staticRoot: env.STATIC_ROOT ?? './dist',
    keys: {
      anthropic: env.ANTHROPIC_API_KEY ?? '',
      openai: env.OPENAI_API_KEY ?? '',
      xai: env.XAI_API_KEY ?? '',
    },
  }
}

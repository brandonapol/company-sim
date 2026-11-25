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

const readText = (relative: string): string | null => {
  try {
    return readFileSync(new URL(relative, import.meta.url), 'utf8')
  } catch {
    return null
  }
}

const fallbackVersion = (): string => {
  const released = readText('../VERSION')?.trim()
  if (released) return released
  const pkg = readText('../package.json')
  const version = pkg ? (JSON.parse(pkg) as { version?: string }).version : undefined
  return `${version ?? '0.0.0'}-dev`
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
    version: env.APP_VERSION?.trim() || fallbackVersion(),
    staticRoot: env.STATIC_ROOT ?? './dist',
    keys: {
      anthropic: env.ANTHROPIC_API_KEY ?? '',
      openai: env.OPENAI_API_KEY ?? '',
      xai: env.XAI_API_KEY ?? '',
    },
  }
}

import { useSyncExternalStore } from 'react'
import { emptyState } from '../domain/seed.ts'
import type { State } from '../domain/types.ts'
import { loadValue, saveValue } from '../lib/storage.ts'
import type { RealProvider } from '../shared/api.ts'

export type View =
  | { kind: 'channel'; id: string }
  | { kind: 'company' }
  | { kind: 'people' }
  | { kind: 'hiring' }
  | { kind: 'curriculum' }
  | { kind: 'decisions' }
  | { kind: 'mentor' }
  | { kind: 'settings' }

export type Ui = {
  loaded: boolean
  typing: Record<string, string[]>
  busy: string | null
  notice: string | null
  serverKeys: Record<RealProvider, boolean>
  serverUp: boolean
  serverVersion: string
  view: View
}

export type Snapshot = { state: State; ui: Ui }

const STATE_KEY = 'state'
const SAVE_DELAY_MS = 400

let snapshot: Snapshot = {
  state: emptyState(),
  ui: {
    loaded: false,
    typing: {},
    busy: null,
    notice: null,
    serverKeys: { anthropic: false, openai: false, xai: false },
    serverUp: true,
    serverVersion: '',
    view: { kind: 'channel', id: 'leadership' },
  },
}

const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | undefined

const emit = () => listeners.forEach((listener) => listener())

const scheduleSave = () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveValue(STATE_KEY, snapshot.state).catch((err: unknown) => console.error('save failed', err))
  }, SAVE_DELAY_MS)
}

export const get = () => snapshot

export const update = (fn: (state: State) => State) => {
  snapshot = { ...snapshot, state: fn(snapshot.state) }
  if (snapshot.ui.loaded) scheduleSave()
  emit()
}

export const updateUi = (fn: (ui: Ui) => Ui) => {
  snapshot = { ...snapshot, ui: fn(snapshot.ui) }
  emit()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useStore = () => useSyncExternalStore(subscribe, get)

const migrate = (saved: State): State => {
  const base = emptyState()
  return {
    ...base,
    ...saved,
    settings: {
      ...base.settings,
      ...saved.settings,
      providers: { ...base.settings.providers, ...saved.settings?.providers },
      mentor: { ...base.settings.mentor, ...saved.settings?.mentor },
    },
  }
}

export const hydrate = async () => {
  const saved = await loadValue<State>(STATE_KEY).catch(() => undefined)
  snapshot = {
    state: saved && saved.version === 1 ? migrate(saved) : snapshot.state,
    ui: { ...snapshot.ui, loaded: true },
  }
  emit()
}

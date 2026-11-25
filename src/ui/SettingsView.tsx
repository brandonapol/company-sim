import { useState } from 'react'
import { ACTIVITY_LABEL, REPLIES_PER_POST, UNPROMPTED_PER_WEEK, tokensToday } from '../domain/engine.ts'
import type { Activity, State } from '../domain/types.ts'
import {
  exportState,
  fetchModels,
  importState,
  refreshHealth,
  resetAll,
  testProvider,
  updateSettings,
} from '../state/actions.ts'
import type { Ui } from '../state/store.ts'
import { REAL_PROVIDERS } from '../shared/api.ts'
import type { RealProvider } from '../shared/api.ts'
import { Field, NumberInput, useNow } from './bits.tsx'

const PROVIDER_LABEL: Record<RealProvider, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'Codex / GPT (OpenAI)',
  xai: 'Grok (xAI)',
}

const ProviderCard = ({ provider, state, ui }: { provider: RealProvider; state: State; ui: Ui }) => {
  const config = state.settings.providers[provider]
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const set = (patch: Partial<typeof config>) =>
    updateSettings((s) => ({ ...s, providers: { ...s.providers, [provider]: { ...s.providers[provider], ...patch } } }))
  const assigned = state.people.filter((p) => p.status === 'active' && p.provider === provider).length
  return (
    <div className="card">
      <div className="row between">
        <h3>{PROVIDER_LABEL[provider]}</h3>
        <label className="check">
          <input type="checkbox" checked={config.enabled} onChange={(e) => set({ enabled: e.target.checked })} />{' '}
          Enabled
        </label>
      </div>
      <Field
        label="API key"
        hint={
          ui.serverKeys[provider]
            ? 'The server also has a key for this provider; leave blank to use it.'
            : 'Kept in this browser only and sent to your own server with each request.'
        }
      >
        <input type="password" value={config.key} autoComplete="off" onChange={(e) => set({ key: e.target.value })} />
      </Field>
      <Field label="Model for employees">
        <input value={config.model} list={`models-${provider}`} onChange={(e) => set({ model: e.target.value })} />
        <datalist id={`models-${provider}`}>
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
      <div className="row">
        <button
          onClick={() => {
            setStatus('Loading models')
            fetchModels(provider)
              .then((list) => {
                setModels(list)
                setStatus(`${list.length} models available. Click the model field to pick one.`)
              })
              .catch((err: unknown) => setStatus(err instanceof Error ? err.message : String(err)))
          }}
        >
          List models
        </button>
        <button
          onClick={() => {
            setStatus('Testing')
            void testProvider(provider).then(setStatus)
          }}
        >
          Test
        </button>
        <span className="muted">{assigned} employees on this provider</span>
      </div>
      {status ? <p className="hint">{status}</p> : null}
    </div>
  )
}

const UsageTable = ({ state }: { state: State }) => {
  const days = Object.keys(state.usage).sort().slice(-7).reverse()
  if (days.length === 0) return <p className="muted">No model calls yet.</p>
  return (
    <table>
      <thead>
        <tr>
          <th>Day</th>
          <th>Provider</th>
          <th>Calls</th>
          <th>Input tokens</th>
          <th>Output tokens</th>
        </tr>
      </thead>
      <tbody>
        {days.flatMap((day) =>
          Object.entries(state.usage[day] ?? {}).map(([provider, cell]) => (
            <tr key={`${day}-${provider}`}>
              <td>{day}</td>
              <td>{provider}</td>
              <td>{cell?.calls}</td>
              <td>{cell?.input.toLocaleString()}</td>
              <td>{cell?.output.toLocaleString()}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  )
}

export const SettingsView = ({ state, ui }: { state: State; ui: Ui }) => {
  const s = state.settings
  const now = useNow()
  const [importStatus, setImportStatus] = useState('')
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportState()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `company-sim-week-${state.company.week}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="page">
      <h2>Settings {ui.serverVersion ? <span className="muted">version {ui.serverVersion}</span> : null}</h2>
      <div className="card">
        <h3>Noise and pace</h3>
        <p className="muted">
          Nothing in this app notifies you or runs in the background. Bots only talk when you post or when a week runs,
          and a week only runs when you press the button, unless you turn on auto-advance below.
        </p>
        <Field label="How much the bots talk">
          <select
            value={s.activity}
            onChange={(e) => updateSettings((x) => ({ ...x, activity: e.target.value as Activity }))}
          >
            {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_LABEL[a]}
              </option>
            ))}
          </select>
        </Field>
        <p className="hint">
          At this level: up to {REPLIES_PER_POST[s.activity]} replies each time you post in a channel, and{' '}
          {UNPROMPTED_PER_WEEK[s.activity]} unprompted messages per simulated week. DMs and @mentions always get an
          answer.
        </p>
        <div className="grid3">
          <Field
            label="Daily token budget"
            hint={`Hard stop. Used today: ${tokensToday(state, now).toLocaleString()}.`}
          >
            <NumberInput
              value={s.dailyTokenBudget}
              step={10_000}
              onChange={(v) => updateSettings((x) => ({ ...x, dailyTokenBudget: v }))}
            />
          </Field>
          <Field label="Reply length (words)" hint="Shorter replies cost less.">
            <NumberInput
              value={s.replyWords}
              min={20}
              step={10}
              onChange={(v) => updateSettings((x) => ({ ...x, replyWords: v }))}
            />
          </Field>
          <Field label="Messages of context per reply" hint="How much channel history each bot reads.">
            <NumberInput
              value={s.contextMessages}
              min={2}
              onChange={(v) => updateSettings((x) => ({ ...x, contextMessages: v }))}
            />
          </Field>
        </div>
        <div className="grid3">
          <Field
            label="Auto-run a week every N hours"
            hint="0 = never (manual only). Only runs while this tab is open."
          >
            <NumberInput
              value={s.autoAdvanceHours}
              onChange={(v) => updateSettings((x) => ({ ...x, autoAdvanceHours: v }))}
            />
          </Field>
          <Field label="Quiet hours start (0-23)" hint="Auto-run never fires during quiet hours.">
            <NumberInput
              value={s.quietStart}
              onChange={(v) => updateSettings((x) => ({ ...x, quietStart: Math.min(v, 23) }))}
            />
          </Field>
          <Field label="Quiet hours end (0-23)">
            <NumberInput
              value={s.quietEnd}
              onChange={(v) => updateSettings((x) => ({ ...x, quietEnd: Math.min(v, 23) }))}
            />
          </Field>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={s.quietWeekdaysOnly}
            onChange={(e) => updateSettings((x) => ({ ...x, quietWeekdaysOnly: e.target.checked }))}
          />{' '}
          Quiet hours apply on weekdays only
        </label>
      </div>

      <div className="card">
        <h3>Mentor</h3>
        <div className="grid2">
          <Field label="Provider">
            <select
              value={s.mentor.provider}
              onChange={(e) =>
                updateSettings((x) => ({ ...x, mentor: { ...x.mentor, provider: e.target.value as RealProvider } }))
              }
            >
              {REAL_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Model" hint="Worth using a strong model here; reviews are infrequent.">
            <input
              value={s.mentor.model}
              onChange={(e) => updateSettings((x) => ({ ...x, mentor: { ...x.mentor, model: e.target.value } }))}
            />
          </Field>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={s.autoReview}
            onChange={(e) => updateSettings((x) => ({ ...x, autoReview: e.target.checked }))}
          />{' '}
          Write a review automatically at the end of every week
        </label>
      </div>

      <div className="row between">
        <h3>Model providers</h3>
        <button onClick={() => void refreshHealth()}>Recheck server</button>
      </div>
      <p className="muted">
        New hires are spread evenly across enabled providers that have a key. With no keys, everyone runs on canned mock
        replies.
      </p>
      <div className="grid3">
        {REAL_PROVIDERS.map((p) => (
          <ProviderCard key={p} provider={p} state={state} ui={ui} />
        ))}
      </div>

      <div className="card">
        <h3>Usage, last 7 days</h3>
        <UsageTable state={state} />
      </div>

      <div className="card">
        <h3>Data</h3>
        <p className="muted">Everything lives in this browser. Exports leave out your API keys.</p>
        <div className="row">
          <button onClick={download}>Export JSON</button>
          <label className="button">
            Import JSON
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                void file
                  .text()
                  .then((text) =>
                    setImportStatus(importState(text) ? 'Imported.' : 'That file is not a Company Sim export.'),
                  )
              }}
            />
          </label>
          <button
            className="danger"
            onClick={() => {
              if (window.confirm('Delete this company and start over? Your settings and keys are kept.')) resetAll()
            }}
          >
            Reset company
          </button>
        </div>
        {importStatus ? <p className="hint">{importStatus}</p> : null}
      </div>
    </div>
  )
}

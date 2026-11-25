import { useEffect, useRef, useState } from 'react'
import { scenarioById } from '../domain/curriculum.ts'
import { channelMembers } from '../domain/engine.ts'
import { CEO_ID, DEPT_LABEL, LEVEL_LABEL, SYSTEM_ID } from '../domain/types.ts'
import type { Channel, Message, Person, State } from '../domain/types.ts'
import { firstName, money } from '../domain/util.ts'
import { hire, markRead, postMessage, recordDecision, rejectCandidate } from '../state/actions.ts'
import type { Ui } from '../state/store.ts'
import { Avatar, Field, Modal, authorName } from './bits.tsx'

type DecisionTarget = { scenarioId: string | null; title: string }

const DecisionModal = ({
  target,
  channelId,
  onClose,
}: {
  target: DecisionTarget
  channelId: string
  onClose: () => void
}) => {
  const [title, setTitle] = useState(target.title)
  const [decision, setDecision] = useState('')
  const [rationale, setRationale] = useState('')
  return (
    <Modal title="Record a decision" onClose={onClose}>
      <p className="muted">
        This goes in the decision log, gets announced in the channel, and is what the mentor grades. Writing the
        reasoning down is the exercise.
      </p>
      <Field label="What is being decided">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="The decision" hint="Specific enough that someone could act on it without asking you a follow-up.">
        <textarea rows={4} value={decision} onChange={(e) => setDecision(e.target.value)} autoFocus />
      </Field>
      <Field label="Why, and what you are giving up" hint="Trade-offs, numbers, what would make you change your mind.">
        <textarea rows={4} value={rationale} onChange={(e) => setRationale(e.target.value)} />
      </Field>
      <div className="row end">
        <button onClick={onClose}>Cancel</button>
        <button
          className="primary"
          disabled={!title.trim() || !decision.trim()}
          onClick={() => {
            recordDecision({ title, decision, rationale, scenarioId: target.scenarioId, channelId })
            onClose()
          }}
        >
          Announce decision
        </button>
      </div>
    </Modal>
  )
}

const ScenarioCard = ({
  message,
  state,
  onDecide,
}: {
  message: Message
  state: State
  onDecide: (target: DecisionTarget) => void
}) => {
  const scenario = message.scenarioId ? scenarioById(message.scenarioId) : undefined
  const run = state.scenarios.find((r) => r.id === message.scenarioId)
  if (!scenario) return null
  return (
    <div className="scenario-card">
      <div className="scenario-head">
        <span className="tag">{scenario.topic}</span>
        <b>{scenario.title}</b>
        <span className="muted">
          {run?.status === 'decided' ? `decided in week ${run.decidedWeek}` : 'needs your decision'}
        </span>
      </div>
      <details>
        <summary>What an MBA would tell you first</summary>
        <p>{scenario.primer}</p>
        <p className="muted">Look up: {scenario.frameworks.join(' · ')}</p>
      </details>
      {run?.status === 'active' ? (
        <button onClick={() => onDecide({ scenarioId: scenario.id, title: scenario.title })}>Record decision</button>
      ) : null}
    </div>
  )
}

const MessageRow = ({
  message,
  state,
  onDecide,
}: {
  message: Message
  state: State
  onDecide: (target: DecisionTarget) => void
}) => {
  const name = authorName(state, message.authorId)
  const person = state.people.find((p) => p.id === message.authorId)
  return (
    <div className={`msg ${message.kind} ${message.authorId === SYSTEM_ID ? 'from-system' : ''}`}>
      <Avatar id={message.authorId} name={name} />
      <div className="msg-body">
        <div className="msg-meta">
          <b>{name}</b>
          {person ? <span className="muted">{person.title}</span> : null}
          {message.authorId === CEO_ID ? <span className="muted">CEO</span> : null}
          <span className="muted">week {message.week}</span>
        </div>
        <div className="msg-text">{message.text}</div>
        {message.kind === 'scenario' ? <ScenarioCard message={message} state={state} onDecide={onDecide} /> : null}
      </div>
    </div>
  )
}

const CandidateBar = ({ person }: { person: Person }) => (
  <div className="candidate-bar">
    <div>
      <b>Interview</b> for {person.title} ({LEVEL_LABEL[person.level]}, {DEPT_LABEL[person.dept]}). Asking{' '}
      {money(person.salary)}.<div className="muted">{person.background}</div>
      <div className="muted">
        Strengths: {person.strengths.join('; ') || 'unknown'}. Visible concerns: {person.concerns.join('; ') || 'none'}.
      </div>
    </div>
    <div className="row">
      <button className="primary" onClick={() => hire(person.id)}>
        Make offer
      </button>
      <button onClick={() => rejectCandidate(person.id)}>Pass</button>
    </div>
  </div>
)

const placeholder = (channel: Channel, members: Person[]) => {
  if (channel.kind === 'mentor') return 'Ask your mentor anything'
  if (channel.kind !== 'channel') return `Message ${channel.name}`
  const example = members[0] ? ` Use @${firstName(members[0].name)} to pull someone in.` : ''
  return `Message #${channel.name}.${example}`
}

export const ChannelView = ({ channelId, state, ui }: { channelId: string; state: State; ui: Ui }) => {
  const channel = state.channels.find((c) => c.id === channelId)
  const [draft, setDraft] = useState('')
  const [deciding, setDeciding] = useState<DecisionTarget | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const messages = state.messages.filter((m) => m.channelId === channelId)
  const typing = ui.typing[channelId] ?? []
  const count = messages.length
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
    markRead(channelId)
  }, [channelId, count, typing.length])
  if (!channel) return <div className="page">This conversation no longer exists.</div>
  const person = state.people.find((p) => p.id === channel.personId)
  const members = channelMembers(channel, state.people)
  const send = () => {
    postMessage(channelId, draft)
    setDraft('')
  }
  return (
    <div className="channel">
      <div className="channel-head">
        <div>
          <b>{channel.kind === 'channel' ? `#${channel.name}` : channel.name}</b>
          <span className="muted"> {channel.topic}</span>
          {channel.kind === 'channel' ? <span className="muted"> · {members.length + 1} members</span> : null}
        </div>
        {channel.kind === 'channel' ? (
          <button onClick={() => setDeciding({ scenarioId: null, title: '' })}>Record decision</button>
        ) : null}
      </div>
      {person?.status === 'candidate' ? <CandidateBar person={person} /> : null}
      <div className="messages">
        {messages.length === 0 ? <div className="empty">Nothing here yet. Say something.</div> : null}
        {messages.map((m) => (
          <MessageRow key={m.id} message={m} state={state} onDecide={setDeciding} />
        ))}
        {typing.length > 0 ? <div className="typing">{typing.join(', ')} typing…</div> : null}
        <div ref={bottom} />
      </div>
      <div className="composer">
        <textarea
          rows={2}
          value={draft}
          placeholder={placeholder(channel, members)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button className="primary" disabled={!draft.trim()} onClick={send}>
          Send
        </button>
      </div>
      {deciding ? <DecisionModal target={deciding} channelId={channelId} onClose={() => setDeciding(null)} /> : null}
    </div>
  )
}

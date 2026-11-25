import type { ReactNode } from 'react'
import { CEO_ID, MENTOR_ID, SYSTEM_ID } from '../domain/types.ts'
import type { State } from '../domain/types.ts'

const hue = (id: string) => [...id].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 360, 7)

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()

export const authorName = (state: State, authorId: string) => {
  if (authorId === CEO_ID) return state.company.ceoName || 'You'
  if (authorId === SYSTEM_ID) return 'Company Sim'
  if (authorId === MENTOR_ID) return 'Mentor'
  return state.people.find((p) => p.id === authorId)?.name ?? 'Former employee'
}

export const Avatar = ({ id, name, size = 34 }: { id: string; name: string; size?: number }) => (
  <span
    className="avatar"
    style={{
      width: size,
      height: size,
      fontSize: size * 0.38,
      background: id === SYSTEM_ID ? 'var(--muted)' : `hsl(${hue(id)} 45% 42%)`,
    }}
  >
    {id === SYSTEM_ID ? 'i' : initials(name)}
  </span>
)

export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="field">
    <span className="field-label">{label}</span>
    {children}
    {hint ? <span className="hint">{hint}</span> : null}
  </label>
)

export const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => (
  <div className="modal-backdrop" onMouseDown={(e) => (e.target === e.currentTarget ? onClose() : undefined)}>
    <div className="modal" role="dialog" aria-label={title}>
      <div className="modal-head">
        <h3>{title}</h3>
        <button className="ghost" onClick={onClose} aria-label="Close">
          Close
        </button>
      </div>
      {children}
    </div>
  </div>
)

export const NumberInput = ({
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number
}) => (
  <input
    type="number"
    value={Number.isFinite(value) ? value : 0}
    min={min}
    step={step}
    onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
  />
)

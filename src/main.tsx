import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { refreshHealth } from './state/actions.ts'
import { hydrate } from './state/store.ts'
import './styles.css'

void hydrate()
void refreshHealth()

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

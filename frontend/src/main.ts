import './styles/fonts.css'
import './styles/tokens.css'
import './styles/shared.css'
import './styles/desktop.css'
import './styles/mobile.css'

import { api, UNAUTHENTICATED } from './api.ts'
import { closeAllOverlays } from './components/overlay.ts'
import { mountDesktop } from './desktop/shell.ts'
import { renderGate } from './gate.ts'
import { mountMobile } from './mobile/shell.ts'
import { startState } from './store.ts'
import { applyTheme } from './theme.ts'
import { toastError } from './toast.ts'

const app = document.getElementById('app') as HTMLElement

const MOBILE_QUERY = '(max-width: 820px), (pointer: coarse) and (max-width: 1024px)'
const mobileMatch = window.matchMedia(MOBILE_QUERY)

let teardown: (() => void) | null = null
let mountedAs: 'mobile' | 'desktop' | null = null

function mountShell(): void {
  const wanted = mobileMatch.matches ? 'mobile' : 'desktop'
  if (wanted === mountedAs) return

  teardown?.()
  app.className = ''
  mountedAs = wanted
  teardown = wanted === 'mobile' ? mountMobile(app, showGate) : mountDesktop(app, showGate)
}

function showGate(): void {
  closeAllOverlays()
  teardown?.()
  teardown = null
  mountedAs = null
  app.className = ''
  renderGate(app, () => {
    startState()
    mountShell()
  })
}

mobileMatch.addEventListener('change', () => {
  if (mountedAs) mountShell()
})

window.addEventListener(UNAUTHENTICATED, showGate)

async function boot(): Promise<void> {
  applyTheme()
  startState()

  try {
    const { authenticated } = await api.session()
    if (authenticated) mountShell()
    else showGate()
  } catch (err) {
    toastError(err)
    showGate()
  }
}

void boot()

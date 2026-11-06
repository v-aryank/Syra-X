import { useCallback, useEffect, useState } from 'react'
import { getHealth } from '../services/api.js'
import SyraCore, { getRecommendedParticleCap } from '../components/core/SyraCore.jsx'

const STATE_BY_KEY = Object.freeze({ '1': 'idle', '2': 'listening', '3': 'thinking', '4': 'speaking' })
const PARTICLE_CAPS = [600, 900, 1200, 1400, 3000, 6000]

export default function App() {
  const [connection, setConnection] = useState('checking')
  const [coreState, setCoreState] = useState('idle')
  const [particleCap, setParticleCap] = useState(getRecommendedParticleCap)
  const [performanceStats, setPerformanceStats] = useState(null)

  const updatePerformance = useCallback((stats) => {
    setPerformanceStats(stats)
  }, [])

  useEffect(() => {
    let active = true
    getHealth()
      .then(() => active && setConnection('connected'))
      .catch(() => active && setConnection('offline'))
    return () => { active = false }
  }, [])

  useEffect(() => {
    const selectCoreState = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const nextState = STATE_BY_KEY[event.key]
      if (!nextState) return
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return
      setCoreState(nextState)
    }

    window.addEventListener('keydown', selectCoreState)
    return () => window.removeEventListener('keydown', selectCoreState)
  }, [])

  const connectionLabel = {
    checking: 'CONNECTING TO API',
    connected: 'API CONNECTED',
    offline: 'API OFFLINE',
  }[connection]

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="SYRA X home">SYRA<span> X</span></a>
        <div className={`connection connection--${connection}`} role="status" aria-live="polite">
          <span className="connection__dot" aria-hidden="true" />
          {connectionLabel}
        </div>
      </header>
      <section className="welcome" aria-labelledby="welcome-title">
        <div className="core-column">
          <div className="core-visual">
            <SyraCore
              state={coreState}
              particleCap={particleCap}
              showHud
              onPerformance={updatePerformance}
            />
          </div>
          {import.meta.env.DEV && (
            <div className="core-dev-tools" aria-label="Core development controls">
              <label className="particle-control">
                <span>Particle cap</span>
                <select
                  value={particleCap}
                  onChange={(event) => setParticleCap(Number(event.target.value))}
                >
                  {PARTICLE_CAPS.map((cap) => <option key={cap} value={cap}>{cap.toLocaleString()}</option>)}
                </select>
              </label>
              <div className="core-key-help">1 IDLE&nbsp; · &nbsp;2 LISTENING&nbsp; · &nbsp;3 THINKING&nbsp; · &nbsp;4 SPEAKING</div>
              {performanceStats && (
                <output className="performance-readout" aria-live="off">
                  {performanceStats.fps} FPS · {performanceStats.frameMs.toFixed(2)} ms · {performanceStats.particles}/{particleCap}
                </output>
              )}
            </div>
          )}
        </div>
        <div className="welcome-copy">
          <div className="eyebrow">PERSONAL ASSISTANT <span> / </span> PHASE 02</div>
          <h1 id="welcome-title">A clearer space<br />to think.</h1>
          <p>SYRA is getting ready. The assistant workspace will take shape here.</p>
          <div className="status-card">
            <span className="status-card__icon" aria-hidden="true">✳</span>
            <div>
              <strong>System status</strong>
              <span>{connection === 'connected' ? 'Backend is responding.' : connection === 'offline' ? 'Backend is unavailable. Start the API to connect.' : 'Checking the local backend…'}</span>
            </div>
          </div>
        </div>
      </section>
      <footer className="footer"><span>SYRA X</span><span>FOUNDATION BUILD · 01</span></footer>
    </main>
  )
}

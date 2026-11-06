import { useEffect, useRef } from 'react'
import {
  DEFAULT_PARTICLE_CAP,
  getRecommendedParticleCap,
  SyraCoreEngine,
} from './coreEngine.js'
import './SyraCore.css'

export { DEFAULT_PARTICLE_CAP, getRecommendedParticleCap }

export default function SyraCore({
  state = 'idle',
  particleCap = getRecommendedParticleCap(),
  showHud = true,
  className = '',
  onPerformance,
}) {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const drawRef = useRef(() => {})
  const stateRef = useRef(state)
  const reducedMotionRef = useRef(false)
  const onPerformanceRef = useRef(onPerformance)
  stateRef.current = state
  onPerformanceRef.current = onPerformance

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !context) return undefined

    const engine = new SyraCoreEngine({ particleCap })
    engine.setState(stateRef.current)
    engineRef.current = engine

    let width = 0
    let height = 0
    let frameId = null
    let previousTimestamp = null
    let lastStatsTimestamp = 0
    let sampledFrames = 0
    let sampledFrameTime = 0

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = reducedMotionQuery.matches
    engine.setReducedMotion(reducedMotionQuery.matches)

    const draw = () => {
      if (width > 0 && height > 0) engine.draw(context, width, height, showHud)
    }
    drawRef.current = draw

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      width = rect.width
      height = rect.height
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const backingWidth = Math.round(width * pixelRatio)
      const backingHeight = Math.round(height * pixelRatio)
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth
        canvas.height = backingHeight
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      if (reducedMotionRef.current) engine.setReducedMotion(true)
      draw()
    }

    const stop = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      frameId = null
      previousTimestamp = null
    }

    const animate = (timestamp) => {
      frameId = null
      if (document.hidden || reducedMotionRef.current) return

      const delta = previousTimestamp === null
        ? 0
        : Math.min((timestamp - previousTimestamp) / 1000, 0.1)
      previousTimestamp = timestamp
      const frameStart = performance.now()
      engine.advance(delta)
      draw()
      sampledFrames += 1
      sampledFrameTime += performance.now() - frameStart

      if (lastStatsTimestamp === 0) lastStatsTimestamp = timestamp
      if (timestamp - lastStatsTimestamp >= 1000) {
        onPerformanceRef.current?.({
          fps: Math.round((sampledFrames * 1000) / (timestamp - lastStatsTimestamp || 1)),
          frameMs: sampledFrames ? sampledFrameTime / sampledFrames : 0,
          particles: engine.liveCount,
          particleCap: engine.particleCap,
        })
        sampledFrames = 0
        sampledFrameTime = 0
        lastStatsTimestamp = timestamp
      }

      frameId = window.requestAnimationFrame(animate)
    }

    const start = () => {
      if (document.hidden || reducedMotionRef.current || frameId !== null) return
      previousTimestamp = null
      frameId = window.requestAnimationFrame(animate)
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop()
      } else if (reducedMotionRef.current) {
        engine.setReducedMotion(true)
        draw()
      } else {
        start()
      }
    }

    const onMotionPreferenceChange = (event) => {
      reducedMotionRef.current = event.matches
      engine.setReducedMotion(event.matches)
      if (event.matches) {
        stop()
        draw()
      } else if (!document.hidden) {
        start()
      }
    }

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resize)
      : null
    if (resizeObserver) resizeObserver.observe(canvas.parentElement || canvas)
    window.addEventListener('resize', resize, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    if (reducedMotionQuery.addEventListener) {
      reducedMotionQuery.addEventListener('change', onMotionPreferenceChange)
    } else {
      reducedMotionQuery.addListener(onMotionPreferenceChange)
    }

    resize()
    draw()
    start()

    return () => {
      stop()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (reducedMotionQuery.removeEventListener) {
        reducedMotionQuery.removeEventListener('change', onMotionPreferenceChange)
      } else {
        reducedMotionQuery.removeListener(onMotionPreferenceChange)
      }
      engine.glowCache.clear()
      engineRef.current = null
      drawRef.current = () => {}
    }
  }, [particleCap, showHud])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setState(state)
    if (reducedMotionRef.current) drawRef.current()
  }, [state])

  return (
    <div className={`syra-core ${className}`.trim()}>
      <canvas
        ref={canvasRef}
        className="syra-core__canvas"
        role="img"
        aria-label={`SYRA visual core, ${state} state`}
      />
    </div>
  )
}

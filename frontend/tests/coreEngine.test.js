import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CORE_STATES,
  DEFAULT_PARTICLE_CAP,
  MAX_PARTICLE_CAP,
  SyraCoreEngine,
  getWaveformAmplitude,
  getRecommendedParticleCap,
  normalizeParticleCap,
} from '../src/components/core/coreEngine.js'

test('particle caps stay within the verified source limit', () => {
  assert.equal(normalizeParticleCap(1200), 1200)
  assert.equal(normalizeParticleCap(9000), MAX_PARTICLE_CAP)
  assert.equal(normalizeParticleCap(0), 1)
  assert.equal(normalizeParticleCap(Number.NaN), DEFAULT_PARTICLE_CAP)
  assert.equal(getRecommendedParticleCap({ hardwareConcurrency: 4, deviceMemory: 8 }), 900)
  assert.equal(getRecommendedParticleCap({ hardwareConcurrency: 8, deviceMemory: 8 }), DEFAULT_PARTICLE_CAP)
})

test('the fixed-step update spawns particles on the source sphere surface', () => {
  const engine = new SyraCoreEngine({ particleCap: 16, random: () => 0.5 })

  assert.equal(engine.advance(1 / 150), 1)
  assert.equal(engine.liveCount, 8)
  for (let index = 0; index < engine.particleCap; index += 1) {
    if (!engine.alive[index]) continue
    const zFromCenter = engine.z[index] + 143
    const radius = Math.hypot(engine.x[index], engine.y[index], zFromCenter)
    assert.ok(Math.abs(radius - 140) < 1e-9)
  }
})

test('state mapping matches the PyQt6 reference and rejects unknown states', () => {
  const engine = new SyraCoreEngine({ particleCap: 8 })
  assert.deepEqual(CORE_STATES.idle, { glow: 1, rotation: 1, spawn: 1, pulse: 0 })
  assert.deepEqual(CORE_STATES.listening, { glow: 1.25, rotation: 1.4, spawn: 1.2, pulse: 0.02 })
  assert.deepEqual(CORE_STATES.thinking, { glow: 1.1, rotation: 2.2, spawn: 1, pulse: 0 })
  assert.deepEqual(CORE_STATES.speaking, { glow: 1.45, rotation: 1.8, spawn: 1.5, pulse: 0.05 })
  for (const state of Object.keys(CORE_STATES)) assert.equal(engine.setState(state), true)
  assert.equal(engine.setState('searching'), false)
})

test('the update loop caps catch-up work at eight steps per frame', () => {
  const engine = new SyraCoreEngine({ particleCap: 128, random: () => 0.5 })

  assert.equal(engine.advance(0.1), 8)
  assert.equal(engine.liveCount, 64)
  assert.equal(engine.tickAccumulator, 0)
})

test('reduced-motion preparation creates a stable bounded particle field', () => {
  const engine = new SyraCoreEngine({ particleCap: 128, random: () => 0.5 })
  engine.prepareReducedMotion()

  assert.equal(engine.liveCount, 128)
  assert.equal(engine.renderCount, 128)
  assert.equal(engine.advance(1), 0)
  assert.equal(engine.liveCount, 128)
})

test('waveform moves only in listening and speaking states', () => {
  assert.equal(getWaveformAmplitude('idle', 0, 12), 0)
  assert.equal(getWaveformAmplitude('thinking', 1, 12), 0)
  assert.notEqual(getWaveformAmplitude('listening', 0.2, 12), getWaveformAmplitude('listening', 0.8, 12))
  assert.notEqual(getWaveformAmplitude('speaking', 0.2, 12), getWaveformAmplitude('speaking', 0.8, 12))
})

test('core rendering enlarges the sphere and lowers the wider waveform', () => {
  const engine = new SyraCoreEngine({ particleCap: 8 })
  let geometry
  engine.drawParticles = () => {}
  engine.drawBlob = () => {}
  engine.drawWaveform = (_context, centerX, y, size) => {
    geometry = { centerX, y, size }
  }

  engine.draw({ clearRect() {} }, 350, 370, false)

  assert.deepEqual(geometry, { centerX: 175, y: 335.2, size: 220 })
})

test('waveform spans more width and uses a larger amplitude', () => {
  const engine = new SyraCoreEngine({ particleCap: 8 })
  const points = []
  engine.setState('speaking')
  engine.clock = 0.5
  const context = {
    beginPath() {},
    lineTo(x, y) { points.push([x, y]) },
    moveTo(x, y) { points.push([x, y]) },
    restore() {},
    save() {},
    stroke() {},
  }

  engine.drawWaveform(context, 100, 200, 220)

  assert.equal(points[0][0], 100 - (220 * 0.52))
  assert.equal(points.at(-1)[0], 100 + (220 * 0.52))
  assert.ok(Math.max(...points.map(([, y]) => Math.abs(y - 200))) > 22)
})

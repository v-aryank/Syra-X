const PROJECTION_SIZE = 500
const SPHERE_RADIUS = 140
const FOCAL_LENGTH = 320
const PARTICLE_RADIUS = 1.8
const PARTICLES_PER_TICK = 8
const SPHERE_CENTER_Z = -3 - SPHERE_RADIUS
const FAR_ALPHA_DEPTH = -750
const TURN_SPEED = (2 * Math.PI) / 1200
const ATTACK_TICKS = 50
const HOLD_TICKS = 50
const DECAY_TICKS = 100
const LIFE_TICKS = ATTACK_TICKS + HOLD_TICKS + DECAY_TICKS
const TICKS_PER_SECOND = 150
const MAX_TICKS_PER_FRAME = 8
const ALPHA_LEVELS = 12
const TAU = Math.PI * 2
const PARTICLE_FILL_STYLES = Array.from({ length: ALPHA_LEVELS }, (_, level) => {
  const alpha = Math.trunc((255 * (level + 0.5)) / ALPHA_LEVELS) / 255
  return `rgba(25, 25, 255, ${alpha})`
})

export const MAX_PARTICLE_CAP = 6000
export const DEFAULT_PARTICLE_CAP = 1400

export const CORE_STATES = Object.freeze({
  idle: Object.freeze({ glow: 1.0, rotation: 1.0, spawn: 1.0, pulse: 0.0 }),
  listening: Object.freeze({ glow: 1.25, rotation: 1.4, spawn: 1.2, pulse: 0.02 }),
  thinking: Object.freeze({ glow: 1.1, rotation: 2.2, spawn: 1.0, pulse: 0.0 }),
  speaking: Object.freeze({ glow: 1.45, rotation: 1.8, spawn: 1.5, pulse: 0.05 }),
})

export function getWaveformAmplitude(state, timeSeconds, progress, phaseOffset = 0) {
  if (state !== 'listening' && state !== 'speaking') return 0
  const speed = state === 'speaking' ? 2.4 : 1.65
  const phase = progress * TAU - timeSeconds * speed + phaseOffset
  const activity = 0.28 + (0.72 * (0.5 + 0.5 * Math.sin(timeSeconds * 2.1 + progress * 3.8)))
  return Math.sin(phase) * activity
}

const BLOBS = [
  { radii: [30, 60, 63, 37, 40, 45, 58, 60], period: 6, start: 0, sweep: 359 },
  { radii: [35, 55, 58, 45, 48, 50, 60, 50], period: 4, start: 90, sweep: 180 },
  { radii: [30, 44, 47, 37, 40, 45, 43, 45], period: 8, start: 180, sweep: 360 },
]

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function normalizeParticleCap(value = DEFAULT_PARTICLE_CAP) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_PARTICLE_CAP
  return clamp(Math.floor(parsed), 1, MAX_PARTICLE_CAP)
}

export function getRecommendedParticleCap(environment = globalThis.navigator) {
  const cores = Number(environment?.hardwareConcurrency) || 4
  const memory = Number(environment?.deviceMemory)
  if (cores <= 4 || (memory > 0 && memory <= 4)) return 900
  return DEFAULT_PARTICLE_CAP
}

function traceBlobPath(context, size, radii) {
  let [tlx, trx, brx, blx, tly, try_, bry, bly] = radii
  const factor = Math.min(
    1,
    100 / (tlx + trx),
    100 / (blx + brx),
    100 / (tly + bly),
    100 / (try_ + bry),
  )
  tlx = (tlx * factor) / 100
  trx = (trx * factor) / 100
  brx = (brx * factor) / 100
  blx = (blx * factor) / 100
  tly = (tly * factor) / 100
  try_ = (try_ * factor) / 100
  bry = (bry * factor) / 100
  bly = (bly * factor) / 100

  const half = size / 2
  const left = -half
  const top = -half
  const right = half
  const bottom = half

  context.beginPath()
  context.moveTo(left + tlx * size, top)
  context.lineTo(right - trx * size, top)
  context.ellipse(right - trx * size, top + try_ * size, trx * size, try_ * size, 0, -Math.PI / 2, 0)
  context.lineTo(right, bottom - bry * size)
  context.ellipse(right - brx * size, bottom - bry * size, brx * size, bry * size, 0, 0, Math.PI / 2)
  context.lineTo(left + blx * size, bottom)
  context.ellipse(left + blx * size, bottom - bly * size, blx * size, bly * size, 0, Math.PI / 2, Math.PI)
  context.lineTo(left, top + tly * size)
  context.ellipse(left + tlx * size, top + tly * size, tlx * size, tly * size, 0, Math.PI, Math.PI * 1.5)
  context.closePath()
}

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export class SyraCoreEngine {
  constructor({ particleCap = DEFAULT_PARTICLE_CAP, random = Math.random } = {}) {
    this.particleCap = normalizeParticleCap(particleCap)
    this.random = random
    this.state = 'idle'
    this.reducedMotion = false
    this.clock = 0
    this.phase = 0
    this.tickAccumulator = 0
    this.spawnAccumulator = 0
    this.turn = 0
    this.liveCount = 0
    this.renderCount = 0
    this.glowCache = new Map()

    const capacity = this.particleCap
    this.alive = new Uint8Array(capacity)
    this.x = new Float64Array(capacity)
    this.y = new Float64Array(capacity)
    this.z = new Float64Array(capacity)
    this.vx = new Float64Array(capacity)
    this.vy = new Float64Array(capacity)
    this.vz = new Float64Array(capacity)
    this.age = new Float64Array(capacity)
    this.stuck = new Float64Array(capacity)
    this.projectedX = new Float64Array(capacity)
    this.projectedY = new Float64Array(capacity)
    this.projectedScale = new Float64Array(capacity)
    this.alpha = new Float64Array(capacity)
    this.bucketHead = new Int32Array(ALPHA_LEVELS)
    this.bucketNext = new Int32Array(capacity)
    this.freeStack = new Uint16Array(capacity)
    for (let index = 0; index < capacity; index += 1) this.freeStack[index] = index
    this.freeCount = capacity
  }

  setState(state) {
    if (!Object.hasOwn(CORE_STATES, state)) return false
    this.state = state
    return true
  }

  setReducedMotion(enabled) {
    this.reducedMotion = Boolean(enabled)
    if (this.reducedMotion) this.prepareReducedMotion()
  }

  advance(deltaSeconds) {
    if (this.reducedMotion) return 0
    const dt = clamp(Number(deltaSeconds) || 0, 0, 0.1)
    const state = CORE_STATES[this.state]
    this.clock += dt
    this.phase += dt * state.rotation

    this.tickAccumulator += dt * TICKS_PER_SECOND
    const elapsedTicks = Math.floor(this.tickAccumulator)
    const ticks = Math.min(elapsedTicks, MAX_TICKS_PER_FRAME)
    // Match the reference's bounded catch-up policy: excess ticks are dropped.
    this.tickAccumulator -= elapsedTicks

    for (let tick = 0; tick < ticks; tick += 1) {
      this.spawnAccumulator += PARTICLES_PER_TICK * state.spawn
      const spawnCount = Math.floor(this.spawnAccumulator)
      this.spawnAccumulator -= spawnCount
      this.step(spawnCount)
    }
    return ticks
  }

  step(spawnCount) {
    this.spawn(spawnCount)
    this.turn = (this.turn + TURN_SPEED) % TAU
    const sinTurn = Math.sin(this.turn)
    const cosTurn = Math.cos(this.turn)
    this.bucketHead.fill(-1)
    this.renderCount = 0

    for (let index = 0; index < this.particleCap; index += 1) {
      if (this.alive[index] === 0) continue

      const age = this.age[index] + 1
      this.age[index] = age

      if (age > this.stuck[index]) {
        this.vx[index] += 0.1 * (this.random() * 2 - 1)
        this.vy[index] += 0.1 * (this.random() * 2 - 1)
        this.vz[index] += 0.1 * (this.random() * 2 - 1)
        this.x[index] += this.vx[index]
        this.y[index] += this.vy[index]
        this.z[index] += this.vz[index]
      }

      const dz = this.z[index] - SPHERE_CENTER_Z
      const rotatedX = cosTurn * this.x[index] + sinTurn * dz
      const rotatedZ = -sinTurn * this.x[index] + cosTurn * dz + SPHERE_CENTER_Z
      const perspective = FOCAL_LENGTH / (FOCAL_LENGTH - rotatedZ)
      const projectedX = rotatedX * perspective + PROJECTION_SIZE / 2
      const projectedY = this.y[index] * perspective + PROJECTION_SIZE / 2
      const outside = projectedX > PROJECTION_SIZE
        || projectedX < 0
        || projectedY < 0
        || projectedY > PROJECTION_SIZE
        || rotatedZ > FOCAL_LENGTH - 2

      if (age >= LIFE_TICKS || outside || !Number.isFinite(perspective)) {
        this.release(index)
        continue
      }

      let envelope
      if (age < ATTACK_TICKS) envelope = age / ATTACK_TICKS
      else if (age < ATTACK_TICKS + HOLD_TICKS) envelope = 1
      else envelope = 1 - (age - ATTACK_TICKS - HOLD_TICKS) / DECAY_TICKS
      const depth = clamp(1 + rotatedZ / -FAR_ALPHA_DEPTH, 0, 1)
      const particleAlpha = envelope * depth
      const bucket = Math.min(Math.floor(particleAlpha * ALPHA_LEVELS), ALPHA_LEVELS - 1)

      this.projectedX[index] = projectedX
      this.projectedY[index] = projectedY
      this.projectedScale[index] = perspective
      this.alpha[index] = particleAlpha
      this.bucketNext[index] = this.bucketHead[bucket]
      this.bucketHead[bucket] = index
      this.renderCount += 1
    }
  }

  spawn(count) {
    const amount = Math.min(this.freeCount, Math.max(0, Math.floor(count)))
    for (let particle = 0; particle < amount; particle += 1) {
      const index = this.freeStack[--this.freeCount]
      const theta = this.random() * TAU
      const phi = Math.acos(this.random() * 2 - 1)
      const sinPhi = Math.sin(phi)
      const x = SPHERE_RADIUS * sinPhi * Math.cos(theta)
      const y = SPHERE_RADIUS * sinPhi * Math.sin(theta)
      const z = SPHERE_RADIUS * Math.cos(phi)

      this.x[index] = x
      this.y[index] = y
      this.z[index] = SPHERE_CENTER_Z + z
      this.vx[index] = 0.002 * x
      this.vy[index] = 0.002 * y
      this.vz[index] = 0.002 * z
      this.age[index] = 0
      this.stuck[index] = 90 + this.random() * 20
      this.alive[index] = 1
      this.liveCount += 1
    }
  }

  release(index) {
    this.alive[index] = 0
    this.freeStack[this.freeCount++] = index
    this.liveCount -= 1
  }

  prepareReducedMotion() {
    this.reducedMotion = true
    if (this.liveCount === 0) {
      this.spawn(Math.min(this.particleCap, 360))
      for (let index = 0; index < this.particleCap; index += 1) {
        if (this.alive[index]) {
          this.age[index] = 100
          this.stuck[index] = Number.POSITIVE_INFINITY
        }
      }
    }
    this.turn = 0
    this.bucketHead.fill(-1)
    this.renderCount = 0
    const sinTurn = 0
    const cosTurn = 1
    for (let index = 0; index < this.particleCap; index += 1) {
      if (!this.alive[index]) continue
      const dz = this.z[index] - SPHERE_CENTER_Z
      const rotatedX = cosTurn * this.x[index] + sinTurn * dz
      const rotatedZ = -sinTurn * this.x[index] + cosTurn * dz + SPHERE_CENTER_Z
      const perspective = FOCAL_LENGTH / (FOCAL_LENGTH - rotatedZ)
      const px = rotatedX * perspective + PROJECTION_SIZE / 2
      const py = this.y[index] * perspective + PROJECTION_SIZE / 2
      const depth = clamp(1 + rotatedZ / -FAR_ALPHA_DEPTH, 0, 1)
      const bucket = Math.min(ALPHA_LEVELS - 1, Math.floor(depth * ALPHA_LEVELS))
      this.projectedX[index] = px
      this.projectedY[index] = py
      this.projectedScale[index] = perspective
      this.alpha[index] = depth
      this.bucketNext[index] = this.bucketHead[bucket]
      this.bucketHead[bucket] = index
      this.renderCount += 1
    }
  }

  draw(context, width, height, showHud = true) {
    context.clearRect(0, 0, width, height)
    const minSide = Math.min(width, height)
    const centerX = width / 2
    const centerY = height / 2 - 22
    const state = CORE_STATES[this.state]
    const pulse = 1 + state.pulse * Math.sin(this.clock * TAU * 1.2)
    const baseSize = Math.max(220, Math.min(0.4 * minSide, 420))
    const coreSize = baseSize * pulse
    const side = Math.max(250, Math.min(0.45 * minSide, 500))

    this.drawParticles(context, centerX, centerY, side)
    for (let index = 0; index < BLOBS.length; index += 1) {
      const blob = BLOBS[index]
      const angle = blob.start + blob.sweep * ((this.phase / blob.period) % 1)
      this.drawBlob(context, centerX, centerY, Math.round(baseSize), pulse, index, blob, angle, state.glow)
    }

    const waveformY = centerY + baseSize / 2 + baseSize * 0.16 + 27
    this.drawWaveform(context, centerX, waveformY, baseSize)

    if (showHud) {
      context.save()
      context.globalCompositeOperation = 'source-over'
      context.font = '500 9px ui-monospace, SFMono-Regular, monospace'
      if ('letterSpacing' in context) context.letterSpacing = '4px'
      context.textAlign = 'right'
      context.fillStyle = 'rgb(110 125 160)'
      const label = this.state === 'idle' ? 'ONLINE' : this.state.toUpperCase()
      context.fillText(`●  ${label}`, width - 24, 26)
      context.restore()
    }
  }

  drawWaveform(context, centerX, y, size) {
    const sampleCount = 65
    const layerCount = 9
    const halfWidth = Math.min(116, size * 0.52)
    const active = this.state === 'listening' || this.state === 'speaking'
    const centerLayer = Math.floor(layerCount / 2)
    context.save()
    context.globalCompositeOperation = 'lighter'
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.shadowColor = 'rgba(91, 168, 231, 0.5)'
    context.shadowBlur = active ? 5 : 1
    for (let layer = 0; layer < layerCount; layer += 1) {
      if (!active && layer !== centerLayer) continue
      const distance = Math.abs(layer - centerLayer)
      const layerScale = 1 - distance * 0.17
      const layerOpacity = layer === centerLayer ? 0.92 : 0.12 + (1 - distance / centerLayer) * 0.2
      const phaseDelay = (layer - centerLayer) * 0.16
      context.beginPath()
      for (let sample = 0; sample < sampleCount; sample += 1) {
        const progress = sample / (sampleCount - 1)
        const x = centerX - halfWidth + progress * halfWidth * 2
        const wave = active
          ? getWaveformAmplitude(this.state, this.clock, progress, phaseDelay) * layerScale
          : 0
        const pointY = y + wave * 26
        if (sample === 0) context.moveTo(x, pointY)
        else context.lineTo(x, pointY)
      }
      context.strokeStyle = layer === centerLayer
        ? `rgba(202, 232, 255, ${layerOpacity})`
        : `rgba(113, 178, 226, ${layerOpacity})`
      context.lineWidth = layer === centerLayer ? 1.6 : 0.85
      context.stroke()
    }
    context.restore()
  }

  drawParticles(context, centerX, centerY, side) {
    if (this.renderCount === 0) return
    const scale = side / PROJECTION_SIZE
    const offsetX = centerX - side / 2
    const offsetY = centerY - side / 2
    context.save()
    context.globalCompositeOperation = 'source-over'
    context.strokeStyle = 'transparent'
    for (let level = 0; level < ALPHA_LEVELS; level += 1) {
      let index = this.bucketHead[level]
      if (index < 0) continue
      context.beginPath()
      while (index >= 0) {
        const x = offsetX + this.projectedX[index] * scale
        const y = offsetY + this.projectedY[index] * scale
        const radius = this.projectedScale[index] * PARTICLE_RADIUS * scale
        context.moveTo(x + radius, y)
        context.arc(x, y, radius, 0, TAU)
        index = this.bucketNext[index]
      }
      context.fillStyle = PARTICLE_FILL_STYLES[level]
      context.fill()
    }
    context.restore()
  }

  drawBlob(context, centerX, centerY, size, pulse, index, blob, angle, intensity) {
    const glow = this.getGlow(size, index, blob, intensity)
    context.save()
    context.translate(centerX, centerY)
    context.rotate((angle * Math.PI) / 180)
    context.scale(pulse, pulse)
    context.globalCompositeOperation = 'lighter'
    context.drawImage(glow.canvas, -glow.width / 2, -glow.height / 2)
    context.restore()
  }

  getGlow(size, index, blob, intensity) {
    const key = (index * 1000000) + (size * 1000) + Math.round(intensity * 100)
    const cached = this.glowCache.get(key)
    if (cached) return cached

    if (this.glowCache.size > 24) this.glowCache.clear()
    const glow = size * 0.16
    const dimension = Math.floor(size + glow * 2 + 8)
    const canvas = makeCanvas(dimension, dimension)
    const context = canvas.getContext('2d')
    context.translate(dimension / 2, dimension / 2)
    context.globalCompositeOperation = 'lighter'
    context.strokeStyle = 'rgb(10, 20, 255)'
    context.lineJoin = 'round'
    context.globalAlpha = Math.min(255, Math.trunc(9 * intensity)) / 255
    for (let layer = 14; layer > 0; layer -= 1) {
      context.lineWidth = (2 * glow * layer) / 14
      traceBlobPath(context, size, blob.radii)
      context.stroke()
    }
    context.globalAlpha = 1
    const entry = { canvas, width: dimension, height: dimension }
    this.glowCache.set(key, entry)
    return entry
  }
}

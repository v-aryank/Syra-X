#!/usr/bin/env python3
"""
SYRA CORE — standalone PyQt6 port of the web UI's AI core.

  * ParticleSphere : vectorised (numpy) port of the original script.js particle
                     sphere (attack/hold/decay envelope, stuck time, random
                     acceleration, depth darkening, slow Y-axis turn).
  * Blob core      : the 3 rotating organic glow rings (CSS border-radius +
                     box-shadow look) rebuilt with QPainterPath.
  * SyraCore       : reusable QWidget. Call set_state("idle" | "listening" |
                     "thinking" | "speaking") from your own code.

Install :  python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt
Run     :  .venv/bin/python original-python-core.py
Keys    :  1 idle   2 listening   3 thinking   4 speaking   F11 fullscreen   Esc quit
"""
import sys
import math
import time
import os

# Avoid crashing on Linux desktops with incomplete GNOME settings schemas.
os.environ.setdefault("QT_QPA_PLATFORMTHEME", "generic")

import numpy as np
from PyQt6.QtCore import Qt, QTimer, QPointF, QRectF
from PyQt6.QtGui import QPainter, QColor, QPainterPath, QPen, QFont, QImage
from PyQt6.QtWidgets import QApplication, QWidget

# ----------------------------------------------------------------------------
# Particle sphere parameters (same values as the original script.js)
# ----------------------------------------------------------------------------
PROJ_SIZE = 500.0            # original canvas was 500 x 500
SPHERE_RAD = 140.0
RADIUS_SP = 1.0
F_LEN = 320.0
PARTICLE_RAD = 1.8
PARTICLES_PER_TICK = 8
PROJ_C = PROJ_SIZE / 2.0
Z_MAX = F_LEN - 2.0
RAND_ACCEL = 0.1
SPHERE_CZ = -3.0 - SPHERE_RAD
ZERO_ALPHA_DEPTH = -750.0
TURN_SPEED = (2.0 * math.pi) / 1200.0
ATTACK, HOLD, DECAY = 50.0, 50.0, 100.0
LIFE = ATTACK + HOLD + DECAY
PARTICLE_RGB = (25, 25, 255)

# The browser version ticked ~250x/sec. Simulation runs on a fixed tick rate so
# the look stays the same at any FPS. Lower = slower/calmer, higher = faster.
TICKS_PER_SEC = 150.0
MAX_TICKS_PER_FRAME = 8
ALPHA_LEVELS = 12            # particles are batched into alpha buckets

BG = QColor.fromHslF(220 / 360, 0.20, 0.02)          # hsl(220 20% 2%)
NEON = QColor.fromHslF(225 / 360, 1.0, 0.55)         # hsl(225 100% 55%)

# State -> (glow intensity, rotation speed, spawn multiplier, pulse amount)
STATES = {
    "idle":      (1.00, 1.0, 1.0, 0.00),
    "listening": (1.25, 1.4, 1.2, 0.02),
    "thinking":  (1.10, 2.2, 1.0, 0.00),
    "speaking":  (1.45, 1.8, 1.5, 0.05),
}

# Blob shapes: CSS "tlx trx brx blx / tly try bry bly" in percent
BLOBS = [
    # radii (%)                                              period  start  sweep
    ((30, 60, 63, 37, 40, 45, 58, 60), 6.0,   0.0, 359.0),   # animate1
    ((35, 55, 58, 45, 48, 50, 60, 50), 4.0,  90.0, 180.0),   # animate2
    ((30, 44, 47, 37, 40, 45, 43, 45), 8.0, 180.0, 360.0),   # animate3
]


# ----------------------------------------------------------------------------
# Particle sphere (numpy, fixed-capacity pool)
# ----------------------------------------------------------------------------
class ParticleSphere:
    def __init__(self, capacity=6000):
        self.rng = np.random.default_rng()
        self.alive = np.zeros(capacity, dtype=bool)
        self.x = np.zeros(capacity)
        self.y = np.zeros(capacity)
        self.z = np.zeros(capacity)
        self.vx = np.zeros(capacity)
        self.vy = np.zeros(capacity)
        self.vz = np.zeros(capacity)
        self.age = np.zeros(capacity)
        self.stuck = np.zeros(capacity)
        self.turn = 0.0
        self.render = None   # (projX, projY, m, alpha) of visible particles

    def _spawn(self, n):
        free = np.flatnonzero(~self.alive)[:n]
        k = free.size
        if k == 0:
            return
        theta = self.rng.random(k) * 2.0 * math.pi
        phi = np.arccos(self.rng.random(k) * 2.0 - 1.0)
        x0 = SPHERE_RAD * np.sin(phi) * np.cos(theta)
        y0 = SPHERE_RAD * np.sin(phi) * np.sin(theta)
        z0 = SPHERE_RAD * np.cos(phi)
        self.x[free] = x0
        self.y[free] = y0
        self.z[free] = SPHERE_CZ + z0
        self.vx[free] = 0.002 * x0
        self.vy[free] = 0.002 * y0
        self.vz[free] = 0.002 * z0
        self.age[free] = 0.0
        self.stuck[free] = 90.0 + self.rng.random(k) * 20.0
        self.alive[free] = True

    def step(self, spawn_count):
        self._spawn(spawn_count)

        self.turn = (self.turn + TURN_SPEED) % (2.0 * math.pi)
        sin_a, cos_a = math.sin(self.turn), math.cos(self.turn)

        idx = np.flatnonzero(self.alive)
        if idx.size == 0:
            self.render = None
            return

        self.age[idx] += 1.0
        age = self.age[idx]

        # random drift only after the "stuck" time (particle sits on the sphere first)
        mv = idx[age > self.stuck[idx]]
        n = mv.size
        if n:
            r = self.rng
            self.vx[mv] += RAND_ACCEL * (r.random(n) * 2.0 - 1.0)
            self.vy[mv] += RAND_ACCEL * (r.random(n) * 2.0 - 1.0)
            self.vz[mv] += RAND_ACCEL * (r.random(n) * 2.0 - 1.0)
            self.x[mv] += self.vx[mv]
            self.y[mv] += self.vy[mv]
            self.z[mv] += self.vz[mv]

        x, y, z = self.x[idx], self.y[idx], self.z[idx]
        dz = z - SPHERE_CZ
        rot_x = cos_a * x + sin_a * dz
        rot_z = -sin_a * x + cos_a * dz + SPHERE_CZ

        m = RADIUS_SP * F_LEN / (F_LEN - rot_z)
        px = rot_x * m + PROJ_C
        py = y * m + PROJ_C

        # attack -> hold -> decay envelope
        alpha = np.where(
            age < ATTACK, age / ATTACK,
            np.where(age < ATTACK + HOLD, 1.0, 1.0 - (age - ATTACK - HOLD) / DECAY),
        )

        outside = (px > PROJ_SIZE) | (px < 0) | (py < 0) | (py > PROJ_SIZE) | (rot_z > Z_MAX)
        kill = (age >= LIFE) | outside
        self.alive[idx[kill]] = False
        keep = ~kill

        depth = np.clip(1.0 - rot_z / ZERO_ALPHA_DEPTH, 0.0, 1.0)
        self.render = (px[keep], py[keep], m[keep], (alpha * depth)[keep])


# ----------------------------------------------------------------------------
# Blob path (CSS-style elliptical border-radius)
# ----------------------------------------------------------------------------
def blob_path(size, radii):
    tlx, trx, brx, blx, tly, try_, bry, bly = [float(v) for v in radii]
    # CSS rule: if radii on a side overflow 100%, scale them all down
    f = min(
        1.0,
        100.0 / (tlx + trx), 100.0 / (blx + brx),
        100.0 / (tly + bly), 100.0 / (try_ + bry),
    )
    tlx, trx, brx, blx, tly, try_, bry, bly = [v * f / 100.0 for v in
                                               (tlx, trx, brx, blx, tly, try_, bry, bly)]
    s = size
    L, T, R, B = -s / 2, -s / 2, s / 2, s / 2

    path = QPainterPath()
    path.moveTo(L + tlx * s, T)
    path.lineTo(R - trx * s, T)
    path.arcTo(QRectF(R - 2 * trx * s, T, 2 * trx * s, 2 * try_ * s), 90, -90)
    path.lineTo(R, B - bry * s)
    path.arcTo(QRectF(R - 2 * brx * s, B - 2 * bry * s, 2 * brx * s, 2 * bry * s), 0, -90)
    path.lineTo(L + blx * s, B)
    path.arcTo(QRectF(L, B - 2 * bly * s, 2 * blx * s, 2 * bly * s), 270, -90)
    path.lineTo(L, T + tly * s)
    path.arcTo(QRectF(L, T, 2 * tlx * s, 2 * tly * s), 180, -90)
    path.closeSubpath()
    return path


# ----------------------------------------------------------------------------
# Reusable widget
# ----------------------------------------------------------------------------
class SyraCore(QWidget):
    def __init__(self, parent=None, show_hud_text=True):
        super().__init__(parent)
        self.setMinimumSize(420, 420)
        self.show_hud_text = show_hud_text

        self.state = "idle"
        self.sphere = ParticleSphere()
        self._tick_acc = 0.0
        self._spawn_acc = 0.0
        self._phase = 0.0       # integrated blob rotation clock
        self._clock = 0.0       # real time, for pulsing
        self._last = time.perf_counter()
        self._glow_cache = {}   # pre-rendered blob glows (rotated every frame)

        self.timer = QTimer(self)
        self.timer.setInterval(16)              # ~60 FPS
        self.timer.timeout.connect(self._frame)
        self.timer.start()

    # ---- public API --------------------------------------------------------
    def set_state(self, state):
        if state in STATES:
            self.state = state
            self.update()

    # ---- simulation --------------------------------------------------------
    def _frame(self):
        now = time.perf_counter()
        dt = min(now - self._last, 0.1)
        self._last = now
        self._clock += dt

        _, rot_speed, spawn_mult, _ = STATES[self.state]
        self._phase += dt * rot_speed

        self._tick_acc += dt * TICKS_PER_SEC
        ticks = min(int(self._tick_acc), MAX_TICKS_PER_FRAME)
        self._tick_acc -= int(self._tick_acc)
        for _ in range(ticks):
            self._spawn_acc += PARTICLES_PER_TICK * spawn_mult
            n = int(self._spawn_acc)
            self._spawn_acc -= n
            self.sphere.step(n)
        self.update()

    # ---- drawing -----------------------------------------------------------
    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.fillRect(self.rect(), BG)

        w, h = self.width(), self.height()
        vmin = min(w, h)
        cx, cy = w / 2.0, h / 2.0 - 14.0

        glow_mult, _, _, pulse_amt = STATES[self.state]
        pulse = 1.0 + pulse_amt * math.sin(self._clock * 2.0 * math.pi * 1.2)

        base_size = max(200.0, min(0.35 * vmin, 400.0))
        core_size = base_size * pulse
        side = max(250.0, min(0.45 * vmin, 500.0))

        self._draw_particles(p, cx, cy, side)
        for i, (radii, period, start, sweep) in enumerate(BLOBS):
            angle = start + sweep * ((self._phase / period) % 1.0)
            self._draw_blob(p, cx, cy, round(base_size), pulse, i, radii, angle, glow_mult)

        # label under the core
        p.setCompositionMode(QPainter.CompositionMode.CompositionMode_SourceOver)
        font = QFont("Orbitron", max(9, int(core_size * 0.04)))
        font.setLetterSpacing(QFont.SpacingType.AbsoluteSpacing, 6)
        p.setFont(font)
        p.setPen(NEON)
        p.drawText(QRectF(0, cy + core_size / 2 + core_size * 0.16 + 4, w, 30),
                   Qt.AlignmentFlag.AlignCenter, "SYRA")

        if self.show_hud_text:
            small = QFont("Orbitron", 9)
            small.setLetterSpacing(QFont.SpacingType.AbsoluteSpacing, 4)
            p.setFont(small)
            p.setPen(NEON)
            p.drawText(QRectF(24, 16, 300, 20),
                       Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter, "SYRA")
            p.setPen(QColor(110, 125, 160))
            label = "ONLINE" if self.state == "idle" else self.state.upper()
            p.drawText(QRectF(w - 324, 16, 300, 20),
                       Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter,
                       "\u25CF  " + label)
        p.end()
        event.accept()

    def _draw_particles(self, p, cx, cy, side):
        data = self.sphere.render
        if data is None:
            return
        px, py, m, a = data
        if px.size == 0:
            return

        scale = side / PROJ_SIZE
        ox, oy = cx - side / 2.0, cy - side / 2.0
        rad = (m * PARTICLE_RAD * scale)
        lv = np.minimum((a * ALPHA_LEVELS).astype(int), ALPHA_LEVELS - 1)

        p.setCompositionMode(QPainter.CompositionMode.CompositionMode_SourceOver)
        p.setPen(Qt.PenStyle.NoPen)
        r, g, b = PARTICLE_RGB
        for level in range(ALPHA_LEVELS):
            sel = np.flatnonzero(lv == level)
            if sel.size == 0:
                continue
            p.setBrush(QColor(r, g, b, int(255 * (level + 0.5) / ALPHA_LEVELS)))
            xs = (ox + px[sel] * scale).tolist()
            ys = (oy + py[sel] * scale).tolist()
            rs = rad[sel].tolist()
            for x, y, rr in zip(xs, ys, rs):
                p.drawEllipse(QPointF(x, y), rr, rr)

    def _glow_image(self, size, radii, intensity):
        """Render one blob's glow ring once (transparent ARGB image)."""
        glow = size * 0.16
        dim = int(size + glow * 2 + 8)
        img = QImage(dim, dim, QImage.Format.Format_ARGB32_Premultiplied)
        img.fill(Qt.GlobalColor.transparent)
        q = QPainter(img)
        q.setRenderHint(QPainter.RenderHint.Antialiasing)
        q.translate(dim / 2.0, dim / 2.0)
        q.setCompositionMode(QPainter.CompositionMode.CompositionMode_Plus)
        q.setBrush(Qt.BrushStyle.NoBrush)
        path = blob_path(size, radii)
        steps = 14
        layer_alpha = int(min(255, 9 * intensity))
        for k in range(steps, 0, -1):
            pen = QPen(QColor(10, 20, 255, layer_alpha), 2.0 * glow * k / steps)
            pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
            q.setPen(pen)
            q.drawPath(path)
        q.end()
        return img

    def _draw_blob(self, p, cx, cy, size, pulse, i, radii, angle, intensity):
        """Glow ring: stacked strokes centred on the edge give both the outer
        box-shadow and the inset glow. Cached once, then only rotated per frame."""
        key = (i, size, intensity)
        img = self._glow_cache.get(key)
        if img is None:
            if len(self._glow_cache) > 24:
                self._glow_cache.clear()
            img = self._glow_cache[key] = self._glow_image(size, radii, intensity)

        p.save()
        p.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)
        p.translate(cx, cy)
        p.rotate(angle)
        p.scale(pulse, pulse)
        p.setCompositionMode(QPainter.CompositionMode.CompositionMode_Plus)
        p.drawImage(QPointF(-img.width() / 2.0, -img.height() / 2.0), img)
        p.restore()

    # ---- demo keys ---------------------------------------------------------
    def keyPressEvent(self, e):
        keys = {Qt.Key.Key_1: "idle", Qt.Key.Key_2: "listening",
                Qt.Key.Key_3: "thinking", Qt.Key.Key_4: "speaking"}
        if e.key() in keys:
            self.set_state(keys[e.key()])
        elif e.key() == Qt.Key.Key_F11:
            win = self.window()
            win.showNormal() if win.isFullScreen() else win.showFullScreen()
        elif e.key() == Qt.Key.Key_Escape:
            self.window().close()


def main():
    app = QApplication(sys.argv)
    core = SyraCore()
    core.setWindowTitle("SYRA Core")
    core.resize(960, 720)
    core.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
    core.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()

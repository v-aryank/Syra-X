# SYRA X Core Migration Notes

Status: Canvas 2D browser prototype implemented; visual comparison and target-device profiling remain

## Source discovery and identity

The expected path `reference/original-python-core/core.py` exists in the current working tree. It is the only project-owned Python source under `reference/` when virtual environments are excluded. The ignored `reference/.venv/` contains third-party package sources and is not a SYRA core candidate.

| Path | Working-tree status | Size | Modified |
| --- | --- | ---: | --- |
| `reference/original-python-core/core.py` | Present | 14,717 bytes | 2026-11-06 23:52:19 +0600 |
| `reference/original-python-core.py` | Absent from working tree; still present in `HEAD` | 14,717 bytes in `HEAD` | No current filesystem timestamp |

The SHA-256 of the current `core.py` is `ccfa3e2cf61e7967dd1a3bf99767b8bad9372ca6cdb31ff1b110205b4a7c517d`. The Git blob for the formerly tracked `reference/original-python-core.py` has the same size and SHA-256. This verifies that the current candidate is byte-for-byte the same repository file previously stored at the alternate path.

The file identifies itself as a standalone PyQt6 port of a web UI core and describes its particle implementation as a NumPy port of an original `script.js`. That establishes the identity of the repository candidate, but the referenced `script.js` and any independent provenance record are not present in `reference/`; the upstream lineage is therefore not independently verified.

## Source-backed implementation findings

### Architecture and dependencies

`SyraCore` is a reusable `QWidget` with a 420 × 420 minimum size; the demo window starts at 960 × 720. It owns a `ParticleSphere`, state, timing accumulators, a glow-image cache, and a 16 ms `QTimer`. `paintEvent` draws the background, particles, three organic outlines, a SYRA label, and optional HUD text. `set_state` accepts `idle`, `listening`, `thinking`, or `speaking` and schedules repainting. Demo keyboard shortcuts select those states, toggle fullscreen, and close the window.

Imports show dependencies on PyQt6 and NumPy, plus Python standard-library `sys`, `math`, `time`, and `os`. `reference/requirements.txt` pins NumPy 2.5.4, PyQt6 6.12.0, PyQt6-Qt6 6.12.0, and PyQt6-sip 13.13.0. At import time the source defaults `QT_QPA_PLATFORMTHEME` to `generic` to avoid a Linux desktop settings-schema crash. It contains no other operating-system control or integration.

### Particle model, geometry, and movement

- A fixed-capacity pool stores up to 6,000 particles in separate NumPy arrays for alive flags, position, velocity, age, and initial stuck duration.
- Spawn positions are uniform samples on a sphere of radius 140: azimuth is uniform over a full turn and the cosine of the polar angle is uniform. The sphere center is offset to z = -143.
- Initial velocity is 0.002 times the sampled sphere coordinates. Particles remain still for a random 90–110 simulation ticks, then each axis receives independent random acceleration in [-0.1, 0.1] per tick; position advances by velocity. There is no force that pulls drifting particles back to the sphere.
- The simulation rotates positions around the Y axis. `TURN_SPEED` is 2π/1200 per simulation tick, equivalent to one revolution per 1,200 ticks.
- Projection is manual perspective onto a 500 × 500 reference plane, with focal length 320. Projected particle radius also scales with perspective. Particles are removed when their 200-tick life ends or when they pass the projection bounds / near-plane limit.
- Opacity uses a 50-tick linear attack, 50-tick hold, and 100-tick linear decay, multiplied by depth darkening. Particle RGB is (25, 25, 255).

### Timing and performance

The QWidget timer requests about 60 paint updates per second. Simulation uses a fixed 150 ticks per second, spawning 8 particles per tick before the state multiplier. A fractional accumulator preserves non-integer spawn amounts. A frame runs at most 8 simulation steps; if it accumulates more, the current code subtracts the full integer backlog while executing only 8 steps, so excess simulation time is dropped after a long frame. Frame delta is also clamped to 0.1 seconds.

Each simulation step uses NumPy array operations and `flatnonzero` to select live/moving particles. Drawing groups particles into 12 alpha buckets but still draws each particle as an individual ellipse. This bounds storage at 6,000 particles; browser performance at equivalent counts, especially on mobile, still needs profiling.

### Organic shapes and glow

Three independently rotating shapes use eight CSS-style elliptical corner radii. `blob_path` normalizes overflowing radii and builds each outline with `QPainterPath` lines and corner arcs. Their configured periods are 6, 4, and 8 seconds, with different starting angles and sweep lengths.

Each glow is rendered once to a transparent `QImage` and cached by shape index, size, and intensity. The cache is cleared after it grows beyond 24 entries. The glow uses 14 increasingly wide blue strokes with additive composition. Each frame transforms the cached image by translation, rotation, and pulse scaling, also with additive composition. Antialiasing and smooth pixmap transforms are enabled. The source does not draw particle trails or use a gradient fill; the glow is produced by layered strokes.

### State mapping

The state tuple is `(glow intensity, rotation speed, spawn multiplier, pulse amount)`:

| State | Glow | Rotation | Spawn | Pulse |
| --- | ---: | ---: | ---: | ---: |
| idle | 1.00 | 1.0 | 1.0 | 0.00 |
| listening | 1.25 | 1.4 | 1.2 | 0.02 |
| thinking | 1.10 | 2.2 | 1.0 | 0.00 |
| speaking | 1.45 | 1.8 | 1.5 | 0.05 |

Pulse is sinusoidal at 1.2 Hz and scales the blob outlines. There is no separate continuous energy/intensity API and no `searching` state. State changes are the source of the visual variation in this implementation.

## Qt-specific behavior

`QWidget`, `QTimer`, `paintEvent`, `QPainter`, `QPainterPath`, `QImage`, `QColor`, `QPen`, Qt composition modes, Qt fonts, keyboard events, and top-level window fullscreen/close behavior require browser equivalents or product-level decisions. `QApplication` owns the desktop event loop. The `QT_QPA_PLATFORMTHEME` setting is specifically a Qt/Linux desktop workaround. These Qt classes and calls should not be copied into browser code.

## Browser migration feasibility

### Canvas 2D

Canvas 2D directly matches the source's final rendering model: the particle positions are already rotated and projected to a 2D plane, and the visual output consists of circles plus 2D paths and transformed glow images. JavaScript typed arrays can hold the bounded particle pool; `requestAnimationFrame` can drive the fixed-step simulation; `Path2D`, arcs, offscreen canvases, alpha buckets, transforms, and `globalCompositeOperation = "lighter"` can reproduce the path and additive-glow approach.

This is the smallest fit with the current source and existing TRD options. The main performance risk is issuing thousands of per-particle Canvas draw operations instead of NumPy vector operations. Profile the 6,000-particle cap on target desktop and mobile devices; use offscreen sprite caching or batching only if measurements justify it. Exact antialiasing, font availability, and additive blending may differ from Qt and require visual tuning.

### Three.js

Three.js could represent particles as 3D points and use a perspective camera, point sprites, additive blending, lights, or shaders. However, this source does not render a 3D mesh, use a scene camera, or perform lighting/shader work. It calculates a simple Y rotation and perspective projection itself, then draws all output with a 2D painter. Three.js would add a scene/rendering abstraction and dependency without a source-backed need. It could become preferable if Canvas profiling fails or a later approved design requires true 3D effects.

### Recommendation

Use Canvas 2D for the first browser renderer prototype. This recommendation follows the source's manual 3D-to-2D projection, individual ellipse drawing, and 2D glow-path rendering; it avoids introducing a 3D engine for a visual model that is already painter-based. Treat performance and Qt-vs-browser blend fidelity as prototype questions, not assumed guarantees.

## Uncertainties and risks

- The candidate's identity as the previous repository reference is verified by an exact hash match. Its claim to derive from a separate original `script.js` is only in its docstring; that upstream file is unavailable here.
- `set_state` maps activity states but there is no continuous energy control; any future energy API would be a design addition rather than a port of an existing API.
- Random-number sequences will differ between NumPy and a browser implementation unless the generator and seed behavior are deliberately matched. Exact particle-by-particle visual snapshots are therefore not guaranteed by a direct port.
- The capped update loop drops excess ticks after long frames. A browser port should preserve the intended fixed-step behavior while choosing and documenting a deliberate catch-up policy.
- Qt font fallback, stroke rasterization, image filtering, and additive composition can vary from Canvas. Visual comparisons are required.
- No target-device performance measurements or screenshots were available as part of this source inspection.

## Suggested migration phases

1. Preserve reference screenshots at fixed widget sizes and each supported state; record the source constants and current behavior as fixtures.
2. Define a renderer-only interface for `setState`, resize, visibility, reduced-motion preference, and cleanup. Keep conversation and API state outside the renderer.
3. Port particle lifecycle, fixed-step timing, Y rotation, perspective projection, and alpha/depth rules to Canvas 2D, preserving constants initially.
4. Port the three `Path2D`-like organic outlines, cached additive glow layers, pulse, labels, and state mapping; compare screenshots against the PyQt reference.
5. Profile at representative desktop/mobile sizes, check hidden-tab and reduced-motion behavior, and tune only where browser differences or measurements require it.

## Canvas 2D prototype implementation

The React prototype is implemented in `frontend/src/components/core/`. `coreEngine.js` owns the bounded particle simulation, projection, organic paths, glow cache, state constants, waveform, and drawing. `SyraCore.jsx` owns the canvas lifecycle and exposes `state`, `particleCap`, `showHud`, and optional `onPerformance` props. It uses `requestAnimationFrame`, a capped 2× device-pixel ratio, `ResizeObserver` with a window-resize fallback, visibility handling, reduced-motion handling, and effect cleanup. In development, keys 1–4 select idle, listening, thinking, and speaking; the particle-cap selector remains available. These controls are not assistant integrations.

### Implemented from the reference

- Configurable pool capped at the source maximum of 6,000; the default is 1,400 and devices reporting four or fewer CPU cores (or at most 4 GB device memory) are assigned 900.
- Uniform spherical spawn positions at radius 140, z-center offset -143, initial velocity, random 90–110 tick pause, per-axis random acceleration and drift, 200-tick life, alpha envelope, Y rotation, manual perspective projection, 12 alpha buckets, and source-sized/timed fixed-step updates with an eight-step frame cap.
- Three configured organic outlines, their independent rotations, source state tuple values, 1.2 Hz pulse, and a cached 14-layer additive blue glow rendered from offscreen canvases.
- A fixed waveform position below the sphere with a bright main sine trace and softer delayed echo traces, following the supplied visual reference. The wave scrolls in listening and speaking and stays flat in idle and thinking. The former SYRA canvas labels have been removed.
- Four parent-controlled visual states and a static bounded particle field when reduced motion is requested.

### Differences from the Python implementation

- Canvas 2D replaces QWidget/QPainter/QImage and Qt's 16 ms timer. The animation cadence now follows the browser's `requestAnimationFrame`; simulation remains 150 ticks per second with the source's eight-step cap and dropped-backlog policy.
- Typed arrays replace NumPy arrays. JavaScript `Math.random` and a LIFO free-slot stack do not reproduce NumPy's random sequence or its live-index ordering, so individual particle trajectories differ even though the distribution and rules are retained.
- Browser Canvas path rasterization, offscreen image filtering, font rendering, and `lighter` compositing differ from Qt. The existing app supplies the dark background; the component canvas is transparent. These differences still need side-by-side visual comparison with the desktop source.
- The browser prototype adds configurable caps, device-based initial cap selection, responsive high-DPI sizing, visibility/reduced-motion handling, a layered state waveform, 1–4 keyboard shortcuts, development performance/cap controls, and a near-black app background. These are browser lifecycle and interface adaptations, not behaviors present in the PyQt source.
- The reduced-motion mode displays a stable, prefilled field rather than animating; it does not simulate the source's changing field while reduced motion is enabled.

### Prototype observations

In the in-app desktop browser preview, the development HUD reported these point-in-time samples (performance varies with host load; active count varies as particles age and leave the projection bounds):

| Configured cap | Observed active particles | HUD frame rate | Engine frame time |
| ---: | ---: | ---: | ---: |
| 600 | 600 | 54–59 FPS | 0.98–1.02 ms |
| 1,200 | 1,200 | 41 FPS | 1.29 ms |
| 1,400 | about 1,392 | 58–60 FPS | about 1.8–1.96 ms |
| 3,000 | 1,824 | 52 FPS | 1.35 ms |
| 6,000 | 1,812 | 61 FPS | 1.19 ms |

These are short, local browser observations, not a benchmark: FPS includes browser scheduling while the displayed engine frame time measures `advance` plus draw work and can understate the total page cost. The pool cap is not the same as the active count. The in-app desktop preview was used; no physical mobile device was tested. No console errors were observed during the preview. The four state controls changed the canvas accessibility label/state, the app remained visible in the tested browser window, and development hot reload exercised repeated effect cleanup/setup; a dedicated unmount assertion and explicit viewport-resize test remain outstanding.

### Remaining migration work

1. Capture PyQt reference screenshots at fixed sizes in all four states and compare them side by side with Canvas output; tune only source-backed geometry/effect mismatches.
2. Verify resize behavior at narrow and wide viewport dimensions, reduced-motion preference changes, hidden-tab pause/resume, and actual unmount cleanup in a controlled browser harness.
3. Profile sustained animation at representative caps on target desktop and physical mobile hardware. Choose a production default from those measurements; the current 1,400/900 defaults are conservative prototype settings, not validated device guarantees.
4. Decide whether the development state/cap/HUD controls remain in the product shell or move to a development-only harness before the next UI phase.

The original PyQt6 source remains unchanged. No Three.js dependency, voice integration, or backend coupling was added.

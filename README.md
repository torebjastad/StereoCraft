# StereoCraft 👁️✨

> A modern, sleek web platform for creating, tuning, and viewing 3D autostereograms (Magic Eye / SIRDS & SIS) using the Thimbleby-Inglis-Witten symmetric equivalence class algorithm.

---

## Quick Start

```powershell
# Install dependencies
npm.cmd install

# Run the development server
npm.cmd run dev

# Run unit tests
npm.cmd test

# Compile production build
npm.cmd run build
```

Open your browser at **`http://127.0.0.1:5173/`**.

---

## Documentation Structure

Comprehensive scientific, mathematical, and architectural documentation is stored in the `docs/` directory:

* [**AGENTS.md**](./AGENTS.md) — Top-level development guidelines and architectural rules for AI agents and developers.
* [**System Architecture**](./docs/architecture.md) — Technical pipeline, module separation, dataflow, and performance profiles.
* **Knowledge Base**:
  * [**01. Stereogram Fundamentals & Stereopsis**](./docs/knowledge/01-stereogram-fundamentals.md) — History, physiology of human binocular vision, Vergence-Accommodation Conflict (VAC), and Panum's area.
  * [**02. Mathematics & Algorithms**](./docs/knowledge/02-mathematics-and-algorithms.md) — Geometric ray-tracing, disparity formulas, Thimbleby-Inglis-Witten Union-Find solver, and line-of-sight occlusion ray marching.
  * [**03. Visual Clarity & Optics Optimization**](./docs/knowledge/03-visual-clarity-and-optics-optimization.md) — Pattern period formulation based on screen DPI, disparity tuning, dot grain scale ($2-3\text{px}$), and Gaussian depth anti-aliasing.
  * [**04. Revealing & Perception Methods**](./docs/knowledge/04-revealing-and-perception-methods.md) — Dual convergence guide dots, cross-eyed vs parallel viewing, motion parallax wigglegrams, and WebGL Three.js 3D displacement mesh inspection.
  * [**05. Future Expansions Roadmap**](./docs/knowledge/05-future-expansions-roadmap.md) — 3D text distance transforms, SVG path extrusion, 3D model baking (GLTF/OBJ), and WebGL fragment shaders.

---

## Features

* **Interactive 2D Stage Editor**: Place, drag, rotate, and scale circles, squares, triangles, and 5-to-12 point stars with real-time bounding box manipulation.
* **3D Relief Profiles**: Choose between Flat plateau, Spherical Dome, Conical Pyramid, and Beveled Chamfer profiles for each shape.
* **Thimbleby-Inglis-Witten Engine**: Symmetrical equivalence class constraint satisfaction with line-of-sight ray marching to eliminate echo streaks.
* **Multiple Textures & Palettes**: Retro 90s Neon confetti, Micro-contrast color noise, Cosmic Nebula, Organic Perlin flow, Desert Sand, and custom image drag-and-drop.
* **Parallel vs Cross-Eyed Mode**: 1-click toggle to invert disparity so both divergent and convergent viewers see popping 3D geometry.
* **Interactive Revealers**:
  * Dual pulsing convergence guide dots (`● ● ●` visual fusion lock).
  * Smooth "Hold to Peek" cross-fade slider ($0-100\%$).
  * Animated 3D Wigglegram ($6-10\text{ Hz}$ motion parallax).
* **3D Stereoscopic Labyrinth Game Mode**:
  * Procedural recursive-backtracking random maze generation (Easy 7×5, Medium 11×8, Hard 15×11).
  * Smooth 3D physics ball rolling with wall collision handling and tactile depth elevation.
  * Real-time 3D embossed stopwatch timer integrated into the stereogram depth buffer.
  * Centered layout with generous margins to prevent peripheral vergence breakdown.
  * Hold-to-peek 2D X-Ray depth radar and best-time tracking.
* **4K UHD & High-DPI Display Support**:
  * Crisp resolution presets from 800×600 up to 4K UHD (3840×2160).
  * Extended optics tuning with period $S$ up to $320\text{px}$ and disparity $\Delta S$ up to $70\text{px}$.
  * 1-Click "Auto-Tune Optics" to instantly calculate ideal eye divergence across any display DPI.
  * Multi-scale grain sizes ($1\text{px}$ to $5\text{px}$) for tactile micro-contrast binocular fusion.
* **Export**: High-resolution 3D stereogram PNG and 16-bit depth map PNG downloads.

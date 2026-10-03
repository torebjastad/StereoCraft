# AGENTS.md — Agent & Developer Instructions for StereoMagic Studio

Welcome! This document provides instructions, architectural rules, and operational guidelines for AI agents and human engineers working on the **StereoMagic Studio** codebase.

---

## 1. Project Mission & Overview

**StereoMagic Studio** is a high-performance web platform for creating, tuning, and viewing 3D autostereograms (Single Image Random Dot Stereograms — SIRDS, and Single Image Textured Stereograms — SIS).

Key goals:
* Provide mathematically optimal stereogram generation based on the Thimbleby-Inglis-Witten algorithm.
* Offer an intuitive 2D canvas editor for placing, rotating, scaling, and elevating 3D shapes.
* Deliver multi-faceted visual revealing tools (Convergence Guide Dots, Hold-to-Peek cross-fading, 3D Wigglegrams, and Three.js WebGL 3D displacement mesh inspection).
* Maintain a test-driven development (TDD) workflow with instant test feedback and headless visual verification.

---

## 2. Environment & CLI Commands (Windows PowerShell)

> [!IMPORTANT]
> On Windows PowerShell, the script execution policy may restrict `npm.ps1`. Always execute NPM commands using **`npm.cmd`** or **`npx.cmd`**.

| Command | Action | Notes |
| :--- | :--- | :--- |
| `npm.cmd run dev` | Start Vite dev server | Launches on `http://127.0.0.1:5173/`. Runs as background daemon. |
| `npm.cmd test` | Run Vitest unit tests | Runs all tests in `src/core/__tests__/`. Must always pass with 0 errors. |
| `npm.cmd run build` | Compile TypeScript & build bundle | Performs `tsc` type checking and Vite production bundling. |

---

## 3. Directory Layout & Knowledge Base

```
Stereogram/
├── docs/
│   ├── architecture.md                   # System design, dataflow diagram & performance profile
│   └── knowledge/                        # Domain knowledge & mathematical formulations
│       ├── 01-stereogram-fundamentals.md  # History, stereopsis, VAC conflict & Panum's area
│       ├── 02-mathematics-and-algorithms.md # Triangulation, Thimbleby Union-Find & ray marching
│       ├── 03-visual-clarity-and-optics-optimization.md # Period, disparity, grain & smoothing
│       ├── 04-revealing-and-perception-methods.md # Guide dots, cross-eyed parity & wigglegrams
│       └── 05-future-expansions-roadmap.md # 3D text, SVG paths, GLTF models & GPU shaders
├── src/
│   ├── types/
│   │   └── index.ts                      # Core interfaces & configuration models
│   ├── core/
│   │   ├── depthRenderer.ts              # 2D shape rasterization, bounding boxes, Gaussian blur
│   │   ├── stereogramEngine.ts           # Thimbleby SIRDS/SIS engine & procedural patterns
│   │   ├── wigglegram.ts                 # Parallax view synthesis for motion stereoscopy
│   │   ├── mazeGenerator.ts              # Procedural recursive-backtracking maze generator
│   │   ├── textDepthRenderer.ts          # 3D alphanumeric embossed text rasterizer
│   │   ├── labyrinthRenderer.ts          # 3D labyrinth depth compositor & ball physics
│   │   └── __tests__/                    # Vitest unit test suites (21 unit tests)
│   ├── components/
│   │   ├── Header.tsx                    # Top navigation, mode switch, presets, celebration
│   │   ├── StageEditor.tsx               # 2D canvas drag/scale stage
│   │   ├── ShapePalette.tsx              # Shape creation toolbar
│   │   ├── ShapeInspector.tsx            # Depth, profile, rotation, scale controls
│   │   ├── StereogramViewport.tsx        # Viewport tabs, main canvas, peek slider, wigglegram
│   │   ├── SettingsPanel.tsx             # Optics, disparity, patterns, and resolution
│   │   ├── MeshReliefViewer.tsx          # Three.js WebGL 3D relief heightfield
│   │   ├── ViewingGuideModal.tsx         # Educational modal trainer
│   │   └── LabyrinthGame.tsx             # Interactive 3D stereoscopic labyrinth game mode
│   ├── App.tsx                           # Main application layout & preset compositions
│   └── main.tsx                          # React 19 mount point
```

---

## 4. Key Architectural Invariants & Rules

When modifying or expanding the codebase, agents MUST adhere to these design principles:

### A. Coordinate System & Depth Space
* All depth maps are stored as a 1D `Float32Array` of size `width * height`.
* Normalized depth values $z \in [0.0, 1.0]$:
  * $z = 0.0$: Far plane / flat background.
  * $z = 1.0$: Closest near plane / highest 3D elevation.
* Pixel index in depth map buffer: `idx = y * width + x`.

### B. Disparity Sign & Viewing Parity
* **Parallel Mode (Wall-Eyed / Divergent)**:
  $$\text{Separation } s(z) = S_{\text{base}} - \text{round}(z \cdot \Delta S)$$
  (Foreground points have smaller separation).
* **Cross-Eyed Mode (Convergent)**:
  $$\text{Separation } s(z) = S_{\text{base}} + \text{round}(z \cdot \Delta S)$$
  (Foreground points have larger separation).
* Disparity $\Delta S$ should be clamped between $15\%$ and $24\%$ of $S_{\text{base}}$ to avoid diplopia (double vision).

### C. Occlusion Handling (Line-of-Sight Ray Marching)
* In [`stereogramEngine.ts`](file:///c:/Users/toreb/OneDrive/Code/Stereogram/src/core/stereogramEngine.ts), never remove the line-of-sight ray checks.
* The ray from eye position $z_{\text{eye}} \approx 2.0$ through the screen to $(x, z)$ must not be intersected by surface points with height greater than the ray line. This prevents ghost echo streaks.

### D. Separation of Concerns & Testability
* Keep `src/core/` pure and decoupled from React or DOM elements.
* Core functions take typed arrays (`Float32Array`, `Int32Array`, `Uint8ClampedArray`) and configuration objects so they can run headlessly in Vitest, Node.js, Web Workers, or CI/CD pipelines without DOM dependencies.

---

## 5. Development Workflow & TDD Protocol

1. **Test-Driven First**: When introducing new depth shapes, profiles, or stereogram algorithms:
   * Write unit tests in `src/core/__tests__/` first.
   * Run `npm.cmd test` to verify expected failure and passing states.
2. **Type Safety & Build**:
   * Run `npm.cmd run build` to verify strict TypeScript compilation (`tsc`) and Vite bundling.
   * Avoid `any` types; define explicit interfaces in [`src/types/index.ts`](file:///c:/Users/toreb/OneDrive/Code/Stereogram/src/types/index.ts).
3. **Visual Verification**:
   * Use headless Chrome or the running dev server to take screenshots and visually inspect stereograms and 3D relief meshes whenever UI or rendering logic changes.

---

## 6. How to Extend the Application

### Adding a New Shape (e.g. Hexagon, Heart, or Text)
1. Add type in [`src/types/index.ts`](file:///c:/Users/toreb/OneDrive/Code/Stereogram/src/types/index.ts) (`ShapeType`).
2. Implement local coordinate distance function in [`src/core/depthRenderer.ts`](file:///c:/Users/toreb/OneDrive/Code/Stereogram/src/core/depthRenderer.ts).
3. Add unit tests in [`depthRenderer.test.ts`](file:///c:/Users/toreb/OneDrive/Code/Stereogram/src/core/__tests__/depthRenderer.test.ts).
4. Add creation button with Lucide icon in [`ShapePalette.tsx`](file:///c:/Users/toreb/OneDrive/Code/Stereogram/src/components/ShapePalette.tsx).
5. Add 2D stage drawing path in [`StageEditor.tsx`](file:///c:/Users/toreb/OneDrive/Code/Stereogram/src/components/StageEditor.tsx).

### Adding a New Pattern
1. Add pattern ID in [`PatternType`](file:///c:/Users/toreb/OneDrive/Code/Stereogram/src/types/index.ts).
2. Implement color sampler case in [`samplePatternColor`](file:///c:/Users/toreb/OneDrive/Code/Stereogram/src/core/stereogramEngine.ts#L70).
3. Add button card in [`SettingsPanel.tsx`](file:///c:/Users/toreb/OneDrive/Code/Stereogram/src/components/SettingsPanel.tsx).

# Future Expansions & Architectural Roadmap

## 1. 3D Text & Typography Rendering

The depth buffer architecture in [`depthRenderer.ts`](file:///c:/Users/toreb/OneDrive/Code/Stereogram/src/core/depthRenderer.ts) is fully decoupled from the stereogram engine, making it trivial to add embossed and extruded 3D typography.

### Implementation Strategy:
1. **Font Rasterization**: Render user text onto an offscreen canvas using Google Fonts or custom font uploads.
2. **Euclidean Distance Transform (EDT)**:
   * Compute the distance $d(x, y)$ from every pixel to the nearest glyph boundary.
   * Applying a smoothstep curve $z(d) = z_{\text{base}} \cdot \min(1, d / \text{bevelWidth})$ creates gorgeous, rounded or chiseled 3D embossed lettering.
3. **Multi-Line & Custom Fonts**: Add font selector (bold serif, slab, geometric sans) and depth level slider.

---

## 2. SVG Vector Path Import & Extrusion

Users can import arbitrary vector artwork (logos, icons, silhouettes) and convert them into 3D relief:

1. Parse SVG `<path>` elements using browser-native `Path2D`.
2. Fill path into depth canvas with assigned elevation $Z$.
3. Apply Gaussian smoothing to soften vector corners and prevent binocular tearing.

---

## 3. Full 3D Model Baking (GLTF / OBJ / STL)

Instead of relying solely on 2D parametric shapes, the studio can accept arbitrary 3D polygonal models:

1. Load `.gltf` or `.obj` files using Three.js loaders (`GLTFLoader`, `OBJLoader`).
2. Render the 3D scene from an orthographic or perspective camera into a `WebGLRenderTarget` using a depth shader:
   $$\text{FragColor} = \text{vec4}(\text{vec3}(z_{\text{normalized}}), 1.0)$$
3. Read the depth buffer directly into the existing [`generateStereogram`](file:///c:/Users/toreb/OneDrive/Code/Stereogram/src/core/stereogramEngine.ts#L160) engine.
4. Enables instant creation of intricate Magic Eye stereograms from 3D scans, statues, dinosaurs, aircraft, or video game assets!

---

## 4. Multi-Layer Boolean Operations (CSG)

Expand the current layered composition to support constructive solid geometry operations:
* **Union**: $\max(Z_1, Z_2)$
* **Difference (Carving / Holes)**: $\max(0, Z_1 - Z_2)$ (allows cutting hollow windows, engravings, or stamping holes into objects)
* **Intersection**: $\min(Z_1, Z_2)$

---

## 5. GPU Shader Real-Time Stereograms (Video & Interactive Games)

While our TypeScript/typed array CPU engine processes $800 \times 600$ in $\approx 15\text{ ms}$, real-time full-screen $4\text{K}$ video or stereoscopic games can be implemented in a single WebGL fragment shader:

* Texture 0: Depth buffer (updated per frame via Three.js or video element).
* Texture 1: Pattern tile.
* Fragment shader iteratively samples color constraints horizontally using a fast loop.
* Enables interactive games (e.g. Stereogram Asteroids, Flappy Bird, or 3D terrain flight).

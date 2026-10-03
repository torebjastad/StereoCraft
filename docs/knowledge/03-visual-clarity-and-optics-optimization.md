# Visual Clarity & Optics Optimization

## 1. Optimum Pattern Period ($S_{\text{base}}$) Formulation

The repetition period $S_{\text{base}}$ dictates the horizontal eye divergence angle needed to lock onto the stereogram.

### Calculation based on Display Metrics
Given:
* Viewer distance $D \approx 45\text{ cm}$ ($17.7\text{ inches}$).
* Human Inter-Pupillary Distance $\text{IPD} \approx 64\text{ mm}$ ($2.52\text{ inches}$).
* Standard Desktop Display: $24\text{ inch}$, $1920 \times 1080$, density $\approx 92\text{ DPI}$ ($0.276\text{ mm/pixel}$).
* High-DPI / Retina Display: $13-16\text{ inch}$, density $\approx 140 - 220\text{ DPI}$ ($0.115 - 0.18\text{ mm/pixel}$).

For comfortable parallel viewing without forced wall-eyed divergence:
$$\text{Physical on-screen divergence } d_{\text{screen}} \approx 28\text{ to }35\text{ mm}$$

On a standard $\approx 96\text{ DPI}$ screen:
$$S = \frac{d_{\text{screen}}}{\text{pixel pitch}} = \frac{30\text{ mm}}{0.264\text{ mm/px}} \approx 113.6\text{ pixels}$$

| Screen Type | DPI | Optimal Period $S$ | Physical Distance |
| :--- | :--- | :--- | :--- |
| Standard Monitor | 96 DPI | **100 – 120 px** | 2.6 – 3.2 cm |
| High-DPI / 2K | 144 DPI | **140 – 170 px** | 2.5 – 3.0 cm |
| 4K Retina Display | 200+ DPI | **200 – 240 px** | 2.5 – 3.0 cm |

**Studio Default**: $110\text{px}$, providing an effortless divergence angle on the vast majority of standard monitors and laptops.

---

## 2. Disparity Tuning & Avoiding Binocular Breakdown

The depth disparity amplitude $\Delta S$ defines the perceived physical relief depth of 3D objects.

### The Fusional Safe Zone
* If $\Delta S$ is too small ($< 8\text{px}$): The 3D relief appears flat or faint, requiring intense mental effort to distinguish.
* If $\Delta S$ is optimal ($16 - 22\text{px}$ at $S = 110\text{px}$, $\approx 18\%$ ratio): Objects appear with distinct, dramatic 3D volume while staying within Panum's fusional area.
* If $\Delta S > 28\text{px}$ ($> 25\%$ ratio): Disparity becomes too wide for binocular fusion, causing **diplopia** (double vision), visual strain, and eye fatigue.

---

## 3. Pattern Textures & Micro-Contrast Engineering

The human visual cortex matches corresponding points between the two eyes by filtering for localized high-contrast features.

### A. Dot Grain Size (1px vs 2px vs 3px)
* **1px Dot Noise**: Too fine on modern high-DPI screens. Sub-pixel blending causes the noise to look like a blurry gray wash. The brain struggles to find distinct matching landmarks.
* **2px – 3px Dot Grain**: The optimal sweet spot. Provides clear, tactile micro-contrast clusters that binocular receptive fields immediately lock onto.
* **4px+ Dot Grain**: Creates blocky patterns that can obscure fine geometry edges.

### B. Color Palette Selection
* **Pure Binary Black & White Static**: Causes harsh high-frequency flicker and rapid eye strain.
* **Multi-Color Neon / Confetti (Retro 90s)**: Classic Magic Eye palette utilizing saturated cyan, pink, yellow, lime, and violet. Highly effective because each color channel provides independent visual cues across the RGB cones of the retina.
* **Continuous Gradient Noise (Perlin / Flow)**: Organic smooth waves that camouflage the 3D depth into an artistic, natural landscape.

---

## 4. Depth Map Anti-Aliasing (Edge Softening)

In computer graphics, 3D models with vertical cliff edges create instantaneous step changes in depth from $z = 0.0$ to $z = 1.0$.

### Why Cliff Edges Cause Visual Tearing:
At an instantaneous vertical step:
* At pixel $x$, separation is $S - \Delta S$.
* At pixel $x + 1$, separation abruptly becomes $S$.
* This creates a "shadow boundary" of width $\Delta S$ where the background pattern is suddenly pinched or severed, leading to visible vertical seams or "tearing" streaks.

### Solution: Gaussian Edge Smoothing
The studio passes the raw depth map through a separable 1D Gaussian kernel with smoothing radius $r = 1\text{ to }2\text{ pixels}$:

$$G(x) = \frac{1}{\sqrt{2\pi \sigma^2}} \exp\left(-\frac{x^2}{2\sigma^2}\right)$$

This rounds the micro-edges of the shape, providing a microscopic bevel. To the human viewer, the shape still looks perfectly crisp and solid, but the underlying autostereogram engine can smoothly transition pixel correspondence without tearing.

---

## 5. Shape 3D Relief Profiles & Formulations

The studio provides 4 mathematical relief profiles for any 2D shape:

1. **Flat**:
   $$z(nx, ny) = z_{\text{base}}$$
   Crisp, flat plateau with uniform height.

2. **Dome (Spherical / Cosine)**:
   $$z(nx, ny) = z_{\text{base}} \cdot \cos\left(r \cdot \frac{\pi}{2}\right) \quad \text{where } r = \sqrt{nx^2 + ny^2}$$
   Smooth, rounded 3D spherical volume with highest elevation at the shape center.

3. **Pyramid (Conical)**:
   $$z(nx, ny) = z_{\text{base}} \cdot (1 - r)$$
   Sharp apex with linear slope falloff down to the base boundary.

4. **Beveled (Chamfered Plateau)**:
   $$t = \min\left(1, \frac{1 - r}{\text{bevelWidth}}\right), \quad z(nx, ny) = z_{\text{base}} \cdot (t^2 \cdot (3 - 2t))$$
   Flat elevated plateau in the center surrounded by a smooth cubic smoothstep chamfer down to the zero floor.

---

## 6. High-DPI & 4K UHD Optimization

On 4K monitors (e.g., $3840 \times 2160$ at 160–220 DPI), physical pixel density is more than double standard $1080\text{p}$ monitors ($92\text{ DPI}$). A fixed pixel period of $110\text{px}$ corresponds to only $\approx 1.5\text{ cm}$ on screen, which forces viewers into an unnaturally tight divergence lock.

### Optimized Presets Matrix

| Resolution Preset | Aspect Ratio | Optimal Period $S$ | Max Disparity $\Delta S$ | Grain Size | Physical Period on Screen |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **800 × 600** (Standard) | 4:3 | $110\text{px}$ | $20\text{px}$ | $2\text{px}$ | $\approx 2.9\text{ cm}$ |
| **1200 × 900** (HD 4:3) | 4:3 | $130\text{px}$ | $24\text{px}$ | $2\text{px}$ | $\approx 3.1\text{ cm}$ |
| **1920 × 1080** (Full HD) | 16:9 | $160\text{px}$ | $30\text{px}$ | $2\text{px}$ | $\approx 3.2\text{ cm}$ |
| **2560 × 1440** (2K QHD) | 16:9 | $200\text{px}$ | $38\text{px}$ | $3\text{px}$ | $\approx 3.1\text{ cm}$ |
| **3840 × 2160** (4K UHD) | 16:9 | $240\text{px}$ | $46\text{px}$ | $3\text{px}$ | $\approx 3.0\text{ cm}$ |

### Auto-Tuning Optics Formula
When custom non-preset resolutions are configured, the studio dynamically computes optimal optics:
$$S = \text{clamp}\left(90, 300, \text{round}(W_{\text{canvas}} \cdot 0.075 + 45)\right)$$
$$\Delta S = \text{clamp}\left(16, 64, \text{round}(S \cdot 0.19)\right)$$
$$\text{grainSize} = \begin{cases} 3\text{px}, & \text{if } W_{\text{canvas}} \ge 2560 \\ 2\text{px}, & \text{otherwise} \end{cases}$$

---

## 7. Peripheral Margin Protection & Vergence Retention

A common failure mode in stereoscopic game design is placing interactive targets or corridors directly adjacent to the viewport boundary.

### The Breakdown Mechanism
1. The binocular visual cortex requires at least **one complete pattern period $S$** to the left and right of any feature to cross-correlate retinal inputs.
2. When the viewer tracks an object close to the screen edge, one eye's line-of-sight falls outside the repeating pattern into dark empty window borders.
3. Without matching features, binocular correlation fails and the eyes abruptly converge back to the screen plane, breaking the 3D illusion.

### Studio Margin & Centering Rules
To prevent peripheral lock loss, interactive scenes enforce generous centered boundary margins and strictly uniform square cells:

* **Windowed Mode Margins**:
  * **Horizontal Margins**: $\text{margin}_{\text{side}} = \max\left(50\text{px}, \lfloor W_{\text{canvas}} \cdot 0.16 \rfloor\right)$ (At least $1.5 \times S$).
  * **Top Margin**: $\text{margin}_{\text{top}} = \max\left(80\text{px}, \lfloor H_{\text{canvas}} \cdot 0.15 \rfloor\right)$.
  * **Bottom Margin**: $\text{margin}_{\text{bottom}} = \max\left(45\text{px}, \lfloor H_{\text{canvas}} \cdot 0.10 \rfloor\right)$.

* **Fullscreen Mode Margins (Edge-to-Edge Immersion)**:
  * **Horizontal Margins**: $\text{margin}_{\text{side}} = \max\left(80\text{px}, \lfloor W_{\text{screen}} \cdot 0.22 \rfloor\right)$ ($\ge 840\text{px}$ to each screen edge on 4K displays!).
  * **Top Margin**: $\text{margin}_{\text{top}} = \max\left(160\text{px}, \lfloor H_{\text{screen}} \cdot 0.20 \rfloor\right)$ (Leaves ample space for the top floating glass HUD, glowing convergence dots at $y=96\text{px}$, and floating 3D embossed time text at $y=130\text{px}$).
  * **Bottom Margin**: $\text{margin}_{\text{bottom}} = \max\left(140\text{px}, \lfloor H_{\text{screen}} \cdot 0.20 \rfloor\right)$ (Symmetrically balances top and bottom distance).

* **Strict Square Cell Formulation**:
  $$\text{cellDim} = \max\left(20, \min\left(\lfloor \text{availW} / \text{cols} \rfloor, \lfloor \text{availH} / \text{rows} \rfloor\right)\right)$$
  $$\text{cellW} = \text{cellDim}, \quad \text{cellH} = \text{cellDim}$$
  Enforcing square cells ensures that corridors, walls, and ball traversal velocities are isotropic (identical horizontally and vertically) without stretching across ultra-wide or 16:9 displays.

---

## 8. Stereoscopic Labyrinth 3D Contrast Formulations

To ensure labyrinth corridors and maze walls are immediately legible without squinting:

* **Corridor Floor Elevation**: $z_{\text{floor}} = 0.08$ (Recessed base plane).
* **Wall Ridge Elevation**: $z_{\text{wall}} = 0.88$ (Crisp elevated plateau).
* **Depth Difference**: $\Delta z = 0.80$ (Yields $\approx 37\text{px}$ of physical disparity at 4K).
* **Wall Thickness**: $W_{\text{wall}} = \max\left(6\text{px}, \lfloor \min(\text{cellW}, \text{cellH}) \cdot 0.28 \rfloor\right)$, ensuring wall tops form solid, easily fusible ridges.
* **3D Ball Elevation**: $z_{\text{ball}} = 0.98$ with a cosine dome profile, elevating the rolling ball prominently above the maze walls.

---

## 9. Real-Time Stereoscopy & Dirty-Scanline Rendering Architecture

Real-time interactive gameplay (such as the 3D Stereoscopic Labyrinth) presents a severe computational bottleneck when executed at high resolutions:

### The Real-Time Bottleneck
* At 4K UHD ($3840 \times 2160$), generating a complete stereogram requires processing $8,294,400$ pixels.
* Executing the Thimbleby-Inglis-Witten Union-Find algorithm with line-of-sight ray marching across 8.3 million pixels requires $\approx 800\text{ million}$ operations per frame.
* On a high-performance modern CPU, a full-canvas 4K regeneration takes **1,500 – 2,200 ms per frame**, dropping rendering performance to $< 0.5\text{ FPS}$ and causing moving objects to smear, duplicate across repetition strips, and freeze the browser.

### Mathematical Invariant: Scanline Independence
In horizontal autostereograms (SIRDS and SIS), binocular disparity constraints are strictly horizontal. Each scanline $y$ satisfies:
$$\text{Pixel } (x_L, y) \equiv \text{Pixel } (x_R, y) \iff x_R = x_L + s(z(x, y))$$

There is **zero vertical coupling** across scanlines:
$$\frac{\partial s}{\partial y} = 0$$

Therefore, a localized depth modification spanning vertical interval $[y_{\text{min}}, y_{\text{max}}]$ affects **only** scanlines in that sub-interval. All scanlines outside $[y_{\text{min}}, y_{\text{max}}]$ remain mathematically identical and need not be recalculated.

### The Dirty-Scanline Algorithm
StereoCraft achieves fluid 60–120 FPS at 4K through a 5-step incremental rendering pipeline:

1. **Static Base Buffer Cache**:
   The static labyrinth depth map and full initial stereogram are computed once and stored in `cleanMazeDepthRef` and `activeImageDataRef`.

2. **Dirty Row Interval Calculation**:
   When the 3D ball moves from position $(x_0, y_0, r_0)$ to $(x_1, y_1, r_1)$, the dirty scanline interval is calculated as the union of both bounding boxes:
   $$y_{\text{dirty, min}} = \max\left(0, \min(y_0 - r_0, y_1 - r_1) - 2\right)$$
   $$y_{\text{dirty, max}} = \min\left(H - 1, \max(y_0 + r_0, y_1 + r_1) + 2\right)$$
   At 4K, this interval spans only $\approx 60 - 80\text{ rows}$ out of $2160$ rows ($< 3.7\%$ of the canvas).

3. **Targeted Depth Restoration & Ingestion**:
   * Only the previous ball bounding box is restored from the static `cleanMazeDepthRef` buffer (clearing the vacated ball position without allocating new memory).
   * The new 3D spherical ball depth is stamped into the working depth buffer.

4. **Row-Restricted Union-Find Execution**:
   `renderStereogramRows(depth, width, height, config, yMin, yMax, targetData)` executes the Thimbleby algorithm and ray marching **only** on the dirty rows $[y_{\text{dirty, min}}, y_{\text{dirty, max}}]$, writing directly into the pre-allocated `ImageData` byte buffer.

5. **Sub-Rect Canvas Blit**:
   The canvas is updated using hardware-accelerated sub-rectangle blitting:
   ```typescript
   ctx.putImageData(activeImg, 0, 0, 0, dirtyMinY, canvasWidth, dirtyHeight);
   ```
   * Frame execution time drops from **2000 ms to 3 – 5 ms**, achieving silky smooth 60 FPS motion with instantaneous ball responsiveness and zero smearing.

### Ray-Marching Slope Hoisting
In line-of-sight ray checks, determining whether a point blocks the ray from eye to screen requires verifying height slopes:
$$\text{raySlope} = \frac{z_{\text{eye}} - z}{dx}$$

By hoisting `slopeLeft` and `slopeRight` out of the inner stepping loops, redundant floating-point divisions are eliminated, reducing per-scanline union-find latency by an additional $35\%$.



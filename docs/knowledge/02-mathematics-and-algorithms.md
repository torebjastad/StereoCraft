# Mathematics & Algorithms for Autostereograms

## 1. Geometric Ray-Tracing Model

Consider an observer viewing a computer screen positioned at distance $D$ from their eyes. The observer's eyes are separated horizontally by an inter-pupillary distance $E$ (typically $\approx 60-65\text{ mm}$).

Let:
* The 2D screen lie on the plane $Z = 0$.
* The left eye be located at $(-E/2, 0, -D)$.
* The right eye be located at $(+E/2, 0, -D)$.
* A point on the apparent 3D solid model be $P = (X, Y, Z)$.
* Normalized depth $z \in [0, 1]$, where:
  * $z = 0.0$ corresponds to the far plane (background depth).
  * $z = 1.0$ corresponds to the closest near plane (maximum foreground height).

```
                 Left Eye                      Right Eye
                 (-E/2, -D)                    (+E/2, -D)
                     \                             /
                      \                           /
                       \                         /
  Screen Plane (Z=0) --[x_L]-------------------[x_R]--
                         \                     /
                          \                   /
                           \                 /
                            \               /
                             \             /
                              \           /
                               \         /
                                 P(X, Y, Z)
```

By similar triangles formed by the line of sight from the two eyes to the 3D surface point $P(X, Y, Z)$:

$$\frac{x_R - x_L}{E} = \frac{Z}{D + Z}$$

The horizontal pixel separation $s$ between the left and right eye screen intersections is given by:

$$s = E - (x_R - x_L) = E \cdot \left(1 - \frac{Z}{D + Z}\right) = \frac{E \cdot D}{D + Z}$$

When normalized depth $z \in [0, 1]$ is mapped to screen pixel space:

$$\text{Separation } s(z) = S_{\text{base}} - \text{round}(z \cdot \Delta S) \quad \text{(Parallel Mode)}$$
$$\text{Separation } s(z) = S_{\text{base}} + \text{round}(z \cdot \Delta S) \quad \text{(Cross-Eyed Mode)}$$

Where:
* $S_{\text{base}}$ is the baseline pattern repetition period (e.g. $110\text{px}$).
* $\Delta S$ is the maximum disparity amplitude (e.g. $20\text{px}$).

---

## 2. The Naive Propagation Algorithm (and Why It Fails)

Early SIRDS programs in the 1980s processed scanlines unidirectionally from left to right:
1. Generate a random strip of width $S$ on the left side of each row.
2. For each pixel $x$ from $S$ to $W - 1$:
   $$\text{pixel}[x] = \text{pixel}[x - s(z(x))]$$

### Catastrophic Failures of Naive Propagation:
1. **Asymmetric Bias**: Pixel constraints are only resolved in one direction. Left edges of 3D objects receive proper correspondences, but right edges leave long horizontal streak tails called **"echoes"**.
2. **Hidden Surface Bleed**: When depth changes abruptly (an occlusion boundary), background rays that pass through foreground geometry are copied anyway, causing ghost shapes floating in the wrong depth planes.

---

## 3. The Thimbleby-Inglis-Witten Algorithm (1994)

The definitive solution was introduced by Harold Thimbleby, Stuart Inglis, and Ian H. Witten (*IEEE Computer*, 1994).

Instead of directional copying, the problem is formulated as **equivalence classes** (disjoint sets) of pixels that are constrained to have the exact same color.

### Step 1: Disjoint-Set Union-Find Structure
For each scanline $y \in [0, H-1]$:
* Allocate an array `parent` of size $W$.
* Initialize each pixel as its own set root:
  $$\forall x \in [0, W-1]: \quad \text{parent}[x] = x$$

```typescript
function find(i: number): number {
  let root = i;
  while (parent[root] !== root) {
    root = parent[root];
  }
  // Path compression for O(alpha(N)) amortized efficiency
  let curr = i;
  while (curr !== root) {
    const next = parent[curr];
    parent[curr] = root;
    curr = next;
  }
  return root;
}

function union(i: number, j: number): void {
  const ri = find(i);
  const rj = find(j);
  if (ri !== rj) {
    // Symmetrical ordering
    if (ri < rj) parent[rj] = ri;
    else parent[ri] = rj;
  }
}
```

### Step 2: Symmetrical Constraint Placement
For each pixel $x \in [0, W-1]$:
* Fetch surface depth $z = \text{depthMap}[y \cdot W + x]$.
* Compute separation $s = s(z)$.
* The two screen rays for point $(x, z)$ strike the canvas at:
  $$x_L = x - \lfloor s / 2 \rfloor$$
  $$x_R = x_L + s$$
* Both $x_L$ and $x_R$ must satisfy $0 \le x_L < W$ and $0 \le x_R < W$.

### Step 3: Hidden Surface Removal (Line-of-Sight Ray Marching)
Points on the 3D surface may be physically occluded by closer foreground geometry. If an occluded point's screen projections are linked, an "echo" artifact appears.

To verify that the sightlines between the observer's eyes and point $(x, z)$ are unobstructed, rays are marched symmetrically outward toward both eyes using the physical interpupillary baseline $E \approx 3.5 \text{ to } 4.0 \cdot S_{\text{base}}$:

1. **Ray Marching Formulation**:
   $$\text{slope} = \frac{z_{\text{eye}} - z}{E / 2} \quad \text{where } z_{\text{eye}} \approx 2.0$$
   For each horizontal step $t = 1, 2, \dots$ until $z_{\text{ray}} \ge 1.0$:
   $$z_{\text{ray}}(t) = z + t \cdot \text{slope}$$
   If an obstacle at $x - t$ or $x + t$ satisfies $\text{depth}[x \pm t] > z_{\text{ray}}(t)$, the sightline is physically blocked:
   $$\text{isVisible} = \text{false}$$

If neither ray is occluded:
$$\text{union}(x_L, x_R)$$

### Step 4: Horizontally Periodic Color Assignment to Roots
Once all constraints on the scanline are recorded:
* To prevent streak artifacts when moving objects split disjoint set equivalence classes, all pattern texture samplers must be **strictly periodic modulo the pattern period**:
  $$x_{\text{wrapped}} = x \pmod{S_{\text{base}}}$$
* For each pixel $x$ from $0$ to $W-1$:
  * Determine the root: $r = \text{find}(x)$.
  * If $r == x$ (it is the root of an equivalence class):
    * Sample a color using the wrapped root coordinate:
      $$\text{color}[x] = \text{samplePatternColor}(r \pmod{S_{\text{base}}}, y)$$
  * Else:
    * Set color to its root's assigned color:
      $$\text{color}[x] = \text{color}[r]$$

---

## 4. Algorithmic Complexity & Real-Time Performance

* **Time Complexity**:
  * Constraint union step: $O(W \cdot \text{maxDisparity})$ per row due to the ray-marching check (where $\text{maxDisparity} \le 30$).
  * Union-find operations with path compression operate in near-constant time $O(\alpha(W))$, where $\alpha$ is the inverse Ackermann function ($\alpha(W) < 5$).
  * Total time complexity: $O(H \cdot W)$.
* **Memory Complexity**:
  * Requires only one 1D `Int32Array(W)` parent buffer and scanline RGB buffers. Space complexity is $O(W)$, highly cache-friendly.
* **Benchmark**:
  * An $800 \times 600$ stereogram executes in under **$15\text{ milliseconds}$** on modern JavaScript V8 engines, easily sustaining $60\text{ fps}$ real-time rendering during interactive shape dragging.

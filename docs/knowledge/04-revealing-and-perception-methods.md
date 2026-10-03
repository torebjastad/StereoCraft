# Revealing & Perception Methods

## 1. Dual Convergence Guide Dots

The most reliable, scientifically backed aid for viewing autostereograms is the **dual convergence guide dot system**.

```
    Normal Gaze (Screen plane focus):
              ●                       ●
           (Left Dot)             (Right Dot)

    Diverged Gaze (Correct Stereoscopic Lock):
              ●           ●           ●
         (Left Eye)    (Fused)   (Right Eye)
```

### The Geometry of Fusion:
1. Two high-contrast dots are drawn at the top center of the canvas, separated by exactly the repetition period $S_{\text{base}}$ (e.g. $110\text{px}$).
2. When the observer relaxes their eyes to look into the distance, each eye sees a double image:
   * Left eye sees Left Dot and Right Dot.
   * Right eye sees Left Dot and Right Dot.
3. As the eyes diverge by angle $\theta \approx S_{\text{base}} / D$, the right-eye image of the left dot overlaps with the left-eye image of the right dot.
4. The visual cortex fuses the overlapping pair into a single **third center dot** that appears crisp and floating at a stable depth.
5. **Viewer Instruction**: Once 3 dots appear and the center dot is sharp, do not refocus! Slowly drift your gaze down into the main picture; the 3D scene will immediately snap into full volumetric relief.

---

## 2. Parallel vs. Cross-Eyed Viewing

Human viewers naturally fall into two distinct viewing categories:

### A. Parallel (Wall-Eyed / Divergent)
* **Mechanics**: Eyes gaze straight ahead or slightly outwards, as if focusing on a point behind the screen (infinity).
* **Geometry**: Rays cross **behind** the screen plane.
* **Separation Formula**:
  $$s(z) = S_{\text{base}} - \text{round}(z \cdot \Delta S)$$
* Foreground objects have **smaller separation**, appearing closer to the observer.
* This is the standard format used by commercial *Magic Eye* publications.

### B. Cross-Eyed (Convergent)
* **Mechanics**: Eyes cross inwards, focusing on an imaginary point in the air between the face and the screen.
* **Geometry**: Rays cross **in front** of the screen plane.
* **Separation Formula**:
  $$s(z) = S_{\text{base}} + \text{round}(z \cdot \Delta S)$$
* Foreground objects have **larger separation**.
* Approximately **$35\%$ of the population** cannot diverge their eyes easily, but can cross their eyes effortlessly.
* **What happens if a cross-eyed viewer looks at a parallel stereogram?**
  Depth inverts: a sphere looks like a hollow spherical cavity; a mountain looks like a sunken crater.
* **The Studio Solution**: A 1-click **"Parallel / Cross-Eyed"** toggle switch in the header instantly inverts the disparity calculation, making the application 100% accessible to both viewer types.

---

## 3. Motion Parallax: The 3D Wigglegram

For viewers who struggle with oculomotor control, the studio provides an animated **3D Wigglegram mode**.

### How Motion Parallax Works:
The brain's visual area **MT (V5)** processes depth through **motion parallax**: when an observer moves, nearby objects shift across the retina much faster than distant background objects.

### Implementation:
1. Using the depth map $Z(x, y)$, the engine synthesizes two perspective-shifted views from the stereogram:
   * Left-eye view: foreground pixels displaced by $-\delta(z)$.
   * Right-eye view: foreground pixels displaced by $+\delta(z)$.
2. An animation loop alternates between the left and right perspectives at **$6\text{ to }10\text{ Hz}$** ($100 - 150\text{ ms}$ per cycle).
3. The visual cortex immediately perceives the 3D shapes rocking back and forth with genuine volumetric depth **with zero eye strain and no divergence required**.

---

## 4. Interactive Three.js WebGL 3D Relief Mesh

To inspect the true physical 3D relief model represented by the stereogram, the studio provides an interactive WebGL 3D viewer:

* Converts the 2D depth map into a 3D vertex heightfield displacement plane ($160 \times 120$ subdivisions).
* Computes surface vertex normals dynamically for realistic specular lighting.
* Features a metallic indigo/pink dual-light setup (key light + fill rim light).
* Enables mouse drag-to-orbit and zoom controls so the user can inspect the shape from any angle.

---

## 5. Proven Human Training Techniques

The application embeds an interactive modal (**"How to View"**) detailing 3 validated techniques:

1. **The Guide Dots Lock**: Focus on the dual dots until they merge into 3 dots, then glide downward.
2. **The Nose-to-Screen Pullback**:
   * Put your nose right against the screen. The screen will be totally blurred. Do not try to focus!
   * Very slowly pull your head back at $\approx 2\text{ cm/s}$ without actively refocusing.
   * At $35 - 45\text{ cm}$ distance, the brain suddenly locks onto the repeating period and the 3D relief pops out.
3. **The Screen Reflection Trick**:
   * Stare past the pixel surface at your own dim reflection in the monitor glass, forcing your vergence to settle $\approx 45\text{ cm}$ behind the screen.

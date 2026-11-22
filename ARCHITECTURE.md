# 🏗️ Terraform — Project Architecture & Viva Defense Guide

This document is designed to help you understand, explain, and defend the **Terraform** project during presentations, code reviews, and capstone vivas.

---

## 🎯 Executive Summary (The 30-Second Pitch)

> **"Terraform is a real-time, browser-based low-poly 3D terrain generator and GIS data visualizer. It processes real-world geospatial elevation data (GeoTIFF-like ASC grids, scattered CSV/JSON point clouds, grayscale heightmaps) and synthesizes procedural multi-fractal landscapes using WebGL and Three.js. It features simulated physical erosion, interactive hydrological analysis, and direct 3D asset export (OBJ/GLB) — built entirely with zero external runtime frameworks, requiring no build tools or backend servers."**

---

## 📊 High-Level System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE & INPUTS                       │
│  [File Drop / Picker]    [Parameter Sliders]    [Presets]    [Camera]  │
│  • PNG/JPG/BMP/WebP      • Mountain Height      • Alpine     • Orbit   │
│  • CSV / JSON Points     • Octaves / Seed       • Desert     • Zoom    │
│  • ESRI ASCII (.asc)     • Erosion / Curves     • Volcanic   • Reset   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ User Actions
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 CENTRAL STATE STORE  (js/state.js)                    │
│   • Single Authoritative State Object    • Undo / Redo History Buffer  │
│   • Strict Min/Max Bound Validation      • UI Bidirectional Sync       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ State Change Event
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│             TERRAIN DATA PIPELINE  (js/heightmap.js & js/terrain.js)   │
│  1. Data Ingestion:                                                    │
│     • Grayscale luminance decoding (ITU-R BT.709)                      │
│     • Inverse-Distance Weighting (IDW) interpolation for points        │
│  2. Procedural Synthesis (js/noise.js):                                │
│     • Simplex fBm, Perlin fBm, Ridged Multi-fractal, Voronoi Cellular  │
│  3. Blending & Shaping:                                                │
│     • Heightmap + Noise lerp blend                                     │
│     • Ridge sharpening (exp) & valley deepening (sigmoid)              │
│  4. Physical Simulation:                                               │
│     • Hydraulic erosion (momentum particles) & Thermal talus erosion  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Float32Array 2D Grid [0..1]
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                3D RENDERING ENGINE  (Three.js / WebGL)                 │
│  • Geometry (js/geometry.js):                                          │
│    - Non-indexed BufferGeometry with flat shading                      │
│    - Counter-Clockwise (CCW) face winding for strict +Y normals        │
│    - Integrated base skirt and animated water plane                    │
│  • Materials & Shading (js/materials.js):                              │
│    - PBR MeshStandardMaterial (low roughness, subtle specular)         │
│    - 5 physical palettes with elevation-band vertex coloring           │
│  • Lighting (js/lighting.js):                                          │
│    - Three-point lighting (Sun Key, Sky Hemispherical, Rim Light)     │
│    - Soft PCF shadow mapping (THREE.PCFShadowMap)                      │
│  • Analytical Inspection (js/analysis.js):                             │
│    - Slope angle gradient (0° Green → 30° Yellow → 60° Red)            │
│    - Elevation heatmap & Topographical contour isolines                │
│    - Real-time raycaster hover inspection for height/slope values      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         EXPORTS  (js/exports.js)                       │
│  • Screenshot PNG (1x/2x)  • 8-bit Heightmap PNG  • Wavefront OBJ      │
│  • Binary glTF 2.0 (GLB)   • Configuration Preset (JSON)               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Directory Structure & Module Responsibilities

The codebase follows strict **Separation of Concerns (SoC)**. Every JavaScript module has a single, well-defined responsibility:

```text
terraform/
├── index.html              # Clean semantic HTML5 layout, ARIA accessibility, modals
├── vercel.json             # Static hosting configuration for Vercel
├── package.json            # Scripts and metadata (Zero-build ES modules)
│
├── css/                    # Pure CSS3 styles (No Tailwind / Bootstrap)
│   ├── styles.css          # Design tokens (colors, fonts, CSS variables) & reset
│   ├── components.css      # Custom UI components (sliders, cards, buttons, modals, legends)
│   └── responsive.css      # Mobile bottom-sheet drawer & responsive breakpoints
│
├── js/                     # Vanilla ES6+ JavaScript application modules
│   ├── app.js              # Application orchestrator, render loop & initialization
│   ├── state.js            # Single authoritative state manager (Single Source of Truth)
│   ├── ui.js               # DOM event listeners, slider sync & toast notifications
│   ├── terrain.js          # Terrain shaping, erosion simulations, and smoothing
│   ├── heightmap.js        # HeightField class, image luminance decoding, IDW interpolation, file loaders
│   ├── noise.js            # Procedural noise math: Simplex, Perlin, Ridged, Billow, Voronoi
│   ├── geometry.js         # Three.js BufferGeometry generation, CCW face winding, base skirt, water
│   ├── materials.js        # MeshStandardMaterial, vertex coloring, and 5 physical color palettes
│   ├── lighting.js         # Sun Key Light, Sky Fill, PCF Shadow maps
│   ├── camera.js           # Perspective camera, OrbitControls, and bounding-box camera fit
│   ├── analysis.js         # Slope analysis, elevation heatmaps, contour lines, raycaster hover
│   ├── exports.js          # Export engines: OBJ, GLB, PNG heightmaps, screenshots, JSON presets
│   ├── presets.js          # Predefined terrain presets (Alpine, Desert, Volcanic, etc.)
│   └── utils.js            # Math utilities: clamp, lerp, pseudo-random generator, debouncers
│
├── assets/                 # Sample assets for testing
│   ├── sample-heightmap.png# 256x256 grayscale elevation sample
│   ├── points.csv          # Scattered 3D point cloud sample (CSV)
│   └── points.json         # Scattered 3D point cloud sample (JSON)
│
├── vendor/                 # Vendored Three.js library and official addons
│   └── three/              # Three.js core (r187), OrbitControls, OBJExporter, GLTFExporter
│
└── tests/                  # Automated verification and unit test suites
    ├── verify-engine.mjs   # Test Suite: state, procedural noise, heightfield, presets (Node.js)
    ├── verify-three.mjs    # Test Suite: Three.js geometry, face winding, OBJ export (Node.js)
    ├── test-exports.mjs    # Test Suite: Binary GLB, OBJ, Heightmap PNG, JSON presets (Node.js)
    ├── heightfield.test.js # Vitest: HeightField data structure & bilinear interpolation
    ├── interpolation.test.js# Vitest: IDW spatial interpolation algorithms
    ├── loaders.test.js     # Vitest: ASC, CSV, and JSON elevation loaders
    └── slope.test.js       # Vitest: Face normal slope angle trigonometry
```

---

## 🧠 Key Technical Concepts (How to Explain Each Part)

### 1. Data Ingestion & Spatial Interpolation (`js/heightmap.js`)
* **Grayscale Image Heightmaps:** Each pixel represents altitude. Luminance is calculated using the ITU-R BT.709 formula:  
  $$\text{Elevation} = \frac{0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B}{255}$$
* **Scattered Point Clouds (CSV/JSON):** Real-world GIS points are rarely on an even grid. We use **Inverse-Distance Weighting (IDW)**:
  For any grid coordinate $(u, v)$, the elevation $Z(u, v)$ is:
  $$Z(u, v) = \frac{\sum w_i \cdot z_i}{\sum w_i} \quad \text{where} \quad w_i = \frac{1}{\text{distance}(p, p_i)^2}$$
* **ESRI ASCII Grid (.asc):** Standard GIS format with a 6-line metadata header (`ncols`, `nrows`, `xllcorner`, `yllcorner`, `cellsize`, `NODATA_value`) followed by elevation values.

### 2. Procedural Multi-Fractal Noise (`js/noise.js`)
* **Fractal Brownian Motion (fBm):** Multiple octaves of noise are summed with increasing frequency and decreasing amplitude (persistence):
  $$\text{fBm}(x, y) = \sum_{i=0}^{\text{octaves}-1} \text{amplitude}^i \cdot \text{noise}(x \cdot \text{frequency}^i, y \cdot \text{frequency}^i)$$
* **Ridged Multi-fractal:** Creates jagged mountain peaks by taking the absolute value and inverting it:
  $$\text{ridge} = 1.0 - |\text{noise}(x, y)|$$
* **Voronoi / Cellular:** Partitions 2D space into distance cells to simulate volcanic calderas and craters.

### 3. Physical Erosion Simulation (`js/terrain.js`)
* **Hydraulic Erosion:** Simulates hundreds of raindrops falling across the terrain. Each drop moves downhill based on surface gradient, picking up sediment when moving fast (erosion) and depositing sediment when slowing down or entering a depression (deposition).
* **Thermal Erosion:** Simulates rock crumbling down steep cliffs when the slope exceeds the natural **talus angle of repose** (typically ~35°).

### 4. 3D Mesh Generation & Normal Winding (`js/geometry.js`)
* Built as a **non-indexed `THREE.BufferGeometry`** so each triangle facet is independent, giving the signature **low-poly faceted aesthetic**.
* **Counter-Clockwise (CCW) Winding:** Triangle vertices are ordered $A \to B \to C$ in CCW order so that surface normal vectors calculated via cross-product strictly point outward ($+Y$), preventing inverted or black backfaces under lighting.
* **Base Skirt:** Extrudes the perimeter vertices downward to $Y = -0.5$ to create a solid architectural pedestal model.

### 5. Centralized State Store (`js/state.js`)
* Avoids framework complexity (React/Redux) by implementing a **Single Authoritative State Store**:
  - `getState()` / `updateState(partial)`
  - Parameter clamping ensures inputs can never crash WebGL (e.g., resolution clamped to 16–256).
  - Synchronizes inputs bidirectionally: updating a slider updates the number input, the state, and immediately triggers the 3D update.
  - Deterministic **Reset Default** restores the initial sample without leaving stale values in the UI.

---

## 🎓 Viva / Capstone Defense Q&A Cheatsheet

### Q1: Why did you build this in Vanilla JavaScript instead of React or Next.js?
> **Answer:**  
> "A 3D WebGL graphics pipeline needs direct, low-latency control over the Three.js render loop, BufferGeometries, and GPU buffers. React's Virtual DOM adds unnecessary overhead and reconciliation cycles when updating thousands of vertex coordinates. Vanilla JavaScript ES modules allow us to achieve maximum runtime performance, instantaneous load times, and zero build/transpilation dependencies, while running statically on any HTTP server."

### Q2: How does the application convert 2D heightmap data into a 3D terrain?
> **Answer:**  
> "The 2D height data is stored in a normalized `Float32Array` within our `HeightField` class, where each value ranges from 0.0 (sea level) to 1.0 (peak). In `js/geometry.js`, we construct a grid of square quads, each split into two triangles. For each vertex $(x, z)$, its 3D position is calculated as $X = \text{gridX} - \text{halfSize}$, $Z = \text{gridZ} - \text{halfSize}$, and $Y = \text{heightField.sample}(u, v) \times \text{mountainHeight}$. Non-indexed buffer geometry computes flat normals for each face to produce the faceted low-poly look."

### Q3: How did you solve the 'Reset Default' bug where UI numbers stayed at old values?
> **Answer:**  
> "Previously, state was fragmented across multiple DOM variables and local script scopes. We resolved this by creating a centralized state manager in `js/state.js`. A single `DEFAULT_STATE` object holds all opening values. When 'Reset Default' is invoked, `resetStateToDefault()` restores the state object, and `syncUIFromState()` iterates over every input element, updating both `.value` and triggering DOM input sync before re-running the generation pipeline."

### Q4: How is mobile responsiveness handled for a 3D application?
> **Answer:**  
> "On desktop, controls reside in a right sidebar. On mobile screens (such as 390×844px), the sidebar is hidden so the 3D canvas receives 100% of the screen. A floating 'Controls' button opens a responsive CSS bottom-sheet drawer with touch-friendly controls. Additionally, our `fitCameraToTerrain()` function dynamically calculates the 3D bounding box against the canvas aspect ratio and field-of-view, ensuring the mountain fits perfectly within the visible screen without clipping."

### Q5: How do the analytical views (Slope & Elevation Heatmaps) work?
> **Answer:**  
> "In `js/analysis.js`, we compute vertex colors directly onto the geometry buffer. For slope analysis, we take the dot product between each face's normal vector $\vec{N}$ and the vertical up-vector $(0, 1, 0)$ to find the slope angle $\theta = \arccos(\vec{N} \cdot \vec{U})$. We then map $0^\circ \to \text{Green}$, $30^\circ \to \text{Yellow}$, and $60^\circ+ \to \text{Red}$. For elevation, we normalize vertex $Y$ height and interpolate across a 5-stop color gradient."

### Q6: How does the 3D export (OBJ and GLB) work?
> **Answer:**  
> "In `js/exports.js`:
> - **OBJ:** We iterate over the terrain geometry's position and normal attributes, formatting them into standard ASCII Wavefront text (`v`, `vn`, `f` directives) and triggering a client-side Blob download.
> - **GLB:** We utilize Three.js's `GLTFExporter` configured with `{ binary: true }`. It serializes the mesh, vertex colors, and materials into binary glTF 2.0 format (`.glb`), which is compatible with Blender, Unity, Unreal Engine, and Web 3D viewers."

---

## ⚡ Quick Demonstration Script (For Live Presentation)

1. **Open the App:** Show the default low-poly mountain loaded from the bundled sample with shadows and water.
2. **Interact:** Orbit, pan, and zoom with mouse / touch gestures.
3. **Inspect Elevation & Slope:** Switch View Mode from *Shaded* to *Slope Heatmap* and hover over faces to show the live degrees readout in the bottom-right corner.
4. **Modify Terrain:** Change Mountain Height, adjust erosion sliders, change Palette to *Volcanic* or *Desert*.
5. **Procedural Generation:** Click **Randomize Seed** and switch Noise Type to *Ridged* or *Voronoi*.
6. **File Import:** Drag and drop `assets/points.csv` or `assets/points.json` to demonstrate automatic IDW interpolation.
7. **Export:** Click **Export GLB** or **Export OBJ** to show that 3D files are instantly generated on the client side ready for Blender.
8. **Reset Default:** Click **Reset Default** to demonstrate immediate deterministic return to the opening state.

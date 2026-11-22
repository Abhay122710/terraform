# 🏔️ Terraform — Low-Poly 3D Terrain Generator

A real-time, browser-based low-poly 3D terrain generator built with **HTML5**, **CSS3**, **Vanilla JavaScript (ES6+)**, and **Three.js**.

Live Reference: [https://terraform-zeta.vercel.app/](https://terraform-zeta.vercel.app/)

Zero framework dependencies (No React, Vue, Svelte, Tailwind, or TypeScript runtime). Deployable anywhere as a static website without a mandatory build or transpilation step.

> 📖 **Project Documentation & Guides**:
> - [ARCHITECTURE.md](file:///d:/webgl%20project%20capstone/ARCHITECTURE.md) — System architecture diagram, module-by-module breakdown, and capstone presentation Q&A cheatsheet.
> - [PROJECT_EXPLANATION_GUIDE.md](file:///d:/webgl%20project%20capstone/PROJECT_EXPLANATION_GUIDE.md) — Detailed code-level explanation of every feature with an equal 3-person team presentation & viva defense script.

---

## 🚀 Key Features

### 1. Data Inputs & File Formats
- **Image Heightmaps**: PNG, JPG, BMP, WebP with luminance decoding (ITU-R BT.709), Invert mode, and Geographic Heatmaps (Rainbow, Turbo, Spectral).
- **Scattered Points (CSV)**: Auto-detects `x,y,z` or `lat,lon,elevation`; interpolates onto a regular grid using **Inverse-Distance Weighting (IDW)**.
- **Scattered Points (JSON)**: Array of `{x, y, z}` or `{lat, lon, elevation}` interpolated via IDW.
- **ESRI ASCII Grid (.asc)**: Full header parsing (`ncols`, `nrows`, `cellsize`, `NODATA_value`).
- **Procedural Generation**: 100% procedural generation without requiring file uploads.
- **Data ↔ Noise Blending**: Seamless continuous blend between real elevation maps and procedural noise.
- **Drag-and-Drop**: Drop files anywhere on the browser window or use the file picker.
- **Bundled Samples**: Includes bundled mountain sample (`assets/sample-heightmap.png`, `assets/points.csv`, `assets/points.json`).

### 2. Procedural Noise Algorithms
- **Simplex fBm**: Smooth, natural multi-octave rolling hills.
- **Perlin fBm**: Classic gradient noise fractal.
- **Ridged Multifractal**: Sharp, jagged alpine mountain ridges (`1 - |noise|`).
- **Billow fBm**: Billowy, soft cloud-like formations (`|noise|`).
- **Voronoi / Cellular**: Distance-to-nearest-feature cells for volcanic calderas and craters.

### 3. Mountain Shaping & Erosion Simulations
- **Ridge Sharpening**: Exponent curve boosting summits into sharp alpine peaks.
- **Valley Deepening**: Sigmoid flattening on lower elevations into lush meadows.
- **Elevation Curve**: Power redistribution curve.
- **Plateau / Terracing**: Quantized terrace stepping for mesas and canyons.
- **Smoothing**: Box blur passes.
- **Hydraulic Erosion**: Particle-based water drop simulation with momentum, sediment capacity, erosion, and deposition.
- **Thermal Erosion**: Talus-angle material redistribution.

### 4. Shading, Themes & Inspection Views
- **5 Physical Color Palettes**:
  - *Mountain Reference (Default)*: Lowland grass green (`#789B45`), meadow (`#86A64E`), earthy brown (`#94744B`), rocky slopes (`#80634D`), rock grey (`#A3A09A`), summit stone (`#C4C0B6`).
  - *Alpine High Country*: Granite scree and glacial snow.
  - *Desert / Canyon*: Sandstone tiers and red rock cliffs.
  - *Volcanic Caldera*: Basalt plains, ash, and molten ridges.
  - *Arctic Tundra*: Tundra moss, permafrost, and glacial ice.
- **Inspection Views**:
  - *Shaded Realistic (PBR)*: Matte diffuse outdoor lighting with soft PCF shadows.
  - *Slope Angle Heatmap*: Green (0° flat) → Yellow (30°) → Red (60° steep).
  - *Elevation Heatmap*: Normalized height (Blue → Cyan → Green → Yellow → White).
  - *Topographical Contours*: Real-time elevation isolines with configurable interval.
  - *Low-Poly Wireframe*: Facet wireframe overlay.
  - *Diagnostic Baseline*: Solid natural green for lighting calibration.
- **Interactive Raycaster Hover Readout**: Real-time height, slope in degrees, and 3D world coordinates.
- **Water Plane**: Toggleable valley water plane with adjustable elevation level and opacity.

### 5. Downloads & Exports
1. **Screenshot (PNG)**: 1× or 2× resolution, with optional transparent background.
2. **Heightmap (PNG)**: Grayscale 8-bit elevation map [0..255].
3. **Mesh (OBJ)**: Standard Wavefront OBJ format with vertices, normals, and triangle faces.
4. **Mesh (GLB)**: Binary glTF 2.0 format compatible with Blender, three.js viewers, and 3D engines.
5. **Save Preset (JSON)**: Complete configuration export (can be reloaded with **Load Preset**).

---

## 🛠️ Technology Stack

1. **HTML5** — Semantic markup, accessible labels, ARIA landmarks, and focus management.
2. **CSS3** — Custom modern dark theme, CSS Grid & Flexbox, responsive bottom sheet, smooth transitions.
3. **Vanilla JavaScript (ES6+)** — Centralized state management, event orchestration, procedural math, and file loaders.
4. **Three.js (r187)** — 3D scene graph, perspective camera, OrbitControls, PCF shadows, PBR standard materials, and GLTFExporter.

---

## 📱 Mobile Responsiveness Redesign

- **Desktop (1440px+)**: Dominant 3D viewport with an organized sidebar on the right.
- **Tablet (768px–1024px)**: Compact sidebar layout.
- **Mobile (320px–480px, including 390×844px)**:
  - Sidebar is replaced with a floating **⚙️ Controls** button.
  - Opens as a responsive **Bottom Sheet** modal (touch drag-down handle, backdrop tap, or Escape key to dismiss).
  - Minimum 44px touch targets.
  - Zero horizontal overflow.
  - Camera fitting automatically scales terrain to fit visible canvas on resize and on **Reset Camera**.

---

## 🐛 Resolved QA Defect Report

| Issue | Root Cause | Solution Implemented |
|---|---|---|
| **3.1 Reset Default Desynchronization** | Competing state variables and UI controllers retaining previous numeric values. | Implemented single authoritative `state.js` object with full synchronization (`syncUIFromState`). Reset Default deterministically restores all opening default parameters and opening sample. |
| **3.2 Mobile Responsiveness Defect** | 320px fixed sidebar covering 85% of mobile screen (390×844px). | Transformed sidebar into a mobile bottom sheet with floating trigger button and dynamic camera fitting. |
| **4.1 Legend Label Alignment** | Legend labels placed beneath gradient canvas with loose spacing `<br>` tags. | Rebuilt legend into a flexbox card where top label aligns to top endpoint, mid label to vertical center, and bottom label to bottom endpoint, with explicit units (Degrees ° and Normalized Height). |
| **4.2 Deprecated Shadow Map Warning** | Use of removed `THREE.PCFSoftShadowMap` in Three.js renderer configuration. | Replaced with supported `THREE.PCFShadowMap` and tuned shadow bias & normalBias. Zero console warnings remain. |

---

## 🏃 Getting Started & Local Development

Run with any standard static HTTP server:

### Option A: Python (Built-in)
```bash
python -m http.server 5173
```
Then open [http://localhost:5173](http://localhost:5173) in your browser.

### Option B: Node.js (npx serve)
```bash
npx serve .
```

---

## 🧪 Automated Test Suite

Run the end-to-end automated test suites:
```bash
# 1. State, Noise, Heightfield & Interpolation Unit Tests
node tests/verify-engine.mjs

# 2. Three.js Geometry, Materials & Export Verification
node tests/verify-three.mjs

# 3. Headless Chrome End-to-End CDP Test (DOM, Controls, Resets, Legends, Mobile 390x844)
node tests/test-browser-cdp.mjs
```

---

## 🚢 Production Deployment to Vercel

Terraform is a zero-configuration static website. To deploy on Vercel:

1. Push this repository to GitHub.
2. In the Vercel Dashboard, click **Add New Project** and import the repository.
3. Leave **Build Command** blank (or `None`).
4. Set **Output Directory** to `.` (root directory).
5. Click **Deploy**.

---

## 📄 License
MIT

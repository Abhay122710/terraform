# 🎓 Terraform — Comprehensive Project & Code Explanation Guide
## Equal 3-Person Presentation & Viva Defense Manual

This document provides a complete, code-level explanation of every feature, algorithm, and module in the **Terraform** project. The entire project is divided into **three equal parts**, giving each person a balanced share of code, theory, and live demonstration responsibilities.

---

## 👥 Presentation Division Summary

```text
┌────────────────────────────────────────────────────────────────────────┐
│ PERSON 1: Architecture, State Store & Real-World GIS Data Ingestion   │
│ • UI/UX, Semantic HTML5 & Responsive Mobile Bottom-Sheet               │
│ • Centralized State Management (state.js) & Deterministic Reset        │
│ • DOM Event Orchestration & Drag-and-Drop (ui.js)                      │
│ • HeightField 2D Grid & Luminance Decoding (heightmap.js)              │
│ • GIS File Loaders: ESRI ASCII (.asc), CSV/JSON Point Clouds & IDW     │
├────────────────────────────────────────────────────────────────────────┤
│ PERSON 2: Procedural Math, Noise Algorithms & Physical Erosion Engine │
│ • Multi-Fractal Noise Mathematics (noise.js): Simplex, Perlin, Ridged, │
│   Billow, and Voronoi / Cellular noise                                 │
│ • Data-to-Noise Continuous Blending & Mathematical Shaping Curves      │
│ • Terracing / Plateau Stepping & Box-Blur Smoothing (terrain.js)       │
│ • Hydraulic Erosion (Particle physics) & Thermal Talus Erosion         │
│ • Presets Engine (presets.js) & Mathematical Utilities (utils.js)      │
├────────────────────────────────────────────────────────────────────────┤
│ PERSON 3: Three.js 3D Graphics, Inspection Views & 3D Export Engine    │
│ • Main Three.js Orchestrator & Render Loop (app.js)                    │
│ • Low-Poly Mesh Generation & CCW Normal Winding (geometry.js)          │
│ • PBR Materials, 5 Color Palettes & Lighting/PCF Shadows (materials.js)│
│ • Analytical Views: Slope Angle Heatmap, Contour Isolines (analysis.js)│
│ • Raycaster Real-Time Hover Inspector (analysis.js)                    │
│ • 3D Exporters: Wavefront OBJ, Binary glTF 2.0 (GLB), PNG, JSON        │
└────────────────────────────────────────────────────────────────────────┘
```

---

# 👤 PERSON 1: Architecture, State Management & Data Ingestion

### Core Mission:
> Explain the application architecture, why pure Vanilla JavaScript was chosen over frontend frameworks, how state synchronization eliminates UI desynchronization bugs, and how real-world GIS elevation data (images, CSV, JSON, ASC) is ingested and interpolated into 2D height arrays.

---

### 1.1 Architectural Philosophy & Technology Stack
* **Technologies:** HTML5, CSS3, Vanilla JavaScript (ES6+ Modules), Three.js (r187).
* **Zero Frameworks:** No React, Angular, Vue, or Svelte.
* **Zero Build Step:** Runs directly in any modern browser via standard ES modules (`<script type="module" src="js/app.js">`) without Vite, Webpack, or Babel.
* **Why this matters:** WebGL requires direct, low-latency access to GPU buffers and render loops. A Virtual DOM introduces unnecessary memory overhead and garbage collection pauses when mutating 3D vertex positions.

---

### 1.2 Centralized Authoritative State Store (`js/state.js`)

#### Purpose:
Eliminates competing state variables. Every parameter in the application originates from one immutable-like default structure.

#### Key Code — `DEFAULT_STATE`:
```javascript
// js/state.js
export const DEFAULT_STATE = Object.freeze({
  source: 'sample',             // 'sample' | 'procedural' | 'file'
  mountainHeight: 1.35,         // Scaled elevation factor [0.2 .. 4.0]
  seed: 42,                     // PRNG seed integer
  noiseType: 'ridged',          // 'simplex' | 'perlin' | 'ridged' | 'billow' | 'voronoi'
  octaves: 5,                   // Noise detail octaves [1 .. 8]
  persistence: 0.5,             // Amplitude decay per octave
  lacunarity: 2.0,              // Frequency multiplier per octave
  resolution: 128,              // Grid mesh density [16 .. 256]
  palette: 'mountain-reference',// Active color theme
  viewMode: 'shaded',           // 'shaded' | 'slope' | 'height' | 'contour' | 'wireframe'
  flatShading: true,            // Faceted low-poly shading toggle
  showBase: true,               // Pedestal skirt toggle
  showWater: true,              // Valley water plane toggle
  waterLevel: 0.15,             // Water plane elevation
  shadows: true,                // Dynamic PCF shadow toggle
  // ... erosion, curves, and camera defaults
});
```

#### Key Function — Deterministic `resetStateToDefault()`:
```javascript
// js/state.js
export function resetStateToDefault() {
  currentState = JSON.parse(JSON.stringify(DEFAULT_STATE));
  pushHistory(currentState);
  notifySubscribers();
  return getState();
}
```
* **Viva Explanation:** *"In earlier builds, changing Mountain Height to 0.4 and clicking Reset Default caused UI desynchronization because input fields did not synchronize with internal variables. Our `resetStateToDefault()` coupled with `ui.js:syncUIFromState()` guarantees 100% deterministic restoration of both the 3D model and all UI inputs."*

---

### 1.3 UI Orchestration & Mobile Bottom Sheet (`js/ui.js` & `css/responsive.css`)

#### Purpose:
Handles bidirectional DOM synchronization, drag-and-drop file imports, toasts, and mobile responsiveness.

#### Key Code — Bidirectional Slider & Number Synchronization:
```javascript
// js/ui.js
export function bindSliderAndNumber(sliderId, numberId, stateKey, min, max, isFloat = false) {
  const slider = document.getElementById(sliderId);
  const number = document.getElementById(numberId);
  if (!slider || !number) return;

  const update = (rawVal) => {
    let val = isFloat ? parseFloat(rawVal) : parseInt(rawVal, 10);
    val = clamp(val, min, max);
    slider.value = val;
    number.value = val;
    updateState({ [stateKey]: val });
  };

  slider.addEventListener('input', (e) => update(e.target.value));
  number.addEventListener('change', (e) => update(e.target.value));
}
```

#### Mobile Responsiveness (The 390×844px Fix):
* **Desktop:** Controls live in a permanent 320px sidebar.
* **Mobile:** The sidebar is hidden. A floating `⚙️ Controls` button opens a **CSS Bottom Sheet Drawer** with a touch-friendly drag handle and backdrop dismissal, preserving 100% of the screen for the 3D canvas.

---

### 1.4 The `HeightField` Class & Image Luminance (`js/heightmap.js`)

#### Purpose:
The foundational data structure: a 2D grid stored in a contiguous, high-performance 1D `Float32Array` with values strictly normalized to $[0.0, 1.0]$.

#### Key Code — `HeightField` with Bilinear Sampling:
```javascript
// js/heightmap.js
export class HeightField {
  constructor(size, data = null) {
    this.size = size;
    this.data = data || new Float32Array(size * size);
  }

  get(x, y) {
    const cx = clamp(Math.floor(x), 0, this.size - 1);
    const cy = clamp(Math.floor(y), 0, this.size - 1);
    return this.data[cy * this.size + cx];
  }

  // Bilinear interpolation for smooth continuous coordinate sampling
  sample(u, v) {
    const x = clamp(u, 0, 1) * (this.size - 1);
    const y = clamp(v, 0, 1) * (this.size - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, this.size - 1);
    const y1 = Math.min(y0 + 1, this.size - 1);
    const fx = x - x0, fy = y - y0;

    return (
      this.get(x0, y0) * (1 - fx) * (1 - fy) +
      this.get(x1, y0) * fx * (1 - fy) +
      this.get(x0, y1) * (1 - fx) * fy +
      this.get(x1, y1) * fx * fy
    );
  }
}
```

#### ITU-R BT.709 Perceptual Luminance Elevation Decoding:
```javascript
// js/heightmap.js
export function decodePixelElevation(r, g, b, mode = 'luminance') {
  if (mode === 'invert') {
    return 1.0 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  // Human eye is most sensitive to green, then red, then blue
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
```

---

### 1.5 Real-World GIS File Loaders & IDW Interpolation (`js/heightmap.js`)

#### 1. ESRI ASCII Grid Parser (`loadASC`):
Parses standard digital elevation models from the USGS and European Space Agency.
```javascript
// js/heightmap.js
export async function loadASC(file) {
  const text = await file.text();
  const lines = text.trim().split(/\r?\n/);
  // Parses: ncols, nrows, xllcorner, yllcorner, cellsize, NODATA_value
  // Normalizes all elevation values between 0.0 and 1.0
}
```

#### 2. Inverse-Distance Weighting (IDW) for Point Clouds (`idwInterpolation`):
Used when surveyors provide scattered 3D points $(X, Y, Z)$ via CSV or JSON.
```javascript
// js/heightmap.js
export function idwInterpolation(points, size = 128, power = 2.0) {
  const grid = new Float32Array(size * size);
  for (let gy = 0; gy < size; gy++) {
    for (let gx = 0; gx < size; gx++) {
      const u = gx / (size - 1), v = gy / (size - 1);
      let weightSum = 0, valueSum = 0;

      for (let i = 0; i < points.length; i++) {
        const dx = u - points[i].x, dy = v - points[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1e-10) { valueSum = points[i].z; weightSum = 1; break; }
        const w = 1.0 / Math.pow(dist, power); // Weight inversely proportional to d^2
        weightSum += w;
        valueSum += w * points[i].z;
      }
      grid[gy * size + gx] = valueSum / weightSum;
    }
  }
  return grid;
}
```

---

# 👤 PERSON 2: Procedural Math, Noise Algorithms & Erosion Engine

### Core Mission:
> Explain the mathematics of procedural multi-fractal noise generation, continuous data-to-noise blending, non-linear terrain shaping curves, box-blur smoothing, and physical simulation of hydraulic and thermal erosion.

---

### 2.1 Multi-Fractal Noise Mathematics (`js/noise.js`)

#### Purpose:
Procedural landscapes cannot look like repetitive sine waves. We combine multi-octave gradient and cellular noise using a seeded pseudo-random number generator (PRNG).

#### Key Algorithms:

#### 1. Simplex & Perlin Fractal Brownian Motion (fBm):
Sums multiple layers of noise octaves, with each subsequent octave doubling in frequency and halving in amplitude.
$$\text{fBm}(x, y) = \sum_{i=0}^{\text{octaves}-1} \text{amplitude}^i \cdot \text{noise}(x \cdot \text{lacunarity}^i, y \cdot \text{lacunarity}^i)$$

```javascript
// js/noise.js
export function ridgedFBm(x, y, octaves = 5, lacunarity = 2.0, persistence = 0.5) {
  let total = 0, frequency = 1.0, amplitude = 1.0, maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    // 1.0 - abs(noise) creates sharp V-shaped ridges characteristic of alpine peaks
    let n = 1.0 - Math.abs(perlin2D(x * frequency, y * frequency));
    n = n * n; // Square to sharpen summits
    total += n * amplitude;
    maxVal += amplitude;
    frequency *= lacunarity;
    amplitude *= persistence;
  }
  return total / maxVal;
}
```

#### 2. Voronoi / Cellular Noise:
Partitions space into feature points to generate volcanic craters, calderas, and tectonic blocks.
```javascript
// js/noise.js
export function voronoiNoise(x, y) {
  // Finds Euclidean distance to the nearest randomly scattered cellular feature point
  // Produces organic polygon cells and sharp boundary ridges
}
```

---

### 2.2 Data ↔ Noise Blending & Shaping Curves (`js/terrain.js`)

#### 1. Continuous Blending:
Allows the user to seamlessly blend a real-world geological heightmap with procedural synthetic noise:
$$\text{Height}(x, y) = (1 - \text{blend}) \cdot \text{Data}(x, y) + \text{blend} \cdot \text{Noise}(x, y)$$

#### 2. Non-Linear Mathematical Shaping Curves:
```javascript
// js/terrain.js
export function applyShapeCurves(height, ridgeSharpening, valleyDeepening, elevationCurve) {
  let h = clamp(height, 0, 1);

  // Elevation Curve: Power function reshaping overall altitude distribution
  if (elevationCurve !== 1.0) {
    h = Math.pow(h, elevationCurve);
  }

  // Ridge Sharpening: Exponential summit boost
  if (ridgeSharpening > 0) {
    const factor = 1 + ridgeSharpening * 2;
    h = Math.pow(h, 1 / factor);
  }

  // Valley Deepening: S-curve (sigmoid) flattening lower plains into meadows
  if (valleyDeepening > 0) {
    const s = valleyDeepening;
    h = h < 0.5 
      ? Math.pow(h * 2, 1 + s) / 2 
      : 1 - Math.pow((1 - h) * 2, 1 + s) / 2;
  }

  return clamp(h, 0, 1);
}
```

#### 3. Terracing / Plateau Stepping (Canyon Mesa Effect):
```javascript
// js/terrain.js
if (terraces > 0) {
  const step = 1.0 / terraces;
  val = Math.floor(val / step) * step; // Quantizes elevation into flat geological strata
}
```

---

### 2.3 Physical Erosion Simulation Engine (`js/terrain.js`)

#### 1. Particle-Based Hydraulic Erosion:
Simulates raindrops rolling down mountains, carrying sediment, and depositing it in valleys.
```javascript
// js/terrain.js
export function hydraulicErode(data, size, iterations) {
  const result = new Float32Array(data);
  for (let iter = 0; iter < iterations; iter++) {
    // 1. Spawn a water droplet at a random coordinate
    let posX = Math.random() * (size - 1);
    let posY = Math.random() * (size - 1);
    let dirX = 0, dirY = 0, vel = 1, water = 1, sediment = 0;

    for (let lifetime = 0; lifetime < 30; lifetime++) {
      // 2. Calculate surface slope gradients (gx, gy)
      const gx = (result[Math.floor(posY) * size + Math.min(Math.floor(posX) + 1, size - 1)] -
                  result[Math.floor(posY) * size + Math.max(Math.floor(posX) - 1, 0)]) * 0.5;
      const gy = (result[Math.min(Math.floor(posY) + 1, size - 1) * size + Math.floor(posX)] -
                  result[Math.max(Math.floor(posY) - 1, 0) * size + Math.floor(posX)]) * 0.5;

      // 3. Update droplet momentum & velocity
      dirX = dirX * 0.05 - gx * 0.95;
      dirY = dirY * 0.05 - gy * 0.95;
      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len < 0.01) break;
      dirX /= len; dirY /= len;
      posX += dirX; posY += dirY;

      // 4. Calculate sediment carrying capacity based on slope and speed
      const capacity = Math.max(-gx * dirX - gy * dirY, 0.01) * vel * water * 3.5;
      if (sediment > capacity) {
        // Deposit excess sediment into depressions
        const drop = (sediment - capacity) * 0.25;
        sediment -= drop;
        result[Math.floor(posY) * size + Math.floor(posX)] += drop;
      } else {
        // Erode rock from steep slopes
        const take = Math.min((capacity - sediment) * 0.25, 0.05);
        sediment += take;
        result[Math.floor(posY) * size + Math.floor(posX)] -= take;
      }
      vel = Math.sqrt(vel * vel + Math.abs(gx * dirX + gy * dirY));
      water *= 0.985; // Evaporation
    }
  }
  return result;
}
```

#### 2. Thermal Talus Erosion:
Simulates rock crumbling when the slope angle exceeds the natural angle of repose (~35°):
```javascript
// js/terrain.js
export function thermalErode(data, size, iterations = 3, talusThreshold = 0.04) {
  // If height difference between neighbors exceeds talusThreshold,
  // material slides down to the lower cell, creating realistic scree slopes.
}
```

---

# 👤 PERSON 3: Three.js 3D Graphics, Inspection & 3D Exports

### Core Mission:
> Explain the Three.js rendering pipeline, non-indexed BufferGeometry generation with strict Counter-Clockwise (CCW) face winding, lighting and PCF shadows, slope angle trigonometry, analytical heatmap coloring, and the 3D model export engine (OBJ/GLB).

---

### 3.1 Three.js 3D Mesh Generation & Normal Winding (`js/geometry.js`)

#### Purpose:
Converts the 2D `Float32Array` elevation grid into a 3D WebGL polygonal surface.

#### 1. Why Non-Indexed BufferGeometry?
* In smooth indexed geometries, adjacent faces share vertex normals, causing smooth curved shading.
* In Terraform, we want the signature **low-poly faceted aesthetic**. By creating independent vertex triplets for every triangle, Three.js computes distinct flat face normals.

#### 2. Counter-Clockwise (CCW) Winding Rule:
Vertices must be ordered counter-clockwise ($A \to B \to C$) when viewed from above:
$$\vec{N} = (\vec{B} - \vec{A}) \times (\vec{C} - \vec{A})$$
This guarantees the surface normal vector points strictly upward ($+Y$), preventing black, inverted backfaces.

```javascript
// js/geometry.js
export function buildTerrainGeometry(heightfield, options) {
  const { segments, heightScale } = options;
  const numQuads = (segments - 1) * (segments - 1);
  const numVertices = numQuads * 6; // 2 triangles per quad * 3 vertices

  const positions = new Float32Array(numVertices * 3);
  let ptr = 0;

  for (let z = 0; z < segments - 1; z++) {
    for (let x = 0; x < segments - 1; x++) {
      // Quad corners: (x, z), (x+1, z), (x, z+1), (x+1, z+1)
      // Triangle 1: CCW order (Top-Left, Bottom-Left, Top-Right)
      // Triangle 2: CCW order (Top-Right, Bottom-Left, Bottom-Right)
      // Height Y is calculated as: heightfield.sample(u, v) * heightScale
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals(); // Computes flat facet normals
  return geo;
}
```

#### 3. Base Skirt & Water Mesh:
* **Base Skirt:** Extrudes all boundary edges downward to $Y = -0.5$ with a dark soil material, turning the terrain into a solid architectural pedestal.
* **Water Plane:** A semi-transparent `THREE.MeshStandardMaterial` plane placed at configurable elevation $Y$ with subtle wave animation.

---

### 3.2 PBR Materials, Palettes & PCF Lighting (`js/materials.js` & `js/lighting.js`)

#### 1. 5 Physical Color Palettes:
* **Mountain Reference:** Lowland grass (`#789B45`), meadow (`#86A64E`), rock grey (`#A3A09A`), summit snow (`#C4C0B6`).
* **Alpine High Country, Desert Canyon, Volcanic Caldera, Arctic Tundra.**
* Colors are assigned per-vertex based on normalized elevation bands and slope rockiness.

#### 2. Studio Three-Point Lighting with Soft PCF Shadows:
```javascript
// js/lighting.js
// 1. Sun Key Light: Directional light at (12, 18, 10) with THREE.PCFShadowMap
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.bias = -0.0002; // Eliminates shadow acne

// 2. Sky Fill Light: Hemispherical light (Sky blue top, Ground ambient bottom)
// 3. Rim Light: Subtle directional back-light at (-12, 10, -10) defining silhouettes
```
* **Resolved Warning:** Replaced deprecated `PCFSoftShadowMap` with supported `THREE.PCFShadowMap` for zero console warnings.

---

### 3.3 Inspection Views & Slope Angle Analysis (`js/analysis.js`)

#### 1. Slope Angle Trigonometry:
The slope angle $\theta$ of any face is calculated by taking the dot product between the face's normal $\vec{N}$ and the vertical unit vector $\vec{U} = (0, 1, 0)$:
$$\cos(\theta) = \vec{N} \cdot \vec{U} \implies \theta = \arccos(\text{clamp}(\vec{N} \cdot \vec{U}, -1, 1)) \times \frac{180}{\pi}$$

```javascript
// js/analysis.js
export function computeFaceSlope(normal) {
  const up = new THREE.Vector3(0, 1, 0);
  const angle = Math.acos(clamp(normal.dot(up), -1, 1));
  return (angle * 180) / Math.PI; // Exact angle in degrees [0° .. 90°]
}
```

#### 2. Slope Heatmap Color Gradient:
* **0° (Flat Meadow):** Pure Green (`#00FF00`)
* **30° (Moderate Hill):** Yellow (`#FFFF00`)
* **60°+ (Steep Cliff):** Pure Red (`#FF0000`)

#### 3. Topographical Contour Isolines:
Uses modulo arithmetic on normalized elevation $t$:
```javascript
// js/analysis.js
const mod = t % contourInterval;
const isContourLine = mod < 0.008 || mod > contourInterval - 0.008;
// If true, paints a crisp white isoline onto the vertex buffer
```

#### 4. Terrain Analysis Statistics (`calculateTerrainStatistics`):
Computes Minimum Elevation, Maximum Elevation, Arithmetic Mean Elevation from `HeightField`, and Area-Weighted Average Slope in degrees from valid terrain triangle faces (excluding water and base skirt):
```javascript
// js/analysis.js
const stats = calculateTerrainStatistics(currentHeightfield, geometry);
// Returns { minElevation, maxElevation, avgElevation, avgSlope }
```

#### 5. Real-Time Raycaster Hover Readout:
Casts a ray from mouse coordinates through the camera into the 3D scene. Intersects the terrain mesh to display live **World $(X, Y, Z)$**, **Normalized Height**, and **Slope Angle in Degrees (°)** in the bottom-right HUD.

---

### 3.4 3D Model & File Export Engine (`js/exports.js`)

#### 1. Wavefront OBJ Export (`exportOBJ`):
Constructs a standard 3D text file with geometric vertices (`v`), normals (`vn`), and triangle face indices (`f`):
```javascript
// js/exports.js
export function generateOBJString(geometry) {
  let out = '# Terraform Wavefront OBJ File\n';
  const pos = geometry.getAttribute('position');
  const norm = geometry.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    out += `v ${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}\n`;
    out += `vn ${norm.getX(i).toFixed(4)} ${norm.getY(i).toFixed(4)} ${norm.getZ(i).toFixed(4)}\n`;
  }
  for (let i = 0; i < pos.count / 3; i++) {
    const idx = i * 3 + 1;
    out += `f ${idx}//${idx} ${idx + 1}//${idx + 1} ${idx + 2}//${idx + 2}\n`;
  }
  return out;
}
```

#### 2. Binary glTF 2.0 (GLB) Export (`exportGLB`):
Uses Three.js official addon `GLTFExporter` in binary mode:
* Bundles geometry, normals, vertex colors, and materials into a self-contained `.glb` file.
* Can be opened directly in **Blender**, **Unity**, **Unreal Engine**, or **Windows 3D Viewer**.

#### 3. 8-Bit Grayscale Heightmap PNG:
Draws the `Float32Array` values directly onto a 2D HTML5 `<canvas>` as grayscale RGBA pixels (`R=G=B=val*255, A=255`) and triggers a PNG download.

---

# 🎯 Complete Rehearsal & Live Demo Script

Follow this step-by-step sequence during your presentation:

| Time | Presenter | Action / Screen Activity | Key Spoken Points |
|---|---|---|---|
| **0:00 - 2:00** | **Person 1** | Show opening page with default mountain. | Introduce project, explain Vanilla JS/HTML5/Three.js architecture, demonstrate centralized state, show mobile bottom sheet by resizing browser. |
| **2:00 - 3:30** | **Person 1** | Drag & drop `assets/points.csv` or `sample-heightmap.png`. | Explain image luminance decoding (ITU-R BT.709) and Inverse-Distance Weighting (IDW) spatial interpolation. |
| **3:30 - 5:30** | **Person 2** | Change Noise Type to *Ridged*, adjust seed and octaves. | Explain multi-fractal noise mathematics ($\text{fBm}$), ridged mountain formula, and continuous data-to-noise blending. |
| **5:30 - 7:00** | **Person 2** | Increase Hydraulic Erosion iterations and click Generate. | Explain droplet physics, velocity, slope gradient, sediment pickup and deposition in valleys. |
| **7:00 - 9:00** | **Person 3** | Switch View Mode to *Slope Angle Heatmap*, hover mouse. | Explain Three.js low-poly non-indexed BufferGeometry, CCW face winding, dot product slope formula, and live raycaster readout. |
| **9:00 - 10:30**| **Person 3** | Change palette to *Desert*, click **Export GLB** and **Export OBJ**. | Explain PBR lighting and PCF shadows, show instant client-side download of 3D assets ready for Blender. |
| **10:30 - 11:00**| **Person 1** | Click **Reset Default**. | Demonstrate deterministic return to opening state, concluding the presentation. |

---

# ❓ Examiner Q&A Guide (Sorted by Person)

### Questions for Person 1:
1. **Q: Why avoid frontend frameworks like React or Angular?**  
   *A:* "A 3D application's bottleneck is WebGL buffer uploads and render loop synchronization. Framework Virtual DOM diffing causes garbage collection spikes and re-render cycles. Pure ES6+ modules provide optimal 60 FPS performance, direct memory management, zero build dependencies, and static deployment."
2. **Q: How does IDW point interpolation work?**  
   *A:* "Survey points are rarely arranged in neat rows. IDW computes the elevation at any grid cell by weighting nearby survey points inversely to their squared distance: $w_i = 1 / d^2$."

### Questions for Person 2:
1. **Q: What is the mathematical difference between Simplex and Ridged noise?**  
   *A:* "Simplex noise produces smooth undulating hills. Ridged noise computes $1.0 - |\text{noise}|$, inverting the valleys into sharp knife-edge ridges that realistically simulate jagged alpine mountain peaks."
2. **Q: How does hydraulic erosion maintain stability without exploding values?**  
   *A:* "Each droplet has finite sediment capacity proportional to speed and slope angle. Clamping and water evaporation factors ($\times 0.985$) ensure smooth convergence without numeric overflow."

### Questions for Person 3:
1. **Q: Why does low-poly terrain require non-indexed BufferGeometry?**  
   *A:* "In indexed geometry, adjacent triangles share vertices and vertex normal vectors, which makes Three.js interpolate light smoothly across faces. Non-indexed geometry gives each triangle three unique vertices, producing independent flat normals that give the faceted low-poly look."
2. **Q: How are GLB and OBJ exports generated on a pure client-side static site?**  
   *A:* "OBJ files are formatted as Wavefront ASCII strings directly in JavaScript. GLB files are encoded as binary glTF 2.0 buffers via Three.js's `GLTFExporter`. Both are converted into client-side browser `Blob` objects and downloaded using the HTML5 `<a>` download attribute — requiring zero server-side rendering."

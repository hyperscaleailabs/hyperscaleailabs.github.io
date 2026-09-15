/* ==========================================================================
   globe.js — dark elevation-style globe
   Land is sampled from an equirectangular map into a point cloud; major
   compute metros are drawn as extruded bars on a colour ramp; a fresnel
   shell gives the rim glow; great-circle arcs suggest inter-region traffic.

   Rendering only — no data claims. Bar heights are illustrative.
   three.js is vendored locally, so the page has no external runtime deps.
   ========================================================================== */

import * as THREE from '../vendor/three.module.min.js';

const MOUNT = document.getElementById('globe');

/* Major cloud / interconnect metros: [lat, lon, weight 0..1] */
const HUBS = [
  [ 45.52, -122.68, 0.72], [ 39.04,  -77.49, 1.00], [ 37.37, -121.92, 0.95],
  [ 41.88,  -87.63, 0.62], [ 32.78,  -96.80, 0.58], [ 33.75,  -84.39, 0.45],
  [ 40.71,  -74.01, 0.80], [ 43.65,  -79.38, 0.42], [ 47.61, -122.33, 0.68],
  [ 19.43,  -99.13, 0.30], [-23.55,  -46.63, 0.48], [-34.60,  -58.38, 0.22],
  [  4.71,  -74.07, 0.20], [ 53.35,   -6.26, 0.55], [ 51.51,   -0.13, 0.88],
  [ 50.11,    8.68, 0.92], [ 52.37,    4.89, 0.70], [ 48.86,    2.35, 0.60],
  [ 59.33,   18.07, 0.35], [ 41.39,    2.17, 0.28], [ 45.46,    9.19, 0.32],
  [ 52.23,   21.01, 0.26], [ 47.37,    8.54, 0.34], [ 25.20,   55.27, 0.44],
  [ 24.71,   46.68, 0.30], [ 32.09,   34.78, 0.28], [ 41.01,   28.98, 0.24],
  [ -1.29,   36.82, 0.18], [  6.52,    3.38, 0.20], [-26.20,   28.04, 0.30],
  [ 30.04,   31.24, 0.18], [ 19.08,   72.88, 0.58], [ 12.97,   77.59, 0.62],
  [ 28.61,   77.21, 0.40], [ 13.08,   80.27, 0.26], [  1.35,  103.82, 0.86],
  [ 13.76,  100.50, 0.24], [ -6.21,  106.85, 0.30], [  3.14,  101.69, 0.24],
  [ 14.60,  120.98, 0.20], [ 22.32,  114.17, 0.66], [ 31.23,  121.47, 0.72],
  [ 39.90,  116.41, 0.68], [ 22.54,  114.06, 0.50], [ 25.03,  121.57, 0.46],
  [ 37.57,  126.98, 0.64], [ 35.68,  139.69, 0.90], [ 34.69,  135.50, 0.44],
  [-33.87,  151.21, 0.52], [-37.81,  144.96, 0.30], [-36.85,  174.76, 0.18],
  [ 64.15,  -21.94, 0.22], [ 60.17,   24.94, 0.30], [ 55.75,   37.62, 0.22],
];

/* Arcs: index pairs into HUBS */
const ARCS = [
  [1, 14], [1, 34], [2, 47], [15, 34], [34, 41], [47, 2], [6, 14],
  [15, 31], [42, 34], [48, 34], [0, 46], [14, 23],
];

const RADIUS = 100;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function boot() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    MOUNT.dataset.failed = '1';
    document.documentElement.dataset.noGlobe = '1';
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 4000);
  camera.position.set(0, 0, 340);

  renderer.setClearColor(0x000000, 0);
  MOUNT.appendChild(renderer.domElement);

  /* World group: tilt so the north pole leans like a globe on a stand. */
  const world = new THREE.Group();
  world.rotation.z = -0.35;
  scene.add(world);

  const spin = new THREE.Group();
  world.add(spin);

  /* ---- body: a matte sphere that occludes the far-side geometry ---- */
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS - 0.6, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0x05070c })
  );
  spin.add(body);

  /* ---- fresnel rim glow ---- */
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS * 1.16, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(0x6f9bff) } },
      vertexShader: `
        varying vec3 vN; varying vec3 vP;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vP = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying vec3 vN; varying vec3 vP;
        void main() {
          float f = pow(clamp(dot(normalize(vN), normalize(vP)), 0.0, 1.0), 3.2);
          gl_FragColor = vec4(uColor, f * 0.85);
        }`,
    })
  );
  world.add(glow);

  /* ---- land point cloud, sampled from the equirectangular map ---- */
  const landPoints = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      size: 1.7,
      color: 0x4a6ba8,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      map: discTexture(),
      alphaTest: 0.35,
    })
  );
  spin.add(landPoints);

  sampleLand('assets/img/world.jpg')
    .then((positions) => {
      landPoints.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      landPoints.geometry.computeBoundingSphere();
      ready();
    })
    .catch(ready);

  /* ---- extruded bars at each hub ---- */
  const barGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, -0.5);
  const bars = new THREE.InstancedMesh(
    barGeo,
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 }),
    HUBS.length
  );
  bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  const origin = new THREE.Vector3(0, 0, 0);
  const targetH = new Float32Array(HUBS.length);
  const colour = new THREE.Color();

  HUBS.forEach(([lat, lon, w], i) => {
    targetH[i] = 6 + w * 52;
    bars.setColorAt(i, colour.setStyle(ramp(w)));
  });
  if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
  spin.add(bars);

  /* ---- great-circle arcs ---- */
  const arcGroup = new THREE.Group();
  ARCS.forEach(([a, b]) => {
    const pa = toVec(HUBS[a][0], HUBS[a][1], RADIUS);
    const pb = toVec(HUBS[b][0], HUBS[b][1], RADIUS);
    const lift = 1 + pa.distanceTo(pb) / (RADIUS * 3.4);
    const mid = pa.clone().add(pb).multiplyScalar(0.5).normalize().multiplyScalar(RADIUS * lift);
    const pts = new THREE.QuadraticBezierCurve3(pa, mid, pb).getPoints(64);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    /* Fade each arc towards its ends via vertex alpha baked into colour. */
    const cols = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      const f = Math.sin(t * Math.PI);
      cols[i * 3] = 0.30 * f; cols[i * 3 + 1] = 0.55 * f; cols[i * 3 + 2] = 1.0 * f;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    arcGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })));
  });
  spin.add(arcGroup);

  /* ---- interaction ---- */
  let autoSpin = 0.00075;
  let velX = 0, velY = 0;
  let rotY = -1.9, rotX = 0.12;
  let dragging = false, lastX = 0, lastY = 0;
  let pointerNX = 0, pointerNY = 0;
  let grow = 0;                 // 0..1 bar reveal
  let scrollFade = 1;
  let started = false;

  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  el.style.cursor = 'grab';

  el.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';
  });
  el.addEventListener('pointerup', (e) => {
    dragging = false;
    try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    el.style.cursor = 'grab';
  });
  el.addEventListener('pointercancel', () => { dragging = false; el.style.cursor = 'grab'; });
  window.addEventListener('pointermove', (e) => {
    pointerNX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNY = (e.clientY / window.innerHeight) * 2 - 1;
    if (!dragging) return;
    velY += (e.clientX - lastX) * 0.00042;
    velX += (e.clientY - lastY) * 0.00028;
    lastX = e.clientX; lastY = e.clientY;
  }, { passive: true });

  /* ---- resize ---- */
  function resize() {
    const w = MOUNT.clientWidth || window.innerWidth;
    const h = MOUNT.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);            // must update canvas CSS size, not just the buffer
    camera.aspect = w / h;
    /* Fit the globe to ~62% of the frame's short axis at every viewport shape. */
    const fov = camera.fov * Math.PI / 180;
    let dist = ((RADIUS * 2.32) / 0.62 / 2) / Math.tan(fov / 2);
    if (camera.aspect < 1) dist /= camera.aspect;          // portrait: fit by width
    camera.position.z = dist;
    /* On wide screens shift the globe right of centre, clear of the headline;
       on narrow ones lift it above the text block. */
    world.position.x = w >= 1100 ? RADIUS * 0.72 : w >= 900 ? RADIUS * 0.42 : 0;
    world.position.y = w >= 900 ? RADIUS * 0.18 : RADIUS * 0.65;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  /* Mobile browsers settle their viewport after load; re-fit once it has. */
  window.addEventListener('load', () => { resize(); setTimeout(resize, 300); });

  /* Fade the globe out as the hero scrolls away. */
  window.addEventListener('scroll', () => {
    const v = window.innerHeight;
    scrollFade = Math.max(0, 1 - window.scrollY / (v * 0.85));
    MOUNT.style.opacity = String(scrollFade);
    MOUNT.style.pointerEvents = scrollFade > 0.5 ? 'auto' : 'none';
  }, { passive: true });

  /* ---- loop ---- */
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (scrollFade <= 0.01) return;   // nothing visible — skip the draw

    if (!dragging) { velY += (autoSpin - velY) * 0.02; }
    rotY += velY; rotX += velX;
    velX *= 0.92;
    if (dragging) velY *= 0.9;
    rotX = Math.max(-0.9, Math.min(0.9, rotX));

    spin.rotation.y = rotY;
    spin.rotation.x = rotX;

    /* Gentle parallax on the whole world group. */
    world.rotation.y += (pointerNX * 0.06 - world.rotation.y) * 0.03;
    world.rotation.x += (-pointerNY * 0.05 - world.rotation.x) * 0.03;

    if (started && grow < 1) grow = Math.min(1, grow + (REDUCED ? 1 : 0.012));

    /* Bars breathe slightly so the globe never looks frozen. */
    const t = performance.now() * 0.0006;
    for (let i = 0; i < HUBS.length; i++) {
      const pulse = REDUCED ? 1 : 1 + Math.sin(t + i * 0.7) * 0.06;
      const h = Math.max(0.001, targetH[i] * easeOut(Math.min(1, grow * 1.4 - i / HUBS.length * 0.4)) * pulse);
      const p = toVec(HUBS[i][0], HUBS[i][1], RADIUS);
      dummy.position.copy(p);
      dummy.lookAt(origin);          // +Z inward, so the box grows outward
      dummy.scale.set(1.6, 1.6, h);
      dummy.updateMatrix();
      bars.setMatrixAt(i, dummy.matrix);
    }
    bars.instanceMatrix.needsUpdate = true;

    arcGroup.rotation.z = 0;
    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) frame();
  });

  function ready() {
    started = true;
    document.documentElement.dataset.globeReady = '1';
    window.dispatchEvent(new CustomEvent('globe:ready'));
  }
  frame();
}

/* ------------------------------------------------------------------ utils */

function toVec(lat, lon, r) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (180 - lon) * Math.PI / 180;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/* Blue → cyan → green → amber → red, matching the elevation-globe ramp. */
function ramp(w) {
  const stops = [
    [0.00, [0x24, 0x46, 0x8f]],
    [0.30, [0x2f, 0x86, 0xc4]],
    [0.55, [0x3f, 0xc2, 0x9a]],
    [0.78, [0xe0, 0xb1, 0x4a]],
    [1.00, [0xe2, 0x5c, 0x3f]],
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (w >= stops[i][0] && w <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const t = b[0] === a[0] ? 0 : (w - a[0]) / (b[0] - a[0]);
  const mix = (i) => Math.round(a[1][i] + (b[1][i] - a[1][i]) * t);
  return `rgb(${mix(0)},${mix(1)},${mix(2)})`;
}

function easeOut(x) { const c = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - c, 3); }

/* A soft round sprite so land reads as dots, not squares. */
function discTexture() {
  const s = 32;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* Read the land mask and turn lit pixels into sphere-surface points. */
function sampleLand(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const W = 720, H = 360;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, W, H);
      let data;
      try { data = g.getImageData(0, 0, W, H).data; }
      catch (err) { reject(err); return; }

      const step = 2;                 // sample every other pixel
      const out = [];
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          const i = (y * W + x) * 4;
          const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
          if (lum > 6) continue;      // ocean is dark grey (~12); land is pure black (0)
          const lat = 90 - (y / H) * 180;
          const lon = (x / W) * 360 - 180;
          const v = toVec(lat, lon, RADIUS + 0.4);
          out.push(v.x, v.y, v.z);
        }
      }
      resolve(new Float32Array(out));
    };
    img.onerror = reject;
    img.src = src;
  });
}

/* Kick off last: the module-scope constants above must be initialised first. */
if (MOUNT) boot();

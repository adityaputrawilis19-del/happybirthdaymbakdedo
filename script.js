import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createCharacterAnimator } from "./character-animator.js";

/* ==========================================================
   A LITTLE BIRTHDAY FILM — KAK DEDO
   Rebuilt scene system / Three.js r165
   ========================================================== */

const $ = (id) => document.getElementById(id);
const canvas = $("world");
if (!canvas) throw new Error('Canvas #world tidak ditemukan. Periksa index.html.');

const ui = {
  loading: $("loadingScreen"),
  loadingBar: $("loadingBar"),
  loadingStatus: $("loadingStatus"),
  intro: $("introScreen"),
  experience: $("experienceUI"),
  start: $("startButton"),
  sound: $("soundButton"),
  soundLabel: $("soundLabel"),
  counter: $("sceneCounter"),
  eyebrow: $("storyEyebrow"),
  title: $("storyTitle"),
  description: $("storyDescription"),
  story: $("storyPanel"),
  actionWrap: $("actionWrap"),
  action: $("actionButton"),
  actionLabel: $("actionLabel"),
  progress: $("progressBar"),
  prev: $("prevButton"),
  next: $("nextButton"),
  hint: $("navigationHint"),
  curtain: $("transitionCurtain"),
  flash: $("flash")
};

const audio = {
  music: $("backgroundMusic"),
  birthday: $("birthdayMusic"),
  whoosh: $("whooshSound"),
  click: $("clickSound"),
  surprise: $("surpriseSound"),
  crowd: $("crowdSound")
};

let soundEnabled = true;
let started = false;
let currentScene = 0;
let transitionSequence = 0;
let sceneElapsed = 0;
let giftOpened = false;
let giftProgress = 0;
let cakeProgress = 0;
let confettiActive = false;
let characterAnimator = null;
let characterModel = null;
let characterLoaded = false;
let walkStartX = -4.6;
let walkEndX = -2.65;
let walkDuration = 3.25;
let giftButtonUnlocked = false;

function setLoading(percent, message) {
  if (ui.loadingBar) ui.loadingBar.style.width = `${THREE.MathUtils.clamp(percent, 0, 100)}%`;
  if (ui.loadingStatus) ui.loadingStatus.textContent = message;
}

function playAudio(element, volume = 1, restart = true) {
  if (!element || !soundEnabled) return;
  try {
    if (restart) element.currentTime = 0;
    element.volume = volume;
    const promise = element.play();
    if (promise?.catch) promise.catch((error) => console.info("Audio menunggu interaksi / file:", error.message));
  } catch (error) {
    console.info("Audio tidak tersedia:", error.message);
  }
}

function stopAudio(element) {
  if (!element) return;
  element.pause();
  try { element.currentTime = 0; } catch { /* ignore */ }
}

function stopCelebrationAudio() {
  stopAudio(audio.birthday);
  stopAudio(audio.crowd);
}

function startMusic() {
  if (!audio.music || !soundEnabled) return;
  audio.music.loop = true;
  audio.music.volume = 0.26;
  playAudio(audio.music, 0.26, false);
}

function setMusicDuck(ducked) {
  if (audio.music && soundEnabled) audio.music.volume = ducked ? 0.09 : 0.26;
}

/* -------------------- THREE CORE -------------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1725);
scene.fog = new THREE.FogExp2(0x0b1725, 0.009);

const camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(0, 4.3, 14);
const cameraLook = new THREE.Vector3(0, 2.5, -2);
let cameraPositionTarget = new THREE.Vector3(0, 4.3, 14);
let cameraLookTarget = new THREE.Vector3(0, 2.5, -2);
let cameraFovTarget = 43;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !matchMedia("(max-width: 700px)").matches,
  alpha: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemi = new THREE.HemisphereLight(0xcbdcf0, 0x544231, 1.9);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xffdfad, 3.0);
keyLight.position.set(-7, 12, 8);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -18;
keyLight.shadow.camera.right = 18;
keyLight.shadow.camera.top = 18;
keyLight.shadow.camera.bottom = -18;
keyLight.shadow.bias = -0.00018;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x9ebee2, 1.05);
fillLight.position.set(8, 6, 2);
scene.add(fillLight);

const goldLight = new THREE.PointLight(0xf0bd74, 34, 25, 2);
goldLight.position.set(4, 4, 5);
scene.add(goldLight);

const revealLight = new THREE.PointLight(0xffc66f, 0, 10, 2);
revealLight.position.set(0, 3.1, -0.7);
scene.add(revealLight);

const mats = {
  navy: new THREE.MeshStandardMaterial({ color: 0x10243b, roughness: 0.38, metalness: 0.18 }),
  navyDeep: new THREE.MeshStandardMaterial({ color: 0x091827, roughness: 0.5, metalness: 0.12 }),
  blueGlass: new THREE.MeshPhysicalMaterial({ color: 0x7096ad, roughness: 0.16, metalness: 0.22, transparent: true, opacity: 0.42, transmission: 0.12, thickness: 0.3 }),
  glassDark: new THREE.MeshPhysicalMaterial({ color: 0x19374b, roughness: 0.2, metalness: 0.25, transparent: true, opacity: 0.68 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd6b477, roughness: 0.28, metalness: 0.72 }),
  paleGold: new THREE.MeshStandardMaterial({ color: 0xf0dcae, roughness: 0.36, metalness: 0.32 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xe8ddc8, roughness: 0.82 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x28384a, roughness: 0.72, metalness: 0.08 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x5b4030, roughness: 0.42, metalness: 0.12 }),
  woodLight: new THREE.MeshStandardMaterial({ color: 0x99704a, roughness: 0.45 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x486c52, roughness: 0.9 }),
  red: new THREE.MeshStandardMaterial({ color: 0x922a40, roughness: 0.3, metalness: 0.1 }),
  redLight: new THREE.MeshStandardMaterial({ color: 0xc24d5a, roughness: 0.34 }),
  frosting: new THREE.MeshStandardMaterial({ color: 0xffe3d5, roughness: 0.38 }),
  berry: new THREE.MeshStandardMaterial({ color: 0xb62f51, roughness: 0.28 })
};

function box(parent, name, size, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  if (options.rotation) mesh.rotation.set(...options.rotation);
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, name, top, bottom, height, position, material, radial = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, radial), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function sphere(parent, name, radius, position, material, scale = [1, 1, 1], segments = 24) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeTextTexture(lines, width = 1024, height = 300) {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = width;
  canvasTexture.height = height;
  const ctx = canvasTexture.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f0dcae";
  ctx.font = "700 132px Arial";
  ctx.fillText(lines[0], width / 2, height * 0.43);
  if (lines[1]) {
    ctx.fillStyle = "rgba(245,239,224,.78)";
    ctx.font = "500 33px Arial";
    ctx.fillText(lines[1], width / 2, height * 0.79);
  }
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addFloor(parent, size, material, y = -0.15) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = y;
  floor.receiveShadow = true;
  parent.add(floor);
  return floor;
}

/* -------------------- EXTERIOR WORLD -------------------- */
const exterior = new THREE.Group();
scene.add(exterior);

function makePlant(parent, x, z, scale = 1) {
  const plant = new THREE.Group();
  plant.position.set(x, 0, z);
  plant.scale.setScalar(scale);
  parent.add(plant);
  cylinder(plant, "Planter", 0.48, 0.38, 0.68, [0, 0.34, 0], mats.woodLight);
  cylinder(plant, "Soil", 0.39, 0.39, 0.06, [0, 0.7, 0], mats.navyDeep);
  cylinder(plant, "Plant stem", 0.045, 0.06, 1.5, [0, 1.42, 0], mats.leaf, 12);
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7;
    const leaf = sphere(plant, "Broad leaf", 0.32, [Math.cos(a) * 0.34, 1.52 + (i % 2) * 0.16, Math.sin(a) * 0.34], mats.leaf, [0.56, 1.45, 0.42], 16);
    leaf.rotation.z = Math.cos(a) * 0.42;
    leaf.rotation.x = Math.sin(a) * 0.35;
  }
}

function buildExterior() {
  addFloor(exterior, 160, new THREE.MeshStandardMaterial({ color: 0x263342, roughness: 0.9 }), -0.18);

  // Architectural mass and glass frontage.
  box(exterior, "Bank architectural shell", [20, 10, 1.25], [0, 5, -6.1], mats.navyDeep);
  box(exterior, "Upper facade fascia", [20.2, 1.0, 1.38], [0, 9.0, -5.98], mats.navy);
  box(exterior, "Lower facade plinth", [20.1, 0.35, 1.4], [0, 0.32, -5.98], mats.gold);

  // Glass bays and gold mullions.
  for (let i = 0; i < 5; i++) {
    const x = -7.8 + i * 3.9;
    box(exterior, `Facade glass bay ${i}`, [3.45, 6.75, 0.12], [x, 4.85, -5.42], mats.blueGlass, { castShadow: false });
    box(exterior, `Facade vertical mullion ${i}`, [0.055, 7.15, 0.18], [x + 1.82, 4.8, -5.25], mats.gold, { castShadow: false });
    box(exterior, `Window lower rail ${i}`, [3.55, 0.055, 0.18], [x, 1.42, -5.25], mats.gold, { castShadow: false });
  }

  // Entrance portal.
  box(exterior, "Entrance dark recess", [4.4, 6.2, 0.22], [0, 3.35, -5.2], mats.navyDeep);
  box(exterior, "Entrance gold left", [0.11, 6.2, 0.22], [-2.22, 3.35, -5.0], mats.paleGold);
  box(exterior, "Entrance gold right", [0.11, 6.2, 0.22], [2.22, 3.35, -5.0], mats.paleGold);
  box(exterior, "Entrance gold lintel", [4.5, 0.11, 0.22], [0, 6.43, -5.0], mats.paleGold);

  const leftDoor = new THREE.Group();
  leftDoor.position.set(-0.04, 0, -4.99);
  exterior.add(leftDoor);
  box(leftDoor, "Left automatic door", [2.0, 4.8, 0.08], [-1.0, 2.65, 0], mats.glassDark, { castShadow: false });
  box(leftDoor, "Left door handle", [0.045, 0.72, 0.07], [-0.18, 2.5, 0.08], mats.gold);

  const rightDoor = new THREE.Group();
  rightDoor.position.set(0.04, 0, -4.99);
  exterior.add(rightDoor);
  box(rightDoor, "Right automatic door", [2.0, 4.8, 0.08], [1.0, 2.65, 0], mats.glassDark, { castShadow: false });
  box(rightDoor, "Right door handle", [0.045, 0.72, 0.07], [0.18, 2.5, 0.08], mats.gold);
  exterior.userData.doors = { leftDoor, rightDoor };

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6.0, 1.75),
    new THREE.MeshBasicMaterial({ map: makeTextTexture(["BTN", "BANK TABUNGAN NEGARA"]), transparent: true, toneMapped: false })
  );
  sign.position.set(0, 8.05, -5.22);
  exterior.add(sign);
  box(exterior, "Sign backing", [6.3, 1.95, 0.16], [0, 8.05, -5.32], mats.navy);
  sign.position.z = -5.22;

  // Forecourt, warm pathway lines and steps.
  box(exterior, "Entry landing", [7.8, 0.18, 3.0], [0, -0.02, -2.45], mats.cream);
  for (let i = 0; i < 3; i++) {
    box(exterior, `Entry step ${i}`, [8.3 - i * 0.35, 0.16, 0.7], [0, -0.12 + i * 0.12, -0.5 + i * 0.68], mats.paleGold);
  }
  for (const x of [-8.9, 8.9]) {
    box(exterior, "Architectural pillar", [0.38, 8.1, 0.55], [x, 4.0, -5.0], mats.navy);
    box(exterior, "Pillar capital", [0.62, 0.18, 0.76], [x, 7.95, -5.0], mats.gold);
    makePlant(exterior, x * 0.78, 0.9, 1.0);
  }
  for (let i = 0; i < 4; i++) {
    box(exterior, "Pathway inlay", [0.035, 0.012, 7.0], [-5.2 + i * 3.45, -0.025, 1.0], mats.gold, { castShadow: false });
  }
  // Low landscape walls.
  box(exterior, "Landscape wall left", [4.0, 0.38, 1.2], [-7.4, 0.05, 1.7], mats.navy);
  box(exterior, "Landscape wall right", [4.0, 0.38, 1.2], [7.4, 0.05, 1.7], mats.navy);
  return exterior;
}

/* -------------------- OFFICE WORLD -------------------- */
const office = new THREE.Group();
scene.add(office);
let giftGroup;
let giftLidPivot;
let giftRibbon;
let cakeGroup;
let cakeFlames = [];
let deskSpot;

function buildOffice() {
  addFloor(office, 48, new THREE.MeshStandardMaterial({ color: 0x26374a, roughness: 0.56 }), -0.18);
  box(office, "Office back wall", [25, 10, 0.45], [0, 5, -7.7], mats.cream);
  box(office, "Office right wall", [0.45, 10, 21], [12.3, 5, 2.4], mats.navy);
  box(office, "Office left wall", [0.45, 10, 21], [-12.3, 5, 2.4], mats.navy);

  // Large windows with skyline silhouettes.
  for (let i = 0; i < 3; i++) {
    const x = -7.7 + i * 7.7;
    box(office, "Office window glass", [5.7, 4.7, 0.12], [x, 5.45, -7.42], mats.blueGlass, { castShadow: false });
    box(office, "Office window vertical trim", [0.075, 4.9, 0.16], [x + 2.88, 5.45, -7.3], mats.gold, { castShadow: false });
    box(office, "Office window lower trim", [5.8, 0.075, 0.16], [x, 3.05, -7.3], mats.gold, { castShadow: false });
  }
  box(office, "Office ceiling beam", [24.5, 0.32, 1.1], [0, 9.45, -7.0], mats.navy);
  box(office, "Office feature wall", [6.8, 5.6, 0.16], [0, 5.15, -7.38], mats.navy);
  const btnWall = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, 1.02),
    new THREE.MeshBasicMaterial({ map: makeTextTexture(["BTN", "SERVING WITH HEART"], 900, 260), transparent: true, toneMapped: false })
  );
  btnWall.position.set(0, 6.45, -7.25);
  office.add(btnWall);

  // Executive work desk.
  box(office, "Desk top", [6.4, 0.28, 2.7], [0, 1.38, -0.65], mats.wood);
  box(office, "Desk apron", [5.6, 0.45, 0.22], [0, 1.0, -1.72], mats.woodLight);
  for (const x of [-2.7, 2.7]) {
    box(office, "Desk pedestal", [0.55, 1.1, 2.2], [x, 0.55, -0.65], mats.navy);
    box(office, "Pedestal gold trim", [0.58, 0.045, 2.24], [x, 0.92, -0.65], mats.gold);
  }
  // Monitor and a little desk decor.
  box(office, "Monitor body", [1.95, 1.22, 0.15], [-1.75, 2.22, -1.2], mats.navyDeep);
  box(office, "Monitor display", [1.76, 1.03, 0.025], [-1.75, 2.23, -1.105], new THREE.MeshBasicMaterial({ color: 0x203b52 }));
  box(office, "Monitor stand", [0.16, 0.48, 0.17], [-1.75, 1.6, -1.2], mats.gold);
  box(office, "Desk notebook", [1.12, 0.055, 0.78], [2.12, 1.55, -0.65], mats.cream);
  box(office, "Notebook cover", [1.13, 0.025, 0.8], [2.12, 1.59, -0.65], mats.red);
  cylinder(office, "Pen cup", 0.16, 0.18, 0.36, [2.95, 1.7, -1.28], mats.gold, 20);
  for (let i = 0; i < 3; i++) box(office, "Pen", [0.025, 0.52, 0.025], [2.91 + i * 0.07, 2.1, -1.28], mats.navy, { rotation: [0, 0, (i - 1) * 0.12] });

  // Desk lamp with a warm practical light.
  const lamp = new THREE.Group();
  lamp.position.set(-2.65, 1.53, -0.2);
  office.add(lamp);
  cylinder(lamp, "Lamp foot", 0.32, 0.34, 0.09, [0, 0, 0], mats.gold);
  cylinder(lamp, "Lamp stem", 0.045, 0.055, 0.8, [0, 0.42, 0], mats.gold, 12);
  sphere(lamp, "Lamp shade", 0.34, [0, 0.88, 0], mats.paleGold, [1.0, 0.55, 1.0]);
  deskSpot = new THREE.PointLight(0xffc57c, 8, 7, 2);
  deskSpot.position.set(-2.65, 2.65, -0.2);
  office.add(deskSpot);

  // A pair of lounge chairs to create depth.
  for (const x of [-5.1, 5.0]) {
    box(office, "Accent chair seat", [1.65, 0.42, 1.55], [x, 0.55, -3.0], mats.navy);
    box(office, "Accent chair back", [1.65, 1.45, 0.35], [x, 1.33, -3.65], mats.navy);
    box(office, "Accent chair gold rail", [1.7, 0.06, 1.62], [x, 0.83, -3.0], mats.gold);
  }
  makePlant(office, -8.5, -4.2, 0.8);
  makePlant(office, 8.6, -4.3, 0.9);

  // Gift base and hinged lid, set on the desk.
  giftGroup = new THREE.Group();
  giftGroup.position.set(0.78, 1.53, -0.32);
  office.add(giftGroup);
  box(giftGroup, "Gift lower box", [1.55, 1.05, 1.5], [0, 0.525, 0], mats.red);
  box(giftGroup, "Gift front panel", [1.58, 0.22, 0.035], [0, 0.52, 0.765], mats.redLight);
  box(giftGroup, "Gift vertical ribbon", [0.22, 1.09, 1.52], [0, 0.53, 0], mats.paleGold);
  box(giftGroup, "Gift horizontal ribbon", [1.56, 1.09, 0.22], [0, 0.53, 0], mats.paleGold);

  giftLidPivot = new THREE.Group();
  giftLidPivot.position.set(0, 1.04, -0.69);
  giftGroup.add(giftLidPivot);
  box(giftLidPivot, "Gift lid", [1.68, 0.22, 1.62], [0, 0.12, 0.69], mats.redLight);
  box(giftLidPivot, "Gift lid ribbon", [0.23, 0.235, 1.64], [0, 0.12, 0.69], mats.paleGold);
  giftRibbon = new THREE.Group();
  giftLidPivot.add(giftRibbon);
  const bowLeft = sphere(giftRibbon, "Gift bow left", 0.23, [-0.19, 0.31, 0.68], mats.gold, [1.35, 0.48, 0.45]);
  const bowRight = sphere(giftRibbon, "Gift bow right", 0.23, [0.19, 0.31, 0.68], mats.gold, [1.35, 0.48, 0.45]);
  bowLeft.rotation.z = -0.24;
  bowRight.rotation.z = 0.24;
  sphere(giftRibbon, "Gift bow knot", 0.13, [0, 0.31, 0.68], mats.paleGold, [1, 0.8, 0.8]);

  // Birthday cake rises from behind the gift lid.
  cakeGroup = new THREE.Group();
  cakeGroup.position.set(0.78, 0.86, -0.32);
  cakeGroup.visible = false;
  office.add(cakeGroup);
  cylinder(cakeGroup, "Cake base board", 0.93, 0.93, 0.10, [0, 0.06, 0], mats.gold);
  cylinder(cakeGroup, "Cake lower tier", 0.82, 0.82, 0.62, [0, 0.42, 0], mats.frosting);
  cylinder(cakeGroup, "Cake upper tier", 0.62, 0.67, 0.46, [0, 0.93, 0], mats.redLight);
  cylinder(cakeGroup, "Cake icing top", 0.65, 0.65, 0.12, [0, 1.22, 0], mats.frosting);
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI * 2 / 10;
    sphere(cakeGroup, "Cake berry", 0.075, [Math.cos(a) * 0.49, 1.31, Math.sin(a) * 0.49], mats.berry, [1, 0.8, 1], 14);
  }
  cakeFlames = [];
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.22;
    cylinder(cakeGroup, "Birthday candle", 0.045, 0.045, 0.34, [x, 1.48, 0], mats.paleGold, 14);
    const flame = sphere(cakeGroup, "Candle flame", 0.075, [x, 1.7, 0], new THREE.MeshBasicMaterial({ color: 0xffb44e, toneMapped: false }), [0.8, 1.4, 0.8], 12);
    cakeFlames.push(flame);
  }

  // Keep cake tucked down until the gift is opened.
  cakeGroup.scale.setScalar(0.001);
  return office;
}

/* -------------------- SKY ENDING -------------------- */
const skyWorld = new THREE.Group();
scene.add(skyWorld);
let clouds = [];
let skyDome;

function buildSky() {
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 2048;
  skyCanvas.height = 1024;
  const ctx = skyCanvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
  gradient.addColorStop(0, "#172841");
  gradient.addColorStop(0.42, "#627b96");
  gradient.addColorStop(0.72, "#d9a878");
  gradient.addColorStop(1, "#f5d5a3");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2048, 1024);
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;
  skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(75, 48, 32),
    new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false })
  );
  skyWorld.add(skyDome);

  const sunBall = sphere(skyWorld, "Golden horizon", 3.5, [-19, 13, -40], new THREE.MeshBasicMaterial({ color: 0xffd29b, toneMapped: false }), [1, 0.72, 1], 32);
  const sunHalo = sphere(skyWorld, "Sun halo", 5.5, [-19, 13, -40], new THREE.MeshBasicMaterial({ color: 0xf5bd83, transparent: true, opacity: 0.14, depthWrite: false }), [1, 0.72, 1], 32);
  sunHalo.renderOrder = -1;

  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffedda, roughness: 1, metalness: 0, transparent: true, opacity: 0.93 });
  function cloud(x, y, z, size = 1) {
    const group = new THREE.Group();
    const puffPositions = [[-1.1, 0, 0], [-0.45, 0.35, 0.1], [0.28, 0.24, 0], [0.95, 0, -0.08], [0.05, -0.08, 0.25]];
    puffPositions.forEach(([px, py, pz], i) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(i === 2 ? 0.85 : 0.72, 20, 16), cloudMat);
      puff.position.set(px, py, pz);
      puff.scale.set(1.25, 0.72, 0.62);
      puff.castShadow = false;
      group.add(puff);
    });
    group.position.set(x, y, z);
    group.scale.setScalar(size);
    skyWorld.add(group);
    clouds.push(group);
  }
  cloud(-11, 7, -17, 2.2);
  cloud(10, 10, -22, 2.6);
  cloud(-1, 15, -35, 3.0);
  cloud(17, 5, -13, 1.7);
  cloud(-19, 12, -28, 1.9);
  cloud(2, 4, -10, 1.6);
}

/* -------------------- CHARACTER RIG -------------------- */
const characterGroup = new THREE.Group();
characterGroup.visible = false;
scene.add(characterGroup);
const characterShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.82, 48),
  new THREE.MeshBasicMaterial({ color: 0x030a12, transparent: true, opacity: 0.24, depthWrite: false })
);
characterShadow.rotation.x = -Math.PI / 2;
characterShadow.position.y = 0.012;
characterGroup.add(characterShadow);

async function loadCharacter() {
  setLoading(12, "Memuat karakter 3D...");
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync("assets/character.glb", (progress) => {
    if (progress.lengthComputable) {
      const percent = 12 + (progress.loaded / progress.total) * 62;
      setLoading(percent, "Mempersiapkan karakter Kak Dedo...");
    }
  });

  characterModel = gltf.scene;
  const bounds = new THREE.Box3().setFromObject(characterModel);
  const center = new THREE.Vector3();
  bounds.getCenter(center);
  characterModel.position.x = -center.x;
  characterModel.position.y = -bounds.min.y;
  characterModel.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.material) {
      object.material.side = THREE.FrontSide;
      if ("roughness" in object.material) object.material.roughness = Math.max(object.material.roughness ?? 0.55, 0.48);
      object.material.needsUpdate = true;
    }
  });

  characterGroup.add(characterModel);
  characterGroup.scale.setScalar(0.72);
  characterGroup.position.set(2.4, 0, 0.9);
  characterGroup.visible = true;
  characterAnimator = createCharacterAnimator(characterModel);
  characterAnimator.setState("wave");
  characterLoaded = true;
  setLoading(86, "Menyusun pencahayaan dan suasana...");
}

/* -------------------- ATMOSPHERE / PARTICLES -------------------- */
const dustCount = matchMedia("(max-width: 700px)").matches ? 90 : 170;
const dustPositions = new Float32Array(dustCount * 3);
const dustSpeeds = new Float32Array(dustCount);
for (let i = 0; i < dustCount; i++) {
  dustPositions[i * 3] = (Math.random() - 0.5) * 23;
  dustPositions[i * 3 + 1] = Math.random() * 8 + 0.4;
  dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 19;
  dustSpeeds[i] = 0.08 + Math.random() * 0.22;
}
const dustGeometry = new THREE.BufferGeometry();
dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xffdfb0, size: 0.035, transparent: true, opacity: 0.52, depthWrite: false, sizeAttenuation: true }));
scene.add(dust);

const confettiCount = matchMedia("(max-width: 700px)").matches ? 76 : 142;
const confettiGeometry = new THREE.BoxGeometry(0.075, 0.13, 0.025);
const confettiMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.08, side: THREE.DoubleSide });
const confettiMesh = new THREE.InstancedMesh(confettiGeometry, confettiMaterial, confettiCount);
confettiMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
confettiMesh.visible = false;
scene.add(confettiMesh);
const confettiData = [];
const confettiPalette = [0xe7c987, 0xf8eed9, 0xc34e61, 0x6286ad, 0xffd9a3];
const dummy = new THREE.Object3D();
for (let i = 0; i < confettiCount; i++) {
  const data = {
    x: (Math.random() - 0.5) * 11,
    y: Math.random() * 10 + 4,
    z: -0.2 + (Math.random() - 0.5) * 5,
    vy: 1.0 + Math.random() * 2.2,
    vx: (Math.random() - 0.5) * 0.5,
    spin: (Math.random() - 0.5) * 5,
    rx: Math.random() * Math.PI,
    ry: Math.random() * Math.PI,
    rz: Math.random() * Math.PI
  };
  confettiData.push(data);
  confettiMesh.setColorAt(i, new THREE.Color(confettiPalette[i % confettiPalette.length]));
  dummy.position.set(data.x, -20, data.z);
  dummy.scale.setScalar(0.01);
  dummy.updateMatrix();
  confettiMesh.setMatrixAt(i, dummy.matrix);
}
confettiMesh.instanceMatrix.needsUpdate = true;

function launchConfetti() {
  confettiActive = true;
  confettiMesh.visible = true;
  for (const p of confettiData) {
    p.y = 5 + Math.random() * 7;
    p.x = (Math.random() - 0.5) * 10;
    p.z = -0.2 + (Math.random() - 0.5) * 4;
    p.vy = 1.0 + Math.random() * 2.5;
    p.vx = (Math.random() - 0.5) * 0.7;
    p.rx = Math.random() * Math.PI;
    p.ry = Math.random() * Math.PI;
    p.rz = Math.random() * Math.PI;
  }
}

function stopConfetti() {
  confettiActive = false;
  confettiMesh.visible = false;
}

function updateParticles(dt, time) {
  const positions = dustGeometry.attributes.position;
  for (let i = 0; i < dustCount; i++) {
    const yIndex = i * 3 + 1;
    positions.array[yIndex] += dustSpeeds[i] * dt;
    positions.array[i * 3] += Math.sin(time * 0.35 + i) * dt * 0.035;
    if (positions.array[yIndex] > 9) positions.array[yIndex] = 0.35;
  }
  positions.needsUpdate = true;

  if (!confettiActive) return;
  for (let i = 0; i < confettiCount; i++) {
    const p = confettiData[i];
    p.y -= p.vy * dt;
    p.x += p.vx * dt + Math.sin(time * 2 + i) * dt * 0.16;
    p.rx += p.spin * dt;
    p.ry += p.spin * 0.7 * dt;
    p.rz += p.spin * 0.45 * dt;
    if (p.y < -1.3) {
      p.y = 7 + Math.random() * 4;
      p.x = (Math.random() - 0.5) * 10;
    }
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.rx, p.ry, p.rz);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    confettiMesh.setMatrixAt(i, dummy.matrix);
  }
  confettiMesh.instanceMatrix.needsUpdate = true;
}

/* -------------------- STORY / CAMERA -------------------- */
const stories = [
  {
    eyebrow: "THE WELCOME",
    title: "Selamat datang,<br><em>mbak Dedo.</em>",
    description: "Ada satu momen kecil yang dipersiapkan khusus untukmu.",
    action: "Masuk ke kejutan",
    hint: "A WARM WELCOME TO YOUR DAY"
  },
  {
    eyebrow: "A QUIET SURPRISE",
    title: "Ada sesuatu<br><em>menunggumu.</em>",
    description: "Di tengah hari yang biasa, semoga ada kejutan kecil yang membuatmu tersenyum.",
    action: "Dekati hadiahnya",
    hint: "A LITTLE MOMENT, JUST FOR YOU"
  },
  {
    eyebrow: "THE REVEAL",
    title: "Satu hadiah<br><em>untukmu.</em>",
    description: "Buka perlahan. Ada doa dan harapan baik di dalamnya.",
    action: "Buka hadiahnya",
    hint: "LET THE SURPRISE BEGIN"
  },
  {
    eyebrow: "THE CELEBRATION",
    title: "Happy Birthday,<br><em>mbak Dedo!</em>",
    description: "Semoga sehat selalu, bahagia dalam setiap langkah, lancar rezekinya, di mudahkan segala urusan ya",
    action: "Ada doa untukmu",
    hint: "A DAY FULL OF GOOD THINGS"
  },
  {
    eyebrow: "A LITTLE PRAYER",
    title: "Semoga hal baik<br><em>selalu dekat.</em>",
    description: "Semoga setiap urusan dimudahkan, setiap impian diberi jalan, dan hatimu selalu punya alasan untuk tenang.",
    action: "Lihat penutup",
    hint: "WISHING YOU THE VERY BEST"
  },
  {
    eyebrow: "THE LAST FRAME",
    title: "Terus bersinar,<br><em>mbak Dedo.</em>",
    description: "Semoga tahun yang baru membawa cerita indah, kesempatan baik, dan kebahagiaan yang berlipat.",
    action: "Putar kembali",
    hint: "UNTIL THE NEXT BEAUTIFUL CHAPTER"
  }
];

const cameraShots = [
  { position: [0.0, 4.2, 14.5], look: [0.8, 2.45, -3.4], fov: 43 },
  { position: [7.2, 4.3, 10.7], look: [-0.15, 2.1, -0.4], fov: 45 },
  { position: [3.4, 3.25, 7.2], look: [0.75, 2.25, -0.35], fov: 39 },
  { position: [4.8, 3.65, 10.6], look: [0.6, 2.0, 0.25], fov: 43 },
  { position: [3.0, 3.35, 7.9], look: [0.1, 2.65, 1.0], fov: 39 },
  { position: [0.0, 8.0, 16.5], look: [0.0, 12.4, -24], fov: 48 }
];

function updateStory(index) {
  const story = stories[index];
  if (!story) return;
  ui.eyebrow.textContent = story.eyebrow;
  ui.title.innerHTML = story.title;
  ui.description.textContent = story.description;
  ui.hint.textContent = story.hint;
  ui.counter.textContent = String(index + 1).padStart(2, "0");
  ui.progress.style.width = `${((index + 1) / stories.length) * 100}%`;
  ui.prev.disabled = index === 0;
  ui.next.disabled = index === stories.length - 1;
  ui.story.classList.remove("show");
  ui.actionWrap.classList.remove("show");
  requestAnimationFrame(() => {
    ui.story.classList.add("show");
    ui.actionWrap.classList.add("show");
  });
  ui.actionLabel.textContent = story.action;
}

function aimCamera(index) {
  const shot = cameraShots[index];
  cameraPositionTarget.set(...shot.position);
  cameraLookTarget.set(...shot.look);
  cameraFovTarget = shot.fov;
}

function setCharacterForScene(index) {
  if (!characterLoaded) return;
  characterGroup.visible = [0, 1, 3, 4].includes(index);
  characterGroup.rotation.set(0, 0, 0);

  if (index === 0) {
    characterGroup.position.set(2.5, 0, 0.65);
    characterAnimator?.setState("wave");
  } else if (index === 1) {
    characterGroup.position.set(walkStartX, 0, 1.55);
    characterAnimator?.setState("walk");
  } else if (index === 3) {
    characterGroup.position.set(2.45, 0, 0.9);
    characterAnimator?.setState("celebrate");
  } else if (index === 4) {
    characterGroup.position.set(0.8, 0, 1.05);
    characterAnimator?.setState("prayer");
  }
}

function resetGift() {
  giftOpened = false;
  giftProgress = 0;
  cakeProgress = 0;
  giftButtonUnlocked = false;
  if (giftLidPivot) giftLidPivot.rotation.set(0, 0, 0);
  if (giftRibbon) giftRibbon.position.set(0, 0, 0);
  if (cakeGroup) {
    cakeGroup.visible = false;
    cakeGroup.scale.setScalar(0.001);
    cakeGroup.position.y = 0.86;
  }
  cakeFlames.forEach((flame) => { flame.visible = true; });
  revealLight.intensity = 0;
  stopConfetti();
}

function applyScene(index) {
  currentScene = THREE.MathUtils.clamp(index, 0, stories.length - 1);
  sceneElapsed = 0;
  exterior.visible = currentScene === 0;
  office.visible = currentScene >= 1 && currentScene <= 4;
  skyWorld.visible = currentScene === 5;
  dust.visible = currentScene >= 1 && currentScene <= 4;

  if (currentScene === 0) {
    keyLight.color.setHex(0xffdfad);
    keyLight.intensity = 3.0;
    setCharacterForScene(0);
    exterior.userData.doors.leftDoor.rotation.y = 0;
    exterior.userData.doors.rightDoor.rotation.y = 0;
  } else if (currentScene === 1) {
    keyLight.color.setHex(0xffd5a0);
    keyLight.intensity = 2.4;
    setCharacterForScene(1);
    exterior.userData.doors.leftDoor.rotation.y = 1.08;
    exterior.userData.doors.rightDoor.rotation.y = -1.08;
    if (giftGroup) giftGroup.visible = true;
    if (cakeGroup) cakeGroup.visible = false;
  } else if (currentScene === 2) {
    keyLight.color.setHex(0xffd9aa);
    keyLight.intensity = 2.0;
    characterGroup.visible = false;
    giftGroup.visible = true;
    cakeGroup.visible = giftOpened;
    if (!giftOpened) resetGift();
  } else if (currentScene === 3) {
    keyLight.color.setHex(0xffd5a0);
    keyLight.intensity = 2.5;
    characterGroup.visible = characterLoaded;
    setCharacterForScene(3);
    giftGroup.visible = false;
    cakeGroup.visible = true;
    cakeGroup.scale.setScalar(1);
    cakeGroup.position.y = 1.38;
    confettiMesh.visible = confettiActive;
  } else if (currentScene === 4) {
    keyLight.color.setHex(0xffe0b4);
    keyLight.intensity = 2.0;
    characterGroup.visible = characterLoaded;
    setCharacterForScene(4);
    giftGroup.visible = false;
    cakeGroup.visible = false;
    stopConfetti();
  } else {
    characterGroup.visible = false;
    exterior.visible = false;
    office.visible = false;
    skyWorld.visible = true;
    dust.visible = false;
    stopConfetti();
    scene.background = new THREE.Color(0x4b6078);
    scene.fog = null;
    keyLight.color.setHex(0xffd6ad);
    keyLight.intensity = 1.0;
  }

  if (currentScene !== 5) {
    scene.background = new THREE.Color(0x0b1725);
    scene.fog = new THREE.FogExp2(0x0b1725, 0.009);
  }

  aimCamera(currentScene);
  updateStory(currentScene);
  playAudio(audio.whoosh, 0.28);
  if (ui.flash) {
    ui.flash.classList.remove("active");
    void ui.flash.offsetWidth;
    ui.flash.classList.add("active");
  }
}

function transitionToScene(index, immediate = false) {
  const target = THREE.MathUtils.clamp(index, 0, stories.length - 1);
  if (target === currentScene && !immediate) return;
  if (immediate) {
    applyScene(target);
    return;
  }
  const sequence = ++transitionSequence;
  ui.curtain.classList.add("cover");
  playAudio(audio.whoosh, 0.3);
  window.setTimeout(() => {
    if (sequence !== transitionSequence) return;
    applyScene(target);
    window.setTimeout(() => {
      if (sequence === transitionSequence) ui.curtain.classList.remove("cover");
    }, 120);
  }, 420);
}

/* -------------------- GIFT REVEAL -------------------- */
function openGift() {
  if (giftOpened) return;
  giftOpened = true;
  giftProgress = 0;
  cakeProgress = 0;
  cakeGroup.visible = true;
  cakeGroup.scale.setScalar(0.001);
  cakeGroup.position.y = 0.86;
  playAudio(audio.click, 0.8);
  playAudio(audio.surprise, 0.85);
  setMusicDuck(true);
  playAudio(audio.birthday, 0.72);
  playAudio(audio.crowd, 0.55);
  revealLight.intensity = 0;
  giftButtonUnlocked = false;
  ui.actionLabel.textContent = "Satu momen lagi...";
  ui.action.disabled = true;
  ui.action.classList.add("is-loading");
}

function updateGiftReveal(dt, time) {
  if (!giftOpened) return;
  giftProgress = Math.min(1, giftProgress + dt * 0.58);
  const lidEase = 1 - Math.pow(1 - giftProgress, 3);
  if (giftLidPivot) {
    giftLidPivot.rotation.x = lidEase * 1.45;
    giftLidPivot.rotation.z = -lidEase * 0.06;
  }
  if (giftRibbon) giftRibbon.position.y = Math.sin(time * 5.5) * 0.012 + lidEase * 0.07;

  if (giftProgress > 0.25) {
    cakeProgress = Math.min(1, cakeProgress + dt * 0.78);
    const rise = THREE.MathUtils.smoothstep(cakeProgress, 0, 1);
    const overshoot = 1 + Math.sin(Math.min(cakeProgress, 0.85) * Math.PI) * 0.055;
    cakeGroup.scale.setScalar(Math.max(0.001, rise * overshoot));
    cakeGroup.position.y = 0.86 + rise * 0.52;
    revealLight.intensity = rise * 28;
  }
  if (giftProgress >= 1 && !giftButtonUnlocked) {
    giftButtonUnlocked = true;
    ui.action.disabled = false;
    ui.action.classList.remove("is-loading");
    ui.actionLabel.textContent = "Lihat perayaannya";
  }
}

function updateCharacter(dt) {
  if (!characterAnimator || !characterGroup.visible) return;
  if (currentScene === 1) {
    const progress = THREE.MathUtils.clamp(sceneElapsed / walkDuration, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    characterGroup.position.x = THREE.MathUtils.lerp(walkStartX, walkEndX, eased);
    if (progress >= 1 && characterAnimator.getState() !== "idle") characterAnimator.setState("idle");
  }
  if (currentScene === 3 && sceneElapsed > 2.8 && characterAnimator.getState() !== "talk") {
    characterAnimator.setState("talk");
  }
  characterAnimator.update(dt);
  if (characterShadow) {
    const breathe = 1 + Math.sin(sceneElapsed * 2.1) * 0.025;
    characterShadow.scale.set(breathe, breathe, breathe);
  }
}

function updateCamera(dt, time) {
  const smooth = 1 - Math.exp(-dt * 2.45);
  const drift = currentScene === 0 ? 0.12 : currentScene === 5 ? 0.045 : 0.065;
  const desiredPosition = cameraPositionTarget.clone();
  desiredPosition.x += Math.sin(time * 0.22 + currentScene) * drift;
  desiredPosition.y += Math.sin(time * 0.31) * drift * 0.4;
  camera.position.lerp(desiredPosition, smooth);
  cameraLook.lerp(cameraLookTarget, smooth * 1.08);
  camera.lookAt(cameraLook);
  camera.fov = THREE.MathUtils.lerp(camera.fov, cameraFovTarget, smooth * 0.75);
  camera.updateProjectionMatrix();
}

function updateDoors(dt) {
  if (!exterior.userData.doors) return;
  const open = currentScene === 1 ? 1 : 0;
  const amount = 1 - Math.exp(-dt * 2.8);
  const { leftDoor, rightDoor } = exterior.userData.doors;
  leftDoor.rotation.y = THREE.MathUtils.lerp(leftDoor.rotation.y, open * 1.08, amount);
  rightDoor.rotation.y = THREE.MathUtils.lerp(rightDoor.rotation.y, -open * 1.08, amount);
}

function updateSky(dt) {
  if (currentScene !== 5) return;
  clouds.forEach((cloud, i) => {
    cloud.position.x += dt * (0.10 + i * 0.016);
    if (cloud.position.x > 23) cloud.position.x = -23;
    cloud.position.y += Math.sin(sceneElapsed * 0.25 + i) * dt * 0.035;
  });
}

/* -------------------- INTERACTION -------------------- */
function startExperience() {
  if (started) return;
  started = true;
  playAudio(audio.click, 0.72);
  startMusic();
  ui.intro.classList.add("hidden");
  ui.experience.classList.add("active");
  applyScene(0);
}

function advanceScene() {
  playAudio(audio.click, 0.7);
  if (currentScene === 2 && !giftOpened) {
    openGift();
    return;
  }
  if (currentScene === 2 && giftOpened && !giftButtonUnlocked) return;
  if (currentScene === 5) {
    replayExperience();
    return;
  }
  transitionToScene(currentScene + 1);
}

function replayExperience() {
  stopCelebrationAudio();
  if (audio.music && soundEnabled) {
    audio.music.volume = 0.26;
    audio.music.currentTime = 0;
    playAudio(audio.music, 0.26, false);
  }
  giftOpened = false;
  resetGift();
  transitionToScene(0);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  ui.sound.classList.toggle("muted", !soundEnabled);
  ui.sound.setAttribute("aria-label", soundEnabled ? "Matikan suara" : "Nyalakan suara");
  ui.soundLabel.textContent = soundEnabled ? "SOUND ON" : "SOUND OFF";
  Object.values(audio).forEach((element) => {
    if (!element) return;
    element.muted = !soundEnabled;
    if (!soundEnabled) element.pause();
  });
  if (soundEnabled && started) startMusic();
}

ui.start.addEventListener("click", startExperience);
ui.action.addEventListener("click", advanceScene);
ui.next.addEventListener("click", () => {
  if (started && currentScene !== 5) advanceScene();
});
ui.prev.addEventListener("click", () => {
  if (started && currentScene > 0) {
    playAudio(audio.click, 0.65);
    transitionToScene(currentScene - 1);
  }
});
ui.sound.addEventListener("click", toggleSound);
window.addEventListener("keydown", (event) => {
  if (!started && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    startExperience();
  } else if (started && event.key === "ArrowRight") {
    advanceScene();
  } else if (started && event.key === "ArrowLeft" && currentScene > 0) {
    transitionToScene(currentScene - 1);
  }
});

/* -------------------- MAIN LOOP -------------------- */
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  sceneElapsed += dt;

  updateCamera(dt, time);
  updateCharacter(dt);
  updateDoors(dt);
  updateGiftReveal(dt, time);
  updateParticles(dt, time);
  updateSky(dt);

  cakeFlames.forEach((flame, i) => {
    if (!flame.visible) return;
    const flicker = 0.9 + Math.sin(time * 12 + i * 1.7) * 0.13;
    flame.scale.set(0.8 * flicker, 1.35 * flicker, 0.8 * flicker);
  });
  if (currentScene === 2 && giftOpened) {
    revealLight.intensity = Math.max(0, 24 * cakeProgress) + Math.sin(time * 3.2) * 1.5;
  }
  renderer.render(scene, camera);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.fov = width < 600 ? 49 : width < 900 ? 46 : 43;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setSize(width, height);
}
window.addEventListener("resize", onResize, { passive: true });

/* -------------------- BOOT -------------------- */
async function boot() {
  buildExterior();
  buildOffice();
  buildSky();
  skyWorld.visible = false;
  office.visible = false;
  dust.visible = false;
  exterior.visible = true;
  setLoading(8, "Membangun dunia kecil...");
  animate();

  try {
    await loadCharacter();
    setLoading(96, "Menyelesaikan sentuhan terakhir...");
  } catch (error) {
    console.error("Karakter GLB gagal dimuat. Periksa assets/character.glb", error);
    setLoading(100, "Dunia siap, tetapi karakter belum terbaca.");
  }

  setLoading(100, "Semuanya siap untuk Kak Dedo.");
  window.setTimeout(() => ui.loading.classList.add("hidden"), 650);
  updateStory(0);
  aimCamera(0);
  if (!characterLoaded) {
    console.warn("Scene tetap dapat dibuka, tetapi model 3D tidak akan tampil sampai GLB ditemukan.");
  }
}

boot();

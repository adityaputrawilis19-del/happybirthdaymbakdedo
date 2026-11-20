import * as THREE from "three";

/**
 * Kak Dedo — procedural character animator
 * Works with the articulated pivot hierarchy in assets/character.glb.
 * Animation is layered over the model's authored bind transforms and
 * blended with quaternion interpolation to avoid hard pose snapping.
 */
export function createCharacterAnimator(root) {
  if (!root) throw new Error("createCharacterAnimator: model root is required.");

  const find = (name) => root.getObjectByName(name) || null;
  const nodes = {
    root: find("CharacterRoot"),
    pelvis: find("Pelvis"),
    spine: find("Spine"),
    head: find("Head"),
    waveShoulder: find("WaveShoulder"),
    waveElbow: find("WaveElbow"),
    waveWrist: find("WaveWrist"),
    restShoulder: find("RestShoulder"),
    restElbow: find("RestElbow"),
    restWrist: find("RestWrist"),
    leftHip: find("LeftHip"),
    rightHip: find("RightHip"),
    leftKnee: find("LeftKnee"),
    rightKnee: find("RightKnee"),
    leftHair: find("LeftHairWave3"),
    rightHair: find("RightHairWave3"),
    scarfBlue: find("ScarfBlueTail"),
    scarfYellow: find("ScarfYellowTail"),
    idCard: find("IDCard")
  };

  const missing = ["Pelvis", "Spine", "Head", "WaveShoulder", "WaveElbow", "WaveWrist", "RestShoulder", "RestElbow", "LeftHip", "RightHip", "LeftKnee", "RightKnee"]
    .filter((name) => !find(name));
  if (missing.length) {
    console.warn("[Kak Dedo Animator] Some optional rig nodes are missing:", missing.join(", "));
  }

  const base = new Map();
  const current = new Map();
  const targetQuaternion = new THREE.Quaternion();
  const offsetEuler = new THREE.Euler();
  const offsetQuaternion = new THREE.Quaternion();
  const zero = { x: 0, y: 0, z: 0 };

  for (const [key, object] of Object.entries(nodes)) {
    if (!object) continue;
    base.set(key, {
      position: object.position.clone(),
      quaternion: object.quaternion.clone()
    });
    current.set(key, object.quaternion.clone());
  }

  const stateNames = new Set(["idle", "wave", "walk", "talk", "prayer", "celebrate"]);
  let state = "idle";
  let stateTime = 0;
  let elapsed = 0;
  let disposed = false;

  function setState(nextState) {
    if (!stateNames.has(nextState)) {
      console.warn(`[Kak Dedo Animator] Unknown state "${nextState}". Falling back to idle.`);
      nextState = "idle";
    }
    if (nextState !== state) {
      state = nextState;
      stateTime = 0;
    }
    return api;
  }

  function rotationFor(key, x = 0, y = 0, z = 0) {
    const object = nodes[key];
    const rest = base.get(key);
    if (!object || !rest) return;
    offsetEuler.set(x, y, z, "XYZ");
    offsetQuaternion.setFromEuler(offsetEuler);
    targetQuaternion.copy(rest.quaternion).multiply(offsetQuaternion);
    return targetQuaternion;
  }

  function update(deltaTime) {
    if (disposed) return;
    const dt = THREE.MathUtils.clamp(Number(deltaTime) || 0, 0, 0.05);
    elapsed += dt;
    stateTime += dt;

    const t = elapsed;
    const step = stateTime;
    const walkPhase = t * 7.0;
    const stride = Math.sin(walkPhase);
    const smallBreath = Math.sin(t * 2.05);
    const pose = Object.create(null);
    const put = (key, x = 0, y = 0, z = 0) => { pose[key] = { x, y, z }; };

    // Shared micro-motion: breathing, subtle head tracking, hair and accessories.
    put("spine", 0.012 + smallBreath * 0.012, Math.sin(t * 0.55) * 0.012, Math.sin(t * 0.8) * 0.008);
    put("head", Math.sin(t * 0.7) * 0.018, Math.sin(t * 0.48) * 0.045, Math.sin(t * 0.95) * 0.012);
    put("leftHair", 0, 0, Math.sin(t * 1.45) * 0.018);
    put("rightHair", 0, 0, -Math.sin(t * 1.35 + 0.35) * 0.018);
    put("scarfBlue", Math.sin(t * 1.8) * 0.018, 0, Math.sin(t * 1.2) * 0.025);
    put("scarfYellow", Math.sin(t * 1.7 + 0.5) * 0.022, 0, Math.sin(t * 1.1 + 0.7) * 0.03);
    put("idCard", Math.sin(t * 1.8) * 0.012, 0, Math.sin(t * 1.4) * 0.016);

    // Default: relaxed arms down. The raised arm in the authored GLB is lowered
    // by an additive shoulder offset; the wave state restores its authored pose.
    put("waveShoulder", 0, 0, 1.82);
    put("waveElbow", 0, 0, 0.04);
    put("waveWrist", 0, 0, 0.02);
    put("restShoulder", 0, 0, 0.02);
    put("restElbow", 0, 0, 0.015);
    put("restWrist", 0, 0, 0);
    put("leftHip", 0, 0, 0);
    put("rightHip", 0, 0, 0);
    put("leftKnee", 0, 0, 0);
    put("rightKnee", 0, 0, 0);

    if (state === "wave") {
      const greetingLift = THREE.MathUtils.smoothstep(step, 0.08, 0.7);
      put("waveShoulder", 0.025, 0.025, 0.04 + Math.sin(t * 1.55) * 0.025);
      put("waveElbow", 0.02, 0, 0.08 + Math.sin(t * 5.0) * 0.055);
      put("waveWrist", 0.03, Math.sin(t * 4.3) * 0.08, 0.24 + Math.sin(t * 7.1) * 0.27 * greetingLift);
      put("restShoulder", Math.sin(t * 1.2) * 0.025, 0, 0.02);
      put("head", Math.sin(t * 0.85) * 0.02, Math.sin(t * 0.65) * 0.075, 0.025 + Math.sin(t * 1.1) * 0.012);
    }

    if (state === "walk") {
      put("waveShoulder", stride * 0.15, 0, 1.72 + stride * 0.055);
      put("restShoulder", -stride * 0.22, 0, 0.02);
      put("restElbow", 0, 0, 0.04 + Math.max(0, stride) * 0.10);
      put("leftHip", stride * 0.28, 0, 0);
      put("rightHip", -stride * 0.28, 0, 0);
      put("leftKnee", Math.max(0, -stride) * 0.34, 0, 0);
      put("rightKnee", Math.max(0, stride) * 0.34, 0, 0);
      put("spine", 0.025 + Math.abs(stride) * 0.014, 0, Math.sin(walkPhase * 0.5) * 0.018);
      put("head", Math.sin(t * 1.4) * 0.018, Math.sin(t * 0.8) * 0.035, 0);
    }

    if (state === "talk") {
      const gesture = Math.sin(t * 2.35);
      put("waveShoulder", 0.08, 0.02, 0.78 + gesture * 0.14);
      put("waveElbow", 0.02, 0, 0.28 + Math.max(0, gesture) * 0.13);
      put("waveWrist", 0, 0, 0.10 + Math.sin(t * 3.2) * 0.10);
      put("restShoulder", 0.03, 0, -0.08 + Math.sin(t * 1.6 + 1) * 0.06);
      put("restElbow", 0, 0, 0.04);
      put("head", 0.015 + Math.sin(t * 2.0) * 0.025, Math.sin(t * 1.1) * 0.075, Math.sin(t * 1.5) * 0.016);
    }

    if (state === "prayer") {
      const settle = THREE.MathUtils.smoothstep(step, 0.05, 1.0);
      put("waveShoulder", 0.02, 0.02, 1.30 * settle);
      put("waveElbow", 0, 0, 0.72 * settle);
      put("waveWrist", 0, 0, -0.06 * settle);
      put("restShoulder", 0.015, 0, -0.46 * settle);
      put("restElbow", 0, 0, -0.72 * settle);
      put("restWrist", 0, 0, 0.08 * settle);
      put("head", 0.11 * settle + Math.sin(t * 0.55) * 0.008, 0, 0);
      put("spine", 0.018, 0, 0);
    }

    if (state === "celebrate") {
      const bounce = Math.abs(Math.sin(t * 3.8));
      put("waveShoulder", 0.02, 0, 0.02 + Math.sin(t * 3.8) * 0.035);
      put("waveElbow", 0, 0, 0.08 + Math.sin(t * 5.2) * 0.08);
      put("waveWrist", 0, 0, Math.sin(t * 6.1) * 0.16);
      put("restShoulder", 0.04, 0, -1.05 + Math.sin(t * 3.8 + 0.7) * 0.045);
      put("restElbow", 0, 0, -0.18 + Math.sin(t * 5.0 + 1) * 0.06);
      put("head", Math.sin(t * 3.8) * 0.025, Math.sin(t * 1.7) * 0.055, Math.sin(t * 3.8) * 0.025);
      put("pelvis", 0, bounce * 0.035, 0);
    }

    const blend = 1 - Math.exp(-dt * (state === "walk" ? 10.5 : 7.5));
    for (const [key, object] of Object.entries(nodes)) {
      if (!object) continue;
      const baseTransform = base.get(key);
      if (!baseTransform) continue;
      const offset = pose[key] || zero;
      const desired = rotationFor(key, offset.x, offset.y, offset.z);
      if (desired) {
        object.quaternion.slerp(desired, blend);
        current.get(key)?.copy(object.quaternion);
      }
      if (key === "pelvis") {
        const lift = offset.y || 0;
        const basePosition = baseTransform.position;
        object.position.set(basePosition.x, basePosition.y + lift + (state !== "celebrate" && state !== "walk" ? Math.sin(t * 2.05) * 0.006 : 0), basePosition.z);
      } else {
        object.position.copy(baseTransform.position);
      }
    }
  }

  function reset() {
    for (const [key, object] of Object.entries(nodes)) {
      const baseTransform = base.get(key);
      if (!object || !baseTransform) continue;
      object.position.copy(baseTransform.position);
      object.quaternion.copy(baseTransform.quaternion);
    }
    state = "idle";
    stateTime = 0;
  }

  const api = {
    setState,
    update,
    getState: () => state,
    getNode: (name) => find(name),
    reset,
    dispose: () => { disposed = true; }
  };

  return api;
}

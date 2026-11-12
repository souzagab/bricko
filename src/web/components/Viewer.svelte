<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
  import type { MeshLike } from '../../export/stl.ts';
  import type { ViewMode } from '../lib/state.svelte.ts';

  interface Props {
    meshes: { base: MeshLike; arm: MeshLike } | null;
    /** hinge axis in the bed frame (x, y); the axis runs along bed Z */
    axis: [number, number] | null;
    width: number;
    mode: ViewMode;
    angle: number; // degrees, 0 = closed
    section: number; // 0..1 of the width kept, 1 = no cut
    dark: boolean;
    resetToken: number;
    /** cables to draw lying in the channels (bed frame), desk view only */
    cables?: { x: number; y: number; r: number }[];
    /** px of the canvas covered by other UI at the top and bottom: the clip is framed in what is left */
    inset?: { top: number; bottom: number };
    /** small screens: fill the view with the clip as it is posed now, instead of leaving room for its whole range of motion */
    tight?: boolean;
    /** what a screen reader says the canvas is */
    label: string;
  }
  let { meshes, axis, width, mode, angle, section, dark, resetToken, cables = [], inset = { top: 0, bottom: 0 }, tight = false, label }: Props = $props();

  let host: HTMLDivElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let sun: THREE.DirectionalLight;
  let ground: THREE.Mesh;
  let grid: THREE.GridHelper | null = null;
  const root = new THREE.Group(); // bed frame lives here
  const armPivot = new THREE.Group(); // rotates about the hinge axis
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const matBase = new THREE.MeshStandardMaterial({ color: 0xf2b233, roughness: 0.5, metalness: 0.02, side: THREE.DoubleSide });
  const matArm = new THREE.MeshStandardMaterial({ color: 0x3d7be6, roughness: 0.5, metalness: 0.02, side: THREE.DoubleSide });
  const cableGroup = new THREE.Group();
  const matCable = new THREE.MeshStandardMaterial({ color: 0x34373e, roughness: 0.55, metalness: 0.05 });
  let baseMesh: THREE.Mesh | null = null;
  let armMesh: THREE.Mesh | null = null;
  let fitted = false;
  let userMoved = false; // stop auto-framing once the user has moved the camera
  let interacting = false; // a finger or mouse button is down on the canvas
  let framing = false; // the camera is being moved by us, not by the user
  let fittedSize = 0;
  let motionBox: THREE.Box3 | null = null; // the clip closed and opened, as placed on the ground
  let needsRender = true;
  let raf = 0;
  const requestRender = () => { needsRender = true; };

  // Plain copies of the framing props, so the helpers below can run inside any effect without subscribing it to them
  let padTop = 0, padBottom = 0, tightFit = false;
  const VIEW_DIR = new THREE.Vector3(0.55, 0.62, 0.9).normalize(); // from the clip towards the camera
  const VIEW_RIGHT = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, VIEW_DIR).normalize();
  const VIEW_UP = new THREE.Vector3().crossVectors(VIEW_DIR, VIEW_RIGHT);
  const MIN_VISIBLE = 80; // px. With less than this showing, the preview is covered: keep the framing it had
  const corner = new THREE.Vector3();

  function toGeometry(m: MeshLike): THREE.BufferGeometry {
    const n = m.numProp;
    let pos = m.vertProperties;
    if (n !== 3) {
      pos = new Float32Array((m.vertProperties.length / n) * 3);
      for (let i = 0, j = 0; i < m.vertProperties.length; i += n, j += 3) {
        pos[j] = m.vertProperties[i]!; pos[j + 1] = m.vertProperties[i + 1]!; pos[j + 2] = m.vertProperties[i + 2]!;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(m.triVerts, 1));
    return toCreasedNormals(g, THREE.MathUtils.degToRad(35));
  }

  function replaceMeshes() {
    for (const m of [baseMesh, armMesh]) {
      if (!m) continue;
      m.parent?.remove(m);
      m.geometry.dispose();
    }
    baseMesh = armMesh = null;
    if (!meshes || !axis) return;
    baseMesh = new THREE.Mesh(toGeometry(meshes.base), matBase);
    armMesh = new THREE.Mesh(toGeometry(meshes.arm), matArm);
    for (const m of [baseMesh, armMesh]) { m.castShadow = true; m.receiveShadow = true; }
    root.add(baseMesh);
    armPivot.position.set(axis[0], axis[1], 0);
    armMesh.position.set(-axis[0], -axis[1], 0);
    armPivot.add(armMesh);
    if (!armPivot.parent) root.add(armPivot);
    if (!cableGroup.parent) root.add(cableGroup);
  }

  function replaceCables() {
    for (const m of [...cableGroup.children] as THREE.Mesh[]) { cableGroup.remove(m); m.geometry.dispose(); }
    const len = width + 26;
    for (const c of cables) {
      const g = new THREE.CylinderGeometry(c.r, c.r, len, 28, 1, false);
      g.rotateX(Math.PI / 2); // along bed Z (the clip's width)
      const m = new THREE.Mesh(g, matCable);
      m.position.set(c.x, c.y, width / 2);
      m.castShadow = true;
      cableGroup.add(m);
    }
    cableGroup.visible = mode === 'use';
  }

  /** Orient the bed frame for the view mode and put the closed clip on the ground, centred. */
  function placeRoot() {
    root.rotation.set(mode === 'print' ? -Math.PI / 2 : 0, 0, 0);
    root.position.set(0, 0, 0);
    const keep = armPivot.rotation.z;
    const showCables = cableGroup.visible;
    armPivot.rotation.z = 0;
    cableGroup.visible = false; // place and frame by the clip alone
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root, true);
    armPivot.rotation.z = keep;
    cableGroup.visible = showCables;
    if (box.isEmpty()) return null;
    const c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -box.min.y, -c.z);
    // Frame the whole range of motion (closed and opened), so opening the lid stays in view
    cableGroup.visible = false;
    armPivot.rotation.z = 0;
    root.updateMatrixWorld(true);
    const placed = new THREE.Box3().setFromObject(root, true);
    armPivot.rotation.z = THREE.MathUtils.degToRad(120);
    root.updateMatrixWorld(true);
    placed.union(new THREE.Box3().setFromObject(root, true));
    armPivot.rotation.z = keep;
    cableGroup.visible = showCables;
    root.updateMatrixWorld(true);
    return placed;
  }

  function updateGround(box: THREE.Box3) {
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z) * 3 + 40;
    if (grid) { scene.remove(grid); grid.geometry.dispose(); (grid.material as THREE.Material).dispose(); }
    const cells = Math.round(span / 8);
    grid = new THREE.GridHelper(cells * 8, cells, dark ? 0x3a3f4a : 0xcfcac0, dark ? 0x2a2e36 : 0xe3dfd6);
    grid.position.y = 0.001;
    scene.add(grid);
    ground.scale.set(span, span, 1);
    const r = Math.max(size.x, size.y, size.z);
    const cam = sun.shadow.camera;
    cam.left = cam.bottom = -r; cam.right = cam.top = r; cam.near = 1; cam.far = r * 6;
    cam.updateProjectionMatrix();
    sun.position.set(r * 1.2, r * 2.4, r * 1.6);
  }

  /** Height of the canvas that no other UI is covering. */
  const visibleHeight = () => host.clientHeight - padTop - padBottom;

  /** Shift the picture so that whatever the camera looks at sits in the middle of the uncovered area. */
  function applyInsets() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || visibleHeight() < MIN_VISIBLE) return;
    const down = (padTop - padBottom) / 2;
    if (down) camera.setViewOffset(w, h, 0, -down, w, h);
    else camera.clearViewOffset();
  }

  /**
   * What is on screen right now, as points: the corners of each part's own box, where the part is posed
   * (the lid at its current angle, the cables when they are drawn). Following the parts like this hugs
   * an open clip far better than one big box around everything, and is cheap enough for every frame.
   */
  function posePoints(): THREE.Vector3[] {
    root.updateMatrixWorld(true);
    const parts = [baseMesh, armMesh, ...(cableGroup.visible ? (cableGroup.children as THREE.Mesh[]) : [])];
    const pts: THREE.Vector3[] = [];
    for (const m of parts) {
      if (!m) continue;
      const b = m.geometry.boundingBox ?? (m.geometry.computeBoundingBox(), m.geometry.boundingBox!);
      for (let i = 0; i < 8; i++) {
        pts.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m.matrixWorld));
      }
    }
    return pts;
  }

  /** Point the camera at the clip from the standard angle, at the distance that fits it in the uncovered area. */
  function frame() {
    const w = host.clientWidth, h = host.clientHeight, vis = visibleHeight();
    if (!motionBox || !w || vis < MIN_VISIBLE) return;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const c = new THREE.Vector3();
    let dist = 0;
    if (tightFit) {
      // Every point of the posed clip inside the uncovered rectangle, and centred in it: fills a phone screen either way up
      const pts = posePoints();
      if (!pts.length) return;
      new THREE.Box3().setFromPoints(pts).getCenter(c);
      const focal = h / (2 * tanV); // px
      for (let pass = 0; pass < 3; pass++) {
        // the nearest the camera can be with every point still in the rectangle...
        dist = 0;
        for (const p of pts) {
          corner.copy(p).sub(c);
          const near = corner.dot(VIEW_DIR);
          dist = Math.max(dist, near + (focal * Math.abs(corner.dot(VIEW_RIGHT))) / (w / 2), near + (focal * Math.abs(corner.dot(VIEW_UP))) / (vis / 2));
        }
        // ...then slide the target to the middle of what that draws, and go again
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const p of pts) {
          corner.copy(p).sub(c);
          const k = 1 / (dist - corner.dot(VIEW_DIR));
          const x = corner.dot(VIEW_RIGHT) * k, y = corner.dot(VIEW_UP) * k;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        c.addScaledVector(VIEW_RIGHT, ((x0 + x1) / 2) * dist).addScaledVector(VIEW_UP, ((y0 + y1) / 2) * dist);
      }
      dist *= 1.1;
    } else {
      // The bounding sphere of the whole range of motion, in whichever of the two fields of view is narrower
      motionBox.getCenter(c);
      const r = motionBox.getSize(new THREE.Vector3()).length() / 2;
      dist = (r / Math.sin(Math.min(Math.atan(tanV * (vis / h)), Math.atan(tanV * (w / h))))) * 1.02;
    }
    fittedSize = motionBox.getSize(new THREE.Vector3()).length() / 2;
    framing = true;
    camera.position.copy(c).addScaledVector(VIEW_DIR, dist);
    camera.near = dist / 100; camera.far = dist * 20;
    camera.updateProjectionMatrix();
    controls.target.copy(c);
    controls.minDistance = dist * 0.3; // a pinch can't end up inside the clip or lose it in the distance
    controls.maxDistance = dist * 4;
    controls.update();
    framing = false;
  }

  function resetView() {
    userMoved = false;
    frame();
    requestRender();
  }

  function updateClip() {
    const on = section < 0.999 && width > 0;
    if (on) {
      clip.set(new THREE.Vector3(0, 0, -1), width * section);
      clip.applyMatrix4(root.matrixWorld);
    }
    matBase.clippingPlanes = matArm.clippingPlanes = on ? [clip] : [];
    matBase.needsUpdate = matArm.needsUpdate = true;
  }

  function resize() {
    if (!renderer || !host) return;
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    applyInsets();
    if (fitted && !userMoved) frame(); // a turned phone or a resized window gets the clip framed again
    requestRender();
  }

  onMount(() => {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 5000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.6));
    sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-80, 40, -60);
    scene.add(fill);
    ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.18 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    scene.add(root);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    // Only a camera that actually moved under a finger counts: a stray tap on the canvas must not switch auto-framing off
    controls.addEventListener('start', () => { interacting = true; });
    controls.addEventListener('end', () => { interacting = false; });
    controls.addEventListener('change', () => {
      if (interacting && !framing) userMoved = true;
      requestRender();
    });

    // Double-tap (or double-click) puts the view back
    const el = renderer.domElement;
    let downT = 0, downX = 0, downY = 0, tapT = 0, tapX = 0, tapY = 0;
    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary) { downT = tapT = 0; return; } // a second finger: that's a pinch
      downT = e.timeStamp; downX = e.clientX; downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (!e.isPrimary || !downT) return;
      const tap = e.timeStamp - downT < 300 && Math.hypot(e.clientX - downX, e.clientY - downY) < 10;
      downT = 0;
      if (!tap) { tapT = 0; return; }
      if (e.timeStamp - tapT < 350 && Math.hypot(e.clientX - tapX, e.clientY - tapY) < 30) { tapT = 0; resetView(); }
      else { tapT = e.timeStamp; tapX = e.clientX; tapY = e.clientY; }
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (controls.update()) needsRender = true;
      if (!needsRender) return;
      needsRender = false;
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      controls.dispose();
      renderer.dispose();
    };
  });

  // Covered area or framing style changed (a settings sheet being dragged, a turned phone)
  $effect(() => {
    padTop = inset.top; padBottom = inset.bottom; tightFit = tight;
    if (!renderer) return;
    applyInsets();
    if (fitted && !userMoved) frame();
    requestRender();
  });

  // New geometry
  $effect(() => {
    void meshes; void axis;
    if (!renderer) return;
    replaceMeshes();
    motionBox = placeRoot();
    if (motionBox) {
      updateGround(motionBox);
      const r = motionBox.getSize(new THREE.Vector3()).length() / 2;
      const bigChange = fittedSize > 0 && (r > fittedSize * 1.25 || r < fittedSize * 0.6);
      if (!fitted || !userMoved || bigChange) { frame(); fitted = true; }
    }
    updateClip();
    requestRender();
  });

  // View mode or explicit reset: re-place and re-frame
  $effect(() => {
    void mode; void resetToken; void dark;
    if (!renderer) return;
    userMoved = false;
    motionBox = placeRoot();
    if (motionBox) { updateGround(motionBox); frame(); }
    updateClip();
    requestRender();
  });

  // Cables
  $effect(() => {
    void cables; void width; void mode;
    if (!renderer) return;
    replaceCables();
    if (tightFit && fitted && !userMoved) frame(); // they are part of the picture
    requestRender();
  });

  // Opening angle
  $effect(() => {
    armPivot.rotation.z = THREE.MathUtils.degToRad(angle);
    if (renderer && tightFit && fitted && !userMoved) frame(); // follow the lid
    requestRender();
  });

  // Section cut
  $effect(() => {
    void section; void width;
    if (!renderer) return;
    updateClip();
    requestRender();
  });
</script>

<div class="viewer" bind:this={host} aria-label={label} role="img"></div>

<style>
  .viewer { position: absolute; inset: 0; touch-action: none; }
  .viewer :global(canvas) { display: block; width: 100%; height: 100%; outline: none; }
</style>

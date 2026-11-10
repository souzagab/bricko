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
  }
  let { meshes, axis, width, mode, angle, section, dark, resetToken }: Props = $props();

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
  let baseMesh: THREE.Mesh | null = null;
  let armMesh: THREE.Mesh | null = null;
  let fitted = false;
  let userMoved = false; // stop auto-framing once the user has moved the camera
  let fittedSize = 0;
  let needsRender = true;
  let raf = 0;
  const requestRender = () => { needsRender = true; };

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
  }

  /** Orient the bed frame for the view mode and put the closed clip on the ground, centred. */
  function placeRoot() {
    root.rotation.set(mode === 'print' ? -Math.PI / 2 : 0, 0, 0);
    root.position.set(0, 0, 0);
    const keep = armPivot.rotation.z;
    armPivot.rotation.z = 0;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    armPivot.rotation.z = keep;
    if (box.isEmpty()) return null;
    const c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -box.min.y, -c.z);
    root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(root);
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

  function fitCamera(box: THREE.Box3) {
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    // fit the bounding sphere in whichever of the two fields of view is narrower (portrait phones)
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const dist = (r / Math.sin(Math.min(vHalf, hHalf))) * 1.02;
    fittedSize = r;
    const dir = new THREE.Vector3(0.55, 0.62, 0.9).normalize();
    camera.position.copy(c).addScaledVector(dir, dist);
    camera.near = dist / 100; camera.far = dist * 20;
    camera.updateProjectionMatrix();
    controls.target.copy(c);
    controls.update();
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
    controls.addEventListener('change', requestRender);
    controls.addEventListener('start', () => { userMoved = true; });

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
      controls.dispose();
      renderer.dispose();
    };
  });

  // New geometry
  $effect(() => {
    void meshes; void axis;
    if (!renderer) return;
    replaceMeshes();
    const box = placeRoot();
    if (box) {
      updateGround(box);
      const r = box.getSize(new THREE.Vector3()).length() / 2;
      const bigChange = fittedSize > 0 && (r > fittedSize * 1.25 || r < fittedSize * 0.6);
      if (!fitted || !userMoved || bigChange) { fitCamera(box); fitted = true; }
    }
    updateClip();
    requestRender();
  });

  // View mode or explicit reset: re-place and re-frame
  $effect(() => {
    void mode; void resetToken; void dark;
    if (!renderer) return;
    userMoved = false;
    const box = placeRoot();
    if (box) { updateGround(box); fitCamera(box); }
    updateClip();
    requestRender();
  });

  // Opening angle
  $effect(() => {
    armPivot.rotation.z = THREE.MathUtils.degToRad(angle);
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

<div class="viewer" bind:this={host} aria-label="3D preview of the clip. Drag to rotate, scroll to zoom." role="img"></div>

<style>
  .viewer { position: absolute; inset: 0; touch-action: none; }
  .viewer :global(canvas) { display: block; width: 100%; height: 100%; outline: none; }
</style>

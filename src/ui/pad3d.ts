/**
 * A procedural 3D game controller (Grok Bot, Matt: "a 3D gamepad that shows the buttons and highlights when I press").
 * Built only from three.js primitives and extruded shapes (no logos, no downloaded models). One mesh per standard-mapping
 * input: face buttons, bumpers, analog triggers that travel and fill, sticks that tilt with their axes and sink on click,
 * the d-pad, View / Menu. update() lights each from atom values (core/bindings.atomValues); orbit() turns the model.
 */
import * as THREE from 'three';
import { ACTIVE } from '../core/bindings';

const FACE: Record<string, [number, number, string, string]> = { a: [1.55, -.35, '#3c3', 'A'], b: [1.95, .05, '#d33', 'B'], x: [1.15, .05, '#36e', 'X'], y: [1.55, .45, '#eb2', 'Y'] };
function label(text: string, color = '#fff') {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  g.fillStyle = color; g.font = 'bold 44px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 32, 35);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.26, .26), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  return m;
}
export function createPad3D(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#202430', 1.6)); const sun = new THREE.DirectionalLight('#fff', 2.2); sun.position.set(2, 4, 5); scene.add(sun);
  const root = new THREE.Group(); scene.add(root);
  const mat = (c: string, rough = .55) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: .05 });
  // body: an extruded outline with two grips
  const s = new THREE.Shape(); s.moveTo(-1.7, 1.0); s.bezierCurveTo(-.8, 1.25, .8, 1.25, 1.7, 1.0); s.bezierCurveTo(2.6, .8, 3.0, -1.2, 2.6, -1.9);
  s.bezierCurveTo(2.3, -2.4, 1.7, -2.3, 1.3, -1.6); s.bezierCurveTo(1.0, -1.1, -1.0, -1.1, -1.3, -1.6); s.bezierCurveTo(-1.7, -2.3, -2.3, -2.4, -2.6, -1.9);
  s.bezierCurveTo(-3.0, -1.2, -2.6, .8, -1.7, 1.0);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .55, bevelEnabled: true, bevelSize: .14, bevelThickness: .14, bevelSegments: 4, curveSegments: 24 }), mat('#2a2e36', .7));
  body.position.z = -.55; root.add(body);
  const parts = new Map<string, { mesh: THREE.Mesh; base: THREE.Color; on: THREE.Color }>();
  const add = (atom: string, mesh: THREE.Mesh, color: string, on = '#9ff') => { (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0); parts.set(atom, { mesh, base: new THREE.Color(color), on: new THREE.Color(on) }); root.add(mesh); return mesh; };
  for (const [id, [x, y, c, t]] of Object.entries(FACE)) {
    const m = add(id, new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .14, 28).rotateX(Math.PI / 2), mat('#15171c', .35)), '#15171c', c);
    m.position.set(x, y, .2); const l = label(t, c); l.position.z = .08; m.add(l);
  }
  // sticks: well + tilting cap
  const sticks: Record<string, THREE.Group> = {};
  for (const [id, x, y] of [['ls', -1.55, .05], ['rs', .75, -.75]] as const) {
    const well = new THREE.Mesh(new THREE.TorusGeometry(.34, .06, 12, 32), mat('#111')); well.position.set(x, y, .12); root.add(well);
    const pivot = new THREE.Group(); pivot.position.set(x, y, .05); root.add(pivot); sticks[id] = pivot;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .3, 16).rotateX(Math.PI / 2), mat('#222')); shaft.position.z = .15; pivot.add(shaft);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.3, .27, .1, 32).rotateX(Math.PI / 2), mat('#1b1d22', .8)); cap.position.z = .33; pivot.add(cap);
    (cap.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0); parts.set(id + '.click', { mesh: cap, base: new THREE.Color('#1b1d22'), on: new THREE.Color('#9ff') });
  }
  // d-pad: four arms
  const dp = new THREE.Group(); dp.position.set(-.75, -.75, .14); root.add(dp);
  for (const [id, dx, dy] of [['dup', 0, 1], ['ddown', 0, -1], ['dleft', -1, 0], ['dright', 1, 0]] as const) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(dx ? .26 : .2, dy ? .26 : .2, .1), mat('#1d1f25')); m.position.set(dx * .19, dy * .19, 0);
    (m.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0); parts.set(id, { mesh: m, base: new THREE.Color('#1d1f25'), on: new THREE.Color('#9ff') }); dp.add(m);
  }
  for (const [id, x, t] of [['view', -.38, '⧉'], ['menu', .38, '≡']] as const) { const m = add(id, new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .08, 20).rotateX(Math.PI / 2), mat('#15171c')), '#15171c'); m.position.set(x, .45, .14); const l = label(t, '#ccc'); l.scale.setScalar(.7); l.position.z = .05; m.add(l); }
  { const m = add('xbox', new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .08, 28).rotateX(Math.PI / 2), mat('#3a3f48')), '#3a3f48'); m.position.set(0, .82, .12); } // guide: plain disc, no logo
  // bumpers and triggers (on the top edge)
  const triggers: Record<string, { mesh: THREE.Mesh; fill: THREE.Mesh }> = {};
  for (const [side, x] of [['l', -1.65], ['r', 1.65]] as const) {
    const bm = add(side + 'b', new THREE.Mesh(new THREE.BoxGeometry(1.15, .16, .3), mat('#30343c')), '#30343c'); bm.position.set(x, 1.12, -.25);
    const tr = add(side + 't', new THREE.Mesh(new THREE.BoxGeometry(.7, .26, .5), mat('#30343c')), '#30343c'); tr.position.set(x * 1.05, 1.18, -.75);
    const fill = new THREE.Mesh(new THREE.BoxGeometry(.72, .28, .02), new THREE.MeshBasicMaterial({ color: '#4ef' })); fill.position.set(0, 0, .26); fill.scale.y = .001; tr.add(fill);
    triggers[side + 't'] = { mesh: tr, fill };
  }
  root.rotation.x = -.55;
  let yaw = .2, pitch = -.5, w = 0, h = 0;
  const api = {
    root, parts,
    update(v: Map<string, number>, axes: readonly number[] = []) {
      for (const [a, p] of parts) { const x = Math.min(1, v.get(a) ?? 0), m = p.mesh.material as THREE.MeshStandardMaterial, lit = x > ACTIVE;
        m.color.copy(lit ? p.on : p.base); m.emissive.copy(p.on).multiplyScalar(lit ? .55 : 0); p.mesh.userData.lit = lit; }
      for (const [a, t] of Object.entries(triggers)) { const x = v.get(a) ?? 0; t.mesh.position.z = -.75 - .18 * x; t.fill.scale.y = Math.max(.001, x); t.fill.position.y = -.14 + .14 * x; }
      (['ls', 'rs'] as const).forEach((s, i) => { const p = sticks[s]; p.rotation.y = .45 * (axes[2 * i] ?? 0); p.rotation.x = .45 * (axes[2 * i + 1] ?? 0); p.position.z = (v.get(s + '.click') ?? 0) > ACTIVE ? -.04 : .05; });
    },
    orbit(dx: number, dy: number) { yaw = THREE.MathUtils.clamp(yaw + dx, -1.4, 1.4); pitch = THREE.MathUtils.clamp(pitch + dy, -1.3, .6); },
    lit: () => [...parts].filter(([, p]) => p.mesh.userData.lit).map(([a]) => a),
    render() {
      const cw = canvas.clientWidth || canvas.width, ch = canvas.clientHeight || canvas.height;
      if (cw !== w || ch !== h) { w = cw; h = ch; renderer.setSize(cw, ch, false); camera.aspect = cw / ch; camera.updateProjectionMatrix(); }
      root.rotation.set(pitch, yaw, 0); camera.position.set(0, -.2, 9.5); camera.lookAt(0, -.4, 0); renderer.render(scene, camera);
    },
    dispose() { renderer.dispose(); },
  };
  return api;
}

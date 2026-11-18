/**
 * A soft dark disc under each animal. It is a drawn blob, not a second shadow
 * cascade, so it stays inside the frame budget. Grass darkens its own base.
 */
import * as THREE from 'three';

export interface ContactSpot { x: number; y: number; z: number; s: number }

export function createContactShadows(scene: THREE.Scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const g = canvas.getContext('2d');
  if (g) {
    const ink = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    ink.addColorStop(0, 'rgba(0,0,0,0.55)');
    ink.addColorStop(0.45, 'rgba(0,0,0,0.22)');
    ink.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ink;
    g.fillRect(0, 0, 64, 64);
  }
  const map = new THREE.CanvasTexture(canvas);
  const geo = new THREE.CircleGeometry(0.55, 14);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, 12);
  mesh.name = 'contact-shadows';
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  const dummy = new THREE.Object3D();
  return {
    set(spots: ContactSpot[]) {
      const n = Math.min(spots.length, 12);
      for (let i = 0; i < n; i++) {
        const s = spots[i];
        dummy.position.set(s.x, s.y + 0.03, s.z);
        dummy.scale.setScalar(Math.max(0.35, s.s));
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

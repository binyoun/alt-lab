// Apprentices and the Master: small mannequins in aprons. The apron takes
// the apprentice's chosen ink, one of the nine seal colours.

import * as THREE from 'three';

export const INKS = ['#274a86', '#7a2547', '#4a2c14', '#5e3a22', '#3d3d3f', '#6b7076', '#8a5a4a', '#553024', '#2f5d50'];

const clay = new THREE.MeshStandardMaterial({ color: '#d8c8ae', flatShading: true, roughness: 0.9 });
const shirt = new THREE.MeshStandardMaterial({ color: '#e9e2d0', flatShading: true, roughness: 0.95 });
const dark = new THREE.MeshStandardMaterial({ color: '#2a2622', flatShading: true, roughness: 0.9 });

export function makeAvatar(ink = INKS[0], { master = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const coat = master
    ? new THREE.MeshStandardMaterial({ color: '#1e1b18', flatShading: true, roughness: 0.9 })
    : shirt;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.55, 3, 8), coat);
  torso.position.y = 0.95;
  body.add(torso);

  const apronMat = new THREE.MeshStandardMaterial({ color: ink, flatShading: true, roughness: 0.8 });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.7, 0.04), apronMat);
  apron.position.set(0, 0.82, 0.235);
  if (!master) body.add(apron);

  const legs = [];
  for (const sx of [-0.1, 0.1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 2, 6), dark);
    leg.position.set(sx, 0.32, 0);
    body.add(leg);
    legs.push(leg);
  }

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), clay);
  head.position.y = 1.58;
  body.add(head);
  // a cap with a brim so you can tell which way someone faces
  const capMat = master ? dark : apronMat;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, master ? 0.34 : 0.1, 10), capMat);
  cap.position.set(0, master ? 1.86 : 1.74, 0);
  body.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(master ? 0.5 : 0.24, 0.025, master ? 0.5 : 0.16), capMat);
  brim.position.set(0, 1.7, master ? 0 : 0.17);
  body.add(brim);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  let walkPhase = 0;
  return {
    root,
    setInk(color) { apronMat.color.set(color); },
    // speed in m/s; animates a small waddle
    animate(dt, speed, t) {
      if (speed > 0.05) {
        walkPhase += dt * (4 + speed * 2.2);
        body.position.y = Math.abs(Math.sin(walkPhase)) * 0.06;
        body.rotation.z = Math.sin(walkPhase) * 0.05;
        legs[0].rotation.x = Math.sin(walkPhase) * 0.5;
        legs[1].rotation.x = -Math.sin(walkPhase) * 0.5;
      } else {
        body.position.y += (Math.sin(t * 1.6) * 0.012 - body.position.y) * Math.min(1, dt * 6);
        body.rotation.z *= 0.9;
        legs[0].rotation.x *= 0.85;
        legs[1].rotation.x *= 0.85;
      }
    },
  };
}

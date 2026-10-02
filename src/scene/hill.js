import * as THREE from 'three';
import { groundTexture } from '../textures/procedural.js';

// The hill is a single big sphere. Because it's a perfect sphere we can
// answer "how high is the ground at (x, z)?" and "where does this ray hit
// the hill?" analytically, with no raycasting against triangles.
export function createHill(settings) {
  const center = new THREE.Vector3(...settings.hill.center);
  const radius = settings.hill.radius;

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 128, 96),
    new THREE.MeshLambertMaterial({ map: groundTexture(), color: settings.grass.colors.base }),
  );
  mesh.position.copy(center);

  // Height of the sphere's upper surface, or null if (x, z) is off the hill.
  function surfaceY(x, z) {
    const dx = x - center.x, dz = z - center.z;
    const d2 = radius * radius - dx * dx - dz * dz;
    return d2 < 0 ? null : center.y + Math.sqrt(d2);
  }

  // Ray-sphere intersection: solve |o + t·d - c|² = r² for the nearest t > 0.
  const oc = new THREE.Vector3();
  function intersectRay(ray, target) {
    oc.subVectors(ray.origin, center);
    const b = oc.dot(ray.direction);
    const c = oc.lengthSq() - radius * radius;
    const disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    if (t < 0) return null;
    return target.copy(ray.direction).multiplyScalar(t).add(ray.origin);
  }

  const normalAt = (p, target) => target.subVectors(p, center).normalize();

  return { mesh, center, radius, surfaceY, intersectRay, normalAt };
}

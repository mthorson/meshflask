import * as THREE from 'three';
import type { MeshValidation } from '@shared/types';

const MAX_TRIANGLES_FOR_VALIDATION = 500_000;

/**
 * Lightweight watertight / degenerate-triangle check. Walks every mesh in
 * the scene, accumulates edge-half-counts, and reports whether every edge is
 * shared by exactly two triangles. Skipped for very large meshes — the
 * O(triangles) hashing dominates render time otherwise.
 *
 * Indexed geometry only: non-indexed (every vertex inlined per-triangle) is
 * almost always artist-export output where every triangle has its own
 * vertices and watertightness is meaningless. We report `skipped: non-indexed`
 * and let the UI surface "n/a" rather than misleading "leaky".
 */
export function validateScene(obj: THREE.Object3D): MeshValidation {
  let edgeMap: Map<string, number> | null = null;
  let degenerateTriangles = 0;
  let totalTriangles = 0;
  let sawIndexed = false;
  let sawNonIndexed = false;

  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!(mesh as THREE.Object3D).type || !mesh.isMesh) return;
    const geom = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!geom) return;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const idx = geom.getIndex();
    const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
    totalTriangles += triCount;
  });

  if (totalTriangles === 0) {
    return { isWatertight: null, degenerateTriangles: 0, skipped: 'no-position' };
  }
  if (totalTriangles > MAX_TRIANGLES_FOR_VALIDATION) {
    return { isWatertight: null, degenerateTriangles: 0, skipped: 'too-large' };
  }

  edgeMap = new Map();

  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!(mesh as THREE.Object3D).type || !mesh.isMesh) return;
    const geom = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!geom) return;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const idx = geom.getIndex();
    if (!idx) {
      sawNonIndexed = true;
      return;
    }
    sawIndexed = true;

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const cross = new THREE.Vector3();
    for (let i = 0; i < idx.count; i += 3) {
      const ia = idx.getX(i);
      const ib = idx.getX(i + 1);
      const ic = idx.getX(i + 2);
      a.fromBufferAttribute(pos, ia);
      b.fromBufferAttribute(pos, ib);
      c.fromBufferAttribute(pos, ic);
      // Degenerate area check via 0.5 * |cross|; we just compare cross magnitude.
      cross.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if (cross.lengthSq() < 1e-12) degenerateTriangles++;
      addEdge(edgeMap!, ia, ib);
      addEdge(edgeMap!, ib, ic);
      addEdge(edgeMap!, ic, ia);
    }
  });

  if (sawNonIndexed && !sawIndexed) {
    return { isWatertight: null, degenerateTriangles, skipped: 'non-indexed' };
  }

  let watertight = true;
  for (const count of edgeMap.values()) {
    if (count !== 2) {
      watertight = false;
      break;
    }
  }
  return { isWatertight: watertight, degenerateTriangles };
}

function addEdge(map: Map<string, number>, a: number, b: number): void {
  // Canonicalize so (a,b) and (b,a) hash the same.
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  map.set(key, (map.get(key) ?? 0) + 1);
}

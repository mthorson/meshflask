import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { getDefaultOrientation, type FileOrientation } from '@shared/orientation';
import { applyOrientation } from './orientation';
import { inspectThreeMF } from './three-mf-multipart';
import { extract3MFEmbeddedThumbnail } from './three-mf-fast-path';

/**
 * Signals that a 3MF couldn't be rendered as live 3D — the renderer should
 * fall back to displaying the slicer-embedded PNG preview (when present).
 */
export class ThreeMFEmbeddedOnlyError extends Error {
  readonly png: Uint8Array | null;
  constructor(message: string, png: Uint8Array | null) {
    super(message);
    this.name = 'ThreeMFEmbeddedOnlyError';
    this.png = png;
  }
}

/**
 * Pure loaders: take the file's bytes, return a renderable Object3D. No
 * filesystem or fetch IO — callers (thumb worker / in-UI viewer) are
 * responsible for delivering bytes through whatever transport works in
 * their context.
 *
 * Orientation is applied here so every consumer gets a consistently
 * upright model. Caller may pass an override; otherwise the format default
 * (e.g. STL/3MF → +Z up) is used.
 */
export async function loadModel(
  buffer: ArrayBuffer,
  ext: string,
  resourcePath = '',
  orientation?: FileOrientation
): Promise<THREE.Object3D> {
  let obj: THREE.Object3D;
  switch (ext) {
    case 'glb':
    case 'gltf':
      obj = await loadGLTF(buffer, resourcePath);
      break;
    case 'obj':
      obj = loadOBJ(buffer);
      break;
    case 'stl':
      obj = loadSTL(buffer);
      break;
    case 'ply':
      obj = loadPLY(buffer);
      break;
    case '3mf':
      obj = loadThreeMF(buffer);
      break;
    default:
      throw new Error(`Unsupported extension: ${ext}`);
  }
  applyOrientation(obj, orientation ?? getDefaultOrientation(ext));
  return obj;
}

function loadGLTF(buffer: ArrayBuffer, resourcePath: string): Promise<THREE.Object3D> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(
      buffer,
      resourcePath,
      (gltf) => resolve(gltf.scene),
      (err) => reject(err instanceof Error ? err : new Error(String(err)))
    );
  });
}

function loadOBJ(buffer: ArrayBuffer): THREE.Object3D {
  const text = new TextDecoder().decode(buffer);
  const loader = new OBJLoader();
  const obj = loader.parse(text);
  applyDefaultMaterial(obj);
  return obj;
}

function loadSTL(buffer: ArrayBuffer): THREE.Mesh {
  const loader = new STLLoader();
  const geom = loader.parse(buffer);
  if (!geom.hasAttribute('normal')) geom.computeVertexNormals();
  return new THREE.Mesh(geom, neutralMaterial());
}

function loadPLY(buffer: ArrayBuffer): THREE.Mesh {
  const loader = new PLYLoader();
  const geom = loader.parse(buffer);
  if (!geom.hasAttribute('normal')) geom.computeVertexNormals();
  const mat = geom.hasAttribute('color')
    ? new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.05, roughness: 0.7 })
    : neutralMaterial();
  return new THREE.Mesh(geom, mat);
}

function loadThreeMF(buffer: ArrayBuffer): THREE.Object3D {
  // Slicer-exported 3MFs (Bambu/Prusa/Orca) use the Production Extension
  // which splits the mesh into sub-`.model` parts referenced via
  // `<component p:path>`. Stock ThreeMFLoader can't follow those, so we
  // pre-process the zip (reorder parts so referenced ones are decoded
  // first) and short-circuit huge files to the embedded PNG fallback.
  const inspection = inspectThreeMF(buffer);
  if (inspection.kind === 'too-large') {
    throw new ThreeMFEmbeddedOnlyError(
      'Mesh data exceeds in-memory preview budget; showing embedded slicer thumbnail.',
      inspection.embeddedPng
    );
  }
  const input = inspection.kind === 'rewritten' ? inspection.buffer : buffer;
  const loader = new ThreeMFLoader();
  let obj: THREE.Object3D;
  try {
    obj = loader.parse(input) as THREE.Object3D;
  } catch (err) {
    // Any remaining parse failure (e.g. unsupported extension on a smaller
    // multi-part 3MF) → fall back to the embedded PNG rather than showing
    // the cryptic loader error.
    throw new ThreeMFEmbeddedOnlyError(
      (err as Error).message || 'Failed to parse 3MF.',
      // Re-extract from the original buffer; the rewritten one drops nothing
      // but it's cheaper to scan the original we already have in hand.
      extract3MFEmbeddedThumbnail(buffer)
    );
  }
  applyDefaultMaterial(obj);
  return obj;
}

function neutralMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xb0b3b8, metalness: 0.05, roughness: 0.65 });
}

/**
 * Replaces materials that are obviously placeholder defaults (e.g. OBJLoader's
 * MeshPhongMaterial with white) so the thumbnail looks consistent across
 * formats. We keep any material that already has a texture map.
 */
function applyDefaultMaterial(obj: THREE.Object3D): void {
  const fallback = neutralMaterial();
  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material;
    const isVanillaWhite = (m: THREE.Material) =>
      (m as THREE.MeshBasicMaterial).map == null &&
      ((m as THREE.MeshPhongMaterial).color?.equals(new THREE.Color(0xffffff)) ?? false);
    if (Array.isArray(mat)) {
      mesh.material = mat.map((m) => (isVanillaWhite(m) ? fallback : m));
    } else if (mat && isVanillaWhite(mat)) {
      mesh.material = fallback;
    }
    if (mesh.geometry && !mesh.geometry.hasAttribute('normal')) {
      mesh.geometry.computeVertexNormals();
    }
  });
}

/** Free all GPU resources owned by an object subtree. Idempotent. */
export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats: THREE.Material[] = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const m of mats) {
      for (const v of Object.values(m)) {
        if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      }
      m.dispose();
    }
  });
}

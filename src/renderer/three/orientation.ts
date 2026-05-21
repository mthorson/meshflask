import * as THREE from 'three';
import { getYaw, type FileOrientation, type UpAxis } from '@shared/orientation';

const SOURCE_UP_VECTORS: Record<UpAxis, THREE.Vector3> = {
  '+X': new THREE.Vector3(1, 0, 0),
  '-X': new THREE.Vector3(-1, 0, 0),
  '+Y': new THREE.Vector3(0, 1, 0),
  '-Y': new THREE.Vector3(0, -1, 0),
  '+Z': new THREE.Vector3(0, 0, 1),
  '-Z': new THREE.Vector3(0, 0, -1)
};

const WORLD_Y = new THREE.Vector3(0, 1, 0);

/**
 * Rotate the object to its persisted orientation:
 *   1. up-axis correction → file's up vector aligns with world +Y
 *   2. yaw rotation around world +Y by the saved degrees
 *
 * Quaternion composition: `q = yawQ * upQ` so when applied to a model-space
 * vector v, the upQ rotates first (fixing the axis convention) and yawQ
 * rotates second (around the now-correct world up).
 */
export function applyOrientation(obj: THREE.Object3D, orientation: FileOrientation): void {
  const upQ = new THREE.Quaternion().setFromUnitVectors(
    SOURCE_UP_VECTORS[orientation.upAxis],
    WORLD_Y
  );
  const yawDegrees = getYaw(orientation);
  if (yawDegrees === 0) {
    obj.quaternion.copy(upQ);
    return;
  }
  const yawQ = new THREE.Quaternion().setFromAxisAngle(WORLD_Y, (yawDegrees * Math.PI) / 180);
  obj.quaternion.copy(yawQ).multiply(upQ);
}

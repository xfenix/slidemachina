import { Color, Euler, MathUtils, Quaternion, Vector3, type Mesh, type MeshBasicMaterial, type PerspectiveCamera } from "three";
import type { ObjectPose } from "./scene-poses.ts";
import type { SceneLight } from "./scene-objects.ts";

// Every value eases towards its target at this rate per second: fast at first, then gently settling, like a spring without bounce.
const smoothingRate = 5;
const settledDistance = 1e-4;
const appearanceRise = 0.4;
const smallestVisibleShare = 0.001;
const smallestScaleShare = 0.0001;
const verticalAxis = new Vector3(0, 1, 0);

export type ObjectMotion = {
  objectMesh: Mesh;
  spinSpeed: number;
  spinAngle: number;
  position: { current: Vector3; target: Vector3 };
  orientation: { current: Quaternion; target: Quaternion };
  color: { current: Color; target: Color };
  // Scale and appearance as [current, target]: a hidden object shrinks to nothing and sinks a little.
  scale: [number, number];
  appearance: [number, number];
};

export type LightMotion = { sceneLight: SceneLight; brightness: [number, number] };

export type CameraMotion = {
  sceneCamera: PerspectiveCamera;
  position: { current: Vector3; target: Vector3 };
  aim: { current: Vector3; target: Vector3 };
  fieldOfView: [number, number];
  orbitSpeed: number;
  orbitAngle: number;
};

export function computeSmoothingFactor(elapsedSeconds: number) {
  return 1 - Math.exp(-elapsedSeconds * smoothingRate);
}

function easeNumberPair(numberPair: [number, number], smoothingFactor: number): boolean {
  const remainingDistance = numberPair[1] - numberPair[0];
  numberPair[0] = Math.abs(remainingDistance) < settledDistance ? numberPair[1] : numberPair[0] + remainingDistance * smoothingFactor;
  return remainingDistance !== 0;
}

function easeVectorPair(vectorPair: { current: Vector3; target: Vector3 }, smoothingFactor: number): boolean {
  const remainingDistance = vectorPair.current.distanceTo(vectorPair.target);
  if (remainingDistance < settledDistance) vectorPair.current.copy(vectorPair.target);
  else vectorPair.current.lerp(vectorPair.target, smoothingFactor);
  return remainingDistance !== 0;
}

export function createObjectMotion(objectMesh: Mesh, spinDegrees: number): ObjectMotion {
  return {
    objectMesh,
    spinSpeed: MathUtils.degToRad(spinDegrees),
    spinAngle: 0,
    position: { current: new Vector3(), target: new Vector3() },
    orientation: { current: new Quaternion(), target: new Quaternion() },
    color: { current: new Color(), target: new Color() },
    scale: [1, 1],
    appearance: [0, 0],
  };
}

export function aimObjectMotion(objectMotion: ObjectMotion, objectPose: ObjectPose, targetColor: Color) {
  objectMotion.position.target.set(...objectPose.position);
  const [rotationX, rotationY, rotationZ] = objectPose.rotation.map(MathUtils.degToRad);
  objectMotion.orientation.target.setFromEuler(new Euler(rotationX, rotationY, rotationZ));
  objectMotion.color.target.copy(targetColor);
  objectMotion.scale[1] = objectPose.scale;
  objectMotion.appearance[1] = objectPose.isShown ? 1 : 0;
}

// Returns whether anything changed, so a settled scene is not drawn again.
export function advanceObjectMotion(objectMotion: ObjectMotion, smoothingFactor: number, elapsedSeconds: number): boolean {
  const { orientation, color } = objectMotion;
  let hasMoved = easeVectorPair(objectMotion.position, smoothingFactor);
  hasMoved = easeNumberPair(objectMotion.scale, smoothingFactor) || hasMoved;
  hasMoved = easeNumberPair(objectMotion.appearance, smoothingFactor) || hasMoved;
  const remainingRotation = orientation.current.angleTo(orientation.target);
  if (remainingRotation < settledDistance) orientation.current.copy(orientation.target);
  else orientation.current.slerp(orientation.target, smoothingFactor);
  const remainingColor =
    Math.abs(color.current.r - color.target.r) + Math.abs(color.current.g - color.target.g) + Math.abs(color.current.b - color.target.b);
  if (remainingColor < settledDistance) color.current.copy(color.target);
  else color.current.lerp(color.target, smoothingFactor);
  hasMoved = hasMoved || remainingColor !== 0;
  objectMotion.spinAngle += objectMotion.spinSpeed * elapsedSeconds;
  return hasMoved || remainingRotation !== 0 || (objectMotion.spinSpeed !== 0 && elapsedSeconds > 0);
}

export function applyObjectMotion(objectMotion: ObjectMotion) {
  const { objectMesh, appearance } = objectMotion;
  const shownShare = appearance[0];
  objectMesh.visible = shownShare > smallestVisibleShare;
  objectMesh.position.copy(objectMotion.position.current);
  objectMesh.position.y -= (1 - shownShare) * appearanceRise;
  objectMesh.scale.setScalar(Math.max(objectMotion.scale[0] * shownShare, smallestScaleShare));
  objectMesh.quaternion.setFromAxisAngle(verticalAxis, objectMotion.spinAngle).multiply(objectMotion.orientation.current);
  (objectMesh.material as MeshBasicMaterial).color.copy(objectMotion.color.current);
}

export function advanceLightMotion(lightMotion: LightMotion, smoothingFactor: number): boolean {
  const hasMoved = easeNumberPair(lightMotion.brightness, smoothingFactor);
  lightMotion.sceneLight.directionalLight.intensity = lightMotion.brightness[0];
  return hasMoved;
}

export function advanceCameraMotion(cameraMotion: CameraMotion, smoothingFactor: number, elapsedSeconds: number): boolean {
  let hasMoved = easeVectorPair(cameraMotion.position, smoothingFactor);
  hasMoved = easeVectorPair(cameraMotion.aim, smoothingFactor) || hasMoved;
  hasMoved = easeNumberPair(cameraMotion.fieldOfView, smoothingFactor) || hasMoved;
  cameraMotion.orbitAngle += cameraMotion.orbitSpeed * elapsedSeconds;
  const { sceneCamera } = cameraMotion;
  const orbitOffset = cameraMotion.position.current.clone().sub(cameraMotion.aim.current).applyAxisAngle(verticalAxis, cameraMotion.orbitAngle);
  sceneCamera.position.copy(cameraMotion.aim.current).add(orbitOffset);
  sceneCamera.lookAt(cameraMotion.aim.current);
  sceneCamera.fov = cameraMotion.fieldOfView[0];
  sceneCamera.updateProjectionMatrix();
  return hasMoved || (cameraMotion.orbitSpeed !== 0 && elapsedSeconds > 0);
}

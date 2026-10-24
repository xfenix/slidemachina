import { Box3, Euler, MathUtils, Matrix4, Quaternion, Sphere, Vector3, type BufferGeometry } from "three";
import type { CameraPose } from "./scene-poses.ts";
import type { ScenePoint } from "./scene-parts.tsx";

export const defaultFieldOfView = 30;
// A product shot: slightly from above, so the tops of the objects and their shadows show.
const viewingElevation = 0.36;
const viewingDirection = new Vector3(0, viewingElevation, 1).normalize();
// Air around the scene inside the frame, as a share of the tightest fit.
const framingMargin = 1.2;
const smallestSceneRadius = 0.5;
const boxCornerCount = 8;

type ScenePlace = { geometry: BufferGeometry; position: ScenePoint; rotation: ScenePoint; scale: number };

export type SceneBounds = { sceneBox: Box3; sceneCentre: Vector3; sceneRadius: number; floorLevel: number };

export function measureSceneBounds(scenePlaces: ScenePlace[]): SceneBounds {
  const sceneBox = new Box3();
  for (const { geometry, position, rotation, scale } of scenePlaces) {
    geometry.computeBoundingBox();
    const placeRotation = new Quaternion().setFromEuler(new Euler(...rotation.map(MathUtils.degToRad)));
    const placeMatrix = new Matrix4().compose(new Vector3(...position), placeRotation, new Vector3(scale, scale, scale));
    sceneBox.union(geometry.boundingBox!.clone().applyMatrix4(placeMatrix));
  }
  if (sceneBox.isEmpty()) sceneBox.setFromCenterAndSize(new Vector3(), new Vector3(1, 1, 1));
  const boundingSphere = sceneBox.getBoundingSphere(new Sphere());
  return { sceneBox, sceneCentre: boundingSphere.center, sceneRadius: Math.max(boundingSphere.radius, smallestSceneRadius), floorLevel: sceneBox.min.y };
}

// Without a <Camera position> the whole scene fits the frame on every step, whatever the frame proportions.
export function frameCamera(cameraPose: CameraPose, sceneBounds: SceneBounds, frameAspect: number) {
  const fieldOfView = cameraPose.fov ?? defaultFieldOfView;
  const aimPoint = cameraPose.target === undefined ? sceneBounds.sceneCentre.clone() : new Vector3(...cameraPose.target);
  if (cameraPose.position !== undefined) return { cameraPosition: new Vector3(...cameraPose.position), aimPoint, fieldOfView };
  const viewingDistance = measureFittingDistance(sceneBounds.sceneBox, aimPoint, MathUtils.degToRad(fieldOfView) / 2, frameAspect);
  return { cameraPosition: aimPoint.clone().addScaledVector(viewingDirection, viewingDistance), aimPoint, fieldOfView };
}

// The closest distance along the viewing direction at which every corner of the scene box is inside the frame.
function measureFittingDistance(sceneBox: Box3, aimPoint: Vector3, verticalHalfAngle: number, frameAspect: number): number {
  const verticalSlope = Math.tan(verticalHalfAngle);
  const horizontalSlope = verticalSlope * frameAspect;
  const rightAxis = new Vector3(0, 1, 0).cross(viewingDirection).normalize();
  const upwardAxis = viewingDirection.clone().cross(rightAxis);
  let fittingDistance = 0;
  for (let cornerIndex = 0; cornerIndex < boxCornerCount; cornerIndex += 1) {
    const cornerOffset = new Vector3(
      cornerIndex & 1 ? sceneBox.max.x : sceneBox.min.x,
      cornerIndex & 2 ? sceneBox.max.y : sceneBox.min.y,
      cornerIndex & 4 ? sceneBox.max.z : sceneBox.min.z,
    ).sub(aimPoint);
    const towardsCamera = cornerOffset.dot(viewingDirection);
    fittingDistance = Math.max(
      fittingDistance,
      towardsCamera + Math.abs(cornerOffset.dot(rightAxis)) / horizontalSlope,
      towardsCamera + Math.abs(cornerOffset.dot(upwardAxis)) / verticalSlope,
    );
  }
  return fittingDistance * framingMargin;
}

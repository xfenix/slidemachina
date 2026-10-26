import { Box3, Euler, MathUtils, Matrix4, Quaternion, Sphere, Vector3, type BufferGeometry } from "three";
import type { CameraPose } from "./scene-poses.ts";
import type { ScenePoint } from "./scene-parts.tsx";

export const defaultFieldOfView = 30;
// A product shot: slightly from above, so the tops of the objects and their shadows show.
const viewingElevation = 0.36;
const viewingDirection = new Vector3(0, viewingElevation, 1).normalize();
const verticalAxis = new Vector3(0, 1, 0);
const rightAxis = verticalAxis.clone().cross(viewingDirection).normalize();
const upwardAxis = viewingDirection.clone().cross(rightAxis);
// The objects with their shadows fill this share of the frame: a hair of air keeps blurred shadow edges inside.
const framingFill = 0.96;
// Perspective makes the fit nonlinear; a few rounds of aiming and moving settle it to a fraction of a pixel.
const framingRoundCount = 8;
// An orbiting camera sees the scene from every side: the fit holds for this many angles of one turn.
const orbitSampleCount = 12;
// Every few vertices are enough for the outline of a smooth object, and keep the fit fast while the camera orbits.
const largestOutlinePointCount = 512;
const smallestSceneRadius = 0.5;

type ScenePlace = { geometry: BufferGeometry; position: ScenePoint; rotation: ScenePoint; scale: number };
export type FrameExtent = { leftEdge: number; rightEdge: number; bottomEdge: number; topEdge: number };
export type SceneBounds = { sceneBox: Box3; sceneCentre: Vector3; sceneRadius: number; floorLevel: number; outlinePoints: Vector3[] };
export type SceneFraming = { alignsTop: boolean; orbits: boolean };

export function measureSceneBounds(scenePlaces: ScenePlace[]): SceneBounds {
  const sceneBox = new Box3();
  const outlinePoints: Vector3[] = [];
  for (const { geometry, position, rotation, scale } of scenePlaces) {
    geometry.computeBoundingBox();
    const placeRotation = new Quaternion().setFromEuler(new Euler(...rotation.map(MathUtils.degToRad)));
    const placeMatrix = new Matrix4().compose(new Vector3(...position), placeRotation, new Vector3(scale, scale, scale));
    sceneBox.union(geometry.boundingBox!.clone().applyMatrix4(placeMatrix));
    const outlineGeometry: BufferGeometry = geometry.userData.outlineGeometry ?? geometry;
    const vertexPositions = outlineGeometry.getAttribute("position");
    const vertexStride = Math.ceil(vertexPositions.count / largestOutlinePointCount);
    for (let vertexIndex = 0; vertexIndex < vertexPositions.count; vertexIndex += vertexStride) {
      outlinePoints.push(new Vector3().fromBufferAttribute(vertexPositions, vertexIndex).applyMatrix4(placeMatrix));
    }
  }
  if (sceneBox.isEmpty()) sceneBox.setFromCenterAndSize(new Vector3(), new Vector3(1, 1, 1));
  const boundingSphere = sceneBox.getBoundingSphere(new Sphere());
  return {
    sceneBox,
    sceneCentre: boundingSphere.center,
    sceneRadius: Math.max(boundingSphere.radius, smallestSceneRadius),
    floorLevel: sceneBox.min.y,
    outlinePoints,
  };
}

// The floor shadow of every point, cast along the light: the frame holds the shadows as well as the objects.
export function addShadowOutline(sceneBounds: SceneBounds, lightDirection: Vector3) {
  if (lightDirection.y <= 0) return;
  const shadowPoints = sceneBounds.outlinePoints.map((outlinePoint) =>
    outlinePoint.clone().addScaledVector(lightDirection, -(outlinePoint.y - sceneBounds.floorLevel) / lightDirection.y),
  );
  sceneBounds.outlinePoints.push(...shadowPoints);
}

function turnAroundAim(outlinePoints: Vector3[], aimPoint: Vector3): Vector3[] {
  return Array.from({ length: orbitSampleCount }, (_, sampleIndex) => (sampleIndex * Math.PI * 2) / orbitSampleCount).flatMap((orbitAngle) =>
    outlinePoints.map((outlinePoint) => outlinePoint.clone().sub(aimPoint).applyAxisAngle(verticalAxis, orbitAngle).add(aimPoint)),
  );
}

// Where the points land in the frame, from -1 to 1 on each side.
function measureFrameExtent(outlinePoints: Vector3[], cameraPoint: Vector3, horizontalSlope: number, verticalSlope: number): FrameExtent {
  const frameExtent = { leftEdge: Infinity, rightEdge: -Infinity, bottomEdge: Infinity, topEdge: -Infinity };
  const pointOffset = new Vector3();
  for (const outlinePoint of outlinePoints) {
    pointOffset.subVectors(outlinePoint, cameraPoint);
    const pointDepth = -pointOffset.dot(viewingDirection);
    const frameX = pointOffset.dot(rightAxis) / (pointDepth * horizontalSlope);
    const frameY = pointOffset.dot(upwardAxis) / (pointDepth * verticalSlope);
    frameExtent.leftEdge = Math.min(frameExtent.leftEdge, frameX);
    frameExtent.rightEdge = Math.max(frameExtent.rightEdge, frameX);
    frameExtent.bottomEdge = Math.min(frameExtent.bottomEdge, frameY);
    frameExtent.topEdge = Math.max(frameExtent.topEdge, frameY);
  }
  return frameExtent;
}

// Without a <Camera position> the scene fills its area of the frame on every step: centred across, at the top or in the middle
// up and down. With a <Camera target> only the distance is fitted, around the given point, to the whole frame.
export function frameCamera(cameraPose: CameraPose, sceneBounds: SceneBounds, frameAspect: number, sceneFraming: SceneFraming, fittingArea: FrameExtent) {
  const fieldOfView = cameraPose.fov ?? defaultFieldOfView;
  const givenAim = cameraPose.target === undefined ? undefined : new Vector3(...cameraPose.target);
  const aimPoint = givenAim?.clone() ?? sceneBounds.sceneCentre.clone();
  if (cameraPose.position !== undefined) return { cameraPosition: new Vector3(...cameraPose.position), aimPoint, fieldOfView };
  const verticalSlope = Math.tan(MathUtils.degToRad(fieldOfView) / 2);
  const horizontalSlope = verticalSlope * frameAspect;
  const outlinePoints = sceneFraming.orbits ? turnAroundAim(sceneBounds.outlinePoints, aimPoint) : sceneBounds.outlinePoints;
  const areaHalfWidth = (fittingArea.rightEdge - fittingArea.leftEdge) / 2;
  const areaHalfHeight = (fittingArea.topEdge - fittingArea.bottomEdge) / 2;
  let viewingDistance = (sceneBounds.sceneRadius / Math.min(verticalSlope, horizontalSlope)) * 2 + sceneBounds.sceneRadius;
  for (let framingRound = 0; framingRound < framingRoundCount; framingRound += 1) {
    const cameraPoint = aimPoint.clone().addScaledVector(viewingDirection, viewingDistance);
    const { leftEdge, rightEdge, bottomEdge, topEdge } = measureFrameExtent(outlinePoints, cameraPoint, horizontalSlope, verticalSlope);
    if (givenAim !== undefined) {
      viewingDistance *= Math.max(-leftEdge, rightEdge, -bottomEdge, topEdge) / framingFill;
      continue;
    }
    const halfWidth = (rightEdge - leftEdge) / 2;
    const halfHeight = (topEdge - bottomEdge) / 2;
    const distanceChange = Math.max(halfWidth / areaHalfWidth, halfHeight / areaHalfHeight) / framingFill;
    const settledMiddleX = (fittingArea.leftEdge + fittingArea.rightEdge) / 2;
    const settledMiddleY = sceneFraming.alignsTop ? fittingArea.topEdge - halfHeight / distanceChange : (fittingArea.bottomEdge + fittingArea.topEdge) / 2;
    const shiftAcross = ((leftEdge + rightEdge) / 2 - settledMiddleX * distanceChange) * viewingDistance * horizontalSlope;
    const shiftUp = ((bottomEdge + topEdge) / 2 - settledMiddleY * distanceChange) * viewingDistance * verticalSlope;
    aimPoint.addScaledVector(rightAxis, shiftAcross).addScaledVector(upwardAxis, shiftUp);
    viewingDistance *= distanceChange;
  }
  return { cameraPosition: aimPoint.clone().addScaledVector(viewingDirection, viewingDistance), aimPoint, fieldOfView };
}

import { isSceneObjectPart, type ScenePart } from "./scene-outline.ts";
import type { ScenePoint } from "./scene-parts.tsx";

const originPoint: ScenePoint = [0, 0, 0];

export type ObjectPose = {
  isShown: boolean;
  position: ScenePoint;
  rotation: ScenePoint;
  scale: number;
  color?: string;
};
export type CameraPose = {
  position?: ScenePoint;
  target?: ScenePoint;
  fov?: number;
};
export type ScenePoses = {
  objectPoses: Map<number, ObjectPose>;
  shownLights: Set<number>;
  cameraPose: CameraPose;
};
type ReachablePlace = { partPosition: number; position: ScenePoint; rotation: ScenePoint; scale: number };

function isPartReached(scenePart: ScenePart, partPosition: number, reachedPartPositions: Set<number>) {
  const partStep = scenePart.partProperties.step;
  return partStep === undefined || partStep === false || reachedPartPositions.has(partPosition);
}

function pickDefinedFields<FieldRecord extends object>(fieldRecord: FieldRecord): Partial<FieldRecord> {
  return Object.fromEntries(Object.entries(fieldRecord).filter(([, fieldValue]) => fieldValue !== undefined)) as Partial<FieldRecord>;
}

// Reached <Move on="id"> parts apply in markup order, and so do reached cameras: the last one wins field by field.
export function poseScene(sceneParts: ScenePart[], reachedPartPositions: Set<number>): ScenePoses {
  const objectPoses = new Map<number, ObjectPose>();
  const objectPositionsById = new Map<string, number>();
  const shownLights = new Set<number>();
  let cameraPose: CameraPose = {};
  sceneParts.forEach((scenePart, partPosition) => {
    const isReached = isPartReached(scenePart, partPosition, reachedPartPositions);
    if (isSceneObjectPart(scenePart)) {
      const { id, position = originPoint, rotation = originPoint, scale = 1, color } = scenePart.partProperties;
      objectPoses.set(partPosition, { isShown: isReached, position, rotation, scale, color });
      if (id !== undefined) objectPositionsById.set(id, partPosition);
      return;
    }
    if (!isReached) return;
    if (scenePart.partKind === "light") shownLights.add(partPosition);
    if (scenePart.partKind === "camera") {
      const { position, target, fov } = scenePart.partProperties;
      cameraPose = { ...cameraPose, ...pickDefinedFields({ position, target, fov }) };
    }
    if (scenePart.partKind === "move") {
      const { on, position, rotation, scale, color } = scenePart.partProperties;
      const movedPosition = objectPositionsById.get(on);
      const movedPose = movedPosition === undefined ? undefined : objectPoses.get(movedPosition);
      if (movedPose !== undefined) objectPoses.set(movedPosition!, { ...movedPose, ...pickDefinedFields({ position, rotation, scale, color }) });
    }
  });
  return { objectPoses, shownLights, cameraPose };
}

// Every place an object can stand on any step: the camera and the floor are fitted to all of them at once.
export function listReachablePlaces(sceneParts: ScenePart[]): ReachablePlace[] {
  const reachablePlaces: ReachablePlace[] = [];
  const objectPositionsById = new Map<string, number>();
  sceneParts.forEach((scenePart, partPosition) => {
    if (isSceneObjectPart(scenePart)) {
      const { id, position = originPoint, rotation = originPoint, scale = 1 } = scenePart.partProperties;
      reachablePlaces.push({ partPosition, position, rotation, scale });
      if (id !== undefined) objectPositionsById.set(id, partPosition);
      return;
    }
    if (scenePart.partKind !== "move") return;
    const movedPosition = objectPositionsById.get(scenePart.partProperties.on);
    const lastPlace = reachablePlaces.findLast((reachablePlace) => reachablePlace.partPosition === movedPosition);
    if (movedPosition === undefined || lastPlace === undefined) return;
    const { position = lastPlace.position, rotation = lastPlace.rotation, scale = lastPlace.scale } = scenePart.partProperties;
    reachablePlaces.push({ partPosition: movedPosition, position, rotation, scale });
  });
  return reachablePlaces;
}

import { MathUtils, Mesh, PerspectiveCamera, Scene as ThreeScene, Vector3, type Color, type Material, type MeshBasicMaterial } from "three";
import { defaultFieldOfView, frameCamera, measureSceneBounds, type SceneBounds } from "./scene-camera.ts";
import { resolveSceneColor, readSceneNumber } from "./scene-colors.ts";
import {
  advanceCameraMotion,
  advanceLightMotion,
  advanceObjectMotion,
  aimObjectMotion,
  applyObjectMotion,
  computeSmoothingFactor,
  createObjectMotion,
  type CameraMotion,
  type LightMotion,
  type ObjectMotion,
} from "./scene-motion.ts";
import { aimSceneLight, buildObjectMesh, buildSceneLights, buildShadowFloor, type SceneLook } from "./scene-objects.ts";
import { isSceneObjectPart, type ScenePart } from "./scene-outline.ts";
import { listReachablePlaces, type ScenePoses } from "./scene-poses.ts";
import { readEnvironmentTexture } from "./scene-renderer.ts";

export type BuiltScene = {
  threeScene: ThreeScene;
  sceneParts: ScenePart[];
  sceneLook: SceneLook;
  sceneBounds: SceneBounds;
  objectMotions: Map<number, ObjectMotion>;
  lightMotions: LightMotion[];
  cameraMotion: CameraMotion;
  resolvedColors: Map<string, Color>;
};

export type SceneSettings = {
  showsFloor: boolean;
  orbitDegrees: number;
  // Reduced motion in the system settings: no spin, no orbit, steps jump.
  keepsStill: boolean;
};

const defaultSpinDegrees = 24;

function readSceneLook(figureElement: HTMLElement): SceneLook {
  const figureStyle = getComputedStyle(figureElement);
  return {
    probeElement: figureElement.querySelector<HTMLElement>("[data-scene-probe]")!,
    objectColor: "var(--scene-color, var(--accent-color))",
    textColor: "var(--scene-text-color, var(--text-color))",
    fontFamily: figureStyle.getPropertyValue("--scene-font").trim() || figureStyle.fontFamily,
    fontWeight: figureStyle.getPropertyValue("--scene-font-weight").trim() || "700",
    shadowOpacity: readSceneNumber(figureElement, "--scene-shadow-opacity", 0.2),
  };
}

export function buildScene(figureElement: HTMLElement, sceneParts: ScenePart[], sceneSettings: SceneSettings): BuiltScene {
  const { showsFloor, orbitDegrees, keepsStill } = sceneSettings;
  const sceneLook = readSceneLook(figureElement);
  const threeScene = new ThreeScene();
  threeScene.environment = readEnvironmentTexture();
  // Soft fill from every side; the key light adds the shape. Stronger fill washes theme colours out.
  threeScene.environmentIntensity = 0.55;
  const objectMotions = new Map<number, ObjectMotion>();
  sceneParts.forEach((scenePart, partPosition) => {
    if (!isSceneObjectPart(scenePart)) return;
    const objectMesh = buildObjectMesh(scenePart, sceneLook);
    const { spin = false } = scenePart.partProperties;
    const spinDegrees = keepsStill ? 0 : spin === true ? defaultSpinDegrees : spin || 0;
    threeScene.add(objectMesh);
    objectMotions.set(partPosition, createObjectMotion(objectMesh, spinDegrees));
  });
  const sceneBounds = measureSceneBounds(
    listReachablePlaces(sceneParts).map((reachablePlace) => ({
      ...reachablePlace,
      geometry: objectMotions.get(reachablePlace.partPosition)!.objectMesh.geometry,
    })),
  );
  const lightMotions = buildSceneLights(sceneParts, sceneLook).map((sceneLight): LightMotion => {
    aimSceneLight(sceneLight, sceneBounds.sceneCentre, sceneBounds.sceneRadius);
    threeScene.add(sceneLight.directionalLight, sceneLight.directionalLight.target);
    return { sceneLight, brightness: [0, 0] };
  });
  if (showsFloor) threeScene.add(buildShadowFloor(sceneBounds.sceneCentre, sceneBounds.sceneRadius, sceneBounds.floorLevel - 0.002, sceneLook.shadowOpacity));
  const sceneCamera = new PerspectiveCamera(defaultFieldOfView, 1, sceneBounds.sceneRadius * 0.01, sceneBounds.sceneRadius * 100);
  const cameraMotion: CameraMotion = {
    sceneCamera,
    position: { current: new Vector3(), target: new Vector3() },
    aim: { current: new Vector3(), target: new Vector3() },
    fieldOfView: [defaultFieldOfView, defaultFieldOfView],
    orbitSpeed: keepsStill ? 0 : MathUtils.degToRad(orbitDegrees),
    orbitAngle: 0,
  };
  return { threeScene, sceneParts, sceneLook, sceneBounds, objectMotions, lightMotions, cameraMotion, resolvedColors: new Map() };
}

function resolveColorOnce(builtScene: BuiltScene, cssColor: string): Color {
  let resolvedColor = builtScene.resolvedColors.get(cssColor);
  if (resolvedColor === undefined) {
    resolvedColor = resolveSceneColor(builtScene.sceneLook.probeElement, cssColor);
    builtScene.resolvedColors.set(cssColor, resolvedColor);
  }
  return resolvedColor;
}

// Sets where everything is heading; a snap puts it there at once, for a frame that is not on screen yet.
export function aimScene(builtScene: BuiltScene, scenePoses: ScenePoses, frameAspect: number, snapsAtOnce: boolean) {
  for (const [partPosition, objectMotion] of builtScene.objectMotions) {
    const objectPart = builtScene.sceneParts[partPosition];
    const objectPose = scenePoses.objectPoses.get(partPosition)!;
    const defaultColor = objectPart.partKind === "text" ? builtScene.sceneLook.textColor : builtScene.sceneLook.objectColor;
    aimObjectMotion(objectMotion, objectPose, resolveColorOnce(builtScene, objectPose.color ?? defaultColor));
  }
  for (const lightMotion of builtScene.lightMotions) {
    const { partPosition, fullIntensity } = lightMotion.sceneLight;
    lightMotion.brightness[1] = partPosition === undefined || scenePoses.shownLights.has(partPosition) ? fullIntensity : 0;
  }
  const { cameraMotion } = builtScene;
  const { cameraPosition, aimPoint, fieldOfView } = frameCamera(scenePoses.cameraPose, builtScene.sceneBounds, frameAspect);
  cameraMotion.position.target.copy(cameraPosition);
  cameraMotion.aim.target.copy(aimPoint);
  cameraMotion.fieldOfView[1] = fieldOfView;
  cameraMotion.sceneCamera.aspect = frameAspect;
  if (snapsAtOnce) advanceScene(builtScene, 0, 1);
}

// Returns whether the frame changed since the last call.
export function advanceScene(builtScene: BuiltScene, elapsedSeconds: number, smoothingFactor = computeSmoothingFactor(elapsedSeconds)): boolean {
  let hasMoved = false;
  for (const objectMotion of builtScene.objectMotions.values()) {
    hasMoved = advanceObjectMotion(objectMotion, smoothingFactor, elapsedSeconds) || hasMoved;
    applyObjectMotion(objectMotion);
  }
  for (const lightMotion of builtScene.lightMotions) hasMoved = advanceLightMotion(lightMotion, smoothingFactor) || hasMoved;
  return advanceCameraMotion(builtScene.cameraMotion, smoothingFactor, elapsedSeconds) || hasMoved;
}

// Geometries, materials, text textures and shadow maps live on the GPU until they are given back.
export function releaseScene(builtScene: BuiltScene) {
  builtScene.threeScene.traverse((sceneNode) => {
    if (sceneNode instanceof Mesh) {
      sceneNode.geometry.dispose();
      const nodeMaterial = sceneNode.material as Material & Partial<Pick<MeshBasicMaterial, "map">>;
      nodeMaterial.map?.dispose();
      nodeMaterial.dispose();
    }
  });
  for (const lightMotion of builtScene.lightMotions) lightMotion.sceneLight.directionalLight.dispose();
}

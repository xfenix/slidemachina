import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { createPartStepAttributes } from "../../slide-steps/step-attributes.ts";
import { useHeavyPartsAllowed } from "../../presentation-core/heavy-part-loading.ts";
import { outlineSceneParts } from "./scene-outline.ts";
import { useSlideEnvironment } from "../../presentation-core/slide-environment.ts";
import { pickSourceMarks } from "../../presentation-core/source-marks.ts";

export type SceneProperties = {
  children?: ReactNode;
  // Degrees per second the camera circles the scene; true is a slow turn.
  orbit?: boolean | number;
  floor?: boolean;
  full?: boolean;
};

type SceneViewModule = typeof import("./scene-view.ts");

const defaultOrbitDegrees = 8;
let loadedSceneViewModule: SceneViewModule | undefined;
let sceneViewModuleRequest: Promise<SceneViewModule> | undefined;

// three.js lives in its own chunk: it is fetched when the first scene is allowed to start, and never without a scene.
function loadSceneViewModule(): Promise<SceneViewModule> {
  sceneViewModuleRequest ??= import("./scene-view.ts").then((sceneViewModule) => (loadedSceneViewModule = sceneViewModule));
  return sceneViewModuleRequest;
}

export function Scene({ children, orbit = false, floor = true, full = false, ...otherProperties }: SceneProperties) {
  const figureElementReference = useRef<HTMLElement>(null);
  const sceneParts = useMemo(() => outlineSceneParts(children), [children]);
  const { isSlideCopy } = useSlideEnvironment();
  const isSceneAllowed = useHeavyPartsAllowed();
  const orbitDegrees = orbit === true ? defaultOrbitDegrees : orbit || 0;

  useLayoutEffect(() => {
    if (!isSceneAllowed) return;
    const figureElement = figureElementReference.current!;
    let sceneView: { dispose: () => void } | undefined;
    let isUnmounted = false;
    const startView = (sceneViewModule: SceneViewModule) => {
      if (isUnmounted) return;
      try {
        sceneView = sceneViewModule.createSceneView(figureElement, sceneParts, { showsFloor: floor, orbitDegrees, isSlideCopy });
      } catch (sceneError) {
        reportSceneFailure(sceneError);
      }
    };
    // Without WebGL the scene stays empty; the mark tells the PDF build not to wait for a frame that never comes.
    const reportSceneFailure = (sceneError: unknown) => {
      console.error(sceneError);
      figureElement.toggleAttribute("data-drawn", true);
    };
    // The print menu calls print() right after the printed copies mount: with three.js and fonts ready, they draw in this task.
    if (loadedSceneViewModule !== undefined && document.fonts.status === "loaded") startView(loadedSceneViewModule);
    else void Promise.all([loadSceneViewModule(), document.fonts.ready]).then(([sceneViewModule]) => startView(sceneViewModule), reportSceneFailure);
    return () => {
      isUnmounted = true;
      sceneView?.dispose();
    };
  }, [sceneParts, floor, orbitDegrees, isSlideCopy, isSceneAllowed]);

  // Parts with step leave an empty hidden marker: the slide counts it like any other step, the scene reads which are reached.
  return (
    <figure ref={figureElementReference} data-scene={full ? "full" : "block"} {...pickSourceMarks(otherProperties)}>
      <canvas data-scene-canvas aria-hidden />
      <span data-scene-probe hidden />
      {sceneParts.map((scenePart, partPosition) => {
        const stepAttributes = createPartStepAttributes(scenePart.partProperties.step, "fade", "fade");
        if (!("data-step" in stepAttributes)) return null;
        return <span key={partPosition} data-scene-step={partPosition} hidden {...stepAttributes} />;
      })}
    </figure>
  );
}

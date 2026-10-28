import { useLayoutEffect, useRef } from "react";
import * as Machina from "slidemachina";

// three.js arrives with the stage module on first use, as the engine loads it for <Scene>: the main bundle stays without it.
const loadCubeStage = () => import("./assembling-cube-stage.ts");

function StillCube() {
  const pictureReference = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    let isCancelled = false;
    void loadCubeStage().then(({ paintStillPicture }) => {
      if (!isCancelled) paintStillPicture(pictureReference.current!);
    });
    return () => {
      isCancelled = true;
    };
  }, []);
  return <img ref={pictureReference} alt="" className="absolute inset-0 size-full" />;
}

function LiveCube() {
  const stageReference = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let isCancelled = false;
    let stopLiveCube: (() => void) | undefined;
    void loadCubeStage().then(({ runLiveCube }) => {
      if (!isCancelled) stopLiveCube = runLiveCube(stageReference.current!);
    });
    return () => {
      isCancelled = true;
      stopLiveCube?.();
    };
  }, []);
  return <div ref={stageReference} aria-hidden className="contents" />;
}

// A cube of 27 pieces comes apart, its pieces turn into small spheres, tetrahedra and octahedra, then it assembles again; it answers the mouse.
// Copies and reduced motion show one still frame; a slide that is neither on screen nor a copy holds no WebGL context.
export function AssemblingCube() {
  const { isCurrent, isCopy } = Machina.useSlide();
  if (isCopy || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return <StillCube />;
  return isCurrent ? <LiveCube /> : null;
}

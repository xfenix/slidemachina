import {
  NeutralToneMapping,
  PMREMGenerator,
  SRGBColorSpace,
  VSMShadowMap,
  WebGLRenderer,
  type Camera,
  type Scene,
  type Texture,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// A soft room, blurred: the environment lights the scene without mirroring it.
const environmentBlur = 0.04;

type SharedRenderer = {
  webglRenderer: WebGLRenderer;
  offscreenCanvas: OffscreenCanvas;
  environmentTexture: Texture;
};

let sharedRenderer: SharedRenderer | undefined;

// One WebGL context for all scenes: browsers drop contexts past about 16.
function prepareSharedRenderer(): SharedRenderer {
  if (sharedRenderer !== undefined) return sharedRenderer;
  const offscreenCanvas = new OffscreenCanvas(1, 1);
  const webglRenderer = new WebGLRenderer({ canvas: offscreenCanvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  webglRenderer.setClearColor(0x000000, 0);
  webglRenderer.outputColorSpace = SRGBColorSpace;
  // Neutral tone mapping keeps theme colours as they are.
  webglRenderer.toneMapping = NeutralToneMapping;
  webglRenderer.shadowMap.enabled = true;
  webglRenderer.shadowMap.type = VSMShadowMap;
  const environmentGenerator = new PMREMGenerator(webglRenderer);
  const roomEnvironment = new RoomEnvironment();
  const environmentTexture = environmentGenerator.fromScene(roomEnvironment, environmentBlur).texture;
  roomEnvironment.dispose();
  environmentGenerator.dispose();
  sharedRenderer = { webglRenderer, offscreenCanvas, environmentTexture };
  return sharedRenderer;
}

export function readEnvironmentTexture(): Texture {
  return prepareSharedRenderer().environmentTexture;
}

export function readLargestAnisotropy(): number {
  return prepareSharedRenderer().webglRenderer.capabilities.getMaxAnisotropy();
}

// Chrome prints only a 2D canvas, and the PDF must show the scene.
export function drawSceneFrame(threeScene: Scene, sceneCamera: Camera, targetCanvas: HTMLCanvasElement, pixelWidth: number, pixelHeight: number) {
  const { webglRenderer, offscreenCanvas } = prepareSharedRenderer();
  if (offscreenCanvas.width !== pixelWidth || offscreenCanvas.height !== pixelHeight) {
    webglRenderer.setSize(pixelWidth, pixelHeight, false);
  }
  webglRenderer.render(threeScene, sceneCamera);
  if (targetCanvas.width !== pixelWidth || targetCanvas.height !== pixelHeight) Object.assign(targetCanvas, { width: pixelWidth, height: pixelHeight });
  const targetContext = targetCanvas.getContext("2d")!;
  targetContext.clearRect(0, 0, pixelWidth, pixelHeight);
  targetContext.drawImage(offscreenCanvas, 0, 0);
}

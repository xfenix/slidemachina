import type { CSSProperties, ReactNode } from "react";
import { pickSourceMarks } from "../../presentation-core/source-marks.ts";
import { MediaFrame } from "../media-frame.tsx";
import type { ImageFloat } from "../image-component.tsx";
import { drawQRCode, type QRCorrection } from "./qr-module-shapes.ts";

export type QRProperties = {
  // What the code holds: a link or any text.
  value: string;
  // A picture for the middle of the code; the correction becomes H, so the code still reads.
  logo?: string;
  // L, M, Q or H: a higher level survives more damage and needs more modules.
  correction?: QRCorrection;
  color?: string;
  // left or right: text flows around the code, as beside a floated picture.
  float?: ImageFloat;
  // A <figcaption> here stays with the code: under it and from its left edge.
  children?: ReactNode;
};

const percentScale = 100;

// The code takes the free space like a stretched picture and stays square; floated it shrinks like a picture.
// A floated code carries its caption inside the float, so the text still wraps beside it.
export function QR({ value, logo, correction = "M", color, float, children, ...otherProperties }: QRProperties) {
  const qrDrawing = drawQRCode(value, correction, logo !== undefined);
  const qrStyle = { color, "--qr-logo-inset": `${qrDrawing.logoInsetShare * percentScale}%` } as CSSProperties;
  return (
    <MediaFrame stretch={float === undefined} caption={float === undefined ? children : undefined}>
      <div data-media data-qr data-media-float={float} style={qrStyle} {...pickSourceMarks(otherProperties)}>
        <div data-qr-code>
          <svg viewBox={`0 0 ${qrDrawing.moduleCount} ${qrDrawing.moduleCount}`}>
            <title>{value}</title>
            <path fill="currentColor" fillRule="evenodd" d={qrDrawing.modulesPath} />
          </svg>
          {logo !== undefined && <img data-qr-logo src={logo} alt="" />}
        </div>
        {float !== undefined && children}
      </div>
    </MediaFrame>
  );
}

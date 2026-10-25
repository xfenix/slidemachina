import { encode, QrCodeDataType } from "uqr";

export type QRCorrection = "L" | "M" | "Q" | "H";
export type QRDrawing = {
  moduleCount: number;
  modulesPath: string;
  // The logo sits this share of the code side away from each edge, inside the cleared middle.
  logoInsetShare: number;
};

// Sizes are in modules. A module is a little smaller than its cell, so each one reads as its own rounded tile.
// Wider gaps and rounder finder corners stop weaker scanners like OpenCV from reading the code.
const moduleSide = 0.92;
const moduleRadius = 0.26;
const moduleInset = (1 - moduleSide) / 2;
const finderSide = 7;
const finderRadius = 0.85;
const finderHoleInset = 1;
const finderHoleRadius = 0.5;
const finderCenterInset = 2;
const finderCenterRadius = 0.45;
// Error correction H restores up to 30% of the code; the cleared middle takes about 6% of it.
const logoZoneShare = 0.24;
const logoPadding = 0.7;
const pathPrecision = 100;

function roundCoordinate(coordinate: number): number {
  return Math.round(coordinate * pathPrecision) / pathPrecision;
}

function traceRoundedSquare(squareLeft: number, squareTop: number, squareSide: number, cornerRadius: number): string {
  const straightLength = roundCoordinate(squareSide - 2 * cornerRadius);
  const cornerArc = (horizontalShift: number, verticalShift: number) =>
    `a${cornerRadius} ${cornerRadius} 0 0 1 ${horizontalShift} ${verticalShift}`;
  return (
    `M${roundCoordinate(squareLeft + cornerRadius)} ${roundCoordinate(squareTop)}` +
    `h${straightLength}${cornerArc(cornerRadius, cornerRadius)}v${straightLength}${cornerArc(-cornerRadius, cornerRadius)}` +
    `h${-straightLength}${cornerArc(-cornerRadius, -cornerRadius)}v${-straightLength}${cornerArc(cornerRadius, -cornerRadius)}z`
  );
}

// The ring and its hole are drawn as two squares: with the even-odd rule the hole stays empty and the centre inside it is filled.
function traceFinderPattern(finderLeft: number, finderTop: number): string {
  const finderHoleSide = finderSide - 2 * finderHoleInset;
  const finderCenterSide = finderSide - 2 * finderCenterInset;
  return (
    traceRoundedSquare(finderLeft, finderTop, finderSide, finderRadius) +
    traceRoundedSquare(finderLeft + finderHoleInset, finderTop + finderHoleInset, finderHoleSide, finderHoleRadius) +
    traceRoundedSquare(finderLeft + finderCenterInset, finderTop + finderCenterInset, finderCenterSide, finderCenterRadius)
  );
}

function findNearestOdd(approximateCount: number): number {
  return 2 * Math.round((approximateCount - 1) / 2) + 1;
}

// boostEcc raises the correction as long as the code keeps its size: the fewest and largest modules for the screen.
export function drawQRCode(encodedValue: string, correction: QRCorrection, hasLogo: boolean): QRDrawing {
  const encodedCode = encode(encodedValue, { ecc: hasLogo ? "H" : correction, boostEcc: true, border: 0 });
  const moduleCount = encodedCode.size;
  const logoZoneSide = hasLogo ? findNearestOdd(moduleCount * logoZoneShare) : 0;
  const logoZoneStart = (moduleCount - logoZoneSide) / 2;
  const isInLogoZone = (modulePosition: number) => modulePosition >= logoZoneStart && modulePosition < logoZoneStart + logoZoneSide;
  const moduleSquares: string[] = [];
  encodedCode.data.forEach((moduleRow, rowPosition) => {
    moduleRow.forEach((isDarkModule, columnPosition) => {
      if (!isDarkModule || encodedCode.types[rowPosition]![columnPosition] === QrCodeDataType.Position) return;
      if (isInLogoZone(rowPosition) && isInLogoZone(columnPosition)) return;
      moduleSquares.push(traceRoundedSquare(columnPosition + moduleInset, rowPosition + moduleInset, moduleSide, moduleRadius));
    });
  });
  const farFinderEdge = moduleCount - finderSide;
  const finderPatterns = [traceFinderPattern(0, 0), traceFinderPattern(farFinderEdge, 0), traceFinderPattern(0, farFinderEdge)];
  return {
    moduleCount,
    modulesPath: finderPatterns.join("") + moduleSquares.join(""),
    logoInsetShare: (logoZoneStart + logoPadding) / moduleCount,
  };
}

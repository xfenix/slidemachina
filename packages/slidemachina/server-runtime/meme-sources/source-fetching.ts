import { largestPictureBytes } from "../development-server/edit-request-checks.ts";
import { SourceEditProblem } from "../development-server/source-rewriting.ts";

const networkTimeout = 20_000;

export async function fetchFromSource(sourceAddress: string): Promise<Response> {
  try {
    return await fetch(sourceAddress, { signal: AbortSignal.timeout(networkTimeout), headers: { "User-Agent": "slidemachina" } });
  } catch (fetchError) {
    throw new SourceEditProblem("memeNetworkFailed", `${sourceAddress}: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
  }
}

// Downloads keep the editor's limit for pictures: a file past it is refused before it fills the disk.
export async function readResponseBytes(sourceResponse: Response): Promise<Buffer> {
  if (Number(sourceResponse.headers.get("content-length") ?? 0) > largestPictureBytes) throw new SourceEditProblem("pictureTooLarge");
  const responseBytes = Buffer.from(await sourceResponse.arrayBuffer());
  if (responseBytes.length > largestPictureBytes) throw new SourceEditProblem("pictureTooLarge");
  return responseBytes;
}

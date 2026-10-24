import type { ElkNode } from "elkjs/lib/elk-api";
// Only an address: the 1.5 MB layout engine is fetched by the worker, and only once a diagram asks for it.
import elkWorkerAddress from "elkjs/lib/elk-worker.min.js?url";

const pendingLayouts = new Map<number, PendingLayout>();
let layoutWorker: Worker | undefined;
let lastRequestNumber = 0;

type PendingLayout = {
  resolveLayout: (laidOutGraph: ElkNode) => void;
  rejectLayout: (layoutError: unknown) => void;
};

type WorkerAnswer = { id: number; data?: ElkNode; error?: unknown };

// A blob URL makes the inlined worker same-origin, also on file://.
function createWorkerAddress(): string {
  if (!elkWorkerAddress.startsWith("data:")) return elkWorkerAddress;
  const workerBytes = Uint8Array.from(atob(elkWorkerAddress.slice(elkWorkerAddress.indexOf(",") + 1)), (byteCharacter) => byteCharacter.charCodeAt(0));
  return URL.createObjectURL(new Blob([workerBytes], { type: "text/javascript" }));
}

function startLayoutWorker(): Worker {
  const startedWorker = new Worker(createWorkerAddress());
  startedWorker.onmessage = ({ data: workerAnswer }: MessageEvent<WorkerAnswer>) => {
    const pendingLayout = pendingLayouts.get(workerAnswer.id);
    if (pendingLayout === undefined) return;
    pendingLayouts.delete(workerAnswer.id);
    if (workerAnswer.error === undefined) pendingLayout.resolveLayout(workerAnswer.data!);
    else pendingLayout.rejectLayout(workerAnswer.error);
  };
  // A worker that failed to load or crashed answers nothing: its layouts fail now, the next one starts a new worker.
  startedWorker.onerror = (workerError) => {
    workerError.preventDefault();
    startedWorker.terminate();
    if (layoutWorker === startedWorker) layoutWorker = undefined;
    for (const pendingLayout of pendingLayouts.values()) pendingLayout.rejectLayout(new Error(workerError.message || "ELK worker failed"));
    pendingLayouts.clear();
  };
  startedWorker.postMessage({ id: 0, cmd: "register", algorithms: ["layered"] });
  return startedWorker;
}

export function layOutWithElk(elkGraph: ElkNode): Promise<ElkNode> {
  layoutWorker ??= startLayoutWorker();
  lastRequestNumber += 1;
  const requestNumber = lastRequestNumber;
  return new Promise((resolveLayout, rejectLayout) => {
    pendingLayouts.set(requestNumber, { resolveLayout, rejectLayout });
    layoutWorker!.postMessage({ id: requestNumber, cmd: "layout", graph: elkGraph });
  });
}

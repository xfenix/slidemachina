// An arrow end is a node id, or a named line/token anchor inside a Code block of that node.
export type CodeAnchorEndpoint = { node: string; code: string; anchor: string };
export type ArrowEndpoint = string | CodeAnchorEndpoint;

export function readArrowNodeIdentifier(arrowEndpoint: ArrowEndpoint): string {
  return typeof arrowEndpoint === "string" ? arrowEndpoint : arrowEndpoint.node;
}

export function isCodeAnchorEndpoint(arrowEndpoint: ArrowEndpoint): arrowEndpoint is CodeAnchorEndpoint {
  return typeof arrowEndpoint !== "string";
}

// slidemachina dev marks slide elements with their place in the source; engine parts pass the marks to what they draw.
type SourceMarks = {
  "data-source-location"?: string;
  "data-source-edit"?: string;
};

// A build has no marks, so the check folds away and leaves nothing of the editor in the bundle.
export function pickSourceMarks(componentProperties: object): SourceMarks {
  if (!import.meta.env.DEV) return {};
  const { "data-source-location": sourceLocation, "data-source-edit": sourceEdit } = componentProperties as SourceMarks;
  return { "data-source-location": sourceLocation, "data-source-edit": sourceEdit };
}

// The page walks React elements and the editor plugin walks TypeScript syntax nodes; both number slides by these rules.
export type OutlineMarkupKind = "fragment" | "section" | "slide";
export type SlideOutlineReader<MarkupNode> = {
  classifyMarkupNode: (markupNode: MarkupNode) => OutlineMarkupKind;
  listMarkupChildren: (markupNode: MarkupNode) => MarkupNode[];
  // false drops the cover slide, true asks for the generated one, a node is a cover slide of its own.
  readSectionCover: (sectionNode: MarkupNode) => boolean | MarkupNode;
};
export type SectionPlace<MarkupNode> = { sectionNode: MarkupNode; sectionNumber: string };
export type OutlinedMarkup<MarkupNode> = {
  // A generated section cover has no node of its own and points at its section.
  slideNode: MarkupNode;
  // Fragments and sections around the slide, outermost first; a section cover is inside its own section.
  enclosingNodes: MarkupNode[];
  sectionPlaces: SectionPlace<MarkupNode>[];
  isSectionCover: boolean;
};

// Fragments are see-through, any other node is one slide, a section puts its cover slide first.
export function outlineSlideMarkup<MarkupNode>(
  markupNodes: MarkupNode[],
  outlineReader: SlideOutlineReader<MarkupNode>,
  enclosingNodes: MarkupNode[] = [],
  sectionPlaces: SectionPlace<MarkupNode>[] = [],
): OutlinedMarkup<MarkupNode>[] {
  let sectionCount = 0;
  return markupNodes.flatMap((markupNode): OutlinedMarkup<MarkupNode>[] => {
    const markupKind = outlineReader.classifyMarkupNode(markupNode);
    if (markupKind === "slide") return [{ slideNode: markupNode, enclosingNodes, sectionPlaces, isSectionCover: false }];
    const nestedNodes = [...enclosingNodes, markupNode];
    const markupChildren = outlineReader.listMarkupChildren(markupNode);
    if (markupKind === "fragment") return outlineSlideMarkup(markupChildren, outlineReader, nestedNodes, sectionPlaces);
    sectionCount += 1;
    const parentSectionNumber = sectionPlaces.at(-1)?.sectionNumber;
    // "02" for the second section, "02.1" for the first section inside it.
    const sectionNumber =
      parentSectionNumber === undefined ? String(sectionCount).padStart(2, "0") : `${parentSectionNumber}.${sectionCount}`;
    const nestedPlaces = [...sectionPlaces, { sectionNode: markupNode, sectionNumber }];
    const sectionSlides = outlineSlideMarkup(markupChildren, outlineReader, nestedNodes, nestedPlaces);
    const sectionCover = outlineReader.readSectionCover(markupNode);
    if (sectionCover === false) return sectionSlides;
    const coverNode = sectionCover === true ? markupNode : sectionCover;
    return [{ slideNode: coverNode, enclosingNodes: nestedNodes, sectionPlaces: nestedPlaces, isSectionCover: true }, ...sectionSlides];
  });
}

// The page walks React elements and the build walks TypeScript syntax nodes; both find covers by these rules.
export type OutlineMarkupKind = "fragment" | "section" | "slide";
export type SlideOutlineReader<MarkupNode> = {
  classifyMarkupNode: (markupNode: MarkupNode) => OutlineMarkupKind;
  listMarkupChildren: (markupNode: MarkupNode) => MarkupNode[];
  // cover={false}: the section has no generated cover slide.
  dropsSectionCover: (sectionNode: MarkupNode) => boolean;
  isCoverSlide: (slideNode: MarkupNode) => boolean;
};
export type SectionPlace<MarkupNode> = {
  sectionNode: MarkupNode;
  sectionNumber: string;
  // The section opens with a <Slide cover> of its own: no generated cover, its h1 names the section.
  ownCover: MarkupNode | undefined;
};
export type OutlinedMarkup<MarkupNode> = {
  // A generated section cover has no node of its own and points at its section.
  slideNode: MarkupNode;
  // Fragments and sections around the slide, outermost first; a section cover is inside its own section.
  enclosingNodes: MarkupNode[];
  sectionPlaces: SectionPlace<MarkupNode>[];
  isGeneratedCover: boolean;
};

// The first slide of a presentation or a section is its title when it is a <Slide cover>; a section before any slide means there is none.
export function findOpeningCover<MarkupNode>(markupNodes: MarkupNode[], outlineReader: SlideOutlineReader<MarkupNode>): MarkupNode | undefined {
  for (const markupNode of markupNodes) {
    const markupKind = outlineReader.classifyMarkupNode(markupNode);
    if (markupKind === "section") return undefined;
    if (markupKind === "slide") return outlineReader.isCoverSlide(markupNode) ? markupNode : undefined;
    const fragmentChildren = outlineReader.listMarkupChildren(markupNode);
    if (fragmentChildren.length > 0) return findOpeningCover(fragmentChildren, outlineReader);
  }
  return undefined;
}

// Fragments are see-through, any other node is one slide, a section without a cover of its own gets a generated one first.
export function outlineSlideMarkup<MarkupNode>(
  markupNodes: MarkupNode[],
  outlineReader: SlideOutlineReader<MarkupNode>,
  enclosingNodes: MarkupNode[] = [],
  sectionPlaces: SectionPlace<MarkupNode>[] = [],
): OutlinedMarkup<MarkupNode>[] {
  let sectionCount = 0;
  return markupNodes.flatMap((markupNode): OutlinedMarkup<MarkupNode>[] => {
    const markupKind = outlineReader.classifyMarkupNode(markupNode);
    if (markupKind === "slide") return [{ slideNode: markupNode, enclosingNodes, sectionPlaces, isGeneratedCover: false }];
    const nestedNodes = [...enclosingNodes, markupNode];
    const markupChildren = outlineReader.listMarkupChildren(markupNode);
    if (markupKind === "fragment") return outlineSlideMarkup(markupChildren, outlineReader, nestedNodes, sectionPlaces);
    sectionCount += 1;
    const parentSectionNumber = sectionPlaces.at(-1)?.sectionNumber;
    // "02" for the second section, "02.1" for the first section inside it.
    const sectionNumber =
      parentSectionNumber === undefined ? String(sectionCount).padStart(2, "0") : `${parentSectionNumber}.${sectionCount}`;
    const ownCover = findOpeningCover(markupChildren, outlineReader);
    const nestedPlaces = [...sectionPlaces, { sectionNode: markupNode, sectionNumber, ownCover }];
    const sectionSlides = outlineSlideMarkup(markupChildren, outlineReader, nestedNodes, nestedPlaces);
    if (ownCover !== undefined || outlineReader.dropsSectionCover(markupNode)) return sectionSlides;
    return [{ slideNode: markupNode, enclosingNodes: nestedNodes, sectionPlaces: nestedPlaces, isGeneratedCover: true }, ...sectionSlides];
  });
}

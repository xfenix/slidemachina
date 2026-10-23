import { readFileContent, type SourceEditRequest } from "./source-edit-requests.ts";

type SourceEditRunner = (editRequest: SourceEditRequest) => Promise<boolean>;

// The new picture shows at once; if the file is not written, the old one comes back.
export async function replacePicture(pictureElement: HTMLElement, pictureFile: File, runSourceEdit: SourceEditRunner) {
  const previousAddress = pictureElement.getAttribute("src");
  const previewAddress = URL.createObjectURL(pictureFile);
  pictureElement.setAttribute("src", previewAddress);
  const isPictureSaved = await runSourceEdit({
    editKind: "picture",
    sourceLocation: pictureElement.dataset.sourceLocation!,
    pictureName: pictureFile.name,
    pictureContent: await readFileContent(pictureFile),
  });
  if (!isPictureSaved && previousAddress !== null) pictureElement.setAttribute("src", previousAddress);
  URL.revokeObjectURL(previewAddress);
}

export function choosePictureFile(handleChosenPicture: (pictureFile: File) => void) {
  const pictureInput = document.createElement("input");
  pictureInput.type = "file";
  pictureInput.accept = "image/*";
  pictureInput.addEventListener("change", () => {
    const pictureFile = pictureInput.files?.[0];
    if (pictureFile !== undefined) handleChosenPicture(pictureFile);
  });
  pictureInput.click();
}

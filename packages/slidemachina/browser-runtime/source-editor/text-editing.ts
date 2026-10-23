// \s covers the typographer's non-breaking spaces: the source gets plain ones, and no line breaks.
function normalizeTypedText(shownText: string) {
  return shownText.replace(/\s+/g, " ").trim();
}

type TextEditingCallbacks = {
  saveText: (typedText: string) => Promise<boolean>;
  finishEditing: () => void;
};

// The same text nodes go back after typing: React keeps references to them.
export function beginTextEditing(textElement: HTMLElement, editingCallbacks: TextEditingCallbacks) {
  const reactNodes = [...textElement.childNodes];
  const reactValues = reactNodes.map((reactNode) => reactNode.nodeValue);
  const shownText = normalizeTypedText(textElement.textContent ?? "");
  let isFinished = false;

  const restoreReactNodes = (firstValue?: string) => {
    textElement.replaceChildren(...reactNodes);
    reactNodes.forEach((reactNode, nodePosition) => {
      if (reactNode.nodeType === Node.TEXT_NODE) reactNode.nodeValue = reactValues[nodePosition];
    });
    if (firstValue !== undefined && reactNodes.length === 1 && reactNodes[0].nodeType === Node.TEXT_NODE) reactNodes[0].nodeValue = firstValue;
  };

  const finishTyping = (keepsText: boolean) => {
    if (isFinished) return;
    isFinished = true;
    const typedText = normalizeTypedText(textElement.textContent ?? "");
    textElement.removeEventListener("keydown", handleKeydown);
    textElement.removeEventListener("blur", handleBlur);
    textElement.removeAttribute("contenteditable");
    textElement.removeAttribute("data-source-editing");
    window.getSelection()?.removeAllRanges();
    const savesText = keepsText && typedText !== "" && typedText !== shownText;
    restoreReactNodes(savesText ? typedText : undefined);
    editingCallbacks.finishEditing();
    if (savesText) void editingCallbacks.saveText(typedText).then((isTextSaved) => isTextSaved || restoreReactNodes());
  };

  const handleKeydown = (keyboardEvent: KeyboardEvent) => {
    if (keyboardEvent.isComposing) return;
    if (keyboardEvent.key === "Enter" || keyboardEvent.key === "Escape") {
      // Stopped here: Escape would open the navigator once the element is no longer editable.
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      finishTyping(keyboardEvent.key === "Enter");
    }
  };
  const handleBlur = () => finishTyping(true);

  textElement.setAttribute("contenteditable", "plaintext-only");
  textElement.setAttribute("data-source-editing", "");
  textElement.spellcheck = false;
  textElement.addEventListener("keydown", handleKeydown);
  textElement.addEventListener("blur", handleBlur);
  return { finishTyping };
}

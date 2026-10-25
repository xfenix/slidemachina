import { lazy, Suspense, useState, type ComponentType } from "react";
import { pickEditorTexts } from "./editor-texts.ts";
import { useWindowKeydown } from "../slide-navigation/keyboard-listener.ts";
import { ToolbarButton } from "../presentation-interface/presentation-toolbar.tsx";

// The condition is folded at build time, like Agentation's: a built presentation carries no editor code.
const SourceEditor = lazy<ComponentType<{ languageCode: string }>>(() =>
  import.meta.env.DEV ? import("./source-editor.tsx") : Promise.resolve({ default: () => null }),
);

// E or the pencil turns the editor on; the letter is matched by physical key, so it works in any layout.
export function EditorSwitch({ languageCode }: { languageCode: string }) {
  const editorTexts = pickEditorTexts(languageCode);
  const [isEditorOn, setEditorOn] = useState(false);
  const toggleEditor = () => setEditorOn((wasEditorOn) => !wasEditorOn);
  useWindowKeydown((keyboardEvent) => {
    if (keyboardEvent.code !== "KeyE") return false;
    toggleEditor();
    return true;
  }, true);

  return (
    <>
      <ToolbarButton label={editorTexts.editorButton} isPressed={isEditorOn} onPress={toggleEditor}>
        <PencilIcon />
      </ToolbarButton>
      {isEditorOn && (
        <Suspense fallback={null}>
          <SourceEditor languageCode={languageCode} />
        </Suspense>
      )}
    </>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12.5 4.5l3 3M3.5 16.5l.8-3.6 9.2-9.2a1.4 1.4 0 0 1 2 0l.8.8a1.4 1.4 0 0 1 0 2l-9.2 9.2z" />
    </svg>
  );
}

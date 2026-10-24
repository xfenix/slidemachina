import { useEffect, useState, type RefObject } from "react";
import { toolbarIdleDelay } from "../presentation-core/settings.ts";
import { isFeedbackActive } from "../development-feedback/development-feedback.tsx";

// Controls fade after two seconds without the mouse, unless hovered, a menu is open or a note is being written.
export function useToolbarIdle(toolbarReference: RefObject<HTMLElement | null>) {
  const [isToolbarIdle, setToolbarIdle] = useState(false);
  useEffect(() => {
    let idleTimer = 0;
    const scheduleIdle = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        const toolbarElement = toolbarReference.current;
        const isToolbarInUse =
          toolbarElement?.matches(":hover, :focus-within") === true || toolbarElement?.querySelector("[data-print-menu]") != null || isFeedbackActive();
        if (isToolbarInUse) scheduleIdle();
        else setToolbarIdle(true);
      }, toolbarIdleDelay);
    };
    const wakeToolbar = () => {
      setToolbarIdle(false);
      scheduleIdle();
    };
    wakeToolbar();
    // A tap on a touch screen brings the controls back too.
    window.addEventListener("pointermove", wakeToolbar);
    window.addEventListener("pointerdown", wakeToolbar);
    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener("pointermove", wakeToolbar);
      window.removeEventListener("pointerdown", wakeToolbar);
    };
  }, [toolbarReference]);
  return isToolbarIdle;
}

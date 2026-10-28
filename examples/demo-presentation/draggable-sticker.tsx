import { useRef, useState, type PointerEvent, type ReactNode } from "react";

type StickerPosition = { left: number; top: number };
type DragStart = StickerPosition & { pointerX: number; pointerY: number; displayScale: number };
type DraggableStickerProperties = { children: ReactNode; startLeft: number; startTop: number; tiltDegrees: number; stickerColor: string };

// A sticker of the freeform demo: placed by left and top, moved with the mouse. The slide is scaled to the window, so the pointer path is divided by that scale.
export function DraggableSticker({ children, startLeft, startTop, tiltDegrees, stickerColor }: DraggableStickerProperties) {
  const [stickerPosition, setStickerPosition] = useState<StickerPosition>({ left: startLeft, top: startTop });
  const dragStartReference = useRef<DragStart | null>(null);

  const startDragging = (pointerEvent: PointerEvent<HTMLDivElement>) => {
    const stickerElement = pointerEvent.currentTarget;
    const freeformElement = stickerElement.parentElement!;
    stickerElement.setPointerCapture(pointerEvent.pointerId);
    dragStartReference.current = {
      ...stickerPosition,
      pointerX: pointerEvent.clientX,
      pointerY: pointerEvent.clientY,
      displayScale: freeformElement.getBoundingClientRect().width / freeformElement.offsetWidth,
    };
  };

  const moveSticker = (pointerEvent: PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartReference.current;
    if (dragStart === null) return;
    setStickerPosition({
      left: dragStart.left + (pointerEvent.clientX - dragStart.pointerX) / dragStart.displayScale,
      top: dragStart.top + (pointerEvent.clientY - dragStart.pointerY) / dragStart.displayScale,
    });
  };

  const stopDragging = () => {
    dragStartReference.current = null;
  };

  return (
    <div
      data-step
      data-step-effect="scale"
      className="absolute flex size-[260px] cursor-grab touch-none items-center justify-center p-8 text-center text-(length:--text-size) leading-tight text-[#1d1b16] shadow-[0_24px_48px_-16px_rgb(0_0_0/0.35)] print:shadow-none select-none active:cursor-grabbing"
      style={{ left: stickerPosition.left, top: stickerPosition.top, rotate: `${tiltDegrees}deg`, background: stickerColor }}
      onPointerDown={startDragging}
      onPointerMove={moveSticker}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    >
      {children}
    </div>
  );
}

import { useRef, type CSSProperties, type ReactNode } from "react";
import { arrowHeadLength, arrowHeadWidth, drawArrow } from "./arrow-geometry.ts";
import { useFocusSteps } from "./diagram-focus.ts";
import { listMarkupElements } from "../presentation-core/markup-elements.ts";
import { Focus, FocusMarker, type FocusProperties } from "./diagram-parts.tsx";
import { createPartStepAttributes, type StepEffect } from "../slide-steps/step-attributes.ts";

const selfLoopWidth = 56;
const selfLoopHeight = 40;
const selfLoopCornerRadius = 14;

const horizontalHead = drawArrow(
  [{ x: 0, y: arrowHeadWidth / 2 }, { x: arrowHeadLength, y: arrowHeadWidth / 2 }],
  0,
);

// A message to oneself leaves to the right and comes back to the same lifeline a little lower.
const selfLoop = drawArrow(
  [
    { x: 0, y: 1 },
    { x: selfLoopWidth, y: 1 },
    { x: selfLoopWidth, y: selfLoopHeight },
    { x: 0, y: selfLoopHeight },
  ],
  selfLoopCornerRadius,
);

export type SequenceProperties = {
  children?: ReactNode;
};

export type ActorProperties = {
  id: string;
  children?: ReactNode;
  step?: boolean | number;
  effect?: StepEffect;
};

export type MessageProperties = {
  from: string;
  to: string;
  id?: string;
  label?: string;
  reply?: boolean;
  step?: boolean | number;
  effect?: StepEffect;
};

export const Actor: (actorProperties: ActorProperties) => null = () => null;

export const Message: (messageProperties: MessageProperties) => null = () => null;

function MessageArrow({ messageDirection }: { messageDirection: "right" | "left" | "self" }) {
  if (messageDirection === "self") {
    return (
      <svg data-message-loop width={selfLoopWidth} height={selfLoopHeight + arrowHeadWidth / 2} aria-hidden>
        <path data-arrow-line d={selfLoop.linePath} pathLength={1} />
        <path data-arrow-head d={selfLoop.headPath} />
      </svg>
    );
  }
  return (
    <div data-message-line>
      <svg data-message-head width={arrowHeadLength} height={arrowHeadWidth} aria-hidden>
        <path data-arrow-head d={horizontalHead.headPath} />
      </svg>
    </div>
  );
}

// Actors are columns, messages are rows in markup order. Actor boxes morph with diagram boxes of the same id.
export function Sequence({ children }: SequenceProperties) {
  const sequenceElementReference = useRef<HTMLElement>(null);
  useFocusSteps(sequenceElementReference);
  const markupElements = listMarkupElements(children);
  const actorColumns = new Map(
    markupElements
      .filter((markupElement) => markupElement.type === Actor)
      .map((markupElement, actorPosition) => [(markupElement.props as ActorProperties).id, actorPosition + 1]),
  );
  let messageCount = 0;
  const drawnParts = markupElements.map((markupElement, partPosition) => {
    if (markupElement.type === Focus) return <FocusMarker key={partPosition} focusProperties={markupElement.props as FocusProperties} />;
    if (markupElement.type === Actor) {
      const actorProperties = markupElement.props as ActorProperties;
      return (
        <div
          key={partPosition}
          data-actor
          data-focus-id={actorProperties.id}
          style={{ gridColumn: actorColumns.get(actorProperties.id) }}
          {...createPartStepAttributes(actorProperties.step, actorProperties.effect, "rise")}
        >
          <div data-box morph={`diagram-node:${actorProperties.id}`}>
            <span data-box-label data-morph-text morph={`diagram-node-label:${actorProperties.id}`}>
              {actorProperties.children}
            </span>
          </div>
          <div data-lifeline />
        </div>
      );
    }
    if (markupElement.type !== Message) return null;
    const messageProperties = markupElement.props as MessageProperties;
    const sourceColumn = actorColumns.get(messageProperties.from);
    const targetColumn = actorColumns.get(messageProperties.to);
    if (sourceColumn === undefined || targetColumn === undefined) return null;
    messageCount += 1;
    const messageDirection = sourceColumn === targetColumn ? "self" : targetColumn > sourceColumn ? "right" : "left";
    const firstColumn = Math.min(sourceColumn, targetColumn);
    const lastColumn = Math.max(sourceColumn, targetColumn);
    const messageStyle = {
      gridColumn: `${firstColumn} / ${lastColumn + 1}`,
      gridRow: messageCount + 1,
      "--message-span": lastColumn - firstColumn + 1,
    } as CSSProperties;
    return (
      <div
        key={partPosition}
        data-message={messageDirection}
        data-reply={messageProperties.reply || undefined}
        data-focus-id={messageProperties.id ?? `message:${partPosition}`}
        data-focus-ends={`${messageProperties.from} ${messageProperties.to}`}
        style={messageStyle}
        {...createPartStepAttributes(messageProperties.step, messageProperties.effect, "fade")}
      >
        {messageProperties.label !== undefined && <span data-message-label>{messageProperties.label}</span>}
        <MessageArrow messageDirection={messageDirection} />
      </div>
    );
  });
  const sequenceStyle = { "--actor-count": actorColumns.size, "--message-count": messageCount } as CSSProperties;
  return (
    <figure ref={sequenceElementReference} data-sequence style={sequenceStyle}>
      {drawnParts}
    </figure>
  );
}

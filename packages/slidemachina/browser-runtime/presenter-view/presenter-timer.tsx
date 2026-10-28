import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { pickInterfaceTexts } from "../presentation-interface/interface-texts.ts";

type TimerState = { runningSince?: number; elapsedBeforeRun: number };
type PresenterTimerProperties = {
  languageCode: string;
  slideAddress: string;
  stepIndex: number;
  // Hidden slides are left out: the schedule follows the numbers the audience sees.
  shownNumber: number;
  shownCount: number;
  talkMinutes?: number;
};

// The window keeps its timer through a reload, and a new presenter window starts from zero.
const timerStorageKey = "slidemachina-presenter-timer";
const clockTickInterval = 1000;
const millisecondsPerSecond = 1000;
const secondsPerMinute = 60;
const secondsPerHour = 3600;
const millisecondsPerMinute = secondsPerMinute * millisecondsPerSecond;
// Closer than this to the plan reads as on schedule: a minute of talk is never that exact.
const scheduleTolerance = 30 * millisecondsPerSecond;
const stoppedTimer: TimerState = { elapsedBeforeRun: 0 };

function readStoredTimer(): TimerState {
  const storedText = sessionStorage.getItem(timerStorageKey);
  return storedText === null ? stoppedTimer : (JSON.parse(storedText) as TimerState);
}

// "4:05", or "1:04:05" past an hour.
function formatDuration(durationMilliseconds: number): string {
  const totalSeconds = Math.floor(durationMilliseconds / millisecondsPerSecond);
  const hourCount = Math.floor(totalSeconds / secondsPerHour);
  const minuteCount = Math.floor((totalSeconds % secondsPerHour) / secondsPerMinute);
  const secondText = String(totalSeconds % secondsPerMinute).padStart(2, "0");
  return hourCount > 0 ? `${hourCount}:${String(minuteCount).padStart(2, "0")}:${secondText}` : `${minuteCount}:${secondText}`;
}

// Buttons keep the focus where it was, otherwise the next Space would press them instead of moving forward.
export function keepFocus(pointerEvent: PointerEvent) {
  pointerEvent.preventDefault();
}

// The timer waits at zero and starts with the first move, so the presenter window can open long before the talk.
export function PresenterTimer({ languageCode, slideAddress, stepIndex, shownNumber, shownCount, talkMinutes }: PresenterTimerProperties) {
  const interfaceTexts = pickInterfaceTexts(languageCode);
  const [timerState, setTimerState] = useState(readStoredTimer);
  const [currentTime, setCurrentTime] = useState(Date.now);
  const openingPositionReference = useRef(`${slideAddress}.${stepIndex}`);

  useEffect(() => {
    const clockTicker = setInterval(() => setCurrentTime(Date.now()), clockTickInterval);
    return () => clearInterval(clockTicker);
  }, []);
  useEffect(() => {
    sessionStorage.setItem(timerStorageKey, JSON.stringify(timerState));
  }, [timerState]);
  useEffect(() => {
    if (`${slideAddress}.${stepIndex}` === openingPositionReference.current) return;
    openingPositionReference.current = "";
    setTimerState((previousTimer) =>
      previousTimer.runningSince === undefined && previousTimer.elapsedBeforeRun === 0 ? { runningSince: Date.now(), elapsedBeforeRun: 0 } : previousTimer,
    );
  }, [slideAddress, stepIndex]);

  const isRunning = timerState.runningSince !== undefined;
  const elapsedTime = timerState.elapsedBeforeRun + (timerState.runningSince === undefined ? 0 : Math.max(0, currentTime - timerState.runningSince));
  const hasStarted = isRunning || elapsedTime > 0;
  const talkLength = talkMinutes === undefined ? undefined : talkMinutes * millisecondsPerMinute;
  const timeLeft = talkLength === undefined ? undefined : talkLength - elapsedTime;
  // Planned time for the slides already behind, minus the time spent: above zero the talk runs ahead.
  const scheduleLead = talkLength === undefined ? 0 : (Math.max(0, shownNumber - 1) / shownCount) * talkLength - elapsedTime;
  const schedulePace = Math.abs(scheduleLead) < scheduleTolerance ? "even" : scheduleLead > 0 ? "ahead" : "behind";
  const progressStyle = {
    "--slides-share": shownCount > 1 ? Math.max(0, shownNumber - 1) / (shownCount - 1) : 1,
    "--time-share": talkLength === undefined ? 0 : Math.min(1, elapsedTime / talkLength),
  } as CSSProperties;

  const switchTimer = () => {
    const switchTime = Date.now();
    setCurrentTime(switchTime);
    setTimerState(isRunning ? { elapsedBeforeRun: elapsedTime } : { runningSince: switchTime, elapsedBeforeRun: elapsedTime });
  };

  return (
    <>
      <section data-presenter-timer aria-label={interfaceTexts.presenterTimerLabel}>
        <p data-presenter-schedule>
          {!hasStarted && <span>{interfaceTexts.presenterTimerWaiting}</span>}
          {hasStarted && timeLeft !== undefined && (
            <>
              <span data-presenter-time-left data-overtime={timeLeft < 0 || undefined}>
                {timeLeft < 0 ? interfaceTexts.presenterOvertime(formatDuration(-timeLeft)) : interfaceTexts.presenterTimeLeft(formatDuration(timeLeft))}
              </span>
              <span data-presenter-pace={schedulePace}>
                {schedulePace === "even"
                  ? interfaceTexts.presenterOnSchedule
                  : schedulePace === "ahead"
                    ? interfaceTexts.presenterAhead(formatDuration(scheduleLead))
                    : interfaceTexts.presenterBehind(formatDuration(-scheduleLead))}
              </span>
            </>
          )}
        </p>
        <div data-presenter-readings>
          <p data-presenter-elapsed data-running={isRunning || undefined}>
            {formatDuration(elapsedTime)}
          </p>
          <p data-presenter-clock aria-label={interfaceTexts.presenterClockLabel}>
            {new Date(currentTime).toLocaleTimeString(languageCode, { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div data-presenter-buttons>
          <button type="button" onPointerDown={keepFocus} onClick={switchTimer}>
            {isRunning ? interfaceTexts.presenterPauseTimer : interfaceTexts.presenterStartTimer}
          </button>
          <button type="button" onPointerDown={keepFocus} onClick={() => setTimerState(stoppedTimer)} disabled={!hasStarted}>
            {interfaceTexts.presenterResetTimer}
          </button>
        </div>
      </section>
      <div data-presenter-progress aria-hidden="true" style={progressStyle}>
        <span data-presenter-progress-slides />
        {talkLength !== undefined && <span data-presenter-progress-time />}
      </div>
    </>
  );
}

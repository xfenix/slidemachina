import type { CSSProperties, ReactNode } from "react";
import * as Machina from "slidemachina";

const LEAF_RUST = "#c2510f";
const LEAF_AMBER = "#d98e1b";
const LEAF_MAPLE = "#a8341f";
const LEAF_OLIVE = "#97801f";
const LEAF_BROWN = "#8a4b23";
const LAUNCH_WEEK_ROWS = [
  { launchWeek: "нед 1", newUsers: 1200 },
  { launchWeek: "нед 2", newUsers: 2800 },
  { launchWeek: "нед 3", newUsers: 5300 },
  { launchWeek: "нед 4", newUsers: 9100 },
];

const COLD_BOOT_SEGMENTS = [
  { segmentLabel: "образы 96с", segmentShare: 38, segmentFill: LEAF_MAPLE },
  { segmentLabel: "зависимости 71с", segmentShare: 28, segmentFill: LEAF_RUST },
  { segmentLabel: "база 58с", segmentShare: 23, segmentFill: LEAF_AMBER },
  { segmentLabel: "сеть 27с", segmentShare: 11, segmentFill: LEAF_OLIVE },
];
type FallingLeafConfig = {
  leafKey: string;
  leftOffset: string;
  leafSize: number;
  leafTint: string;
  leafOpacity: number;
  leafBlur: number;
  fallDuration: string;
  fallDelay: string;
  swayDuration: string;
  swayDelay: string;
  swayShift: string;
};

const LEAF_FALLING_CONFIGS: FallingLeafConfig[] = [
  { leafKey: "leaf-01", leftOffset: "6%", leafSize: 20, leafTint: LEAF_RUST, leafOpacity: 0.9, leafBlur: 0, fallDuration: "9.5s", fallDelay: "-2s", swayDuration: "3.1s", swayDelay: "-1s", swayShift: "30px" },
  { leafKey: "leaf-02", leftOffset: "13%", leafSize: 34, leafTint: LEAF_AMBER, leafOpacity: 0.8, leafBlur: 2, fallDuration: "12s", fallDelay: "-7s", swayDuration: "3.8s", swayDelay: "-2.4s", swayShift: "42px" },
  { leafKey: "leaf-03", leftOffset: "19%", leafSize: 16, leafTint: LEAF_MAPLE, leafOpacity: 0.95, leafBlur: 0, fallDuration: "8.4s", fallDelay: "-5s", swayDuration: "2.6s", swayDelay: "-0.6s", swayShift: "24px" },
  { leafKey: "leaf-04", leftOffset: "26%", leafSize: 26, leafTint: LEAF_AMBER, leafOpacity: 0.85, leafBlur: 0, fallDuration: "10.6s", fallDelay: "-9s", swayDuration: "3.4s", swayDelay: "-1.8s", swayShift: "36px" },
  { leafKey: "leaf-05", leftOffset: "33%", leafSize: 40, leafTint: LEAF_BROWN, leafOpacity: 0.7, leafBlur: 3, fallDuration: "13s", fallDelay: "-4s", swayDuration: "4.2s", swayDelay: "-3s", swayShift: "48px" },
  { leafKey: "leaf-06", leftOffset: "40%", leafSize: 18, leafTint: LEAF_OLIVE, leafOpacity: 0.9, leafBlur: 0, fallDuration: "9s", fallDelay: "-7.5s", swayDuration: "2.9s", swayDelay: "-1.2s", swayShift: "26px" },
  { leafKey: "leaf-07", leftOffset: "47%", leafSize: 30, leafTint: LEAF_MAPLE, leafOpacity: 0.8, leafBlur: 1, fallDuration: "11.4s", fallDelay: "-1s", swayDuration: "3.6s", swayDelay: "-2s", swayShift: "40px" },
  { leafKey: "leaf-08", leftOffset: "54%", leafSize: 15, leafTint: LEAF_AMBER, leafOpacity: 0.95, leafBlur: 0, fallDuration: "8s", fallDelay: "-3.4s", swayDuration: "2.5s", swayDelay: "-0.8s", swayShift: "22px" },
  { leafKey: "leaf-09", leftOffset: "61%", leafSize: 24, leafTint: LEAF_RUST, leafOpacity: 0.9, leafBlur: 0, fallDuration: "10s", fallDelay: "-6.2s", swayDuration: "3.2s", swayDelay: "-1.5s", swayShift: "32px" },
  { leafKey: "leaf-10", leftOffset: "68%", leafSize: 38, leafTint: LEAF_AMBER, leafOpacity: 0.7, leafBlur: 3, fallDuration: "12.6s", fallDelay: "-10s", swayDuration: "4s", swayDelay: "-2.8s", swayShift: "46px" },
  { leafKey: "leaf-11", leftOffset: "75%", leafSize: 17, leafTint: LEAF_BROWN, leafOpacity: 0.9, leafBlur: 0, fallDuration: "8.8s", fallDelay: "-4.6s", swayDuration: "2.7s", swayDelay: "-1s", swayShift: "25px" },
  { leafKey: "leaf-12", leftOffset: "82%", leafSize: 28, leafTint: LEAF_MAPLE, leafOpacity: 0.85, leafBlur: 1, fallDuration: "11s", fallDelay: "-8s", swayDuration: "3.5s", swayDelay: "-2.2s", swayShift: "38px" },
  { leafKey: "leaf-13", leftOffset: "89%", leafSize: 20, leafTint: LEAF_OLIVE, leafOpacity: 0.9, leafBlur: 0, fallDuration: "9.8s", fallDelay: "-0.6s", swayDuration: "3s", swayDelay: "-0.4s", swayShift: "28px" },
  { leafKey: "leaf-14", leftOffset: "95%", leafSize: 32, leafTint: LEAF_RUST, leafOpacity: 0.75, leafBlur: 2, fallDuration: "12.2s", fallDelay: "-5.6s", swayDuration: "3.9s", swayDelay: "-1.6s", swayShift: "44px" },
];
const BURST_SPIKE_COUNT = 14;
const BURST_VERTICES_PER_SPIKE = 2;
const BURST_OUTER_RADIUS = 96;
const BURST_INNER_RADIUS = 80;
const BURST_CENTER = 100;
// Negative so the first vertex points up, not right: the burst reads as a seal.
const BURST_START_ANGLE = -Math.PI / 2;
const BURST_POLYGON_POINTS = Array.from({ length: BURST_SPIKE_COUNT * BURST_VERTICES_PER_SPIKE }, (_, pointIndex) => {
  const pointRadius = pointIndex % BURST_VERTICES_PER_SPIKE === 0 ? BURST_OUTER_RADIUS : BURST_INNER_RADIUS;
  const pointAngle = (Math.PI * pointIndex) / BURST_SPIKE_COUNT + BURST_START_ANGLE;
  return `${(BURST_CENTER + pointRadius * Math.cos(pointAngle)).toFixed(1)},${(BURST_CENTER + pointRadius * Math.sin(pointAngle)).toFixed(1)}`;
}).join(" ");

export default (
  <Machina.Presentation title="Клен" lang="ru" date="2026-11-03">
    <Machina.Slide cover>
      <FallingLeaves />
      <div className="machina-freeform-full">
        <span className="autumn-sticker autumn-anim-slap" style={{ left: "8cqw", top: "6cqh", "--autumn-delay": "500ms" } as CSSProperties}>
          осень · 2026
        </span>
        <h1 className="autumn-cover-title autumn-anim-stamp">Клен</h1>
        <p className="autumn-cover-lead autumn-anim-stamp" style={{ "--autumn-delay": "140ms" } as CSSProperties}>
          локальная база знаний: всё живёт на вашем диске
        </p>
        <p className="autumn-command autumn-anim-stamp" style={{ left: "8cqw", top: "64cqh", "--autumn-delay": "260ms" } as CSSProperties}>
          <span className="autumn-command-prompt">$</span> klen init заметки
          <span className="autumn-cursor" />
        </p>

        <div className="autumn-chip autumn-anim-stamp" style={{ right: "8cqw", top: "36cqh", "--autumn-delay": "320ms" } as CSSProperties}>
          <span className="autumn-chip-icon" style={{ background: LEAF_AMBER }} />
          <span className="autumn-chip-name">поиск</span>
          <span className="autumn-chip-status">готов</span>
          <span className="autumn-chip-badge">0,3 с</span>
        </div>
        <div className="autumn-chip autumn-anim-stamp" style={{ right: "8cqw", top: "52cqh", "--autumn-delay": "420ms" } as CSSProperties}>
          <span className="autumn-chip-icon" style={{ background: LEAF_OLIVE }} />
          <span className="autumn-chip-name">индекс</span>
          <span className="autumn-chip-status">спит</span>
          <span className="autumn-chip-badge">12 400</span>
        </div>
        <div className="autumn-chip autumn-anim-stamp" style={{ right: "8cqw", top: "68cqh", "--autumn-delay": "520ms" } as CSSProperties}>
          <span className="autumn-chip-icon" style={{ background: LEAF_MAPLE }} />
          <span className="autumn-chip-name">заметки</span>
          <span className="autumn-chip-status">всегда дома</span>
          <span className="autumn-chip-badge">1 файл</span>
        </div>

        <AutumnBurst burstStyle={{ right: "8cqw", top: "6cqh", width: "15cqw", height: "15cqw", "--autumn-delay": "640ms" } as CSSProperties}>
          <span className="autumn-burst-top">0</span>
          <span className="autumn-burst-bottom">серверов</span>
        </AutumnBurst>
      </div>
      <Machina.Notes>
        <p>Поприветствуйте зал. Клен — база знаний без облака: три чипа справа — вся «инфраструктура».</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <div className="machina-freeform-full">
        <h2 className="autumn-tag">01 · боль</h2>
        <span className="autumn-sticker autumn-anim-slap" style={{ right: "8cqw", top: "6cqh", "--autumn-sticker-fill": LEAF_MAPLE, "--autumn-tilt": "3deg" } as CSSProperties}>
          каждое утро
        </span>

        <div className="autumn-window autumn-anim-stamp" style={{ left: "8cqw", top: "18cqh", width: "60cqw", height: "70cqh" }}>
          <div className="autumn-window-bar">
            <span className="autumn-window-dot" />
            <span className="autumn-window-dot" />
            <span className="autumn-window-dot" />
            <span className="autumn-window-title">облако · холодный старт</span>
          </div>
          <div className="autumn-window-body">
            <Machina.Code lang="bash">{`$ notes up
поднимаюсь… поднимаюсь…
синхронизирую 12 400 страниц
ищу сервер. сервер спит
готово. вы уже устали`}</Machina.Code>
            <div className="autumn-segment-row">
              {COLD_BOOT_SEGMENTS.map((bootSegment) => (
                <div
                  key={bootSegment.segmentLabel}
                  className="autumn-segment autumn-anim-grow-x"
                  data-step
                  data-step-effect="scale"
                  style={{ width: `${bootSegment.segmentShare}%`, background: bootSegment.segmentFill }}
                >
                  <span className="autumn-segment-label">{bootSegment.segmentLabel}</span>
                </div>
              ))}
            </div>
            <div className="autumn-segment-ticks">
              <span>0</span>
              <span>1 мин</span>
              <span>2 мин</span>
              <span>3 мин</span>
              <span>4 мин</span>
            </div>
            <p className="autumn-window-footnote">медиана 1 240 холодных запусков</p>
          </div>
        </div>

        <div className="autumn-side-number autumn-anim-stamp" style={{ right: "8cqw", top: "40cqh", "--autumn-delay": "300ms" } as CSSProperties}>
          04:12
          <span className="autumn-side-number-label">до первой заметки</span>
        </div>
      </div>
      <Machina.Notes>
        <p>Лог — шутка, не читайте. По шагам растёт полоса: куда уходят четыре минуты. Справа итог.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <div className="machina-freeform-full">
        <h2 className="autumn-tag">02 · счёт</h2>

        <div className="autumn-equation-box autumn-anim-stamp" style={{ left: "8cqw", top: "34cqh" }}>
          <span className="autumn-equation-big">5</span>
          <span className="autumn-equation-label">приложений</span>
        </div>
        <span className="autumn-operator autumn-anim-slap" style={{ left: "34cqw", top: "42cqh", "--autumn-delay": "150ms" } as CSSProperties}>
          ×
        </span>
        <div className="autumn-equation-box autumn-anim-stamp" style={{ left: "40cqw", top: "34cqh", "--autumn-delay": "220ms" } as CSSProperties}>
          <span className="autumn-equation-big">3</span>
          <span className="autumn-equation-label">устройства</span>
        </div>
        <span className="autumn-operator autumn-anim-slap" style={{ left: "64cqw", top: "42cqh", "--autumn-delay": "360ms" } as CSSProperties}>
          =
        </span>
        <div className="autumn-equation-box autumn-anim-stamp" style={{ left: "72cqw", top: "34cqh", "--autumn-delay": "430ms" } as CSSProperties}>
          <span className="autumn-equation-big">15</span>
          <span className="autumn-equation-label">копий хаоса</span>
        </div>

        <span className="autumn-sticker autumn-anim-slap" style={{ left: "8cqw", top: "74cqh", "--autumn-delay": "560ms" } as CSSProperties}>
          и ни одной правды
        </span>
      </div>
      <Machina.Notes>
        <p>Коробки штампуются по очереди: пять приложений на трёх устройствах. Пауза после знака равно.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <div className="machina-freeform-full">
        <h2 className="autumn-tag">03 · скорость</h2>

        <div className="autumn-speed-number autumn-anim-stamp" style={{ left: "8cqw", top: "24cqh" }}>
          0,3 с
        </div>
        <p className="autumn-speed-caption autumn-anim-stamp" style={{ left: "8cqw", top: "56cqh", "--autumn-delay": "160ms" } as CSSProperties}>
          до первого результата
        </p>

        <div className="autumn-speed-row autumn-anim-grow-x" style={{ left: "48cqw", top: "34cqh", width: "44cqw", "--autumn-duration": "700ms" } as CSSProperties}>
          <div className="autumn-speed-row-label">
            <span>облако</span>
            <span>12 с</span>
          </div>
          <div className="autumn-track">
            <div className="autumn-track-fill" style={{ width: "100%", background: "#33261a" }} />
          </div>
        </div>
        <div className="autumn-speed-row autumn-anim-grow-x" style={{ left: "48cqw", top: "54cqh", width: "44cqw", "--autumn-delay": "220ms", "--autumn-duration": "700ms" } as CSSProperties}>
          <div className="autumn-speed-row-label">
            <span>клен</span>
            <span>0,3 с</span>
          </div>
          <div className="autumn-track">
            <div className="autumn-track-fill" style={{ width: "3%", background: LEAF_RUST }} />
          </div>
        </div>

        <AutumnBurst burstStyle={{ right: "8cqw", top: "6cqh", width: "16cqw", height: "16cqw", "--autumn-sticker-fill": LEAF_AMBER, "--autumn-delay": "500ms" } as CSSProperties}>
          <span className="autumn-burst-top">1 240</span>
          <span className="autumn-burst-bottom">поисков · медиана</span>
        </AutumnBurst>
      </div>
      <Machina.Notes>
        <p>Полоса «клен» едва видна — в этом весь смысл. Цифра слева крупная, читать вслух не нужно.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <div className="machina-freeform-full">
        <h2 className="autumn-tag">04 · всё дома</h2>
        <span className="autumn-sticker autumn-anim-slap" style={{ right: "8cqw", top: "6cqh", "--autumn-tilt": "2deg" } as CSSProperties}>
          облако не нужно
        </span>

        <div className="autumn-drawer autumn-anim-stamp" style={{ left: "8cqw", top: "42cqh", "--autumn-delay": "100ms" } as CSSProperties}>
          <span className="autumn-drawer-handle" />
          <span className="autumn-drawer-name">входящие</span>
          <span className="autumn-drawer-count">128 заметок ждут разбора</span>
        </div>
        <svg className="autumn-flow-arrow" style={{ left: "31cqw", top: "50cqh" }} viewBox="0 0 100 40" aria-hidden>
          <path d="M4 20 H 82 M 74 10 L 84 20 L 74 30" fill="none" />
        </svg>
        <div className="autumn-drawer autumn-anim-stamp" style={{ left: "40cqw", top: "42cqh", "--autumn-delay": "240ms" } as CSSProperties}>
          <span className="autumn-drawer-handle" />
          <span className="autumn-drawer-name">индекс смыслов</span>
          <span className="autumn-drawer-count">читает всё ночью</span>
        </div>
        <svg className="autumn-flow-arrow" style={{ left: "63cqw", top: "50cqh" }} viewBox="0 0 100 40" aria-hidden>
          <path d="M4 20 H 82 M 74 10 L 84 20 L 74 30" fill="none" />
        </svg>
        <div className="autumn-drawer autumn-anim-stamp" style={{ left: "72cqw", top: "42cqh", "--autumn-delay": "380ms" } as CSSProperties}>
          <span className="autumn-drawer-handle" />
          <span className="autumn-drawer-name">архив</span>
          <span className="autumn-drawer-count">один klen-файл</span>
        </div>
      </div>
      <Machina.Notes>
        <p>Комод вместо схемы: заметки падают в ящики, стрелки — поток. Ничего не уходит наружу.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <div className="machina-freeform-full">
        <h2 className="autumn-tag">05 · поиск понимает</h2>

        <div className="autumn-window autumn-anim-stamp" style={{ left: "8cqw", top: "18cqh", width: "62cqw", height: "62cqh" }}>
          <div className="autumn-window-bar">
            <span className="autumn-window-dot" />
            <span className="autumn-window-dot" />
            <span className="autumn-window-dot" />
            <span className="autumn-window-title">klen ask «бюджет на ноябрь»</span>
          </div>
          <div className="autumn-window-body">
            <p className="autumn-window-query">
              <span className="autumn-command-prompt">→</span> ищу смысл, не слова
              <span className="autumn-cursor" />
            </p>
            <div className="autumn-result" data-step data-step-effect="scale">
              <span className="autumn-result-title">
                план: <span className="autumn-mark">бюджет</span> на ноябрь
              </span>
              <span className="autumn-result-note">заметка от вчера</span>
            </div>
            <div className="autumn-result" data-step data-step-effect="scale">
              <span className="autumn-result-title">
                октябрь: куда ушли <span className="autumn-mark">деньги</span>
              </span>
              <span className="autumn-result-note">слово «ноябрь» не встречается</span>
            </div>
            <div className="autumn-result" data-step data-step-effect="scale">
              <span className="autumn-result-title">
                декабрь: <span className="autumn-mark">подарки</span>, поход
              </span>
              <span className="autumn-result-note">про запас</span>
            </div>
            <p className="autumn-window-footnote">дословных совпадений нет</p>
          </div>
        </div>

        <span className="autumn-sticker autumn-anim-slap" style={{ right: "8cqw", top: "36cqh", "--autumn-sticker-fill": LEAF_OLIVE, "--autumn-tilt": "-3deg" } as CSSProperties}>
          ищет смысл, а не слова
        </span>
      </div>
      <Machina.Notes>
        <p>Три результата по шагам. Второй — главный: слова «ноябрь» в нём нет, смысл есть.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <div className="machina-freeform-full">
        <h2 className="autumn-tag">06 · один файл</h2>

        <div className="autumn-file autumn-anim-stamp" style={{ left: "8cqw", top: "28cqh" }}>
          <span className="autumn-file-tab" />
          <span className="autumn-file-name">заметки.klen</span>
          <span className="autumn-file-line" style={{ width: "86%" }} />
          <span className="autumn-file-line" style={{ width: "64%" }} />
          <span className="autumn-file-line" style={{ width: "74%" }} />
          <span className="autumn-file-line" style={{ width: "42%" }} />
        </div>
        <span className="autumn-sticker autumn-anim-slap" style={{ left: "34cqw", top: "26cqh", "--autumn-sticker-fill": LEAF_MAPLE, "--autumn-tilt": "8deg", "--autumn-delay": "300ms" } as CSSProperties}>
          ваше
        </span>

        <div className="autumn-spec autumn-anim-stamp" style={{ left: "60cqw", top: "32cqh", "--autumn-delay": "160ms" } as CSSProperties}>
          <span className="autumn-spec-value">84 МБ</span>
          <span className="autumn-spec-label">вся база</span>
        </div>
        <div className="autumn-spec autumn-anim-stamp" style={{ left: "60cqw", top: "50cqh", "--autumn-delay": "280ms" } as CSSProperties}>
          <span className="autumn-spec-value">12 400</span>
          <span className="autumn-spec-label">страниц внутри</span>
        </div>
        <div className="autumn-spec autumn-anim-stamp" style={{ left: "60cqw", top: "68cqh", "--autumn-delay": "400ms" } as CSSProperties}>
          <span className="autumn-spec-value">0,3 с</span>
          <span className="autumn-spec-label">до ответа</span>
        </div>
      </div>
      <Machina.Notes>
        <p>Папка с документом — вся инфраструктура. Наклейка «ваше»: файл лежит у пользователя, а не у нас.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <div className="machina-freeform-full">
        <h2 className="autumn-tag">07 · четыре недели</h2>
        <span className="autumn-sticker autumn-anim-slap" style={{ right: "8cqw", top: "6cqh", "--autumn-sticker-fill": LEAF_MAPLE, "--autumn-tilt": "3deg" } as CSSProperties}>
          сарафан включился
        </span>

        <div className="autumn-bars">
          {LAUNCH_WEEK_ROWS.map((launchWeek, weekIndex) => (
            <div key={launchWeek.launchWeek} className="autumn-bar">
              <span className="autumn-bar-value">{launchWeek.newUsers.toLocaleString("ru-RU")}</span>
              <div className="autumn-bar-track">
                <div
                  className="autumn-bar-fill autumn-anim-grow-y"
                  data-step
                  data-step-effect="scale"
                  style={{ height: `${(launchWeek.newUsers / 9100) * 100}%`, "--autumn-delay": `${weekIndex * 120}ms` } as CSSProperties}
                />
              </div>
              <span className="autumn-bar-label">{launchWeek.launchWeek}</span>
            </div>
          ))}
        </div>
      </div>
      <Machina.Notes>
        <p>Столбики растут по шагам, как теплица. Цифры — новые пользователи, данные учебные.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <div className="machina-freeform-full">
        <h2 className="autumn-tag">08 · планы</h2>

        <div className="machina-card autumn-ticket autumn-anim-stamp" style={{ left: "8cqw", top: "32cqh" }}>
          <div className="autumn-ticket-stub">
            <span>билет</span>
            <span>01</span>
          </div>
          <div className="autumn-ticket-body">
            <span className="autumn-ticket-season">2026 · осень</span>
            <span className="autumn-ticket-plan">синхронизация между устройствами</span>
          </div>
        </div>
        <div className="machina-card autumn-ticket autumn-anim-stamp" style={{ left: "52cqw", top: "32cqh", "--autumn-delay": "200ms" } as CSSProperties}>
          <div className="autumn-ticket-stub">
            <span>билет</span>
            <span>02</span>
          </div>
          <div className="autumn-ticket-body">
            <span className="autumn-ticket-season">2027 · зима</span>
            <span className="autumn-ticket-plan">совместные пространства</span>
          </div>
        </div>
      </div>
      <Machina.Notes>
        <p>Два билета на сезоны. Следующий слайд перетечёт в них морфингом.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <div className="machina-freeform-full">
        <h2 className="autumn-tag">08 · планы</h2>

        <div className="machina-card autumn-ticket" style={{ left: "8cqw", top: "32cqh" }}>
          <div className="autumn-ticket-stub">
            <span>билет</span>
            <span>01</span>
          </div>
          <div className="autumn-ticket-body">
            <span className="autumn-ticket-season">2026 · осень</span>
            <span className="autumn-ticket-plan">синхронизация между устройствами</span>
          </div>
        </div>
        <div className="machina-card autumn-ticket" style={{ left: "52cqw", top: "32cqh" }}>
          <div className="autumn-ticket-stub">
            <span>билет</span>
            <span>02</span>
          </div>
          <div className="autumn-ticket-body">
            <span className="autumn-ticket-season">2027 · весна</span>
            <span className="autumn-ticket-plan">плагины от сообщества</span>
          </div>
        </div>
      </div>
      <Machina.Notes>
        <p>Билеты перетекли сами: общие теги нашлись без разметки. Поменялся только второй.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <div className="machina-freeform-full">
        <h2 className="autumn-tag">09 · краски</h2>
        <span className="autumn-sticker autumn-anim-slap" style={{ right: "8cqw", top: "12cqh" }}>
          тема = переменные
        </span>

        <div className="autumn-swatch autumn-anim-stamp" style={{ left: "8cqw", top: "28cqh", "--autumn-tilt": "-5deg", "--swatch-color": "#f6efe1" } as CSSProperties}>
          <span className="autumn-swatch-color" />
          <span className="autumn-swatch-name">бумага</span>
          <span className="autumn-swatch-hex">#F6EFE1</span>
        </div>
        <div className="autumn-swatch autumn-anim-stamp" style={{ left: "30cqw", top: "48cqh", "--autumn-tilt": "3deg", "--swatch-color": "#c2510f", "--autumn-delay": "140ms" } as CSSProperties}>
          <span className="autumn-swatch-color" />
          <span className="autumn-swatch-name">ржавчина</span>
          <span className="autumn-swatch-hex">#C2510F</span>
        </div>
        <div className="autumn-swatch autumn-anim-stamp" style={{ left: "52cqw", top: "28cqh", "--autumn-tilt": "-2deg", "--swatch-color": "#97801f", "--autumn-delay": "240ms" } as CSSProperties}>
          <span className="autumn-swatch-color" />
          <span className="autumn-swatch-name">олива</span>
          <span className="autumn-swatch-hex">#97801F</span>
        </div>
        <div className="autumn-swatch autumn-anim-stamp" style={{ left: "74cqw", top: "48cqh", "--autumn-tilt": "6deg", "--swatch-color": "#33261a", "--autumn-delay": "340ms" } as CSSProperties}>
          <span className="autumn-swatch-color" />
          <span className="autumn-swatch-name">кора</span>
          <span className="autumn-swatch-hex">#33261A</span>
        </div>
      </div>
      <Machina.Notes>
        <p>Четыре образца краски — вся тема. Каждый штампуется со сдвигом, как из пробирки.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <FallingLeaves />
      <div className="machina-freeform-full">
        <h2 className="autumn-tag">10 · листопад</h2>
        <span className="autumn-sticker autumn-anim-slap" style={{ left: "39cqw", top: "8cqh", "--autumn-tilt": "2deg" } as CSSProperties}>
          14 листьев · чистый css
        </span>

        <div className="autumn-leaf-hero" />

        <span className="autumn-callout autumn-anim-stamp" style={{ left: "8cqw", top: "22cqh", "--autumn-delay": "150ms" } as CSSProperties}>
          два скруглённых угла
        </span>
        <span className="autumn-callout autumn-anim-stamp" style={{ right: "8cqw", top: "22cqh", "--autumn-delay": "260ms" } as CSSProperties}>
          черешок — палочка сверху
        </span>
        <span className="autumn-callout autumn-anim-stamp" style={{ left: "8cqw", top: "72cqh", "--autumn-delay": "370ms" } as CSSProperties}>
          качание внутри падения
        </span>
        <span className="autumn-callout autumn-anim-stamp" style={{ right: "8cqw", top: "72cqh", "--autumn-delay": "480ms" } as CSSProperties}>
          размытие — дальний план
        </span>

        <svg className="autumn-anatomy" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d="M30 28 L 45 42" />
          <path d="M70 28 L 59 40" />
          <path d="M30 73 L 45 58" />
          <path d="M70 73 L 59 58" />
        </svg>
      </div>
      <Machina.Notes>
        <p>За окном этих подписей идёт настоящий листопад — слайд разбирает сам себя.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <FallingLeaves />
      <div className="machina-freeform-full">
        <div className="autumn-note autumn-anim-slap">
          <p>«Хороший интерфейс как октябрь: тёплый, тихий и без суеты»</p>
          <p className="autumn-note-sign">— команда клена</p>
        </div>
      </div>
      <Machina.Notes>
        <p>Цитата на стикере. Листопад за окном продолжается.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide background="var(--accent-color)" transition="fade">
      <p className="machina-thesis">Данные растут быстрее там, где живут</p>
      <Machina.Notes>
        <p>Одна мысль на весь слайд. Пауза после неё — секунды две.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <FallingLeaves />
      <div className="machina-freeform-full">
        <h1 className="autumn-cover-title autumn-thanks-title autumn-anim-stamp">Спасибо</h1>

        <div className="autumn-thanks-qr autumn-anim-stamp" style={{ "--autumn-delay": "180ms" } as CSSProperties}>
          <Machina.QR value="https://github.com/xfenix/slidemachina" color="#33261a">
            <figcaption>репозиторий движка</figcaption>
          </Machina.QR>
        </div>

        <p className="autumn-command autumn-anim-stamp" style={{ left: "48cqw", top: "52cqh", "--autumn-delay": "300ms" } as CSSProperties}>
          <span className="autumn-command-prompt">$</span> npm i -g klen
          <span className="autumn-cursor" />
        </p>
        <span className="autumn-sticker autumn-anim-slap" style={{ left: "48cqw", top: "36cqh", "--autumn-tilt": "-2deg", "--autumn-delay": "420ms" } as CSSProperties}>
          забрать тему: style.css
        </span>
        <p className="autumn-thanks-note autumn-anim-stamp" style={{ left: "48cqw", top: "68cqh", "--autumn-delay": "520ms" } as CSSProperties}>
          бумага, ржавчина и листопад — одна тема
        </p>
      </div>
      <Machina.Notes>
        <p>Поблагодарите зал, покажите QR и команду установки.</p>
      </Machina.Notes>
    </Machina.Slide>
  </Machina.Presentation>
);

function FallingLeaves() {
  return (
    <div className="autumn-leaf-layer" aria-hidden>
      {LEAF_FALLING_CONFIGS.map((leafConfig) => (
        <span
          key={leafConfig.leafKey}
          className="autumn-leaf-fall"
          style={{
            left: leafConfig.leftOffset,
            width: leafConfig.leafSize,
            height: leafConfig.leafSize,
            animationDelay: leafConfig.fallDelay,
            animationDuration: leafConfig.fallDuration,
          }}
        >
          <span
            className="autumn-leaf-sway"
            style={
              {
                opacity: leafConfig.leafOpacity,
                filter: leafConfig.leafBlur > 0 ? `blur(${leafConfig.leafBlur}px)` : undefined,
                animationDelay: leafConfig.swayDelay,
                animationDuration: leafConfig.swayDuration,
                "--leaf-tint": leafConfig.leafTint,
                "--leaf-sway-shift": leafConfig.swayShift,
              } as CSSProperties
            }
          />
        </span>
      ))}
    </div>
  );
}

function AutumnBurst({ burstStyle, children }: { burstStyle?: CSSProperties; children: ReactNode }) {
  return (
    <div className="autumn-burst" style={burstStyle}>
      <svg viewBox="0 0 200 200" aria-hidden>
        <polygon points={BURST_POLYGON_POINTS} className="autumn-burst-shadow" transform="translate(6 7)" />
        <polygon points={BURST_POLYGON_POINTS} className="autumn-burst-shape" />
      </svg>
      <div className="autumn-burst-label">{children}</div>
    </div>
  );
}

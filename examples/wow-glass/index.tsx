import type { CSSProperties } from "react";
import * as Machina from "slidemachina";

const GLASS_VIOLET = "#7c5cff";
const GLASS_CYAN = "#35e0ff";
const GLASS_MAGENTA = "#ff6ec7";
const GLASS_AMBER = "#ffc24b";
const ROLE_CARDS = [
  { roleLabel: "основной", roleGradient: `linear-gradient(135deg, ${GLASS_VIOLET}, ${GLASS_MAGENTA})` },
  { roleLabel: "фон", roleGradient: `linear-gradient(135deg, #1a2148, #0d1129)` },
  { roleLabel: "текст", roleGradient: `linear-gradient(135deg, #f5f7ff, #c9d2ff)` },
  { roleLabel: "состояния", roleGradient: `linear-gradient(135deg, ${GLASS_CYAN}, ${GLASS_AMBER})` },
];
const SPEED_BARS = [
  { barLabel: "поиск ролей", barWidth: "40%", barTint: `linear-gradient(90deg, ${GLASS_VIOLET}, ${GLASS_MAGENTA})` },
  { barLabel: "проверка контраста", barWidth: "72%", barTint: `linear-gradient(90deg, ${GLASS_VIOLET}, ${GLASS_CYAN})` },
  { barLabel: "экспорт токенов", barWidth: "100%", barTint: `linear-gradient(90deg, ${GLASS_CYAN}, ${GLASS_AMBER})` },
];
const SPEC_CARDS = [
  { specHeading: "OKLCH", specText: "ровные шаги яркости по восприятию, не по цифрам", specTint: GLASS_VIOLET },
  { specHeading: "canvas", specText: "палитра рисуется без мерцаний и пересборок", specTint: GLASS_CYAN },
  { specHeading: "40 мс", specText: "экспорт токенов во все форматы сразу", specTint: GLASS_MAGENTA },
  { specHeading: "офлайн", specText: "вся работа — в браузере, ничего не уходит", specTint: GLASS_AMBER },
];
const STAT_CARDS = [
  { statNumber: "12 400", statLabel: "палитр за запуск", statTint: GLASS_VIOLET },
  { statNumber: "98%", statLabel: "контраст без ручных правок", statTint: GLASS_CYAN },
  { statNumber: "4,9", statLabel: "оценка пользователей", statTint: GLASS_MAGENTA },
  { statNumber: "0", statLabel: "серверов — всё локально", statTint: GLASS_AMBER },
];
const ROADMAP_STOPS = [
  { stopQuarter: "Q4 2026", stopText: "плагин для figma", stopTint: GLASS_VIOLET },
  { stopQuarter: "Q1 2027", stopText: "живые темы: светлая следует тёмной", stopTint: GLASS_CYAN },
  { stopQuarter: "Q2 2027", stopText: "пространства для команд", stopTint: GLASS_MAGENTA },
  { stopQuarter: "Q3 2027", stopText: "self-hosted для внутренних сетей", stopTint: GLASS_AMBER },
];
const PRICING_PLANS = [
  { planName: "соло", planPrice: "0 ₽", planLine: "один проект · всё необходимое" },
  { planName: "студия", planPrice: "1 900 ₽", planLine: "команда · общие палитры · история" },
  { planName: "цех", planPrice: "6 900 ₽", planLine: "безлимит · приоритет · обучение" },
];

export default (
  <Machina.Presentation title="Витраж" lang="ru" date="2026-11-04">
    <Machina.Slide cover>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">стекло · 2026</p>
        <div className="glass-pane glass-hero glass-anim-rise" style={{ "--glass-delay": "80ms" } as CSSProperties} />
        <h1 className="glass-cover-title">Витраж</h1>
        <p className="glass-cover-lead glass-anim-rise" style={{ "--glass-delay": "220ms" } as CSSProperties}>
          цветовые системы из одного оттенка — прямо в браузере
        </p>
        <p className="glass-command glass-anim-rise" style={{ left: "8cqw", top: "66cqh", "--glass-delay": "340ms" } as CSSProperties}>
          <span className="glass-command-prompt">$</span> vitraz init brand
          <span className="glass-cursor" />
        </p>
        <div className="glass-pane glass-float glass-anim-pop" style={{ left: "60cqw", top: "22cqh", width: "10cqw", height: "14cqh", "--glass-tilt": "7deg", "--glass-delay": "480ms" } as CSSProperties} />
        <div className="glass-pane glass-float glass-anim-pop" style={{ left: "56cqw", top: "58cqh", width: "8cqw", height: "10cqh", "--glass-tilt": "-6deg", "--glass-delay": "560ms" } as CSSProperties} />
        <div className="glass-chip glass-anim-rise" style={{ top: "36cqh", "--glass-delay": "420ms" } as CSSProperties}>
          <span className="glass-chip-dot" style={{ "--chip-tint": GLASS_VIOLET } as CSSProperties} />
          <span className="glass-chip-name">палитра</span>
          <span className="glass-chip-value">из 1 цвета</span>
        </div>
        <div className="glass-chip glass-anim-rise" style={{ top: "52cqh", "--glass-delay": "500ms" } as CSSProperties}>
          <span className="glass-chip-dot" style={{ "--chip-tint": GLASS_CYAN } as CSSProperties} />
          <span className="glass-chip-name">контраст</span>
          <span className="glass-chip-value">4.5 : 1</span>
        </div>
        <div className="glass-chip glass-anim-rise" style={{ top: "68cqh", "--glass-delay": "580ms" } as CSSProperties}>
          <span className="glass-chip-dot" style={{ "--chip-tint": GLASS_AMBER } as CSSProperties} />
          <span className="glass-chip-name">токены</span>
          <span className="glass-chip-value">css · json</span>
        </div>
      </div>
      <Machina.Notes>
        <p>Название читается через стеклянную плашку: за ней плавают сферы. Скажите, что это не картинка, а живая тема style.css.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">01 · боль</p>
        <div className="glass-pane glass-anim-rise" style={{ left: "8cqw", top: "26cqh", width: "26cqw", height: "34cqh", "--glass-tilt": "-3deg" } as CSSProperties}>
          <p className="glass-shard-text">
            <span className="glass-shard-index">разъезд</span>
            палитры плывут между макетом и кодом
          </p>
        </div>
        <div className="glass-pane glass-anim-rise" style={{ left: "37cqw", top: "36cqh", width: "26cqw", height: "34cqh", "--glass-tilt": "2deg", "--glass-delay": "120ms" } as CSSProperties}>
          <p className="glass-shard-text">
            <span className="glass-shard-index">контраст</span>
            ловят на ревью за неделю до релиза
          </p>
        </div>
        <div className="glass-pane glass-anim-rise" style={{ left: "66cqw", top: "24cqh", width: "26cqw", height: "34cqh", "--glass-tilt": "-2deg", "--glass-delay": "240ms" } as CSSProperties}>
          <p className="glass-shard-text">
            <span className="glass-shard-index">токены</span>
            правят руками в пяти файлах сразу
          </p>
        </div>
      </div>
      <Machina.Notes>
        <p>Три осколка — три жалобы дизайнеров. Пауза между ними: пусть зал узнает свою боль.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">02 · как работает</p>
        <div className="glass-pane glass-flow glass-anim-rise" style={{ left: "8cqw", top: "34cqh", width: "20cqw", height: "32cqh", alignItems: "center", justifyContent: "center" }}>
          <span className="glass-chip-dot" style={{ "--chip-tint": GLASS_VIOLET, width: "4cqw", height: "4cqw" } as CSSProperties} />
          <p className="glass-card-text" style={{ textAlign: "center" }}>ваш оттенок</p>
        </div>
        <div className="glass-arrow" style={{ left: "30cqw", width: "6cqw", top: "50cqh" }} />
        <div className="glass-pane glass-flow glass-anim-rise" style={{ left: "40cqw", top: "30cqh", width: "52cqw", height: "40cqh", justifyContent: "center", "--glass-delay": "160ms" } as CSSProperties}>
          <div className="glass-scale-stripe" data-step data-step-effect="scale" style={{ background: `linear-gradient(90deg, ${GLASS_VIOLET}, ${GLASS_MAGENTA})` }} />
          <div className="glass-scale-stripe" data-step data-step-effect="scale" style={{ background: `linear-gradient(90deg, ${GLASS_MAGENTA}, ${GLASS_AMBER})`, opacity: 0.85 }} />
          <div className="glass-scale-stripe" data-step data-step-effect="scale" style={{ background: `linear-gradient(90deg, ${GLASS_AMBER}, ${GLASS_CYAN})`, opacity: 0.7 }} />
          <div className="glass-scale-stripe" data-step data-step-effect="scale" style={{ background: `linear-gradient(90deg, ${GLASS_CYAN}, ${GLASS_VIOLET})`, opacity: 0.55 }} />
        </div>
        <p className="glass-thanks-note glass-anim-rise" style={{ left: "8cqw", top: "80cqh", width: "28cqw", "--glass-delay": "300ms" } as CSSProperties}>
          один оттенок разворачивается в систему из двенадцати ролей
        </p>
      </div>
      <Machina.Notes>
        <p>Слева вход — один цвет. Справа по шагам раскрывается шкала. Стрелка на сетке: 30cqw, вертикаль 50cqh.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">03 · скорость</p>
        <p className="glass-speed-number glass-anim-rise" style={{ "--glass-delay": "100ms" } as CSSProperties}>0,4 с</p>
        <p className="glass-speed-caption glass-anim-rise" style={{ "--glass-delay": "220ms" } as CSSProperties}>
          среднее время сборки палитры из одного цвета
        </p>
        <div className="glass-pane glass-flow glass-anim-rise" style={{ left: "40cqw", top: "28cqh", width: "52cqw", height: "44cqh", justifyContent: "center", "--glass-delay": "160ms" } as CSSProperties}>
          {SPEED_BARS.map((speedBar) => (
            <div className="glass-bar-row" key={speedBar.barLabel} data-step data-step-effect="scale">
              <div className="glass-bar-label">
                <span>{speedBar.barLabel}</span>
                <span>{speedBar.barWidth}</span>
              </div>
              <div className="glass-bar-track">
                <div className="glass-bar-fill" style={{ width: speedBar.barWidth, background: speedBar.barTint }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <Machina.Notes>
        <p>Цифра слева крупно, полосы справа растут по шагам. Сравните с временем заварки кофе.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">04 · палитра</p>
        <p className="glass-thanks-note glass-anim-rise" style={{ left: "8cqw", top: "22cqh", width: "60cqw" }}>
          каждый цвет занимает свою роль и держит её
        </p>
        {ROLE_CARDS.map((roleCard, cardIndex) => (
          <div
            className="glass-pane glass-flow glass-anim-pop"
            data-step
            data-step-effect="scale"
            key={roleCard.roleLabel}
            style={{ left: `${8 + cardIndex * 22}cqw`, top: "34cqh", width: "18cqw", height: "38cqh" }}
          >
            <div className="glass-role-gradient" style={{ background: roleCard.roleGradient }} />
            <p className="glass-role-label">{roleCard.roleLabel}</p>
          </div>
        ))}
      </div>
      <Machina.Notes>
        <p>Четыре роли на сетке 8 / 30 / 52 / 74. Лепестки раскрываются по шагам.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">05 · контраст</p>
        <div className="glass-pane glass-contrast-dark glass-anim-rise" style={{ left: "8cqw", top: "30cqh", width: "40cqw", height: "40cqh" }}>
          <p className="glass-contrast-ratio">15.8 : 1</p>
          <p className="glass-contrast-name">тёмная тема, текст на фоне</p>
          <span className="glass-badge">AAA</span>
        </div>
        <div className="glass-pane glass-contrast-light glass-anim-rise" style={{ left: "52cqw", top: "30cqh", width: "40cqw", height: "40cqh", "--glass-delay": "140ms" } as CSSProperties}>
          <p className="glass-contrast-ratio">7.2 : 1</p>
          <p className="glass-contrast-name">светлая тема, текст на фоне</p>
          <span className="glass-badge">AAA</span>
        </div>
        <p className="glass-thanks-note glass-anim-rise" style={{ left: "8cqw", top: "78cqh", width: "70cqw", "--glass-delay": "260ms" } as CSSProperties}>
          пары проверены по WCAG до того, как вы их увидите
        </p>
      </div>
      <Machina.Notes>
        <p>Тёмная и светлая пары стоят рядом на одной линии 30cqh. Обе со значком AAA.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">06 · токены</p>
        <div className="glass-pane glass-anim-rise" style={{ left: "8cqw", top: "26cqh", width: "56cqw", height: "38cqh", "--glass-delay": "80ms" } as CSSProperties}>
          <div className="glass-terminal">
            <Machina.Code lang="css">{`:root {
  --brand: #7c5cff;
  --brand-text: #ffffff;
  --surface: #0a0e1f;
}`}</Machina.Code>
          </div>
        </div>
        {["css", "json", "figma"].map((tokenFormat, formatIndex) => (
          <div
            className="glass-chip glass-anim-rise"
            key={tokenFormat}
            style={{ left: "68cqw", right: "auto", top: `${32 + formatIndex * 16}cqh`, width: "24cqw", "--glass-delay": `${300 + formatIndex * 90}ms` } as CSSProperties}
          >
            <span className="glass-chip-dot" style={{ "--chip-tint": [GLASS_CYAN, GLASS_MAGENTA, GLASS_AMBER][formatIndex] } as CSSProperties} />
            <span className="glass-chip-name">{tokenFormat}</span>
            <span className="glass-chip-value">→</span>
          </div>
        ))}
      </div>
      <Machina.Notes>
        <p>Терминал слева, форматы справа колонкой на 68/32/... — вертикаль 32, 48, 64.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">07 · устройство</p>
        {SPEC_CARDS.map((specCard, cardIndex) => (
          <div
            className="glass-pane glass-flow glass-anim-rise"
            key={specCard.specHeading}
            style={{ left: `${8 + cardIndex * 22}cqw`, top: "30cqh", width: "18cqw", height: "38cqh", "--glass-delay": `${cardIndex * 110}ms` } as CSSProperties}
          >
            <p className="glass-card-heading" style={{ "--chip-tint": specCard.specTint } as CSSProperties}>{specCard.specHeading}</p>
            <p className="glass-card-text">{specCard.specText}</p>
          </div>
        ))}
      </div>
      <Machina.Notes>
        <p>Четыре карточки технологий на общей сетке 8 / 30 / 52 / 74, вертикаль 30.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">08 · интеграции</p>
        <div className="glass-orbit-ring" />
        <div className="glass-hub glass-anim-pop" style={{ "--glass-delay": "120ms" } as CSSProperties}>Витраж</div>
        <div className="glass-satellite glass-anim-pop" data-step data-step-effect="scale" style={{ left: "22cqw", top: "22cqh" }}>figma</div>
        <div className="glass-satellite glass-anim-pop" data-step data-step-effect="scale" style={{ left: "64cqw", top: "26cqh" }}>vscode</div>
        <div className="glass-satellite glass-anim-pop" data-step data-step-effect="scale" style={{ left: "24cqw", top: "62cqh" }}>npm</div>
        <div className="glass-satellite glass-anim-pop" data-step data-step-effect="scale" style={{ left: "62cqw", top: "64cqh" }}>github</div>
        <p className="glass-thanks-note glass-anim-rise" style={{ left: "8cqw", top: "82cqh", width: "60cqw", "--glass-delay": "300ms" } as CSSProperties}>
          цвет сам уходит в инструменты команды
        </p>
      </div>
      <Machina.Notes>
        <p>Хаб в центре кольца, спутники появляются по шагам. Кольцо пунктирное, на весу.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">09 · планы</p>
        <div className="glass-rail" />
        {ROADMAP_STOPS.map((roadmapStop, stopIndex) => (
          <div key={roadmapStop.stopQuarter}>
            <span className="glass-stop-dot" style={{ left: `${8 + stopIndex * 24}cqw`, "--stop-tint": roadmapStop.stopTint } as CSSProperties} />
            <div
              className="glass-pane glass-flow glass-anim-rise"
              style={{ left: `${8 + stopIndex * 24}cqw`, top: stopIndex % 2 === 0 ? "58cqh" : "22cqh", width: "20cqw", height: "20cqh", "--glass-delay": `${stopIndex * 120}ms` } as CSSProperties}
            >
              <p className="glass-stop-quarter" style={{ "--stop-tint": roadmapStop.stopTint } as CSSProperties}>{roadmapStop.stopQuarter}</p>
              <p className="glass-stop-text">{roadmapStop.stopText}</p>
            </div>
          </div>
        ))}
      </div>
      <Machina.Notes>
        <p>Рельса на 50cqh, остановки через 24cqw: 8 / 32 / 56 / 80. Панели чередуются выше и ниже рельсы.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">10 · тарифы</p>
        <span className="glass-sticker glass-anim-slap" style={{ left: "36cqw", top: "20cqh" }}>выбирают чаще</span>
        {PRICING_PLANS.map((pricingPlan, planIndex) => (
          <div
            className={`glass-pane glass-flow glass-anim-rise${planIndex === 1 ? " glass-pane-hot" : ""}`}
            key={pricingPlan.planName}
            style={{ left: `${8 + planIndex * 28}cqw`, top: "28cqh", width: "24cqw", height: "52cqh", justifyContent: "center", gap: "2cqh", "--glass-delay": `${planIndex * 120}ms` } as CSSProperties}
          >
            <p className="glass-price-name" style={{ "--chip-tint": [GLASS_CYAN, GLASS_VIOLET, GLASS_MAGENTA][planIndex] } as CSSProperties}>{pricingPlan.planName}</p>
            <p className="glass-price-value">{pricingPlan.planPrice}</p>
            <p className="glass-price-line">{pricingPlan.planLine}</p>
          </div>
        ))}
      </div>
      <Machina.Notes>
        <p>Три панели на 8 / 36 / 64, средняя ярче и с наклейкой на шапке 20cqh.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">11 · цифры</p>
        {STAT_CARDS.map((statCard, cardIndex) => (
          <div
            className="glass-pane glass-flow glass-anim-rise"
            key={statCard.statNumber}
            style={{ left: `${8 + cardIndex * 22}cqw`, top: "32cqh", width: "18cqw", height: "36cqh", justifyContent: "center", "--glass-delay": `${cardIndex * 110}ms` } as CSSProperties}
          >
            <p className="glass-card-number">{statCard.statNumber}</p>
            <p className="glass-card-text">{statCard.statLabel}</p>
            <span className="glass-chip-dot" style={{ "--chip-tint": statCard.statTint } as CSSProperties} />
          </div>
        ))}
      </div>
      <Machina.Notes>
        <p>Четыре цифры на общей сетке. Точка-акцент под текстом повторяет цвет сферы.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">12 · кейс</p>
        <div className="glass-pane glass-anim-rise" style={{ left: "8cqw", top: "28cqh", width: "84cqw", height: "44cqh" }}>
          <p className="glass-quote">
            пересобрали тему за один вечер — триста двенадцать токенов сами легли на места
            <span className="glass-quote-sign">команда из четырёх человек, переход с ручных таблиц</span>
          </p>
        </div>
      </div>
      <Machina.Notes>
        <p>Широкая цитата на всю сетку. Кавычка — часть темы, не текст.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <p className="glass-tag glass-anim-rise">13 · доступ</p>
        <div className="glass-pane glass-ticket glass-flow glass-anim-rise" style={{ left: "8cqw", top: "32cqh", width: "40cqw", height: "36cqh" }}>
          <p className="glass-ticket-name" style={{ "--chip-tint": GLASS_AMBER } as CSSProperties}>ранний доступ</p>
          <p className="glass-ticket-text">ноябрь 2026 · код из письма · пятьсот мест</p>
          <span className="glass-ticket-perforation" />
          <span className="glass-ticket-notch glass-ticket-notch-top" />
          <span className="glass-ticket-notch glass-ticket-notch-bottom" />
          <p className="glass-ticket-code">VITRAZ-26</p>
        </div>
        <div className="glass-pane glass-ticket glass-flow glass-anim-rise" style={{ left: "52cqw", top: "32cqh", width: "40cqw", height: "36cqh", "--glass-delay": "140ms" } as CSSProperties}>
          <p className="glass-ticket-name" style={{ "--chip-tint": GLASS_CYAN } as CSSProperties}>лист ожидания</p>
          <p className="glass-ticket-text">запуск для всех — январь 2027, без кода</p>
          <span className="glass-ticket-perforation" />
          <span className="glass-ticket-notch glass-ticket-notch-top" />
          <span className="glass-ticket-notch glass-ticket-notch-bottom" />
          <p className="glass-ticket-code">SOON-27</p>
        </div>
      </div>
      <Machina.Notes>
        <p>Два стеклянных билета на 8 и 52, перфорация и прорези у внутренних краёв.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide>
      <GlassOrbs />
      <div className="machina-freeform-full">
        <h1 className="glass-thanks-title">Спасибо</h1>
        <div className="glass-pane glass-thanks-qr glass-anim-rise" style={{ "--glass-delay": "120ms" } as CSSProperties}>
          <Machina.QR value="https://github.com/xfenix/slidemachina" color="#eef1ff">
            репозиторий движка
          </Machina.QR>
        </div>
        <span className="glass-sticker glass-anim-rise" style={{ left: "48cqw", top: "36cqh", "--glass-delay": "260ms" } as CSSProperties}>
          забрать тему: style.css
        </span>
        <p className="glass-command glass-anim-rise" style={{ left: "48cqw", top: "52cqh", "--glass-delay": "380ms" } as CSSProperties}>
          <span className="glass-command-prompt">$</span> npm i -g vitraz
          <span className="glass-cursor" />
        </p>
        <p className="glass-thanks-note glass-anim-rise" style={{ "--glass-delay": "500ms" } as CSSProperties}>
          стекло, градиенты и тишина — одна тема
        </p>
      </div>
      <Machina.Notes>
        <p>Поблагодарите зал, покажите QR и команду установки. Всё на общей сетке: QR 8/36, правый столбец 48, строки 36/52/68.</p>
      </Machina.Notes>
    </Machina.Slide>
  </Machina.Presentation>
);

function GlassOrbs() {
  return (
    <div className="glass-orb-layer" aria-hidden>
      <span className="glass-orb glass-orb-warm" />
      <span className="glass-orb glass-orb-cold" />
    </div>
  );
}

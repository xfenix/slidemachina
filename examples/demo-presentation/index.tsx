import * as Machina from "slidemachina";
import duskPicture from "./images/dusk.webp";
import developmentToolbarPicture from "./images/development-toolbar.webp";
import editorPicture from "./images/source-editor.webp";
import glassCardsPicture from "./images/glass-cards.webp";
import glassCardsSquarePicture from "./images/glass-cards-square.webp";
import jdMemePicture from "./images/memes/jd.jpg";
import memePanelPicture from "./images/meme-panel.webp";
import minimapPicture from "./images/minimap.webp";
import orbitMemePicture from "./images/memes/orbit.gif";
import navigatorPicture from "./images/navigator.webp";
import navigatorSectionsPicture from "./images/navigator-sections.webp";
import presentationListPicture from "./images/presentation-list.webp";
import printViewPicture from "./images/print-view.webp";
import sceneOrbitPoster from "./images/scene-orbit-poster.webp";
import sceneOrbitVideo from "./images/scene-orbit.webm";
import slidemachinaMarkPicture from "./images/slidemachina-mark.svg";
import { AssemblingCube } from "./assembling-cube.tsx";
import { DraggableSticker } from "./draggable-sticker.tsx";
import { OrbitSunrise } from "./orbit-sunrise.tsx";

// A component of the presentation lives right here, above the slides. It shows the step of its own slide via useSlide().
function StepMeter() {
  const slide = Machina.useSlide();
  return (
    <figure className="machina-big-number">
      <p>{Number.isFinite(slide.step) ? slide.step : "все"}</p>
      <figcaption>шаг этого слайда</figcaption>
    </figure>
  );
}

export default (
  <Machina.Presentation date="2026-10-23" lang="ru" logo={Machina.SlidemachinaLogo} duration={20}>
    <Machina.Slide cover logo="center">
      <h1>Слайды из кода</h1>
      <p className="machina-lead">Шаги, схемы, 3D и морфинг в одном файле</p>
      <Machina.Notes>
        <p>Поздоровайтесь и назовите тему.</p>
        <p>Нажмите <kbd>P</kbd>: откроется окно докладчика с этими заметками.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Section title="Зачем">
      <Machina.Slide>
        <h2>Коротко в цифрах</h2>
        <div className="machina-columns" data-steps data-step-effect="scale">
          <figure className="machina-big-number">
            <p>1</p>
            <figcaption>файл на всю презентацию</figcaption>
          </figure>
          <figure className="machina-big-number">
            <p>13</p>
            <figcaption>переходов между слайдами</figcaption>
          </figure>
          <figure className="machina-big-number">
            <p>0 КБ</p>
            <figcaption>весит подсветка кода в браузере</figcaption>
          </figure>
        </div>
        <p className="machina-source">Замеры сборки этого демо, октябрь 2026</p>
        <Machina.Notes>Три цифры, по одной на шаг. Не читайте подписи вслух.</Machina.Notes>
        <Machina.Notes step={1}>Один файл: слайды, схемы и код лежат в <code>index.tsx</code>.</Machina.Notes>
        <Machina.Notes step={2}>Тринадцать переходов, морфинг среди них самый заметный.</Machina.Notes>
        <Machina.Notes step={3}>
          Подсветку делает сборка: <strong>в браузер не уходит ни строчки Shiki</strong>.
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Что вы получаете</h2>
        <table className="machina-compare">
          <thead>
            <tr>
              <th></th>
              <th>slidemachina</th>
              <th>reveal.js</th>
              <th>PowerPoint</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Файл</th>
              <td><code>index.tsx</code></td>
              <td><code>index.html</code></td>
              <td><code>.pptx</code></td>
            </tr>
            <tr>
              <th>Текст в git</th>
              <td className="machina-yes" />
              <td className="machina-yes" />
              <td className="machina-no" />
            </tr>
            <tr>
              <th>Правка прямо на слайде</th>
              <td className="machina-yes" />
              <td className="machina-no" />
              <td className="machina-yes" />
            </tr>
            <tr>
              <th>Подсветка кода при сборке</th>
              <td className="machina-yes" />
              <td className="machina-no" />
              <td className="machina-no" />
            </tr>
            <tr>
              <th>Схемы из разметки</th>
              <td className="machina-yes" />
              <td className="machina-no" />
              <td className="machina-no" />
            </tr>
          </tbody>
        </table>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Как устроено">
      <Machina.Slide>
        <h2>Вся презентация в одном файле</h2>
        <Machina.Code lang="bash">{`npx slidemachina dev my-talk`}</Machina.Code>
        <ul data-steps>
          <li>Слайды лежат в <code>index.tsx</code></li>
          <li>Из разделов получаются хлебные крошки и навигатор</li>
          <li>Сохранили файл - слайд обновился на том же шаге</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Разделы, подразделы и крошки</h2>
        <div className="machina-columns" style={{ gridTemplateColumns: "auto 1fr" }}>
          <div>
            <Machina.Code lang="tsx">{`
              <Section title="Как устроено">
                <Slide>…</Slide>
                <Section title="Шаги">
                  <Slide>…</Slide>
                </Section>
              </Section>
            `}</Machina.Code>
          </div>
          <ul data-steps>
            <li>Раздел открывает слайд с номером «02»</li>
            <li>Вложенный <code>Section</code> - подраздел с номером «02.1»</li>
            <li>Внизу слева крошки: раздел › подраздел</li>
            <li>Навигатор группирует слайды так же</li>
          </ul>
        </div>
      </Machina.Slide>

      <Machina.Section title="Шаги">
        <Machina.Slide>
          <h2>Рассказ по шагам</h2>
          <ul data-steps>
            <li>Пункт списка появляется по нажатию</li>
            <li>
              Шаг можно поставить на часть пункта: <span data-step data-step-effect="highlight">вот так</span>
            </li>
          </ul>
          <p className="machina-note" data-step={1} data-step-effect="fade">
            Пометка стоит под списком, а появилась с первым пунктом: <code>data-step=&#123;1&#125;</code>
          </p>
          <Machina.Notes>
            <ul>
              <li>Покажите, что пункт появляется по нажатию</li>
              <li>Подсветка стоит на части строки: это <em>отдельный шаг</em></li>
            </ul>
          </Machina.Notes>
        </Machina.Slide>

        <Machina.Slide>
          <h2>Эффекты шагов</h2>
          <ul>
            <li data-step><code>rise</code> - по умолчанию: поднимается снизу</li>
            <li data-step data-step-effect="fade"><code>fade</code> - проявляется на месте</li>
            <li data-step data-step-effect="scale"><code>scale</code> - вырастает</li>
            <li data-step data-step-effect="highlight"><code>highlight</code> - загорается цветом</li>
            <li data-step data-step-effect="dim"><code>dim</code> - гаснет</li>
          </ul>
        </Machina.Slide>
      </Machina.Section>

      <Machina.Slide>
        <h2>Свой компонент на слайде</h2>
        <div className="machina-columns" style={{ gridTemplateColumns: "3fr 1fr" }}>
          <div>
            <Machina.Code lang="tsx">{`
              function StepMeter() {
                const slide = useSlide();
                return <p>{slide.step}</p>;
              }

              <Slide onEnter={startTimer} onLeave={stopTimer}>
              <Presentation onChange={sendAnalytics}>
            `}</Machina.Code>
            <ul data-steps>
              <li><code>useSlide()</code> знает шаг и номер слайда</li>
              <li><code>onEnter</code> и <code>onLeave</code> - слайд пришёл и ушёл</li>
              <li><code>onChange</code> - любое движение по презентации</li>
            </ul>
          </div>
          <StepMeter />
        </div>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Вёрстка">
      <Machina.Slide align="center">
        <h2>По центру</h2>
        <p><code>align="center"</code> на слайде или на всей презентации</p>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Почему текст слева</h2>
        <ul data-steps>
          <li>Каждая строка начинается с одной вертикали, глаз не ищет начало</li>
          <li>Строки разной длины не скачут, как при выключке по центру</li>
          <li>Заголовок, список, код и таблица стоят на одной линии</li>
          <li>По центру - обложки, цитаты и тезисы в одну фразу</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide background="var(--dark-background)">
        <h2>Тёмный фон</h2>
        <Machina.Code lang="tsx">{`
          <Slide background="#14161d">
          <Slide background={photo} tone="dark">
        `}</Machina.Code>
        <ul>
          <li>На тёмном фоне текст, код и логотип светлеют</li>
          <li>Тёмный фон или светлый, движок понимает сам: по цвету или картинке</li>
          <li>Если движок ошибся, задайте <code>tone</code>, как во второй строке кода</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide background={sceneOrbitVideo}>
        <h2>Видео вместо фона</h2>
        <Machina.Code lang="tsx">{`
          <Slide background={video}>
          <Slide background={gif}>
          <Slide background={{ iframe: "https://…" }}>
        `}</Machina.Code>
        <p className="machina-note">Видео играет без звука, пока слайд на экране. Страница в <code>iframe</code> в печать не попадает</p>
      </Machina.Slide>

      <Machina.Slide background={duskPicture} plain align="center" transition="zoom">
        <h1>Картинка на весь слайд</h1>
        <p className="machina-lead"><code>plain</code> убирает логотип, крошки и номер</p>
      </Machina.Slide>

      <Machina.Slide logo="center" align="center" number={false}>
        <h2>Логотип там, где нужен</h2>
        <Machina.Code lang="tsx">{`<Slide logo="center" number={false}>`}</Machina.Code>
        <p>Логотип встал над заголовком, номер слайда спрятан</p>
        <p>Другие места логотипа: <code>top</code> и <code>bottom</code></p>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Один тег настраивает всю презентацию</h2>
        <div className="machina-columns">
          <div>
            <Machina.Code lang="tsx">{`
              <Presentation
                title="Итоги квартала"
                aspectRatio="4:3"
                align="center"
                transition="fade"
                speed="fast"
                breadcrumbsSeparator="/"
                progress={false}
              >
            `}</Machina.Code>
          </div>
          <ul>
            <li>Формат: экран, PDF и PowerPoint</li>
            <li>Текст по центру на всех слайдах</li>
            <li>Переход и его скорость</li>
            <li>Знак между разделами в крошках</li>
            <li>Полоса прогресса внизу</li>
          </ul>
        </div>
        <p className="machina-note">Презентация 4:3 «Итоги квартала» лежит в <code>examples/team-sync</code></p>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Свободная вёрстка в рамке</h2>
        <div className="machina-freeform">
          <svg aria-hidden className="absolute top-0 left-0 h-full w-[1180px] overflow-visible" viewBox="0 0 1180 640">
            <path d="M 180 210 C 300 520, 480 520, 600 400 S 900 120, 1000 200" fill="none" stroke="var(--muted-color)" strokeWidth="4" strokeDasharray="4 16" strokeLinecap="round" />
          </svg>
          <DraggableSticker startLeft={40} startTop={60} tiltDegrees={-5} stickerColor="#ffe066">Любая вёрстка</DraggableSticker>
          <DraggableSticker startLeft={470} startTop={300} tiltDegrees={3} stickerColor="#ffb3c7">Свой React и JS</DraggableSticker>
          <DraggableSticker startLeft={880} startTop={70} tiltDegrees={-2} stickerColor="#a9e5bb">Тащите мышью</DraggableSticker>
          <div className="absolute right-0 bottom-0 w-[600px]">
            <Machina.Code lang="tsx">{`
              <Slide>
                <h2>Заголовок</h2>
                <div className="machina-freeform">
                  …
                </div>
              </Slide>
            `}</Machina.Code>
          </div>
        </div>
      </Machina.Slide>

      <Machina.Slide cover plain align="left" valign="top" background="#02030a">
        <div className="machina-freeform-full -z-1">
          <OrbitSunrise />
        </div>
        <h1>Слайд без правил</h1>
        <p className="machina-lead">Земля, рассвет и блик нарисованы шейдером: ни одной картинки</p>
        <p className="machina-note" data-step>Ведите мышью: камера сдвинется, солнце выглянет из-за края</p>
      </Machina.Slide>

      <Machina.Slide cover plain align="left" valign="bottom">
        <div className="machina-freeform-full -z-1">
          <AssemblingCube />
        </div>
        <h1>Живая обложка</h1>
        <p className="machina-lead max-w-[760px]">Куб разбирается на части и собирается снова. Это код на three.js, а не видео</p>
        <p className="machina-note">Ведите мышью и щёлкните по кубу</p>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Блоки">
      <Machina.Slide>
        <h2>Три уровня текста</h2>
        <p className="machina-lead">Подзаголовок стоит сразу под заголовком</p>
        <p>Основной текст - обычный абзац без класса</p>
        <Machina.Code lang="tsx" title="index.tsx">{`
          <h2>Три уровня текста</h2>
          <p className="machina-lead">Подзаголовок</p>
          <p>Основной текст</p>
          <p className="machina-note">Пометка</p>
        `}</Machina.Code>
        <p className="machina-note">Пометка мелким шрифтом идёт после блоков</p>
      </Machina.Slide>

      <Machina.Slide transition="fade" align="center" number={false}>
        <figure>
          <blockquote>Совершенство достигается не тогда, когда нечего добавить, а когда нечего убрать</blockquote>
          <figcaption>Антуан де Сент-Экзюпери, "Планета людей"</figcaption>
        </figure>
      </Machina.Slide>

      <Machina.Slide background="var(--accent-soft-color)" transition="fade">
        <p className="machina-thesis">Тезис - одна мысль на цветном слайде</p>
      </Machina.Slide>

      <Machina.Slide background="var(--second-accent-soft-color)" transition="fade">
        <p className="machina-thesis-small">Тезис длиннее набран кеглем поменьше, а цвет слайда задаёт проп background</p>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Тезис</h2>
        <Machina.Code lang="tsx">{`
          <Slide background="var(--accent-soft-color)">
            <p className="machina-thesis">Тезис - одна мысль на цветном слайде</p>
          </Slide>
        `}</Machina.Code>
        <ul>
          <li>Одна фраза без заголовка стоит в центре слайда</li>
          <li>Короткая фраза - <code>machina-thesis</code>, длинная - <code>machina-thesis-small</code></li>
          <li>Цвет слайда задаёт проп <code>background</code>, цвет текста движок подбирает под фон</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Блок поверх вёрстки</h2>
        <ul>
          <li><code>machina-pin</code> вынимает блок из потока</li>
          <li><code>machina-pin-bottom</code> и <code>machina-pin-right</code> прижимают его к краям слайда</li>
          <li>Сдвиг из Tailwind выносит блок за край экрана</li>
        </ul>
        <div className="machina-pin-bottom machina-pin-right w-[560px] translate-x-[14%] translate-y-[12%] -rotate-6">
          <Machina.Meme src={jdMemePicture} alt="Жозеф Дюкре" stretch={false}>
            <p>Позвольте</p>
            <p>выглянуть из-за края</p>
          </Machina.Meme>
        </div>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Картинки">
      <Machina.Slide align="center">
        <h2>Картинка по центру</h2>
        <div className="w-[880px]">
          <Machina.Image src={glassCardsPicture} alt="Стеклянные карточки с текстом и графиком">
            <figcaption>Ширину задаёт обёртка: <code>className="w-[880px]"</code></figcaption>
          </Machina.Image>
        </div>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Картинка занимает всё свободное место</h2>
        <Machina.Image src={navigatorPicture} stretch alt="Навигатор по слайдам">
          <figcaption>Навигатор: <kbd>Esc</kbd> открывает все слайды</figcaption>
        </Machina.Image>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Вписать целиком или заполнить кадр</h2>
        <div className="machina-columns">
          <div>
            <Machina.Image src={glassCardsSquarePicture} stretch alt="Квадратная картинка со стеклянными карточками целиком">
              <figcaption><code>fit="contain"</code> - видно всё</figcaption>
            </Machina.Image>
          </div>
          <div>
            <Machina.Image src={glassCardsSquarePicture} stretch fit="cover" alt="Та же картинка, обрезана по колонке">
              <figcaption><code>fit="cover"</code> - кадр заполнен</figcaption>
            </Machina.Image>
          </div>
        </div>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Текст обтекает картинку</h2>
        <Machina.Image src={presentationListPicture} float="left" alt="Список презентаций" />
        <p>
          <code>float="left"</code> ставит картинку слева, текст идёт справа от неё
        </p>
        <ul>
          <li>Верх картинки на линии заглавных букв</li>
          <li>Отступ до текста задаёт <code>--float-gap</code> в теме</li>
          <li>Маркеры висят в отступе, как в колонках</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Картинка справа, текст слева</h2>
        <Machina.Image src={glassCardsPicture} float="right" alt="Стеклянные карточки с текстом и графиком" />
        <p>
          Так работает <code>float="right"</code>
        </p>
        <ul>
          <li>Картинка не шире 40 % области контента</li>
          <li>Заголовки, таблицы и код встают под неё</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide plain background="var(--dark-background)">
        <h2>Картинка под заголовком на весь слайд</h2>
        <Machina.Image src={glassCardsPicture} full alt="Стеклянные карточки с текстом и графиком на цветном фоне" />
      </Machina.Slide>

      <Machina.Slide background="var(--dark-background)">
        <h2>Видео на весь слайд</h2>
        <Machina.Video src={sceneOrbitVideo} poster={sceneOrbitPoster} full />
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Код">
      <Machina.Slide>
        <h2>Строки по шагам</h2>
        <Machina.Code lang="tsx" lines="| 4 | 5-7 | 8-10">{`
          import { Code, Presentation, Slide } from "slidemachina";

          export default (
            <Presentation lang="ru">
              <Slide cover>
                <h1>Доклад</h1>
              </Slide>
              <Slide>
                <Code src="./agent.py" lines="10-13 | 27-30" />
              </Slide>
            </Presentation>
          );
        `}</Machina.Code>
      </Machina.Slide>

      <Machina.Slide background="var(--dark-background)">
        <h2>Код из файла</h2>
        <Machina.Code src="./agent.py" lines="10-13 | 16-24 | 27-30 | 32-43 | 46-48" numbers />
      </Machina.Slide>

      <Machina.Slide>
        <h2>Морфинг кода</h2>
        <Machina.Code lang="ts" title="navigation.ts">{`
          function goForward(position: Position) {
            return { slide: position.slide + 1, step: 0 };
          }
        `}</Machina.Code>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Морфинг кода</h2>
        <Machina.Code lang="ts" title="navigation.ts">{`
          function goForward(position: Position, stepCounts: number[]) {
            if (position.step < stepCounts[position.slide]) { // [!code highlight:3]
              return { ...position, step: position.step + 1 };
            }
            return { slide: position.slide + 1, step: 0 };
          }
        `}</Machina.Code>
        <figcaption>Совпавший код переезжает, новый проявляется</figcaption>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Типографика">
      <Machina.Slide className="[--hanging-punctuation:0]">
        <h2>Обычно знаки рвут край текста</h2>
        <div className="relative">
          <p>"Кавычка" в начале абзаца</p>
          <ul>
            <li>Маркер списка</li>
          </ul>
          <ol>
            <li>Номер пункта</li>
          </ol>
          <Machina.Code lang="bash">{`npm create slidemachina`}</Machina.Code>
          <div aria-hidden className="absolute inset-y-0 right-full border-r-2 border-dashed border-(--accent-color)" />
        </div>
      </Machina.Slide>

      <Machina.Slide>
        <h2>В slidemachina буквы стоят ровно</h2>
        <div className="relative">
          <p>"Кавычка" в начале абзаца</p>
          <ul>
            <li>Маркер списка</li>
          </ul>
          <ol>
            <li>Номер пункта</li>
          </ol>
          <Machina.Code lang="bash">{`npm create slidemachina`}</Machina.Code>
          <div aria-hidden className="absolute inset-y-0 right-full border-r-2 border-dashed border-(--accent-color)" />
        </div>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Зачем вешать знаки в поле</h2>
        <ul data-steps>
          <li>Глаз находит начало строки по левому краю</li>
          <li>Знак в начале строки делает выемку в левом крае, и строка кажется сдвинутой</li>
          <li>Свойство CSS <code>hanging-punctuation</code> знает только Safari</li>
          <li>slidemachina вешает знаки сама: в любом браузере и в PDF</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Висят все знаки в начале строки</h2>
        <p>"Кавычки" выходят за край, буквы стоят на линии заголовка</p>
        <p>(Скобки) висят так же</p>
        <ul>
          <li>Маркеры списка</li>
        </ul>
        <ol data-steps>
          <li>Номера списка</li>
          <li>Стоят правым краем, как в таблице</li>
        </ol>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Код висит так же</h2>
        <Machina.Code lang="bash">{`npm create slidemachina`}</Machina.Code>
        <Machina.Code lang="tsx" numbers>{`
          const hangingMarks = ["«", "„", "(", "$"];
          for (const hangingMark of hangingMarks) {
            hangInMargin(hangingMark);
          }
        `}</Machina.Code>
        <figcaption>Символы кода на линии текста. Плашка, номера строк и <code>$</code> - в поле</figcaption>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Типограф</h2>
        <div className="machina-columns">
          <div>
            <p className="machina-note">В <code>index.tsx</code></p>
            <Machina.Code lang="tsx">{`
              <p>
                "Кавычки" станут ёлочками, дефис - тире.
                Предлог не повиснет в конце строки,
                а кавычка в начале встанет за край
              </p>
            `}</Machina.Code>
          </div>
          <div>
            <p className="machina-note">На слайде</p>
            <p>"Кавычки" станут ёлочками, дефис - тире. Предлог не повиснет в конце строки, а кавычка в начале встанет за край</p>
          </div>
        </div>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Схемы">
      <Machina.Slide>
        <h2>Схемы прямо в презентации</h2>
        <ul data-steps>
          <li>Блоки и стрелки пишутся тегами</li>
          <li>Раскладку считает библиотека ELK, двигать блоки руками не нужно</li>
          <li><code>Focus</code> выделяет нужную часть, остальное гаснет</li>
          <li>Блоки появляются по шагам, схема перетекает в следующую</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide className="[--diagram-max-scale:1.5]">
        <h2>Пишете теги, получаете схему</h2>
        <div className="machina-columns" style={{ gridTemplateColumns: "auto 1fr" }}>
          <div>
            <Machina.Code lang="tsx">{`
              <Diagram>
                <Box id="browser">Браузер</Box>
                <Box id="server">Сервер</Box>
                <Box id="db">База</Box>
                <Arrow from="browser" to="server" label="HTTP" />
                <Arrow from="server" to="db" label="SQL" />
              </Diagram>
            `}</Machina.Code>
          </div>
          <div>
            <Machina.Diagram>
              <Machina.Box id="browser">Браузер</Machina.Box>
              <Machina.Box id="server">Сервер</Machina.Box>
              <Machina.Box id="db">База</Machina.Box>
              <Machina.Arrow from="browser" to="server" label="HTTP" />
              <Machina.Arrow from="server" to="db" label="SQL" />
            </Machina.Diagram>
          </div>
        </div>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Схема собирается по шагам</h2>
        <Machina.Diagram>
          <Machina.Box id="slides">index.tsx<small>слайды</small></Machina.Box>
          <Machina.Group id="build" title="Сборка" step>
            <Machina.Box id="vite">Vite</Machina.Box>
            <Machina.Box id="shiki">Shiki<small>подсветка кода</small></Machina.Box>
            <Machina.Box id="typograf" column={2}>Типограф</Machina.Box>
            <Machina.Arrow from="vite" to="shiki" />
            <Machina.Arrow from="vite" to="typograf" />
          </Machina.Group>
          <Machina.Arrow from="slides" to="vite" step={1} />
          <Machina.Group id="browser" title="Браузер" step>
            <Machina.Box id="react">React</Machina.Box>
            <Machina.Box id="elk" step>ELK<small>раскладка схем</small></Machina.Box>
            <Machina.Arrow from="react" to="elk" label="в фоне" step={3} />
          </Machina.Group>
          <Machina.Arrow from="build" to="react" label="модули" step={2} />
        </Machina.Diagram>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Фокус на части схемы</h2>
        <Machina.Diagram>
          <Machina.Box id="slides">index.tsx<small>слайды</small></Machina.Box>
          <Machina.Group id="build" title="Сборка">
            <Machina.Box id="vite">Vite</Machina.Box>
            <Machina.Box id="shiki">Shiki<small>подсветка кода</small></Machina.Box>
            <Machina.Box id="typograf">Типограф</Machina.Box>
            <Machina.Arrow from="vite" to="shiki" />
            <Machina.Arrow from="vite" to="typograf" />
          </Machina.Group>
          <Machina.Group id="browser" title="Браузер">
            <Machina.Box id="react">React</Machina.Box>
            <Machina.Box id="elk">ELK<small>раскладка схем</small></Machina.Box>
            <Machina.Arrow from="react" to="elk" label="в фоне" />
          </Machina.Group>
          <Machina.Arrow from="slides" to="vite" />
          <Machina.Arrow from="build" to="react" label="модули" />
          <Machina.Focus on={["build"]} step />
          <Machina.Focus on={["react", "elk"]} step />
          <Machina.Focus step />
        </Machina.Diagram>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Схема перестраивается сама</h2>
        <Machina.Diagram>
          <Machina.Box id="slides">index.tsx<small>слайды</small></Machina.Box>
          <Machina.Box id="styles">style.css<small>тема</small></Machina.Box>
          <Machina.Group id="build" title="Сборка">
            <Machina.Box id="vite">Vite</Machina.Box>
            <Machina.Box id="shiki">Shiki<small>подсветка кода</small></Machina.Box>
            <Machina.Box id="typograf">Типограф</Machina.Box>
            <Machina.Arrow from="vite" to="shiki" />
            <Machina.Arrow from="vite" to="typograf" />
          </Machina.Group>
          <Machina.Group id="browser" title="Браузер">
            <Machina.Box id="react">React</Machina.Box>
            <Machina.Box id="elk">ELK<small>раскладка схем</small></Machina.Box>
            <Machina.Box id="transitions">View Transitions<small>переходы</small></Machina.Box>
            <Machina.Arrow from="react" to="elk" label="в фоне" />
            <Machina.Arrow from="react" to="transitions" />
          </Machina.Group>
          <Machina.Arrow from="slides" to="vite" />
          <Machina.Arrow from="styles" to="vite" />
          <Machina.Arrow from="build" to="react" label="модули" />
        </Machina.Diagram>
      </Machina.Slide>

      <Machina.Slide background="var(--dark-background)">
        <h2>Диаграмма обмена тоже из тегов</h2>
        <Machina.Sequence>
          <Machina.Actor id="slides">index.tsx<small>слайды</small></Machina.Actor>
          <Machina.Actor id="vite">Vite</Machina.Actor>
          <Machina.Actor id="react">React</Machina.Actor>
          <Machina.Message from="slides" to="vite" label="файл сохранён" step />
          <Machina.Message from="vite" to="react" label="обнови index.tsx" step />
          <Machina.Message id="request" from="react" to="vite" label="GET /index.tsx" step />
          <Machina.Message id="response" from="vite" to="react" label="код с подсветкой" reply step />
          <Machina.Message from="react" to="react" label="слайд и шаг на месте" step />
          <Machina.Focus on={["request", "response"]} step />
        </Machina.Sequence>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Переходы">
      <Machina.Slide>
        <h2>Морфинг любых блоков</h2>
        <div className="machina-columns">
          <div className="machina-card">
            <figure className="machina-big-number"><p>+72%</p><figcaption>Выручка за год</figcaption></figure>
            <ul className="machina-bars">
              <li style={{ height: "30%" }} />
              <li style={{ height: "55%" }} />
              <li style={{ height: "70%" }} />
              <li style={{ height: "100%" }} />
            </ul>
          </div>
          <div className="machina-card">
            <figure className="machina-big-number"><p>1,3 млн</p><figcaption>Клиентов</figcaption></figure>
          </div>
          <div className="machina-card">
            <figure className="machina-big-number"><p>4,9</p><figcaption>Оценка в магазине приложений</figcaption></figure>
          </div>
        </div>
        <figcaption>Три карточки</figcaption>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Морфинг любых блоков</h2>
        <div className="machina-card machina-card-stretch">
          <figure className="machina-big-number"><p>+72%</p><figcaption>Выручка за год</figcaption></figure>
          <ul className="machina-bars">
            <li style={{ height: "30%" }} />
            <li style={{ height: "55%" }} />
            <li style={{ height: "70%" }} />
            <li style={{ height: "100%" }} />
          </ul>
        </div>
        <figcaption>Карточка стала графиком</figcaption>
      </Machina.Slide>

      <Machina.Slide align="center">
        <h2>Морфинг любых блоков</h2>
        <figure className="machina-big-number"><p>+72%</p><figcaption>Выручка за год</figcaption></figure>
        <p className="machina-note">График стал большим числом. Пары движок нашёл сам</p>
      </Machina.Slide>

      <Machina.Slide align="center">
        <h2>Версия 0.1</h2>
        <p className="text-(length:--display-size) leading-tight font-bold">Слайды листаются</p>
      </Machina.Slide>

      <Machina.Slide align="center">
        <h2>Версия 0.2</h2>
        <p className="text-(length:--display-size) leading-tight font-bold">Слайды листаются и перетекают</p>
        <p className="machina-lead">Общие слова переезжают, новые проявляются</p>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Тринадцать переходов</h2>
        <ul>
          <li><code>auto</code> - по умолчанию: морфинг или сдвиг</li>
          <li><code>morph</code> - общие элементы перетекают</li>
          <li><code>slide</code>, <code>fade</code>, <code>zoom</code> - сдвиг, проявление, приближение</li>
          <li><code>cube</code>, <code>flip</code> - куб и переворот</li>
          <li><code>wipe</code>, <code>iris</code>, <code>blinds</code>, <code>mosaic</code>, <code>glitch</code> - шторка, круг, жалюзи, плитки, сбой</li>
          <li><code>none</code> - без перехода</li>
        </ul>
        <p className="machina-note">Скорость задаёт <code>speed</code>: <code>slow</code>, <code>fast</code> или число</p>
      </Machina.Slide>

      <Machina.Slide transition="cube" speed="slow" background="var(--dark-background)" align="center">
        <h2>Куб</h2>
        <p>Слайд поворачивается гранью куба вместе с фоном, логотипом и номером</p>
      </Machina.Slide>

      <Machina.Slide transition="flip" align="center">
        <h2>Переворот</h2>
        <p>Слайд переворачивается, как карточка. Назад - в обратную сторону</p>
      </Machina.Slide>

      <Machina.Slide transition="wipe" background="var(--accent-soft-color)" align="center">
        <h2>Шторка</h2>
        <p>Новый слайд наезжает справа налево с мягким краем</p>
      </Machina.Slide>

      <Machina.Slide transition="iris" background="var(--dark-background)" align="center">
        <h2>Круг</h2>
        <p>Новый слайд раскрывается кругом из центра</p>
      </Machina.Slide>

      <Machina.Slide transition="blinds" align="center">
        <h2>Жалюзи</h2>
        <p>Слайд поворачивается полосами сверху вниз, как жалюзи</p>
      </Machina.Slide>

      <Machina.Slide transition="mosaic" background={duskPicture} align="center">
        <h2>Плитки</h2>
        <p>Слайд рассыпается на плитки, и они волной переворачиваются в новый</p>
      </Machina.Slide>

      <Machina.Slide transition="glitch" background="var(--dark-background)" align="center">
        <h2>Сбой</h2>
        <p>Текст дёргается и двоится красным и голубым. Фон и номер стоят на месте</p>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Обложки">
      <Machina.Slide cover align="left" valign="bottom">
        <div aria-hidden className="machina-pin-top machina-pin-bottom machina-pin-right w-2/3 bg-[radial-gradient(circle_at_70%_35%,var(--accent-color),transparent_55%),radial-gradient(circle_at_95%_85%,var(--second-accent-color),transparent_45%)] opacity-40" />
        <h1>Итоги квартала</h1>
        <p className="machina-lead">Снизу слева: <code>align="left"</code> и <code>valign="bottom"</code></p>
        <p className="machina-note">Свечение справа — обычный <code>div</code> с градиентом</p>
      </Machina.Slide>

      <Machina.Slide cover background={duskPicture}>
        <h1>Ночной релиз</h1>
        <p className="machina-lead">Посередине, на фото. Цвет текста движок подбирает по яркости картинки</p>
      </Machina.Slide>

      <Machina.Slide cover align="left" valign="top">
        <h1>Планы на 2027</h1>
        <p className="machina-lead">Над полосой слева сверху: <code>align="left"</code>, <code>valign="top"</code></p>
        <div className="machina-pin-bottom machina-pin-left machina-pin-right h-[50cqh]">
          <img src={glassCardsPicture} alt="" className="size-full object-cover" />
        </div>
      </Machina.Slide>

      <Machina.Slide cover align="center" valign="center">
        <h1>Планы на 2027</h1>
        <p className="machina-lead">Над полосой в центре: <code>align="center"</code>, <code>valign="center"</code></p>
        <div className="machina-pin-bottom machina-pin-left machina-pin-right h-[50cqh]">
          <img src={glassCardsPicture} alt="" className="size-full object-cover" />
        </div>
      </Machina.Slide>

      <Machina.Slide cover align="right" valign="bottom">
        <h1>Планы на 2027</h1>
        <p className="machina-lead">Над полосой справа снизу: <code>align="right"</code>, <code>valign="bottom"</code></p>
        <div className="machina-pin-bottom machina-pin-left machina-pin-right h-[50cqh]">
          <img src={glassCardsPicture} alt="" className="size-full object-cover" />
        </div>
      </Machina.Slide>

      <Machina.Slide cover align="left">
        <Machina.Image src={navigatorSectionsPicture} alt="Навигатор: разделы и миниатюры слайдов" />
        <h1>Сто слайдов за минуту</h1>
        <p className="machina-lead">Картинка слева: <code>Image</code> стоит перед текстом</p>
      </Machina.Slide>

      <Machina.Slide cover align="right" background="var(--dark-background)">
        <h1>Метрики продукта</h1>
        <p className="machina-lead">Картинка справа: <code>Image</code> стоит после текста</p>
        <Machina.Image src={glassCardsPicture} alt="Стеклянные карточки с текстом и графиком" />
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section>
      <Machina.Slide cover align="left" valign="top" background="var(--dark-background)">
        <p className="machina-note">Раздел со своей обложкой</p>
        <h1>3D</h1>
        <p className="machina-lead">Первый <code>{"<Slide cover>"}</code> раздела встаёт вместо слайда с номером, его <code>h1</code> идёт в крошки</p>
        <Machina.Scene full orbit>
          <Machina.Sphere size={1.8} position={[0, 0.9, 1]} color="var(--muted-color)" material="metal" />
          <Machina.Cube size={1.6} position={[-2, 0.8, -1]} rotation={[0, 30, 0]} material="glossy" />
          <Machina.Cube size={[0.8, 2.8, 0.8]} position={[2, 1.4, -1.5]} rotation={[0, 18, 0]} color="var(--text-color)" material="glossy" />
          <Machina.Sphere size={1} position={[2.2, 0.5, 1.4]} color="var(--second-accent-color)" material="glossy" />
        </Machina.Scene>
      </Machina.Slide>

      <Machina.Slide background="var(--dark-background)" transition="zoom">
        <h2>Сцена в 3D</h2>
        <p className="machina-lead">Куб и сфера пишутся тегами, свет движок ставит сам</p>
        <Machina.Scene full orbit>
          <Machina.Cube size={1.5} position={[-1.7, 0.75, 0.2]} rotation={[0, 28, 0]} material="glossy" />
          <Machina.Sphere size={1.6} position={[0.1, 0.8, 0.6]} color="var(--text-color)" material="glossy" />
          <Machina.Sphere size={1} position={[1.5, 0.5, -0.4]} color="var(--muted-color)" material="metal" />
          <Machina.Cube size={[0.7, 2.4, 0.7]} position={[2.5, 1.2, -1]} rotation={[0, 18, 0]} color="var(--second-accent-color)" />
        </Machina.Scene>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Шаги внутри сцены</h2>
        <div className="machina-columns">
          <ul data-steps>
            <li>Появляется сфера</li>
            <li>Куб переезжает и поворачивается</li>
            <li>Камера заходит сбоку</li>
            <li>Над сценой встаёт текст</li>
          </ul>
          <div>
            <Machina.Scene>
              <Machina.Cube id="cube" size={1.3} position={[0, 0.65, 0]} rotation={[0, 20, 0]} material="glossy" />
              <Machina.Sphere size={1.1} position={[1.4, 0.55, 0.4]} color="var(--second-accent-color)" step={1} />
              <Machina.Move on="cube" position={[-1.4, 0.65, 0]} rotation={[0, 70, 0]} step={2} />
              <Machina.Camera position={[4.93, 2.56, 4.99]} target={[0.49, 0.62, -0.25]} step={3} />
              <Machina.Text position={[0, 2.3, 0]} size={0.45} step={4}>Готово</Machina.Text>
            </Machina.Scene>
          </div>
        </div>
      </Machina.Slide>

      <Machina.Slide transition="flip">
        <h2>Свет и цвет из темы</h2>
        <Machina.Scene>
          <Machina.Text position={[0, 2.2, 0]} size={0.5}>Привет, сцена</Machina.Text>
          <Machina.Cube size={1.4} position={[-1.4, 0.7, 0]} rotation={[0, -24, 0]} material="glossy" />
          <Machina.Sphere id="ball" size={1.4} position={[1.4, 0.7, 0]} material="glossy" />
          <Machina.Light position={[-4, 7, 5]} />
          <Machina.Light position={[6, 2, 1]} color="var(--second-accent-color)" intensity={2} step />
          <Machina.Move on="ball" color="var(--second-accent-color)" step />
        </Machina.Scene>
        <figcaption>Цвет объектов — из темы. Свет и цвет меняются по шагам</figcaption>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Разметка сцены</h2>
        <div className="machina-columns">
          <div>
            <Machina.Code lang="tsx" lines="| 3 | 4 | 5">{`
              <Scene orbit>
                <Cube size={1.5} material="glossy" />
                <Sphere id="ball" position={[2, 0.5, 0]} step />
                <Move on="ball" position={[-2, 0.5, 0]} step />
                <Camera position={[5, 3, 6]} step />
                <Text position={[0, 2, 0]}>Привет</Text>
              </Scene>
            `}</Machina.Code>
            <p className="machina-note">three.js грузится, только если в презентации есть сцена</p>
          </div>
          <div>
            <Machina.Scene orbit>
              <Machina.Cube size={1.5} material="glossy" />
              <Machina.Sphere id="ball" position={[2, 0.5, 0]} step={1} />
              <Machina.Move on="ball" position={[-2, 0.5, 0]} step={2} />
              <Machina.Camera position={[5, 3, 6]} step={3} />
              <Machina.Text position={[0, 2, 0]}>Привет</Machina.Text>
            </Machina.Scene>
          </div>
        </div>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Мемы и QR">
      <Machina.Slide align="center">
        <Machina.Meme src={jdMemePicture} alt="Жозеф Дюкре">
          <p>Извольте вставить мем</p>
          <p>не покидая слайдов</p>
          <figcaption>Шаблон: Joseph Ducreux, Know Your Meme</figcaption>
        </Machina.Meme>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Мем за минуту</h2>
        <div className="machina-columns">
          <div>
            <ul>
              <li>Панель «Мем» ищет шаблоны и GIF</li>
              <li>Подойдёт и ссылка на картинку</li>
              <li>Подписи правятся прямо на слайде</li>
            </ul>
            <Machina.Code lang="bash">{`slidemachina meme "this is fine"`}</Machina.Code>
          </div>
          <div>
            <Machina.Meme src={orbitMemePicture} alt="Облёт 3D-сцены">
              <p>Схема, код, 3D</p>
              <p>и мем в одном файле</p>
              <figcaption>Свой мем из GIF: подписи пишутся прямо в теге</figcaption>
            </Machina.Meme>
          </div>
        </div>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Мем настраивается в теге</h2>
        <Machina.Meme src={jdMemePicture} float="right" alt="Жозеф Дюкре">
          <p data-place="center" style={{ rotate: "-6deg" }}>Подпись где угодно</p>
        </Machina.Meme>
        <ul>
          <li><code>float</code> - текст обтекает мем, как картинку</li>
          <li><code>data-place</code> двигает подпись: <code>top</code>, <code>bottom</code>, <code>center</code> или проценты</li>
          <li>Цвет и поворот подписи - обычный <code>style</code></li>
          <li>В <code>machina-pin</code> мем встаёт в угол или за край слайда</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Устали генерировать коды на qrcodemonkey?</h2>
        <div className="machina-columns" style={{ gridTemplateColumns: "3fr 7fr" }}>
          <div>
            <Machina.QR value="https://github.com/xfenix/slidemachina" logo={slidemachinaMarkPicture}>
              <figcaption>Исходники slidemachina</figcaption>
            </Machina.QR>
          </div>
          <div>
            <Machina.Code lang="tsx">{`
              <QR
                value="https://github.com/xfenix/slidemachina"
                logo={slidemachinaMarkPicture}
              >
                <figcaption>Исходники slidemachina</figcaption>
              </QR>
            `}</Machina.Code>
            <ul>
              <li>Код рисуется вектором и печатается в PDF</li>
              <li>Точки крупные, их видно с дальних рядов</li>
              <li>С логотипом коррекция ошибок всегда <code>H</code></li>
              <li>Цвет точек - <code>color</code>, по умолчанию цвет текста</li>
            </ul>
          </div>
        </div>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Печать и сборка">
      <Machina.Slide>
        <h2>PDF выглядит как экран</h2>
        <div className="machina-columns">
          <ul data-steps>
            <li><kbd>Cmd</kbd> <kbd>P</kbd> - слайд на страницу</li>
            <li>«Раскадровка» - страница на каждый шаг</li>
            <li><code>?print</code> в адресе - все слайды столбиком</li>
            <li>Фон и схемы печатаются вектором</li>
          </ul>
          <div>
            <Machina.Image src={printViewPicture} stretch alt="Печатная версия: слайды столбиком и меню печати" />
          </div>
        </div>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Сборка</h2>
        <Machina.Code lang="bash">{`npx slidemachina build`}</Machina.Code>
        <table data-steps>
          <thead>
            <tr>
              <th>Что получится</th>
              <th>Флаг для CI</th>
              <th>Зачем</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Один HTML-файл</th>
              <td><code>--html</code></td>
              <td>отправить в чат или письмом</td>
            </tr>
            <tr>
              <th>Файл под паролем</th>
              <td><code>--protected</code></td>
              <td>закрытый доклад</td>
            </tr>
            <tr>
              <th>Папка или zip</th>
              <td><code>--folder</code>, <code>--zip</code></td>
              <td>выложить на сайт</td>
            </tr>
            <tr>
              <th>PDF</th>
              <td><code>--pdf</code>, <code>--steps</code></td>
              <td>раздать после доклада</td>
            </tr>
          </tbody>
        </table>
      </Machina.Slide>

      <Machina.Slide align="center">
        <h2>Один файл</h2>
        <div className="machina-columns" data-steps>
          <figure className="machina-big-number">
            <p>1</p>
            <figcaption>файл с картинками и шрифтами</figcaption>
          </figure>
          <figure className="machina-big-number">
            <p>0,5</p>
            <figcaption>секунды на сборку</figcaption>
          </figure>
          <figure className="machina-big-number">
            <p>0 КБ</p>
            <figcaption>весит редактор в сборке</figcaption>
          </figure>
        </div>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Много презентаций">
      <Machina.Slide>
        <h2>Репозиторий презентаций</h2>
        <div className="machina-columns" style={{ gridTemplateColumns: "auto 1fr" }}>
          <div>
            <Machina.Code lang="text">{`
              talks/
                theme/
                  style.css
                  brand.css
                team-sync/
                  index.tsx
                python-news/
                  index.tsx
                  style.css
            `}</Machina.Code>
          </div>
          <ul data-steps>
            <li><code>theme/</code> - общая тема: шрифты, цвета, логотип</li>
            <li><code>style.css</code> в папке презентации сильнее общей темы</li>
            <li>Тему части докладов подключает сам <code>index.tsx</code>: <code>import "../theme/brand.css"</code></li>
            <li><code>npm create slidemachina</code> в корне добавляет презентацию</li>
            <li><code>npx slidemachina dev</code> в корне открывает список презентаций</li>
            <li>Новые доклады в списке первыми, порядок - по дате</li>
            <li>Папки <code>theme</code> и <code>dist</code> в список не попадают</li>
          </ul>
        </div>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Список презентаций</h2>
        <Machina.Image src={presentationListPicture} alt="Страница со списком презентаций" stretch>
          <figcaption>Обложка — живой первый слайд, правку темы видно сразу</figcaption>
        </Machina.Image>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Сборка всех</h2>
        <Machina.Code lang="bash">{`npx slidemachina build`}</Machina.Code>
        <div className="machina-columns" style={{ gridTemplateColumns: "auto 1fr" }}>
          <div>
            <Machina.Code lang="text">{`
              dist/
                index.html
                team-sync/
                  index.html
                  cover.webp
                python-news/
            `}</Machina.Code>
          </div>
          <ul data-steps>
            <li>Каждая презентация в своей папке, список - в <code>dist/index.html</code></li>
            <li>Обложки для списка снимает Chrome</li>
            <li>У доклада под паролем на карточке нет обложки</li>
            <li>С флагом <code>--pdf</code> рядом с каждой презентацией ляжет PDF</li>
            <li>Папку <code>dist</code> выкладывают на сервер как есть</li>
          </ul>
        </div>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Режим разработки">
      <Machina.Slide background="var(--dark-background)">
        <h2>Панель разработчика</h2>
        <p className="machina-lead">В <code>slidemachina dev</code> на панели внизу есть ещё кнопки</p>
        <Machina.Image src={developmentToolbarPicture} alt="Панель с включённым редактором" />
        <ul data-steps>
          <li>Миникарта показывает все слайды справа</li>
          <li>Карандаш включает редактор, рядом встают кнопки слайда</li>
          <li>Новый слайд, копия, раньше, позже, удалить</li>
          <li>Смайлик открывает панель «Мем»</li>
          <li>В сборке этих кнопок нет</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Правка прямо на слайде</h2>
        <ul data-steps>
          <li><kbd>E</kbd> или карандаш включают редактор</li>
          <li>Текст: нажмите и пишите. <kbd>Enter</kbd> сохраняет, <kbd>Esc</kbd> отменяет</li>
          <li>Картинка: перетащите на неё файл, он ляжет в <code>images/</code></li>
          <li>Блок схемы: тяните в другую колонку или на другое место</li>
          <li>Слайд: кнопки на панели добавляют, копируют, двигают и удаляют</li>
          <li>Правка сразу записывается в <code>index.tsx</code>, слайд остаётся на том же шаге</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide className="[--diagram-max-scale:1.5]">
        <h2>Попробуйте: нажмите E</h2>
        <div className="machina-columns">
          <div>
            <Machina.Image src={editorPicture} alt="Редактор: заголовок слайда в правке" />
            <figcaption>Перетащите сюда свою картинку</figcaption>
          </div>
          <div>
            <Machina.Diagram>
              <Machina.Box id="text">Текст</Machina.Box>
              <Machina.Box id="picture">Картинка</Machina.Box>
              <Machina.Box id="editor">Редактор</Machina.Box>
              <Machina.Box id="file">index.tsx</Machina.Box>
              <Machina.Arrow from="text" to="editor" />
              <Machina.Arrow from="picture" to="editor" />
              <Machina.Arrow from="editor" to="file" />
            </Machina.Diagram>
          </div>
        </div>
      </Machina.Slide>

      <Machina.Slide background="var(--dark-background)">
        <h2>Правка из браузера</h2>
        <Machina.Sequence>
          <Machina.Actor id="browser">Браузер</Machina.Actor>
          <Machina.Actor id="vite">Vite</Machina.Actor>
          <Machina.Actor id="slides">index.tsx<small>слайды</small></Machina.Actor>
          <Machina.Message from="browser" to="vite" label="правка и версия файла" step />
          <Machina.Message id="write" from="vite" to="slides" label="точечная запись" step />
          <Machina.Message from="vite" to="browser" label="обнови index.tsx" step />
          <Machina.Message from="browser" to="browser" label="слайд и шаг на месте" step />
          <Machina.Focus on={["write"]} step />
          <Machina.Focus step />
        </Machina.Sequence>
        <figcaption>Если файл изменили после загрузки, правка не запишется</figcaption>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Мем с панели</h2>
        <div className="machina-columns" style={{ gridTemplateColumns: "2fr 3fr" }}>
          <div>
            <Machina.Image src={memePanelPicture} stretch alt="Панель «Мем»: поиск шаблона ducreux" />
          </div>
          <ul data-steps>
            <li>Смайлик на панели открывает поиск шаблонов memegen и GIF</li>
            <li>Подойдёт и ссылка на картинку или страницу с ней</li>
            <li>Мем встаёт новым слайдом после текущего</li>
            <li>Подписи и их места пишутся прямо в <code>index.tsx</code></li>
          </ul>
        </div>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Миникарта</h2>
        <Machina.Image src={minimapPicture} stretch alt="Миникарта слайдов справа от слайда">
          <figcaption>Все слайды поверх правого края, как миникарта в редакторе кода. Включает кнопка на панели или <kbd>M</kbd></figcaption>
        </Machina.Image>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Замечание агенту кликом по слайду</h2>
        <ul data-steps>
          <li>Кнопка Agentation на панели в режиме <code>dev</code></li>
          <li>Нажмите на заголовок, картинку или блок и напишите, что поправить</li>
          <li>Замечание уходит в Claude Code через MCP-сервер <code>agentation-mcp</code></li>
          <li>В замечании есть место в файле: <code>index.tsx:42:7</code></li>
          <li>Нет сервера - замечания остаются в браузере</li>
          <li>В сборку Agentation не попадает</li>
        </ul>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Управление" cover={false}>
      <Machina.Slide>
        <h2>Заметки и окно докладчика</h2>
        <div className="machina-columns" style={{ gridTemplateColumns: "auto 1fr" }}>
          <div>
            <Machina.Code lang="tsx">{`
              <Slide>
                <h2>Выручка</h2>
                <Notes>
                  Начните с цифры
                </Notes>
                <Notes step={1}>
                  Про первый пункт
                </Notes>
              </Slide>
            `}</Machina.Code>
          </div>
          <ul data-steps>
            <li><kbd>P</kbd> открывает окно докладчика</li>
            <li>В нём слайд на экране, следующий шаг, заметки и время</li>
            <li>Листать можно в любом окне, второе идёт следом</li>
            <li><code>duration=&#123;20&#125;</code> у <code>Presentation</code> покажет запас или отставание</li>
          </ul>
        </div>
        <Machina.Notes>
          <p>Заметки видны только здесь: на слайде, в навигаторе и в PDF их нет.</p>
          <p>В PowerPoint они попадают в заметки к слайду.</p>
        </Machina.Notes>
        <Machina.Notes step={3}>
          Листайте отсюда: стрелки, пробел или клик по следующему слайду справа.
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Скрытые слайды</h2>
        <div className="machina-columns" style={{ gridTemplateColumns: "auto 1fr" }}>
          <div>
            <Machina.Code lang="tsx">{`
              <Slide hidden>
                <h2>Запасной слайд</h2>
              </Slide>
            `}</Machina.Code>
          </div>
          <ul data-steps>
            <li>При показе его нет: стрелки идут мимо, номер и прогресс его не считают</li>
            <li>В навигаторе он бледный, с перечёркнутым глазом. Адрес <code>#12+1</code> — первый скрытый после слайда 12</li>
            <li>В PDF и PowerPoint его тоже нет. Вернуть: «Скрытые слайды» в меню печати или <code>--hidden</code> у сборки</li>
            <li>Запасной слайд демо стоит после «Спасибо»: нажмите <kbd>Esc</kbd> и найдите его</li>
          </ul>
        </div>
      </Machina.Slide>

      <Machina.Slide breadcrumbs="Шпаргалка">
        <h2>Клавиши</h2>
        <table>
          <tbody>
            <tr>
              <td><kbd>→</kbd> <kbd>Пробел</kbd> <kbd>PageDown</kbd></td>
              <td>дальше</td>
            </tr>
            <tr>
              <td><kbd>←</kbd> <kbd>PageUp</kbd></td>
              <td>назад</td>
            </tr>
            <tr>
              <td><kbd>Esc</kbd> <kbd>O</kbd></td>
              <td>все слайды</td>
            </tr>
            <tr>
              <td><kbd>12</kbd> <kbd>Enter</kbd></td>
              <td>слайд с этим номером</td>
            </tr>
            <tr>
              <td><kbd>B</kbd></td>
              <td>пауза: чёрный экран и кнопка возврата</td>
            </tr>
            <tr>
              <td><kbd>P</kbd></td>
              <td>окно докладчика с заметками</td>
            </tr>
            <tr>
              <td><kbd>F</kbd></td>
              <td>полный экран</td>
            </tr>
            <tr>
              <td><kbd>H</kbd></td>
              <td>спрятать панель внизу</td>
            </tr>
            <tr>
              <td><kbd>E</kbd> <kbd>M</kbd></td>
              <td>редактор и миникарта в <code>slidemachina dev</code></td>
            </tr>
            <tr>
              <td><kbd>Cmd</kbd> <kbd>P</kbd></td>
              <td>печать в PDF</td>
            </tr>
          </tbody>
        </table>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Slide cover valign="top" background="var(--dark-background)">
      <h1>Спасибо</h1>
      <Machina.Code lang="bash">{`npm create slidemachina`}</Machina.Code>
      <Machina.Scene full orbit={12}>
        <Machina.Sphere size={1.6} position={[0, 0.8, 0]} color="var(--muted-color)" material="metal" />
        <Machina.Cube size={1.1} position={[-2, 0.55, -1]} rotation={[0, 20, 0]} material="glossy" />
        <Machina.Sphere size={0.9} position={[2, 0.45, -0.8]} color="var(--second-accent-color)" material="glossy" />
        <Machina.Cube size={0.9} position={[1.6, 0.45, 1.6]} rotation={[0, 35, 0]} color="var(--text-color)" material="glossy" />
        <Machina.Sphere size={0.8} position={[-1.6, 0.4, 1.6]} material="glossy" />
        <Machina.Cube size={[0.6, 1.8, 0.6]} position={[0.2, 0.9, -2.2]} rotation={[0, 12, 0]} color="var(--second-accent-color)" />
      </Machina.Scene>
    </Machina.Slide>

    <Machina.Slide hidden>
      <h2>Запасной слайд</h2>
      <p>Он скрыт: при показе, в PDF и PowerPoint его нет.</p>
      <p>Он ждёт вопросов из зала. Открыть его можно из навигатора или по адресу.</p>
    </Machina.Slide>
  </Machina.Presentation>
);

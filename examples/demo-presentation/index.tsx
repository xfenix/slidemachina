import * as Machina from "slidemachina";
import duskPicture from "./images/dusk.webp";
import editorPicture from "./images/source-editor.webp";
import glassCardsPicture from "./images/glass-cards.webp";
import glassCardsSquarePicture from "./images/glass-cards-square.webp";
import navigatorPicture from "./images/navigator.webp";
import navigatorSectionsPicture from "./images/navigator-sections.webp";
import presentationListPicture from "./images/presentation-list.webp";
import printViewPicture from "./images/print-view.webp";
import sceneOrbitPoster from "./images/scene-orbit-poster.webp";
import sceneOrbitVideo from "./images/scene-orbit.webm";
import slidemachinaMarkPicture from "./images/slidemachina-mark.svg";

export default (
  <Machina.Presentation title="slidemachina" date="2026-10-23" lang="ru" logo={Machina.SlidemachinaLogo}>
    <Machina.Slide cover logo="center">
      <h1>Слайды из кода</h1>
      <p className="machina-lead">Шаги, схемы, 3D и морфинг в одном файле</p>
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
            <p>8</p>
            <figcaption>переходов между слайдами</figcaption>
          </figure>
          <figure className="machina-big-number">
            <p>0 КБ</p>
            <figcaption>кода подсветки в браузере</figcaption>
          </figure>
        </div>
        <Machina.Source>Замеры сборки этого демо, октябрь 2026</Machina.Source>
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
    </Machina.Section>

    <Machina.Section title="Вёрстка">
      <Machina.Slide align="center">
        <h2>По центру</h2>
        <p><code>align="center"</code> на слайде или на всей презентации</p>
      </Machina.Slide>

      <Machina.Slide background="var(--dark-background)">
        <h2>Тёмный фон</h2>
        <Machina.Code lang="tsx">{`
          <Slide background="#14161d">
          <Slide background={photo} tone="dark">
        `}</Machina.Code>
        <ul>
          <li>Текст, код и логотип на тёмном светлеют</li>
          <li>Движок сам определяет тон по цвету или картинке</li>
          <li>Если движок ошибся, задайте <code>tone</code>, как во второй строке кода</li>
        </ul>
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
              >
            `}</Machina.Code>
          </div>
          <ul>
            <li>Формат: 16:9, 4:3, 9:16 или свой</li>
            <li>Текст по центру на всех слайдах</li>
            <li>Переход и его скорость</li>
            <li>Знак между разделами в крошках</li>
          </ul>
        </div>
        <p className="machina-note">Презентация 4:3 «Итоги квартала» лежит в <code>examples/team-sync</code></p>
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
        <h2>Из колонки на весь слайд</h2>
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
            <Presentation title="Доклад" lang="ru">
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
        <h2>Кадр на нужной части</h2>
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
        <h2>Морфинг без разметки</h2>
        <div morph="story-card" className="flex w-1/2 flex-col gap-(--block-gap) rounded-(--block-radius) bg-(--code-background) p-(--frame-padding)">
          <p morph="story-label" className="m-0 text-(length:--secondary-text-size) text-(--muted-color) [text-box:trim-both_cap_alphabetic]">Выручка за год</p>
          <p morph="story-number" className="m-0 text-(length:--display-size) leading-none [text-box:trim-both_cap_alphabetic] font-bold tracking-(--heading-letter-spacing) text-(--accent-color)">+72%</p>
          <div className="flex h-(--display-size) items-end gap-(--block-gap)">
            <div morph="story-bar-1" className="h-[30%] flex-1 rounded-(--inline-radius) bg-(--accent-color) opacity-40" />
            <div morph="story-bar-2" className="h-[55%] flex-1 rounded-(--inline-radius) bg-(--accent-color) opacity-60" />
            <div morph="story-bar-3" className="h-[70%] flex-1 rounded-(--inline-radius) bg-(--accent-color) opacity-80" />
            <div morph="story-bar-4" className="h-full flex-1 rounded-(--inline-radius) bg-(--accent-color)" />
          </div>
        </div>
        <figcaption>Карточка</figcaption>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Морфинг без разметки</h2>
        <div morph="story-card" className="flex w-full flex-1 flex-col gap-(--block-gap) rounded-(--block-radius) bg-(--code-background) p-(--frame-padding)">
          <div className="flex items-baseline justify-between">
            <p morph="story-label" className="m-0 text-(length:--secondary-text-size) text-(--muted-color) [text-box:trim-both_cap_alphabetic]">Выручка за год</p>
            <p morph="story-number" className="m-0 text-(length:--heading-size) leading-none [text-box:trim-both_cap_alphabetic] font-bold tracking-(--heading-letter-spacing) text-(--accent-color)">+72%</p>
          </div>
          <div className="flex flex-1 items-end gap-(--block-gap)">
            <div morph="story-bar-1" className="h-[30%] flex-1 rounded-(--inline-radius) bg-(--accent-color) opacity-40" />
            <div morph="story-bar-2" className="h-[55%] flex-1 rounded-(--inline-radius) bg-(--accent-color) opacity-60" />
            <div morph="story-bar-3" className="h-[70%] flex-1 rounded-(--inline-radius) bg-(--accent-color) opacity-80" />
            <div morph="story-bar-4" className="h-full flex-1 rounded-(--inline-radius) bg-(--accent-color)" />
          </div>
        </div>
        <figcaption>Карточка стала графиком</figcaption>
      </Machina.Slide>

      <Machina.Slide align="center">
        <h2>Морфинг без разметки</h2>
        <p morph="story-label" className="text-(length:--secondary-text-size) text-(--muted-color)">Выручка за год</p>
        <p morph="story-number" className="text-(length:--display-size) leading-none font-bold tracking-(--heading-letter-spacing) text-(--accent-color)">+72%</p>
        <figcaption>График стал большим числом. Пары задаёт атрибут <code>morph</code></figcaption>
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
        <h2>Восемь переходов</h2>
        <ul>
          <li><code>auto</code> - по умолчанию: морфинг или сдвиг</li>
          <li><code>morph</code> - общие элементы перетекают</li>
          <li><code>slide</code>, <code>fade</code>, <code>zoom</code> - сдвиг, проявление, приближение</li>
          <li><code>cube</code>, <code>flip</code> - куб и переворот</li>
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
    </Machina.Section>

    <Machina.Section title="Обложки">
      <Machina.Slide cover align="left" valign="bottom">
        <h1>Обложка снизу слева</h1>
        <p className="machina-lead">
          <code>align="left"</code> и <code>valign="bottom"</code>
        </p>
      </Machina.Slide>

      <Machina.Slide cover align="right" valign="top">
        <h1>Обложка сверху справа</h1>
        <p className="machina-lead">
          <code>align="right"</code> и <code>valign="top"</code>
        </p>
      </Machina.Slide>

      <Machina.Slide cover align="left">
        <Machina.Image src={navigatorSectionsPicture} alt="Навигатор: разделы и миниатюры слайдов" />
        <h1>Картинка слева</h1>
        <p className="machina-lead"><code>Image</code> стоит перед текстом</p>
      </Machina.Slide>

      <Machina.Slide cover align="right" background="var(--dark-background)">
        <h1>Картинка справа</h1>
        <p className="machina-lead"><code>Image</code> стоит после текста</p>
        <Machina.Image src={glassCardsPicture} alt="Стеклянные карточки с текстом и графиком" />
      </Machina.Slide>

      <Machina.Slide cover valign="bottom" background={duskPicture}>
        <h1>Обложка на фото</h1>
        <p className="machina-lead">Цвет текста движок подберёт по яркости картинки</p>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section
      title="3D"
      cover={
        <Machina.Slide cover align="left" valign="top" background="var(--dark-background)">
          <h1>3D</h1>
          <p className="machina-lead">Свою обложку раздела задаёт <code>cover</code></p>
          <Machina.Scene full orbit>
            <Machina.Sphere size={1.8} position={[0, 0.9, 1]} color="var(--muted-color)" material="metal" />
            <Machina.Cube size={1.6} position={[-2, 0.8, -1]} rotation={[0, 30, 0]} material="glossy" />
            <Machina.Cube size={[0.8, 2.8, 0.8]} position={[2, 1.4, -1.5]} rotation={[0, 18, 0]} color="var(--text-color)" material="glossy" />
            <Machina.Sphere size={1} position={[2.2, 0.5, 1.4]} color="var(--second-accent-color)" material="glossy" />
          </Machina.Scene>
        </Machina.Slide>
      }
    >
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
        <p className="machina-note">three.js грузится, только если в презентации есть сцена</p>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Мемы и QR">
      <Machina.Slide align="center">
        <Machina.Meme template="jd">
          <p>Извольте вставить мем</p>
          <p>не покидая слайдов</p>
        </Machina.Meme>
        <Machina.Source>Шаблон: Joseph Ducreux, Know Your Meme</Machina.Source>
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
            <Machina.Meme template="orbit" animated>
              <p>Схема, код, 3D</p>
              <p>и мем в одном файле</p>
              <figcaption>Свой шаблон с GIF: <code>images/memes/orbit</code></figcaption>
            </Machina.Meme>
          </div>
        </div>
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

    <Machina.Section title="Редактор">
      <Machina.Slide>
        <h2>Правка прямо на слайде</h2>
        <ul data-steps>
          <li><kbd>E</kbd> или карандаш на панели включают редактор в <code>slidemachina dev</code></li>
          <li>Текст: нажмите и пишите. <kbd>Enter</kbd> сохраняет, <kbd>Esc</kbd> отменяет</li>
          <li>Картинка: перетащите на неё файл, он ляжет в <code>images/</code></li>
          <li>Блок схемы: тяните в другую колонку или на другое место</li>
          <li>Правка сразу записывается в <code>index.tsx</code>, слайд остаётся на том же шаге</li>
          <li>В сборку редактор не попадает</li>
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
              <td><kbd>B</kbd> <kbd>F</kbd></td>
              <td>чёрный экран, полный экран</td>
            </tr>
            <tr>
              <td><kbd>H</kbd></td>
              <td>спрятать панель внизу</td>
            </tr>
            <tr>
              <td><kbd>E</kbd></td>
              <td>редактор в <code>slidemachina dev</code></td>
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
  </Machina.Presentation>
);

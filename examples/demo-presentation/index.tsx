import * as Machina from "slidemachina";
import duskPicture from "./images/dusk.svg";
import editorPicture from "./images/dusk.svg";
import glassCardsPicture from "./images/glass-cards.webp";
import logoOnDarkPicture from "../../assets/logos/logo-on-dark.svg";
import logoPicture from "../../assets/logos/logo-light.svg";
import navigatorPicture from "./images/navigator.webp";
import presentationListPicture from "./images/presentation-list.webp";
import sceneOrbitPoster from "./images/scene-orbit-poster.webp";
import sceneOrbitVideo from "./images/scene-orbit.webm";

export default (
  <Machina.Presentation title="slidemachina" date="2026-10-23" lang="ru" logo={{ light: logoPicture, dark: logoOnDarkPicture }}>
    <Machina.Slide cover>
      <h1>slidemachina</h1>
      <p className="text-(--muted-color)">Презентации на React</p>
    </Machina.Slide>

    <Machina.Section title="Как устроено">
      <Machina.Slide>
        <h2>Вся презентация в одном файле</h2>
        <Machina.Code lang="bash">{`npx slidemachina dev my-talk`}</Machina.Code>
        <Machina.List step>
          <li>Слайды лежат в index.tsx</li>
          <li>Из разделов получаются хлебные крошки и навигатор</li>
          <li>Сохранили файл - слайд обновился на том же шаге</li>
        </Machina.List>
      </Machina.Slide>

      <Machina.Section title="Шаги">
        <Machina.Slide>
          <h2>Шаги</h2>
          <Machina.List step>
            <li>Пункт списка появляется по нажатию</li>
            <li>
              Шаг можно поставить на часть пункта: <Machina.Step effect="highlight">вот так</Machina.Step>
            </li>
          </Machina.List>
          <Machina.Step at={1} effect="fade">
            <p>А этот абзац появился вместе с первым пунктом: at=&#123;1&#125;</p>
          </Machina.Step>
        </Machina.Slide>

        <Machina.Slide>
          <h2>Эффекты шагов</h2>
          <ul>
            <Machina.Step effect="rise">
              <li>rise - поднимается снизу, по умолчанию</li>
            </Machina.Step>
            <Machina.Step effect="fade">
              <li>fade - проявляется на месте</li>
            </Machina.Step>
            <Machina.Step effect="scale">
              <li>scale - вырастает</li>
            </Machina.Step>
            <Machina.Step effect="highlight">
              <li>highlight - загорается цветом</li>
            </Machina.Step>
            <Machina.Step effect="dim">
              <li>dim - гаснет</li>
            </Machina.Step>
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
        <Machina.Code lang="tsx">{`<Slide background="#14161d">`}</Machina.Code>
        <p>Текст, код и логотип светлеют сами</p>
      </Machina.Slide>

      <Machina.Slide background={duskPicture} plain align="center" transition="zoom">
        <h1>Картинка на весь слайд</h1>
        <p>plain убирает логотип, крошки и номер</p>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Блоки">
      <Machina.Slide>
        <h2>Большие числа</h2>
        <Machina.Columns step>
          <Machina.BigNumber label="переходов между слайдами">8</Machina.BigNumber>
          <Machina.BigNumber label="кода подсветки в браузере">0 КБ</Machina.BigNumber>
          <Machina.BigNumber label="файл на всю презентацию">1</Machina.BigNumber>
        </Machina.Columns>
        <Machina.Source>Замеры сборки этого демо, октябрь 2026</Machina.Source>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Таблица по строкам</h2>
        <Machina.Table step>
          <tr>
            <th></th>
            <th>slidemachina</th>
            <th>reveal.js</th>
          </tr>
          <tr>
            <th>Презентация</th>
            <td>index.tsx</td>
            <td>index.html</td>
          </tr>
          <tr>
            <th>Подсветка кода</th>
            <td>при сборке, Shiki</td>
            <td>в браузере, highlight.js</td>
          </tr>
          <tr>
            <th>Морфинг</th>
            <td>включается сам</td>
            <td>data-auto-animate на обоих слайдах</td>
          </tr>
          <tr>
            <th>Типограф</th>
            <td>встроен</td>
            <td>отдельно, например gulp</td>
          </tr>
        </Machina.Table>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Картинка занимает всё свободное место</h2>
        <Machina.Image src={navigatorPicture} stretch alt="Навигатор по слайдам">
          <Machina.Caption>Навигатор: Esc открывает все слайды</Machina.Caption>
        </Machina.Image>
      </Machina.Slide>

      <Machina.Slide plain background="var(--dark-background)">
        <Machina.Image src={glassCardsPicture} full alt="Стеклянные карточки с текстом и графиком на цветном фоне" />
      </Machina.Slide>

      <Machina.Slide background="var(--dark-background)">
        <h2>Видео на весь слайд</h2>
        <Machina.Video src={sceneOrbitVideo} poster={sceneOrbitPoster} full />
      </Machina.Slide>

      <Machina.Slide transition="fade" align="center">
        <Machina.Quote author='Антуан де Сент-Экзюпери, "Планета людей"'>
          Совершенство достигается не тогда, когда нечего добавить, а когда нечего убрать
        </Machina.Quote>
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
                <Code src="./examples/agent.py" lines="10-13 | 27-30" />
              </Slide>
            </Presentation>
          );
        `}</Machina.Code>
      </Machina.Slide>

      <Machina.Slide background="var(--dark-background)">
        <h2>Код из файла</h2>
        <Machina.Code src="./examples/agent.py" lines="10-13 | 16-24 | 27-30 | 32-43 | 46-48" />
      </Machina.Slide>

      <Machina.Slide>
        <h2>Морфинг кода</h2>
        <Machina.Code lang="ts">{`
          function goForward(position: Position) {
            return { slide: position.slide + 1, step: 0 };
          }
        `}</Machina.Code>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Морфинг кода</h2>
        <Machina.Code lang="ts">{`
          function goForward(position: Position, stepCounts: number[]) {
            if (position.step < stepCounts[position.slide]) { // [!code highlight:3]
              return { ...position, step: position.step + 1 };
            }
            return { slide: position.slide + 1, step: 0 };
          }
        `}</Machina.Code>
        <p>Совпавший код переезжает, новый проявляется</p>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Типограф</h2>
        <Machina.Columns widths="3 2">
          <>
            <Machina.Caption>В index.tsx</Machina.Caption>
            <Machina.Code lang="tsx">{`
              <p>
                Пишете "кавычки" и тире - как на клавиатуре.
                Предлог не повиснет в конце строки
              </p>
            `}</Machina.Code>
          </>
          <>
            <Machina.Caption>На слайде</Machina.Caption>
            <p>Пишете "кавычки" и тире - как на клавиатуре. Предлог не повиснет в конце строки</p>
          </>
        </Machina.Columns>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Схемы">
      <Machina.Slide>
        <h2>Схема из разметки</h2>
        <Machina.Columns widths="3 2">
          <Machina.Code lang="tsx">{`
            <Diagram direction="down">
              <Box id="browser">Браузер</Box>
              <Box id="server">Сервер</Box>
              <Box id="db">База</Box>
              <Arrow from="browser" to="server" label="HTTP" />
              <Arrow from="server" to="db" label="SQL" />
            </Diagram>
          `}</Machina.Code>
          <Machina.Diagram direction="down">
            <Machina.Box id="browser">Браузер</Machina.Box>
            <Machina.Box id="server">Сервер</Machina.Box>
            <Machina.Box id="db">База</Machina.Box>
            <Machina.Arrow from="browser" to="server" label="HTTP" />
            <Machina.Arrow from="server" to="db" label="SQL" />
          </Machina.Diagram>
        </Machina.Columns>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Схема по шагам</h2>
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
        <h2>Схема перестроилась</h2>
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
        <h2>Правка файла</h2>
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
        <div morph="story-card" className="flex w-[760px] flex-col gap-12 rounded-[48px] bg-(--code-background) p-16">
          <p morph="story-label" className="m-0 text-(length:--secondary-text-size) text-(--muted-color)">Выручка за год</p>
          <p morph="story-number" className="m-0 text-(length:--display-size) leading-none font-bold tracking-tight text-(--accent-color)">+72%</p>
          <div className="flex h-44 items-end gap-5">
            <div morph="story-bar-1" className="h-[30%] w-20 rounded-2xl bg-(--accent-color) opacity-40" />
            <div morph="story-bar-2" className="h-[55%] w-20 rounded-2xl bg-(--accent-color) opacity-60" />
            <div morph="story-bar-3" className="h-[70%] w-20 rounded-2xl bg-(--accent-color) opacity-80" />
            <div morph="story-bar-4" className="h-full w-20 rounded-2xl bg-(--accent-color)" />
          </div>
        </div>
        <Machina.Caption>Карточка</Machina.Caption>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Морфинг без разметки</h2>
        <div morph="story-card" className="flex w-full flex-1 flex-col gap-12 rounded-[48px] bg-(--code-background) p-16">
          <div className="flex items-baseline justify-between">
            <p morph="story-label" className="m-0 text-(length:--secondary-text-size) text-(--muted-color)">Выручка за год кекестана</p>
            <p morph="story-number" className="m-0 text-(length:--heading-size) leading-none font-bold tracking-tight text-(--accent-color)">+72%</p>
          </div>
          <div className="flex flex-1 items-end gap-10">
            <div morph="story-bar-1" className="h-[30%] flex-1 rounded-3xl bg-(--accent-color) opacity-40" />
            <div morph="story-bar-2" className="h-[55%] flex-1 rounded-3xl bg-(--accent-color) opacity-60" />
            <div morph="story-bar-3" className="h-[70%] flex-1 rounded-3xl bg-(--accent-color) opacity-80" />
            <div morph="story-bar-4" className="h-full flex-1 rounded-3xl bg-(--accent-color)" />
          </div>
        </div>
        <Machina.Caption>Карточка стала графиком</Machina.Caption>
      </Machina.Slide>

      <Machina.Slide align="center">
        <h2>Морфинг без разметки</h2>
        <p morph="story-number" className="m-0 text-(length:--display-size) leading-none font-bold tracking-tight text-(--accent-color)">+72%</p>
        <p morph="story-label" className="text-(length:--secondary-text-size) text-(--muted-color)">Выручка за год</p>
        <Machina.Caption>График стал большой цифрой. Пары задаёт атрибут morph</Machina.Caption>
      </Machina.Slide>

      <Machina.Slide align="center">
        <h2>Версия 0.1</h2>
        <p className="text-(length:--display-size) leading-tight font-bold">Слайды листаются</p>
      </Machina.Slide>

      <Machina.Slide align="center">
        <h2>Версия 0.2</h2>
        <p className="text-(length:--display-size) leading-tight font-bold">Слайды листаются и перетекают</p>
        <p className="text-(--muted-color)">Общие слова переезжают, новые проявляются</p>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Восемь переходов</h2>
        <ul>
          <li>auto - морфинг или сдвиг, по умолчанию</li>
          <li>morph - общие элементы перетекают</li>
          <li>slide, fade, zoom - сдвиг, проявление, приближение</li>
          <li>cube, flip - куб и переворот</li>
          <li>none - без перехода</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide transition="cube" background="var(--dark-background)" align="center">
        <h2>Куб</h2>
        <p>Слайд поворачивается гранью куба вместе с фоном, логотипом и номером</p>
      </Machina.Slide>

      <Machina.Slide transition="flip" align="center">
        <h2>Переворот</h2>
        <p>Слайд переворачивается, как карточка. Назад - в обратную сторону</p>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Управление" cover={false}>
      <Machina.Slide breadcrumbs="Шпаргалка">
        <h2>Клавиши</h2>
        <Machina.Table>
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
            <td>редактор в slidemachina dev</td>
          </tr>
          <tr>
            <td><kbd>Cmd</kbd> <kbd>P</kbd></td>
            <td>печать в PDF</td>
          </tr>
        </Machina.Table>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Печать и сборка">
      <Machina.Slide>
        <h2>Печать в PDF</h2>
        <Machina.List step>
          <li><kbd>Cmd</kbd> <kbd>P</kbd> кладёт каждый слайд на свою страницу 16:9</li>
          <li>Кнопка печати на панели внизу: страница на каждый шаг</li>
          <li>Фон, тёмные слайды и картинки печатаются как на экране</li>
        </Machina.List>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Сборка</h2>
        <Machina.Code lang="bash">{`npx slidemachina build`}</Machina.Code>
        <Machina.Table step>
          <tr>
            <th>Что получится</th>
            <th>Флаг для CI</th>
            <th>Зачем</th>
          </tr>
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
        </Machina.Table>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Один файл</h2>
        <Machina.Columns step>
          <Machina.BigNumber label="файл: картинки, шрифты и схемы внутри">1</Machina.BigNumber>
          <Machina.BigNumber label="секунды на сборку">0,5</Machina.BigNumber>
          <Machina.BigNumber label="кода редактора в файле">0 КБ</Machina.BigNumber>
        </Machina.Columns>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Редактор">
      <Machina.Slide>
        <h2>Правка прямо на слайде</h2>
        <Machina.List step>
          <li>E или карандаш на панели включают редактор</li>
          <li>Текст: нажмите и пишите. Enter сохраняет, Esc отменяет</li>
          <li>Картинка: перетащите на неё файл, он ляжет в images/</li>
          <li>Блок схемы: тяните в другую колонку или на другое место</li>
          <li>Правка сразу записывается в index.tsx, слайд остаётся на том же шаге</li>
        </Machina.List>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Попробуйте: нажмите E</h2>
        <Machina.Columns>
          <>
            <Machina.Image src={editorPicture} alt="Закат" />
            <Machina.Caption>Перетащите сюда свою картинку</Machina.Caption>
          </>
          <Machina.Diagram>
            <Machina.Box id="text">Текст</Machina.Box>
            <Machina.Box id="picture">Картинка</Machina.Box>
            <Machina.Box id="editor">Редактор</Machina.Box>
            <Machina.Box id="file">index.tsx</Machina.Box>
            <Machina.Arrow from="text" to="editor" />
            <Machina.Arrow from="picture" to="editor" />
            <Machina.Arrow from="editor" to="file" />
          </Machina.Diagram>
        </Machina.Columns>
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
        </Machina.Sequence>
        <Machina.Caption>Если файл изменили после загрузки, правка не запишется</Machina.Caption>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section
      title="3D"
      cover={
        <Machina.Slide cover background="var(--dark-background)">
          <h1>3D</h1>
          <p className="text-(--muted-color)">Свою обложку раздела задаёт cover</p>
        </Machina.Slide>
      }
    >
      <Machina.Slide background="var(--dark-background)" transition="zoom">
        <h2>Сцена в 3D</h2>
        <p className="text-(--muted-color)">Куб, сфера, текст и свет пишутся тегами</p>
        <Machina.Scene full orbit>
          <Machina.Camera target={[0.6, 1.7, 0]} />
          <Machina.Cube size={1.5} position={[-1.9, 0.75, 0]} rotation={[0, 28, 0]} material="glossy" />
          <Machina.Sphere size={1.6} position={[0.2, 0.8, 0.3]} color="#F4F5F8" material="glossy" />
          <Machina.Sphere size={1} position={[2, 0.5, -0.3]} color="#C9CCD6" material="metal" />
          <Machina.Cube size={[0.7, 2.4, 0.7]} position={[3.4, 1.2, -1.2]} rotation={[0, 18, 0]} color="#8B95FF" />
        </Machina.Scene>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Шаги внутри сцены</h2>
        <Machina.Columns>
          <Machina.List step>
            <li>Появляется сфера</li>
            <li>Куб переезжает и поворачивается</li>
            <li>Камера заходит сбоку</li>
            <li>Над сценой встаёт текст</li>
          </Machina.List>
          <Machina.Scene>
            <Machina.Cube id="cube" size={1.3} position={[0, 0.65, 0]} rotation={[0, 20, 0]} material="glossy" />
            <Machina.Sphere size={1.1} position={[1.4, 0.55, 0.4]} color="#F2B8A0" step={1} />
            <Machina.Move on="cube" position={[-1.4, 0.65, 0]} rotation={[0, 70, 0]} step={2} />
            <Machina.Camera position={[5.5, 3.2, 6.5]} target={[0, 0.8, 0]} step={3} />
            <Machina.Text position={[0, 2.3, 0]} size={0.45} step={4}>Готово</Machina.Text>
          </Machina.Scene>
        </Machina.Columns>
      </Machina.Slide>

      <Machina.Slide transition="flip">
        <h2>Свет и цвет из темы</h2>
        <Machina.Scene>
          <Machina.Text position={[0, 2.2, 0]} size={0.5}>Привет, сцена</Machina.Text>
          <Machina.Cube size={1.4} position={[-1.4, 0.7, 0]} rotation={[0, -24, 0]} material="glossy" />
          <Machina.Sphere id="ball" size={1.4} position={[1.4, 0.7, 0]} material="glossy" />
          <Machina.Light position={[-4, 7, 5]} />
          <Machina.Light position={[6, 2, 1]} color="#FFB45C" intensity={2} step />
          <Machina.Move on="ball" color="#FF6B57" step />
        </Machina.Scene>
        <Machina.Caption>Цвет объектов — из темы. Свет и цвет меняются по шагам</Machina.Caption>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Разметка сцены</h2>
        <Machina.Code lang="tsx">{`
          <Scene orbit>
            <Cube size={1.5} material="glossy" />
            <Sphere id="ball" position={[2, 0.5, 0]} step />
            <Move on="ball" position={[-2, 0.5, 0]} step />
            <Camera position={[5, 3, 6]} step />
            <Text position={[0, 2, 0]}>Привет</Text>
          </Scene>
        `}</Machina.Code>
        <Machina.Caption>three.js грузится, только если в презентации есть сцена</Machina.Caption>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Много презентаций">
      <Machina.Slide>
        <h2>Репозиторий презентаций</h2>
        <Machina.Columns widths="1 2">
          <Machina.Code lang="text">{`
            talks/
              theme/
                style.css
                logo.svg
              team-sync/
                index.tsx
              python-news/
                index.tsx
                style.css
          `}</Machina.Code>
          <Machina.List step>
            <li>theme/ - общая тема: шрифты, цвета, логотипы</li>
            <li>style.css в папке презентации сильнее общей темы</li>
            <li>npm create slidemachina в корне добавит новую презентацию</li>
          </Machina.List>
        </Machina.Columns>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Список презентаций</h2>
        <Machina.Image src={presentationListPicture} alt="Страница со списком презентаций" stretch>
          <Machina.Caption>Обложка — живой первый слайд, правку темы видно сразу</Machina.Caption>
        </Machina.Image>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Сборка всех</h2>
        <Machina.Code lang="bash">{`npx slidemachina build --protected`}</Machina.Code>
        <Machina.Columns widths="1 2">
          <Machina.Code lang="text">{`
            dist/
              index.html
              team-sync/
                index.html
                cover.webp
              python-news/
          `}</Machina.Code>
          <Machina.List step>
            <li>Каждая презентация в своей папке, список - в dist/index.html</li>
            <li>Обложки для списка снимает Chrome</li>
            <li>Под паролем на карточке только название</li>
            <li>Папку dist выкладывают на сервер как есть</li>
          </Machina.List>
        </Machina.Columns>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Slide cover background="var(--dark-background)">
      <h1>Спасибо</h1>
      <Machina.Code lang="bash">{`npm create slidemachina`}</Machina.Code>
      <Machina.Scene full orbit={12}>
        <Machina.Camera position={[0, 3.4, 13]} target={[0, 2.6, 0]} />
        <Machina.Cube size={1.2} position={[-3.2, 0.6, -0.6]} rotation={[0, 24, 0]} material="glossy" />
        <Machina.Sphere size={1.3} position={[-1.5, 0.65, 1.2]} color="#FF6B57" material="glossy" />
        <Machina.Sphere size={1.6} position={[1.7, 0.8, 0.8]} color="#C9CCD6" material="metal" />
        <Machina.Cube size={[0.8, 2.2, 0.8]} position={[3.3, 1.1, -0.8]} rotation={[0, 18, 0]} color="#8B95FF" material="glossy" />
      </Machina.Scene>
    </Machina.Slide>
  </Machina.Presentation>
);

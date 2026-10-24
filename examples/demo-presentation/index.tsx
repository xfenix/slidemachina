import {
  BigNumber,
  Camera,
  Caption,
  Actor,
  Arrow,
  Box,
  Code,
  Columns,
  Cube,
  Diagram,
  Focus,
  Group,
  Image,
  Light,
  List,
  Message,
  Move,
  Presentation,
  Quote,
  Scene,
  Section,
  Sequence,
  Slide,
  Source,
  Sphere,
  Step,
  Table,
  Text,
  Video,
} from "slidemachina";
import duskPicture from "./images/dusk.svg";
import editorPicture from "./images/dusk.svg";
import glassCardsPicture from "./images/glass-cards.webp";
import logoOnDarkPicture from "./images/logo-on-dark.svg";
import logoPicture from "./images/logo.svg";
import navigatorPicture from "./images/navigator.webp";
import presentationListPicture from "./images/presentation-list.webp";
import sceneOrbitPoster from "./images/scene-orbit-poster.webp";
import sceneOrbitVideo from "./images/scene-orbit.webm";

export default (
  <Presentation title="slidemachina" date="2026-10-23" lang="ru" logo={{ light: logoPicture, dark: logoOnDarkPicture }}>
    <Slide cover>
      <h1>slidemachina</h1>
      <p className="text-(--muted-color)">Презентации на React</p>
    </Slide>

    <Section title="Как устроено">
      <Slide>
        <h2>Вся презентация в одном файле</h2>
        <Code lang="bash">{`npx slidemachina dev my-talk`}</Code>
        <List step>
          <li>Слайды лежат в index.tsx</li>
          <li>Из разделов получаются хлебные крошки и навигатор</li>
          <li>Сохранили файл - слайд обновился на том же шаге</li>
        </List>
      </Slide>

      <Section title="Шаги">
        <Slide>
          <h2>Шаги</h2>
          <List step>
            <li>Пункт списка появляется по нажатию</li>
            <li>
              Шаг можно поставить на часть пункта: <Step effect="highlight">вот так</Step>
            </li>
          </List>
          <Step at={1} effect="fade">
            <p>А этот абзац появился вместе с первым пунктом: at=&#123;1&#125;</p>
          </Step>
        </Slide>

        <Slide>
          <h2>Эффекты шагов</h2>
          <ul>
            <Step effect="rise">
              <li>rise - поднимается снизу, по умолчанию</li>
            </Step>
            <Step effect="fade">
              <li>fade - проявляется на месте</li>
            </Step>
            <Step effect="scale">
              <li>scale - вырастает</li>
            </Step>
            <Step effect="highlight">
              <li>highlight - загорается цветом</li>
            </Step>
            <Step effect="dim">
              <li>dim - гаснет</li>
            </Step>
          </ul>
        </Slide>
      </Section>
    </Section>

    <Section title="Вёрстка">
      <Slide align="center">
        <h2>По центру</h2>
        <p><code>align="center"</code> на слайде или на всей презентации</p>
      </Slide>

      <Slide background="var(--dark-background)">
        <h2>Тёмный фон</h2>
        <Code lang="tsx">{`<Slide background="#14161d">`}</Code>
        <p>Текст, код и логотип светлеют сами</p>
      </Slide>

      <Slide background={duskPicture} plain align="center" transition="zoom">
        <h1>Картинка на весь слайд</h1>
        <p>plain убирает логотип, крошки и номер</p>
      </Slide>
    </Section>

    <Section title="Блоки">
      <Slide>
        <h2>Большие числа</h2>
        <Columns step>
          <BigNumber label="переходов между слайдами">8</BigNumber>
          <BigNumber label="кода подсветки в браузере">0 КБ</BigNumber>
          <BigNumber label="файл на всю презентацию">1</BigNumber>
        </Columns>
        <Source>Замеры сборки этого демо, октябрь 2026</Source>
      </Slide>

      <Slide>
        <h2>Таблица по строкам</h2>
        <Table step>
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
        </Table>
      </Slide>

      <Slide>
        <h2>Картинка занимает всё свободное место</h2>
        <Image src={navigatorPicture} stretch alt="Навигатор по слайдам">
          <Caption>Навигатор: Esc открывает все слайды</Caption>
        </Image>
      </Slide>

      <Slide plain background="var(--dark-background)">
        <Image src={glassCardsPicture} full alt="Стеклянные карточки с текстом и графиком на цветном фоне" />
      </Slide>

      <Slide background="var(--dark-background)">
        <h2>Видео на весь слайд</h2>
        <Video src={sceneOrbitVideo} poster={sceneOrbitPoster} full />
      </Slide>

      <Slide transition="fade" align="center">
        <Quote author='Антуан де Сент-Экзюпери, "Планета людей"'>
          Совершенство достигается не тогда, когда нечего добавить, а когда нечего убрать
        </Quote>
      </Slide>
    </Section>

    <Section title="Код">
      <Slide>
        <h2>Строки по шагам</h2>
        <Code lang="tsx" lines="| 4 | 5-7 | 8-10">{`
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
        `}</Code>
      </Slide>

      <Slide background="var(--dark-background)">
        <h2>Код из файла</h2>
        <Code src="./examples/agent.py" lines="10-13 | 16-24 | 27-30 | 32-43 | 46-48" />
      </Slide>

      <Slide>
        <h2>Морфинг кода</h2>
        <Code lang="ts">{`
          function goForward(position: Position) {
            return { slide: position.slide + 1, step: 0 };
          }
        `}</Code>
      </Slide>

      <Slide>
        <h2>Морфинг кода</h2>
        <Code lang="ts">{`
          function goForward(position: Position, stepCounts: number[]) {
            if (position.step < stepCounts[position.slide]) { // [!code highlight:3]
              return { ...position, step: position.step + 1 };
            }
            return { slide: position.slide + 1, step: 0 };
          }
        `}</Code>
        <p>Совпавший код переезжает, новый проявляется</p>
      </Slide>

      <Slide>
        <h2>Типограф</h2>
        <Columns widths="3 2">
          <>
            <Caption>В index.tsx</Caption>
            <Code lang="tsx">{`
              <p>
                Пишете "кавычки" и тире - как на клавиатуре.
                Предлог не повиснет в конце строки
              </p>
            `}</Code>
          </>
          <>
            <Caption>На слайде</Caption>
            <p>Пишете "кавычки" и тире - как на клавиатуре. Предлог не повиснет в конце строки</p>
          </>
        </Columns>
      </Slide>
    </Section>

    <Section title="Схемы">
      <Slide>
        <h2>Схема из разметки</h2>
        <Columns widths="3 2">
          <Code lang="tsx">{`
            <Diagram direction="down">
              <Box id="browser">Браузер</Box>
              <Box id="server">Сервер</Box>
              <Box id="db">База</Box>
              <Arrow from="browser" to="server" label="HTTP" />
              <Arrow from="server" to="db" label="SQL" />
            </Diagram>
          `}</Code>
          <Diagram direction="down">
            <Box id="browser">Браузер</Box>
            <Box id="server">Сервер</Box>
            <Box id="db">База</Box>
            <Arrow from="browser" to="server" label="HTTP" />
            <Arrow from="server" to="db" label="SQL" />
          </Diagram>
        </Columns>
      </Slide>

      <Slide>
        <h2>Схема по шагам</h2>
        <Diagram>
          <Box id="slides">index.tsx<small>слайды</small></Box>
          <Group id="build" title="Сборка" step>
            <Box id="vite">Vite</Box>
            <Box id="shiki">Shiki<small>подсветка кода</small></Box>
            <Box id="typograf" column={2}>Типограф</Box>
            <Arrow from="vite" to="shiki" />
            <Arrow from="vite" to="typograf" />
          </Group>
          <Arrow from="slides" to="vite" step={1} />
          <Group id="browser" title="Браузер" step>
            <Box id="react">React</Box>
            <Box id="elk" step>ELK<small>раскладка схем</small></Box>
            <Arrow from="react" to="elk" label="в фоне" step={3} />
          </Group>
          <Arrow from="build" to="react" label="модули" step={2} />
        </Diagram>
      </Slide>

      <Slide>
        <h2>Фокус на части схемы</h2>
        <Diagram>
          <Box id="slides">index.tsx<small>слайды</small></Box>
          <Group id="build" title="Сборка">
            <Box id="vite">Vite</Box>
            <Box id="shiki">Shiki<small>подсветка кода</small></Box>
            <Box id="typograf">Типограф</Box>
            <Arrow from="vite" to="shiki" />
            <Arrow from="vite" to="typograf" />
          </Group>
          <Group id="browser" title="Браузер">
            <Box id="react">React</Box>
            <Box id="elk">ELK<small>раскладка схем</small></Box>
            <Arrow from="react" to="elk" label="в фоне" />
          </Group>
          <Arrow from="slides" to="vite" />
          <Arrow from="build" to="react" label="модули" />
          <Focus on={["build"]} step />
          <Focus on={["react", "elk"]} step />
          <Focus step />
        </Diagram>
      </Slide>

      <Slide>
        <h2>Схема перестроилась</h2>
        <Diagram>
          <Box id="slides">index.tsx<small>слайды</small></Box>
          <Box id="styles">style.css<small>тема</small></Box>
          <Group id="build" title="Сборка">
            <Box id="vite">Vite</Box>
            <Box id="shiki">Shiki<small>подсветка кода</small></Box>
            <Box id="typograf">Типограф</Box>
            <Arrow from="vite" to="shiki" />
            <Arrow from="vite" to="typograf" />
          </Group>
          <Group id="browser" title="Браузер">
            <Box id="react">React</Box>
            <Box id="elk">ELK<small>раскладка схем</small></Box>
            <Box id="transitions">View Transitions<small>переходы</small></Box>
            <Arrow from="react" to="elk" label="в фоне" />
            <Arrow from="react" to="transitions" />
          </Group>
          <Arrow from="slides" to="vite" />
          <Arrow from="styles" to="vite" />
          <Arrow from="build" to="react" label="модули" />
        </Diagram>
      </Slide>

      <Slide background="var(--dark-background)">
        <h2>Правка файла</h2>
        <Sequence>
          <Actor id="slides">index.tsx<small>слайды</small></Actor>
          <Actor id="vite">Vite</Actor>
          <Actor id="react">React</Actor>
          <Message from="slides" to="vite" label="файл сохранён" step />
          <Message from="vite" to="react" label="обнови index.tsx" step />
          <Message id="request" from="react" to="vite" label="GET /index.tsx" step />
          <Message id="response" from="vite" to="react" label="код с подсветкой" reply step />
          <Message from="react" to="react" label="слайд и шаг на месте" step />
          <Focus on={["request", "response"]} step />
        </Sequence>
      </Slide>
    </Section>

    <Section title="Переходы">
      <Slide>
        <h2>Морфинг без разметки</h2>
        <div morph="story-card" className="flex w-[760px] flex-col gap-12 rounded-[48px] bg-(--code-background) p-16">
          <p morph="story-label" className="m-0 text-(length:--secondary-text-size) text-(--muted-color)">Выручка за год</p>
          <p morph="story-number" className="m-0 text-(length:--display-size) leading-none font-bold tracking-tight text-(--accent-color)">+42%</p>
          <div className="flex h-44 items-end gap-5">
            <div morph="story-bar-1" className="h-[30%] w-20 rounded-2xl bg-(--accent-color) opacity-40" />
            <div morph="story-bar-2" className="h-[55%] w-20 rounded-2xl bg-(--accent-color) opacity-60" />
            <div morph="story-bar-3" className="h-[70%] w-20 rounded-2xl bg-(--accent-color) opacity-80" />
            <div morph="story-bar-4" className="h-full w-20 rounded-2xl bg-(--accent-color)" />
          </div>
        </div>
        <Caption>Карточка</Caption>
      </Slide>

      <Slide>
        <h2>Морфинг без разметки</h2>
        <div morph="story-card" className="flex w-full flex-1 flex-col gap-12 rounded-[48px] bg-(--code-background) p-16">
          <div className="flex items-baseline justify-between">
            <p morph="story-label" className="m-0 text-(length:--secondary-text-size) text-(--muted-color)">Выручка за год</p>
            <p morph="story-number" className="m-0 text-(length:--heading-size) leading-none font-bold tracking-tight text-(--accent-color)">+42%</p>
          </div>
          <div className="flex flex-1 items-end gap-10">
            <div morph="story-bar-1" className="h-[30%] flex-1 rounded-3xl bg-(--accent-color) opacity-40" />
            <div morph="story-bar-2" className="h-[55%] flex-1 rounded-3xl bg-(--accent-color) opacity-60" />
            <div morph="story-bar-3" className="h-[70%] flex-1 rounded-3xl bg-(--accent-color) opacity-80" />
            <div morph="story-bar-4" className="h-full flex-1 rounded-3xl bg-(--accent-color)" />
          </div>
        </div>
        <Caption>Карточка стала графиком</Caption>
      </Slide>

      <Slide align="center">
        <h2>Морфинг без разметки</h2>
        <p morph="story-number" className="m-0 text-(length:--display-size) leading-none font-bold tracking-tight text-(--accent-color)">+42%</p>
        <p morph="story-label" className="text-(length:--secondary-text-size) text-(--muted-color)">Выручка за год</p>
        <Caption>График стал большой цифрой. Пары задаёт атрибут morph</Caption>
      </Slide>

      <Slide align="center">
        <h2>Версия 0.1</h2>
        <p className="text-(length:--display-size) leading-tight font-bold">Слайды листаются</p>
      </Slide>

      <Slide align="center">
        <h2>Версия 0.2</h2>
        <p className="text-(length:--display-size) leading-tight font-bold">Слайды листаются и перетекают</p>
        <p className="text-(--muted-color)">Общие слова переезжают, новые проявляются</p>
      </Slide>

      <Slide>
        <h2>Восемь переходов</h2>
        <ul>
          <li>auto - морфинг или сдвиг, по умолчанию</li>
          <li>morph - общие элементы перетекают</li>
          <li>slide, fade, zoom - сдвиг, проявление, приближение</li>
          <li>cube, flip - куб и переворот</li>
          <li>none - без перехода</li>
        </ul>
      </Slide>

      <Slide transition="cube" background="var(--dark-background)" align="center">
        <h2>Куб</h2>
        <p>Слайд поворачивается гранью куба вместе с фоном, логотипом и номером</p>
      </Slide>

      <Slide transition="flip" align="center">
        <h2>Переворот</h2>
        <p>Слайд переворачивается, как карточка. Назад - в обратную сторону</p>
      </Slide>
    </Section>

    <Section title="Управление" cover={false}>
      <Slide breadcrumbs="Шпаргалка">
        <h2>Клавиши</h2>
        <Table>
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
        </Table>
      </Slide>
    </Section>

    <Section title="Печать и сборка">
      <Slide>
        <h2>Печать в PDF</h2>
        <List step>
          <li><kbd>Cmd</kbd> <kbd>P</kbd> кладёт каждый слайд на свою страницу 16:9</li>
          <li>Кнопка печати на панели внизу: страница на каждый шаг</li>
          <li>Фон, тёмные слайды и картинки печатаются как на экране</li>
        </List>
      </Slide>

      <Slide>
        <h2>Сборка</h2>
        <Code lang="bash">{`npx slidemachina build`}</Code>
        <Table step>
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
        </Table>
      </Slide>

      <Slide>
        <h2>Один файл</h2>
        <Columns step>
          <BigNumber label="файл: картинки, шрифты и схемы внутри">1</BigNumber>
          <BigNumber label="секунды на сборку">0,5</BigNumber>
          <BigNumber label="кода редактора в файле">0 КБ</BigNumber>
        </Columns>
      </Slide>
    </Section>

    <Section title="Редактор">
      <Slide>
        <h2>Правка прямо на слайде</h2>
        <List step>
          <li>E или карандаш на панели включают редактор</li>
          <li>Текст: нажмите и пишите. Enter сохраняет, Esc отменяет</li>
          <li>Картинка: перетащите на неё файл, он ляжет в images/</li>
          <li>Блок схемы: тяните в другую колонку или на другое место</li>
          <li>Правка сразу записывается в index.tsx, слайд остаётся на том же шаге</li>
        </List>
      </Slide>

      <Slide>
        <h2>Попробуйте: нажмите E</h2>
        <Columns>
          <>
            <Image src={editorPicture} alt="Закат" />
            <Caption>Перетащите сюда свою картинку</Caption>
          </>
          <Diagram>
            <Box id="text">Текст</Box>
            <Box id="picture">Картинка</Box>
            <Box id="editor">Редактор</Box>
            <Box id="file">index.tsx</Box>
            <Arrow from="text" to="editor" />
            <Arrow from="picture" to="editor" />
            <Arrow from="editor" to="file" />
          </Diagram>
        </Columns>
      </Slide>

      <Slide background="var(--dark-background)">
        <h2>Правка из браузера</h2>
        <Sequence>
          <Actor id="browser">Браузер</Actor>
          <Actor id="vite">Vite</Actor>
          <Actor id="slides">index.tsx<small>слайды</small></Actor>
          <Message from="browser" to="vite" label="правка и версия файла" step />
          <Message id="write" from="vite" to="slides" label="точечная запись" step />
          <Message from="vite" to="browser" label="обнови index.tsx" step />
          <Message from="browser" to="browser" label="слайд и шаг на месте" step />
          <Focus on={["write"]} step />
        </Sequence>
        <Caption>Если файл изменили после загрузки, правка не запишется</Caption>
      </Slide>
    </Section>

    <Section title="3D">
      <Slide background="var(--dark-background)" transition="zoom">
        <h2>Сцена в 3D</h2>
        <p className="text-(--muted-color)">Куб, сфера, текст и свет пишутся тегами</p>
        <Scene full orbit>
          <Camera target={[0.6, 1.7, 0]} />
          <Cube size={1.5} position={[-1.9, 0.75, 0]} rotation={[0, 28, 0]} material="glossy" />
          <Sphere size={1.6} position={[0.2, 0.8, 0.3]} color="#F4F5F8" material="glossy" />
          <Sphere size={1} position={[2, 0.5, -0.3]} color="#C9CCD6" material="metal" />
          <Cube size={[0.7, 2.4, 0.7]} position={[3.4, 1.2, -1.2]} rotation={[0, 18, 0]} color="#8B95FF" />
        </Scene>
      </Slide>

      <Slide>
        <h2>Шаги внутри сцены</h2>
        <Columns>
          <List step>
            <li>Появляется сфера</li>
            <li>Куб переезжает и поворачивается</li>
            <li>Камера заходит сбоку</li>
            <li>Над сценой встаёт текст</li>
          </List>
          <Scene>
            <Cube id="cube" size={1.3} position={[0, 0.65, 0]} rotation={[0, 20, 0]} material="glossy" />
            <Sphere size={1.1} position={[1.4, 0.55, 0.4]} color="#F2B8A0" step={1} />
            <Move on="cube" position={[-1.4, 0.65, 0]} rotation={[0, 70, 0]} step={2} />
            <Camera position={[5.5, 3.2, 6.5]} target={[0, 0.8, 0]} step={3} />
            <Text position={[0, 2.3, 0]} size={0.45} step={4}>Готово</Text>
          </Scene>
        </Columns>
      </Slide>

      <Slide transition="flip">
        <h2>Свет и цвет из темы</h2>
        <Scene>
          <Text position={[0, 2.2, 0]} size={0.5}>Привет, сцена</Text>
          <Cube size={1.4} position={[-1.4, 0.7, 0]} rotation={[0, -24, 0]} material="glossy" />
          <Sphere id="ball" size={1.4} position={[1.4, 0.7, 0]} material="glossy" />
          <Light position={[-4, 7, 5]} />
          <Light position={[6, 2, 1]} color="#FFB45C" intensity={2} step />
          <Move on="ball" color="#FF6B57" step />
        </Scene>
        <Caption>Цвет объектов — из темы. Свет и цвет меняются по шагам</Caption>
      </Slide>

      <Slide>
        <h2>Разметка сцены</h2>
        <Code lang="tsx">{`
          <Scene orbit>
            <Cube size={1.5} material="glossy" />
            <Sphere id="ball" position={[2, 0.5, 0]} step />
            <Move on="ball" position={[-2, 0.5, 0]} step />
            <Camera position={[5, 3, 6]} step />
            <Text position={[0, 2, 0]}>Привет</Text>
          </Scene>
        `}</Code>
        <Caption>three.js грузится, только если в презентации есть сцена</Caption>
      </Slide>
    </Section>

    <Section title="Много презентаций">
      <Slide>
        <h2>Репозиторий презентаций</h2>
        <Columns widths="1 2">
          <Code lang="text">{`
            talks/
              theme/
                style.css
                logo.svg
              team-sync/
                index.tsx
              python-news/
                index.tsx
                style.css
          `}</Code>
          <List step>
            <li>theme/ - общая тема: шрифты, цвета, логотипы</li>
            <li>style.css в папке презентации сильнее общей темы</li>
            <li>npm create slidemachina в корне добавит новую презентацию</li>
          </List>
        </Columns>
      </Slide>

      <Slide>
        <h2>Список презентаций</h2>
        <Image src={presentationListPicture} alt="Страница со списком презентаций" stretch>
          <Caption>Обложка — живой первый слайд, правку темы видно сразу</Caption>
        </Image>
      </Slide>

      <Slide>
        <h2>Сборка всех</h2>
        <Code lang="bash">{`npx slidemachina build --protected`}</Code>
        <Columns widths="1 2">
          <Code lang="text">{`
            dist/
              index.html
              team-sync/
                index.html
                cover.webp
              python-news/
          `}</Code>
          <List step>
            <li>Каждая презентация в своей папке, список - в dist/index.html</li>
            <li>Обложки для списка снимает Chrome</li>
            <li>Под паролем на карточке только название</li>
            <li>Папку dist выкладывают на сервер как есть</li>
          </List>
        </Columns>
      </Slide>
    </Section>

    <Slide cover background="var(--dark-background)">
      <h1>Спасибо</h1>
      <Code lang="bash">{`npm create slidemachina`}</Code>
      <Scene full orbit={12}>
        <Camera position={[0, 3.4, 13]} target={[0, 2.6, 0]} />
        <Cube size={1.2} position={[-3.2, 0.6, -0.6]} rotation={[0, 24, 0]} material="glossy" />
        <Sphere size={1.3} position={[-1.5, 0.65, 1.2]} color="#FF6B57" material="glossy" />
        <Sphere size={1.6} position={[1.7, 0.8, 0.8]} color="#C9CCD6" material="metal" />
        <Cube size={[0.8, 2.2, 0.8]} position={[3.3, 1.1, -0.8]} rotation={[0, 18, 0]} color="#8B95FF" material="glossy" />
      </Scene>
    </Slide>
  </Presentation>
);

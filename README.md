<p align="center">
  <img src="assets/logo-light.svg#gh-light-mode-only" alt="slidemachina" width="360">
  <img src="assets/logo-on-dark.svg#gh-dark-mode-only" alt="slidemachina" width="360">
</p>

<p align="center">
  <b>Презентации на React.</b><br>
  Слайды пишутся в одном <code>index.tsx</code>.<br>
  Собираются одной командой: в HTML-файл, сайт, PDF или PowerPoint.
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white">
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white">
  <img alt="Лицензия MIT" src="https://img.shields.io/badge/license-MIT-22c55e">
</p>

<p align="center">
  <a href="#зачем">Зачем</a> ·
  <a href="#быстрый-старт">Быстрый старт</a> ·
  <a href="#возможности">Возможности</a> ·
  <a href="#чем-лучше-revealjs">Сравнение с reveal.js</a> ·
  <a href="#своя-тема">Тема</a> ·
  <a href="docs/slidemachina.md">Документация</a>
</p>

<p align="center">
  <img src="docs/readme/morph-transition.webp" alt="Морфинг: карточка вырастает в график, график — в число, слова заголовка перетекают на следующий слайд" width="860">
</p>

## Зачем

- **Слайды — компоненты React.** Слайд пишется на JSX, свой компонент лежит прямо в `index.tsx`, рядом со слайдами. TypeScript подсказывает, git хранит историю, правки идут через ревью, как код.
- **HTML откроется где угодно.** Сборка — один HTML-файл. Он открывается с диска в любом браузере, без сети и установки. Ту же сборку можно выложить на сайт.
- **PowerPoint на случай, если HTML нельзя.** `--pptx` даёт редактируемую копию презентации. Текст, код и схемы — отдельные объекты, шаги — анимации по щелчку. Файл открывается в PowerPoint и Google Slides.
- **Разделы — по желанию.** `Section` добавляет обложку раздела, хлебные крошки и группу в навигаторе. Разделы вкладываются друг в друга. Не нужны — презентация остаётся списком слайдов.

## Быстрый старт

```bash
npm create slidemachina   # спросит: одна презентация или репозиторий
cd my-talk && npm install
npm run dev               # слайды в браузере, правки видны сразу
npm run build             # спросит, что собрать
```

> [!NOTE]
> Пакетов в npm пока нет. Презентации запускаются из этого репозитория:
> ```bash
> git clone https://github.com/xfenix/slidemachina && cd slidemachina
> npm install
> npm run demo                       # демо со всеми возможностями
> npx slidemachina dev <папка>       # своя папка с index.tsx рядом с examples/
> ```

## Как выглядит презентация

```tsx
import * as Machina from "slidemachina";
import logoPicture from "./images/logo.svg";

export default (
  <Machina.Presentation title="Доклад" lang="ru" aspectRatio="16:9" logo={logoPicture}>
    <Machina.Slide cover>
      <h1>Доклад</h1>
    </Machina.Slide>

    <Machina.Section title="Как устроено">
      <Machina.Slide>
        <h2>Три шага</h2>
        <ul data-steps>
          <li>Пункт появляется по нажатию</li>
          <li>Сохранили файл — слайд обновился на том же шаге</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Схема</h2>
        <Machina.Diagram>
          <Machina.Box id="browser">Браузер</Machina.Box>
          <Machina.Box id="server">Сервер</Machina.Box>
          <Machina.Arrow from="browser" to="server" label="HTTP" step />
        </Machina.Diagram>
      </Machina.Slide>
    </Machina.Section>
  </Machina.Presentation>
);
```

Раздел даёт слайд-обложку, хлебные крошки и группу в навигаторе.
Формат слайдов — `aspectRatio` у `Presentation`, по умолчанию `16:9`.
В этом формате миниатюры, PDF и PowerPoint.
На экране слайд растёт под окно, но не больше чем на треть: фон доходит до краёв, кегли те же.
Стиль лежит в `style.css` рядом, картинки — в `images/`.
TypeScript подсказывает компоненты и их свойства.

## Возможности

<table>
  <tr>
    <td width="50%"><img src="docs/readme/diagram-steps.webp" alt="Схема собирается по шагам и перестраивается"></td>
    <td width="50%"><img src="docs/readme/scene-3d.webp" alt="3D-сцена: фигуры двигаются по шагам"></td>
  </tr>
  <tr>
    <td><b>Схемы из тегов.</b> <code>Diagram</code> и <code>Sequence</code> раскладывает ELK. Блоки появляются по шагам и перетекают между слайдами.</td>
    <td><b>3D-сцены.</b> <code>Scene</code> на three.js. Фигуры пишутся тегами, свет движок ставит сам. three.js грузится, только если сцена есть.</td>
  </tr>
  <tr>
    <td><img src="docs/readme/slide-code.webp" alt="Слайд с кодом из файла"></td>
    <td><img src="docs/readme/slide-typography.webp" alt="Висячая пунктуация: кавычка, маркер, номер и $ вынесены за край текста"></td>
  </tr>
  <tr>
    <td><b>Код.</b> Подсветка Shiki при сборке, в браузере её код не нужен. Код из файла, строки по шагам, морфинг кода по кускам.</td>
    <td><b>Типограф.</b> Кавычки, тире и неразрывные пробелы для русского и английского. Висячая пунктуация в тексте и в коде.</td>
  </tr>
  <tr>
    <td><img src="docs/readme/slide-photo.webp" alt="Картинка на весь слайд"></td>
    <td><img src="docs/readme/slide-qr.webp" alt="Слайд с QR-кодом"></td>
  </tr>
  <tr>
    <td><b>Картинки и видео.</b> На свободное место или на весь слайд. На тёмном фоне текст и логотип светлеют сами.</td>
    <td><b>QR и мемы.</b> QR-код с логотипом рисуется вектором. Мемы и GIF ищет команда <code>slidemachina meme</code>.</td>
  </tr>
</table>

Ещё:
- переходы `slide`, `fade`, `zoom`, `cube`, `flip`, `morph`, скорость у всей презентации или у слайда;
- шаги на списке, таблице, колонках, части схемы или сцены;
- навигатор с миниатюрами, переход по номеру, пауза с чёрным экраном, полный экран, полоса прогресса;
- тезисы в одну фразу, фон из видео, GIF или страницы, блок поверх вёрстки;
- хуки для своего кода: `useSlide()`, `onEnter`, `onLeave`, `onChange`;
- клавиши работают и в русской раскладке, на телефоне листает свайп или касание.

## Инструменты

<table>
  <tr>
    <td width="58%"><img src="examples/demo-presentation/images/source-editor.webp" alt="Редактор на слайде"></td>
    <td><b>Правка прямо на слайде.</b><br>Нажмите E в <code>slidemachina dev</code>. Текст, картинки, блоки схем и сами слайды пишутся обратно в <code>index.tsx</code>.</td>
  </tr>
  <tr>
    <td><img src="examples/demo-presentation/images/navigator.webp" alt="Навигатор с миниатюрами по разделам"></td>
    <td><b>Навигатор.</b><br>Миниатюры по разделам. Esc или O открывает навигатор, Enter — выбранный слайд.</td>
  </tr>
  <tr>
    <td><img src="examples/demo-presentation/images/print-view.webp" alt="Печатная версия"></td>
    <td><b>Печать и PDF.</b><br>Страница на слайд или на каждый шаг. <code>slidemachina build --pdf</code> или печать из браузера.</td>
  </tr>
  <tr>
    <td><img src="examples/demo-presentation/images/presentation-list.webp" alt="Список презентаций с обложками"></td>
    <td><b>Репозиторий докладов.</b><br>Общая тема, список с обложками, сборка всех презентаций сразу.</td>
  </tr>
</table>

## Сборка

Без флагов `slidemachina build` спросит, что собрать.
В CI флаги складываются: `slidemachina build --html --folder --pdf --pptx`.

| Флаг | Результат |
|---|---|
| `--html` | Один HTML-файл, шрифты и картинки внутри. Открывается с диска |
| `--protected` | Тот же файл под паролем |
| `--folder`, `--zip` | Папка для сайта или она же в архиве |
| `--pdf`, `--steps` | PDF: страница на слайд или на каждый шаг |
| `--pptx` | PowerPoint. Текст, таблицы, код, картинки, блоки и стрелки схем — отдельные объекты, их можно править. Шаги — анимация по щелчку |

## Чем лучше reveal.js

| | reveal.js | slidemachina |
|---|---|---|
| Разметка | HTML: `<section>` в `index.html` | JSX в `index.tsx` с подсказками TypeScript |
| Разделы | Вложенные `<section>` — вертикальные слайды. Хлебных крошек и обложек разделов нет | `Section`: обложка с номером, хлебные крошки, группы в навигаторе |
| Шаги | `class="fragment"` на каждом элементе | `step` на списке, таблице, колонках, части схемы или сцены |
| Морфинг | `data-auto-animate` на обоих слайдах, пары через `data-id` | Включён по умолчанию. Общие элементы, слова и куски кода находятся сами |
| Подсветка кода | highlight.js в браузере | Shiki при сборке: в браузере 0 КБ кода подсветки |
| Схемы | Mermaid сторонним плагином | `Diagram` и `Sequence` с автораскладкой ELK |
| 3D | Нет | `Scene` на three.js |
| Типограф | Нет | Для русского и английского |
| Сборка | Сборщик настраиваете сами | HTML-файл, папка, zip, файл под паролем, PDF, PowerPoint |
| Правка | В редакторе кода | Ещё и на слайде, с записью в `index.tsx` |
| Много докладов | Каждый сам по себе | Репозиторий: общая тема, список, сборка всех сразу |

## Своя тема

Тема — CSS-переменные в `style.css` рядом с `index.tsx`.
Поменяли переменную — поменялись все слайды.

```css
@import "tailwindcss";

@font-face {
  font-family: "Golos Text";
  font-weight: 400 900;
  src: url("./fonts/golos-text.woff2") format("woff2-variations");
}

:root {
  --accent-color: #e8574c;        /* маркеры, ссылки, ключевые слова кода, числа */
  --second-accent-color: #2f7d6d; /* строки в коде, второй конец градиента раздела */
  --slide-background: #fbfaf7;    /* фон обычного слайда */
  --dark-background: #15161b;     /* фон тёмных слайдов */
  --section-background: #1d2233;  /* фон обложек разделов */
  --font-text: "Golos Text", system-ui, sans-serif;
}
```

<details>
<summary><b>Все места, где настраивается вид</b></summary>

| Что меняем | Где |
|---|---|
| Цвета | `--accent-color`, `--second-accent-color`, `--text-color`, `--muted-color`, фоны `--slide-background`, `--dark-background`, `--section-background` |
| Шрифты | `--font-text`, `--font-heading`, `--font-code`. Свой шрифт — через `@font-face` в том же `style.css` |
| Кегли | Четыре уровня: `--secondary-text-size` 28, `--text-size` 40, `--heading-size` 56, `--display-size` 112. Остальные размеры берутся от них |
| Рамка слайда | `--frame-padding` по бокам и снизу, `--frame-top` сверху, `--heading-gap` под заголовком |
| Обложки разделов | `--section-background`, `--section-number-start-color`, `--section-number-end-color`, `--section-number-size`, `--section-texture`. Или свой слайд в `cover` у `Section` |
| Движение | `speed` у `Presentation` или `Slide`, длительности `--transition-duration` и соседние, кривая `--transition-easing` |
| Формат | `<Presentation aspectRatio="4:3">`, по умолчанию `16:9`. Миниатюры, PDF и PowerPoint — в этом формате, на экране слайд растёт под окно до трети |
| Разделитель крошек | `<Presentation breadcrumbsSeparator="/">`, по умолчанию `›` |

- Логотип — `logo` у `Presentation`: файл, `{ light, dark }` для светлых и тёмных слайдов или компонент. Компонент получает `dark={true}` на тёмных слайдах. Логотип движка — `logo={Machina.SlidemachinaLogo}`.
- Место логотипа — `logo` у `Slide`: `"top-right"` (по умолчанию), `"top"`, `"center"` над заголовком, `"bottom"` или `false`.
- Тёмный слайд — `background` у `Slide`, цвет или картинка.
- Один слайд по-своему — `className` у `Slide` и классы Tailwind прямо в разметке.
- Общая тема нескольких докладов — `theme/style.css` в репозитории презентаций. Тема доклада сильнее общей.

Все переменные с описанием — в разделе «Тема» в [docs/slidemachina.md](docs/slidemachina.md).

</details>

## Чего пока нет

- Заметок и окна докладчика.
- Пакетов в npm.

## Разработка

```bash
npm install
npm run demo     # демо со всеми возможностями
npm run check    # TypeScript, Oxlint и границы модулей
npm test         # интеграционные тесты на Playwright
```

Устройство движка, решения и ограничения — в [docs/slidemachina.md](docs/slidemachina.md).
Правила для кода — в [AGENTS.md](AGENTS.md).

## Лицензия

[MIT](LICENSE)

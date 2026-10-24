# Мой доклад

Презентация на slidemachina. Слайды лежат в `index.tsx`, тема — в `style.css`, картинки — в `images/`.

## Команды

```bash
npm install
npm run dev      # открыть в браузере, правки видны сразу
npm run build    # собрать: спросит, что именно
```

Без вопросов, например в CI:

```bash
npx slidemachina build --html        # один HTML-файл, картинки и шрифты внутри
npx slidemachina build --protected   # один файл под паролем из SLIDEMACHINA_PASSWORD
npx slidemachina build --folder      # папка для сайта, --zip — она же в архиве
npx slidemachina build --pdf         # PDF, страница на слайд; с --steps — на каждый шаг
```

Результат появится в `dist/`. Другую папку задают флагом `--out`.

## Слайды

Компоненты берутся одним импортом: `import * as Machina from "slidemachina"`. Дальше `<Machina.Slide>`, `<Machina.Image>` и так далее, в таблице ниже приставка опущена.

```tsx
<Machina.Presentation title="Мой доклад" lang="ru" logo={{ light: logo, dark: logoOnDark }}>
  <Machina.Slide cover>
    <h1>Мой доклад</h1>
  </Machina.Slide>
  <Machina.Section title="Начало">
    <Machina.Slide>
      <h2>Заголовок</h2>
      <p>Обычный текст</p>
    </Machina.Slide>
  </Machina.Section>
</Machina.Presentation>
```

- `Section` — раздел. Из разделов получаются обложки, хлебные крошки и оглавление в навигаторе. `cover={false}` убирает обложку раздела, `cover={<Machina.Slide>…</Machina.Slide>}` заменяет её своей.
- `Slide`: `cover` — обложка, `align="center"` — по центру, `background="#14161d"` или картинка, `plain` — без логотипа, крошек и номера, `transition` — свой переход.
- Переходы: `auto`, `morph`, `slide`, `fade`, `zoom`, `cube`, `flip`, `none`. По умолчанию `auto`: если на соседних слайдах есть общие элементы, они перетекают, если нет — слайд сдвигается.
- Скорость переходов и шагов — `speed` у `Presentation` или `Slide`: `fast`, `normal` (по умолчанию), `slow` или число. `speed={2}` — вдвое быстрее.

## Блоки

| Блок | Пример |
| --- | --- |
| Список по шагам | `<List step><li>Первый</li><li>Второй</li></List>` |
| Шаг на любом месте | `<Step effect="highlight">вот так</Step>`, эффекты `rise`, `fade`, `scale`, `highlight`, `dim` |
| Код | `<Code lang="ts">{"const answer = 42;"}</Code>` или `<Code src="./app.py" lines="2-4 \| 8" />` — строки по шагам |
| Картинка | `<Image src={photo} stretch />` — на свободное место, `full` — на весь слайд |
| Видео | `<Video src={clip} poster={still} stretch />` — играет без звука, пока слайд на экране |
| Колонки | `<Columns widths="1 2">...</Columns>` |
| Таблица | `<Table step><tr><th>…</th></tr>…</Table>` — строки по шагам |
| Цитата | `<Quote author="Автор">Текст</Quote>` |
| Большое число | `<BigNumber label="подпись">42</BigNumber>` |
| Подпись и источник | `<Caption>…</Caption>`, `<Source>…</Source>` |
| Схема | `<Diagram><Box id="a">A</Box><Box id="b">B</Box><Arrow from="a" to="b" /></Diagram>` |
| Диаграмма обмена | `<Sequence><Actor id="a">A</Actor><Actor id="b">B</Actor><Message from="a" to="b" label="запрос" /></Sequence>` |
| 3D-сцена | `<Scene orbit><Cube size={1.5} /><Sphere position={[2, 0.5, 0]} step /></Scene>` |

Два элемента на соседних слайдах перетекают друг в друга, если у них одинаковый текст или `morph="имя"`.

## Клавиши

| Клавиша | Что делает |
| --- | --- |
| → , пробел, PageDown | дальше |
| ← , PageUp | назад |
| Esc или O | все слайды |
| номер и Enter | перейти к слайду |
| B | чёрный экран |
| F | полный экран |
| H | спрятать панель |
| E | править текст и картинки прямо на слайде, только в `npm run dev` |
| Cmd+P или Ctrl+P | печать в PDF |

## Тема

Тема — это CSS-переменные в `style.css`. Главные уже выписаны там в комментарии: раскомментируйте строку и поменяйте значение.

```css
:root {
  --accent-color: #e8574c;
  --section-background: #1c2030;
}
```

Классы Tailwind работают прямо в `index.tsx`: `className="text-(--muted-color)"`.

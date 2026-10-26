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
- `Slide`: `cover` — обложка, `align` — `left`, `center` или `right`, `valign` — `top`, `center` или `bottom`, `background="#14161d"` или картинка, `plain` — без логотипа, крошек и номера, `transition` — свой переход.
- Переходы: `auto`, `morph`, `slide`, `fade`, `zoom`, `cube`, `flip`, `none`. По умолчанию `auto`: если на соседних слайдах есть общие элементы, они перетекают, если нет — слайд сдвигается.
- Скорость переходов и шагов — `speed` у `Presentation` или `Slide`: `fast`, `normal` (по умолчанию), `slow` или число. `speed={2}` — вдвое быстрее.
- Формат слайдов — `aspectRatio` у `Presentation`: `"16:9"` (по умолчанию), `"4:3"`, `"16:10"`, `"9:16"` или любая пара чисел. Один формат на всю презентацию: показ, навигатор и PDF. Окно меняет только масштаб, по краям остаются поля.
- Номер слайда видно в редакторе кода: наведите курсор на `<Machina.Slide>` или `<Machina.Section>`. Подсказка — «Слайд 7 · #7», как в адресе презентации. VS Code при первом открытии папки спросит, брать ли TypeScript из проекта: ответьте «Allow». Zed и WebStorm берут его сами.

## Блоки

| Блок | Пример |
| --- | --- |
| Список по шагам | `<ul data-steps><li>Первый</li><li>Второй</li></ul>`. `data-steps={3}` — с третьего шага |
| Шаг на любом месте | `<span data-step data-step-effect="highlight">вот так</span>`, эффекты `rise`, `fade`, `scale`, `highlight`, `dim` |
| Код | `<Code lang="ts">{"const answer = 42;"}</Code>` или `<Code src="./app.py" lines="2-4 \| 8" numbers />` — строки по шагам, `numbers` — номера строк |
| Картинка | `<Image src={photo} stretch />` — на свободное место, `full` — на весь слайд. `float="left"` или `"right"` — текст обтекает картинку. На обложке `<Image>` перед текстом стоит слева от него, после — справа |
| Видео | `<Video src={clip} poster={still} stretch />` — играет без звука, пока слайд на экране |
| Колонки | `<div className="machina-columns"><div>…</div><div>…</div></div>` — каждая колонка в своём `<div>`. Ширины: `style={{ gridTemplateColumns: "1fr 2fr" }}` |
| Таблица | `<table data-steps><thead>…</thead><tbody>…</tbody></table>` — строки по шагам |
| Цитата | `<figure><blockquote>Текст</blockquote><figcaption>Автор</figcaption></figure>` |
| Большое число | `<figure className="machina-big-number"><p>42</p><figcaption>подпись</figcaption></figure>` |
| Текст | `<p className="machina-lead">` — вводная фраза, `<p>` — основной текст, `<p className="machina-note">` — пометка мелким шрифтом |
| Подпись и источник | `<figcaption>…</figcaption>` сразу после блока, `<Source>…</Source>` |
| QR-код | `<QR value="https://…" logo={logo} />` — на свободное место, фон прозрачный |
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

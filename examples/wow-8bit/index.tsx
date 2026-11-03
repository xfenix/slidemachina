import * as Machina from "slidemachina";

const heartRows = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];

const starRows = [
  "000010000",
  "000111000",
  "000111000",
  "011111110",
  "111111111",
  "011111110",
  "001111100",
  "000111000",
  "000111000",
];

const coinRows = ["0111110", "1100011", "1000001", "1000001", "1000001", "1100011", "0111110"];

function PixelHeart() {
  return (
    <svg className="pixel-heart" viewBox="0 0 7 6" shapeRendering="crispEdges" aria-hidden>
      {heartRows.flatMap((heartRow, rowIndex) =>
        heartRow.split("").map((heartCell, columnIndex) =>
          heartCell === "1" ? (
            <rect
              key={`${rowIndex}-${columnIndex}`}
              x={columnIndex}
              y={rowIndex}
              width={1}
              height={1}
              fill={rowIndex === 1 && columnIndex === 2 ? "#ffffff" : "#ff4d6d"}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

function PixelArt({ pictureRows, pictureFill, pictureShade, shinePosition }: PixelArtProperties) {
  const pixelWidth = pictureRows[0]!.length;
  const pixelHeight = pictureRows.length;
  return (
    <svg className="pixel-art" viewBox={`0 0 ${pixelWidth} ${pixelHeight}`} shapeRendering="crispEdges" aria-hidden>
      {pictureRows.flatMap((pictureRow, rowIndex) =>
        pictureRow.split("").map((pictureCell, columnIndex) => {
          if (pictureCell !== "1") return null;
          const isShinePixel = shinePosition[0] === columnIndex && shinePosition[1] === rowIndex;
          const isShadedEdge = columnIndex === pixelWidth - 1 || rowIndex === pixelHeight - 1;
          return (
            <rect
              key={`${rowIndex}-${columnIndex}`}
              x={columnIndex}
              y={rowIndex}
              width={1}
              height={1}
              fill={isShinePixel ? "#ffffff" : isShadedEdge ? pictureShade : pictureFill}
            />
          );
        }),
      )}
    </svg>
  );
}

type PixelArtProperties = {
  pictureRows: string[];
  pictureFill: string;
  pictureShade: string;
  shinePosition: [number, number];
};

export default (
  <Machina.Presentation title="8 бит" lang="ru" date="2026-11-02">
    <Machina.Slide cover>
      <h1>8 бит</h1>
      <p className="machina-lead">Тема в стиле ретро-игры</p>
      <PixelHeart />
      <p className="pixel-blink machina-note">Нажми старт</p>
      <Machina.Notes>
        <p>Поприветствуйте зал, назовите тему доклада.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Section title="Уровень 1">
      <Machina.Slide>
        <h2>Задание</h2>
        <ul data-steps>
          <li>
            Собери <span data-step data-step-effect="highlight">стиль из переменных</span>
          </li>
          <li>Нарисуй спрайты псевдоэлементами</li>
          <li>Расставь шаги как уровни</li>
          <li>Победи босса-пустоту на слайдах</li>
        </ul>
        <Machina.Notes>
          <p>Квест по одному пункту на шаг. Первый пункт подсвечивается.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Статы персонажа</h2>
        <div className="machina-columns" data-steps data-step-effect="scale">
          <figure className="machina-big-number">
            <p>100</p>
            <figcaption>здоровья</figcaption>
          </figure>
          <figure className="machina-big-number">
            <p>64</p>
            <figcaption>манны</figcaption>
          </figure>
          <figure className="machina-big-number">
            <p>12</p>
            <figcaption>уровень</figcaption>
          </figure>
        </div>
        <Machina.Notes>
          <p>По цифре на шаг. Подписи не читайте.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Чит-код</h2>
        <Machina.Code lang="js" title="cheat.js" lines="| 2 | 4-5">{`const player = { hp: 100, mp: 64 };
const level = 12;
// ↑ ↑ ↓ ↓ ← → ← → B A
if (player.hp > 0) {
  castSpell(player);
}`}</Machina.Code>
        <Machina.Notes>
          <p>Код появляется по шагам: игрок, уровень, проверка здоровья.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Спрайты из кода</h2>
        <div className="machina-columns">
          <div className="machina-card pixel-sprite-card">
            <PixelArt pictureRows={starRows} pictureFill="#ffd23f" pictureShade="#d9a400" shinePosition={[2, 1]} />
            <h3>Звезда</h3>
          </div>
          <div className="machina-card pixel-sprite-card">
            <PixelArt pictureRows={coinRows} pictureFill="#3ee6ff" pictureShade="#17a5c6" shinePosition={[1, 1]} />
            <h3>Монетка</h3>
          </div>
        </div>
        <figcaption>Каждый спрайт — массив строк, нарисованный SVG-прямоугольниками</figcaption>
        <Machina.Notes>
          <p>Ни одной картинки: пиксели кодируются единицами в строках, блик — белым пикселем.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Карта уровня</h2>
        <Machina.Diagram>
          <Machina.Box id="start">Старт</Machina.Box>
          <Machina.Box id="castle">Замок</Machina.Box>
          <Machina.Box id="boss">Босс</Machina.Box>
          <Machina.Arrow from="start" to="castle" step />
          <Machina.Arrow from="castle" to="boss" step />
          <Machina.Focus on={["boss"]} step />
        </Machina.Diagram>
        <figcaption>Путь появляется по шагам, босс в фокусе</figcaption>
        <Machina.Notes>
          <p>Стрелки рисуются по шагам, фокус приглушает лишнее.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Очки по уровням</h2>
        <div className="machina-card machina-card-stretch pixel-dither">
          <ul className="machina-bars" data-steps>
            <li style={{ height: "45%" }} />
            <li style={{ height: "70%" }} />
            <li style={{ height: "95%" }} />
          </ul>
        </div>
        <figcaption>Три полосы — по одной на шаг</figcaption>
        <Machina.Notes>
          <p>Столбики растут по шагам, как шкала опыта.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Таблица рекордов</h2>
        <table data-steps>
          <thead>
            <tr>
              <th>Игрок</th>
              <th>Уровень</th>
              <th>Очки</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>pixel_witch</td>
              <td>12</td>
              <td>99 480</td>
            </tr>
            <tr>
              <td>cartridge_kid</td>
              <td>11</td>
              <td>88 120</td>
            </tr>
            <tr>
              <td>demo_scenic</td>
              <td>10</td>
              <td>76 500</td>
            </tr>
            <tr>
              <td>вы</td>
              <td>9</td>
              <td>64 000</td>
            </tr>
          </tbody>
        </table>
        <Machina.Notes>
          <p>Строки встают на табло по шагам, как в аркадном автомате.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Инвентарь</h2>
        <div className="machina-columns">
          <div className="machina-card">
            <h3>Рука</h3>
            <p>Меч</p>
          </div>
          <div className="machina-card">
            <h3>Спина</h3>
            <p>Щит</p>
          </div>
        </div>
        <Machina.Notes>
          <p>Две ячейки инвентаря. Следующий слайд перетечёт в них морфингом.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Инвентарь</h2>
        <div className="machina-columns">
          <div className="machina-card">
            <h3>Рука</h3>
            <p>Лук</p>
          </div>
          <div className="machina-card">
            <h3>Спина</h3>
            <p>Щит</p>
          </div>
        </div>
        <Machina.Notes>
          <p>Карточки перетекли сами: общие теги нашлись без разметки.</p>
        </Machina.Notes>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Босс">
      <Machina.Slide>
        <h2>Голос мастера</h2>
        <figure>
          <blockquote>Убей дракона, спаси принцессу, успей к дедлайну.</blockquote>
          <figcaption>каждый геймдизайнер</figcaption>
        </figure>
        <Machina.Notes>
          <p>Цитата короткая, автор подписан.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide background="var(--accent-color)" transition="fade">
        <p className="machina-thesis">Хорошая тема проходит босса без потери жизней</p>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Slide cover>
      <h1>Спасибо за игру</h1>
      <PixelHeart />
      <p className="pixel-blink machina-note">Нажми старт ещё раз</p>
      <Machina.Notes>
        <p>Поблагодарите зал. Сердечко — SVG-спрайт из массива строк, вся графика в разметке.</p>
      </Machina.Notes>
    </Machina.Slide>
  </Machina.Presentation>
);

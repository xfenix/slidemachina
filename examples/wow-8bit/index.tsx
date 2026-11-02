import * as Machina from "slidemachina";

export default (
  <Machina.Presentation title="8 бит" lang="ru" date="2026-11-02">
    <Machina.Slide cover>
      <h1>8 бит</h1>
      <p className="machina-lead">Тема в стиле ретро-игры</p>
      <div className="pixel-heart" aria-hidden />
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
    </Machina.Section>

    <Machina.Slide cover>
      <h1>Спасибо за игру</h1>
      <div className="pixel-heart" aria-hidden />
      <p className="pixel-blink machina-note">Нажми старт ещё раз</p>
      <Machina.Notes>
        <p>Поблагодарите зал. Сердечко из box-shadow — тоже тема.</p>
      </Machina.Notes>
    </Machina.Slide>
  </Machina.Presentation>
);

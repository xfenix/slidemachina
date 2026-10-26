import * as Machina from "slidemachina";
import logoOnDarkPicture from "../theme/logo-on-dark.svg";
import logoPicture from "../theme/logo.svg";

export default (
  <Machina.Presentation title="Итоги квартала" date="2026-10-16" lang="ru" aspectRatio="4:3" logo={{ light: logoPicture, dark: logoOnDarkPicture }}>
    <Machina.Slide cover>
      <h1>Итоги квартала</h1>
      <p className="machina-lead">Команда платформы, октябрь 2026</p>
    </Machina.Slide>

    <Machina.Section title="Что сделали">
      <Machina.Slide>
        <h2>Главное</h2>
        <p className="machina-lead">Доклады команды переехали на slidemachina</p>
        <ul data-steps>
          <li>Все доклады живут в одном репозитории</li>
          <li>Тема общая: шрифт, цвета и логотип в папке <code>theme</code></li>
          <li>Новый доклад - одна команда <code>npm create slidemachina</code></li>
          <li>Сайт со всеми докладами собирает <code>npx slidemachina build</code></li>
        </ul>
      </Machina.Slide>

      <Machina.Slide align="center">
        <h2>В цифрах</h2>
        <div className="machina-columns" data-steps>
          <figure className="machina-big-number">
            <p>2</p>
            <figcaption>доклада в репозитории</figcaption>
          </figure>
          <figure className="machina-big-number">
            <p>1</p>
            <figcaption>тема на всех</figcaption>
          </figure>
          <figure className="machina-big-number">
            <p>1</p>
            <figcaption>команда для сборки</figcaption>
          </figure>
        </div>
        <Machina.Source>Пример для slidemachina, числа условные</Machina.Source>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Планы">
      <Machina.Slide>
        <h2>Следующий квартал</h2>
        <ul data-steps>
          <li>Перенести старые доклады с reveal.js</li>
          <li>Собирать сайт с докладами в CI</li>
          <li>Класть рядом с каждым докладом PDF: флаг <code>--pdf</code></li>
        </ul>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Slide cover>
      <h1>Спасибо</h1>
      <p className="machina-lead">Вопросы?</p>
    </Machina.Slide>
  </Machina.Presentation>
);

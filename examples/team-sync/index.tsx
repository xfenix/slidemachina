import * as Machina from "slidemachina";
import logoOnDarkPicture from "../theme/logo-on-dark.svg";
import logoPicture from "../theme/logo.svg";

export default (
  <Machina.Presentation title="Итоги квартала" date="2026-10-16" lang="ru" logo={{ light: logoPicture, dark: logoOnDarkPicture }}>
    <Machina.Slide cover>
      <h1>Итоги квартала</h1>
      <p className="text-(--muted-color)">Команда платформы, октябрь 2026</p>
    </Machina.Slide>

    <Machina.Section title="Что сделали">
      <Machina.Slide>
        <h2>Главное</h2>
        <Machina.List step>
          <li>Все доклады команды живут в одном репозитории</li>
          <li>Тема общая: шрифт, цвета и логотип в папке theme</li>
          <li>Новый доклад - одна команда npm create slidemachina</li>
        </Machina.List>
      </Machina.Slide>

      <Machina.Slide>
        <h2>В цифрах</h2>
        <Machina.Columns step>
          <Machina.BigNumber label="доклада в репозитории">2</Machina.BigNumber>
          <Machina.BigNumber label="тема на всех">1</Machina.BigNumber>
          <Machina.BigNumber label="команда для сборки">1</Machina.BigNumber>
        </Machina.Columns>
        <Machina.Source>Пример для slidemachina, числа условные</Machina.Source>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Планы">
      <Machina.Slide>
        <h2>Следующий квартал</h2>
        <Machina.List step>
          <li>Перенести старые доклады с reveal.js</li>
          <li>Собирать сайт с докладами в CI</li>
        </Machina.List>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Slide cover>
      <h1>Спасибо</h1>
      <p className="text-(--muted-color)">Вопросы?</p>
    </Machina.Slide>
  </Machina.Presentation>
);

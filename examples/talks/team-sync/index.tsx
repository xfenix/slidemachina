import { BigNumber, Columns, List, Presentation, Section, Slide, Source } from "slidemachina";
import logoOnDarkPicture from "../theme/logo-on-dark.svg";
import logoPicture from "../theme/logo.svg";

export default (
  <Presentation title="Итоги квартала" date="2026-10-16" lang="ru" logo={{ light: logoPicture, dark: logoOnDarkPicture }}>
    <Slide cover>
      <h1>Итоги квартала</h1>
      <p className="text-(--muted-color)">Команда платформы, октябрь 2026</p>
    </Slide>

    <Section title="Что сделали">
      <Slide>
        <h2>Главное</h2>
        <List step>
          <li>Все доклады команды живут в одном репозитории</li>
          <li>Тема общая: шрифт, цвета и логотип в папке theme</li>
          <li>Новый доклад - одна команда npm create slidemachina</li>
        </List>
      </Slide>

      <Slide>
        <h2>В цифрах</h2>
        <Columns step>
          <BigNumber label="доклада в репозитории">2</BigNumber>
          <BigNumber label="тема на всех">1</BigNumber>
          <BigNumber label="команда для сборки">1</BigNumber>
        </Columns>
        <Source>Пример для slidemachina, числа условные</Source>
      </Slide>
    </Section>

    <Section title="Планы">
      <Slide>
        <h2>Следующий квартал</h2>
        <List step>
          <li>Перенести старые доклады с reveal.js</li>
          <li>Собирать сайт с докладами в CI</li>
        </List>
      </Slide>
    </Section>

    <Slide cover>
      <h1>Спасибо</h1>
      <p className="text-(--muted-color)">Вопросы?</p>
    </Slide>
  </Presentation>
);

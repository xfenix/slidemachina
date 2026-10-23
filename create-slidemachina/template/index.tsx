import { Arrow, Box, Code, Diagram, List, Presentation, Section, Slide } from "slidemachina";
import duskPicture from "./images/dusk.svg";
import logoOnDarkPicture from "./images/logo-on-dark.svg";
import logoPicture from "./images/logo.svg";

export default (
  <Presentation title="Мой доклад" lang="ru" logo={{ light: logoPicture, dark: logoOnDarkPicture }}>
    <Slide cover>
      <h1>Мой доклад</h1>
      <p className="text-(--muted-color)">Имя докладчика, 2026</p>
    </Slide>

    <Section title="Начало">
      <Slide>
        <h2>Три мысли</h2>
        <List step>
          <li>Пункт появляется по нажатию пробела</li>
          <li>Слайды лежат в index.tsx, тема - в style.css</li>
          <li>Сохранили файл - слайд обновился на том же шаге</li>
        </List>
      </Slide>

      <Slide>
        <h2>Код по шагам</h2>
        <Code lang="ts" lines="| 2 | 3">{`
          function greet(name: string) {
            const greeting = "Привет, " + name;
            return greeting;
          }
        `}</Code>
      </Slide>

      <Slide>
        <h2>Схема</h2>
        <Diagram>
          <Box id="slides">index.tsx<small>слайды</small></Box>
          <Box id="build">Сборка<small>slidemachina build</small></Box>
          <Box id="file">HTML-файл</Box>
          <Arrow from="slides" to="build" />
          <Arrow from="build" to="file" step />
        </Diagram>
      </Slide>
    </Section>

    <Section title="Движение">
      <Slide>
        <h2>Морфинг</h2>
        <div className="flex gap-10">
          <div morph="square" className="size-40 rounded-3xl bg-indigo-500" />
          <div morph="circle" className="size-40 rounded-full bg-emerald-500" />
        </div>
      </Slide>

      <Slide>
        <h2>Морфинг</h2>
        <p>Элементы с одинаковым morph перетекают на следующий слайд</p>
        <div className="flex gap-10">
          <div morph="circle" className="h-24 w-96 rounded-full bg-emerald-500" />
          <div morph="square" className="size-24 rounded-xl bg-amber-400" />
        </div>
      </Slide>

      <Slide background={duskPicture} plain align="center">
        <h1>Картинка на весь слайд</h1>
      </Slide>
    </Section>

    <Slide cover>
      <h1>Спасибо</h1>
      <p className="text-(--muted-color)">Вопросы?</p>
    </Slide>
  </Presentation>
);

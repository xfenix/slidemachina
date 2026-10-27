import * as Machina from "slidemachina";
import duskPicture from "./images/dusk.webp";
import logoOnDarkPicture from "./images/logo-on-dark.svg";
import logoPicture from "./images/logo.svg";

export default (
  <Machina.Presentation title="Мой доклад" lang="ru" aspectRatio="16:9" logo={{ light: logoPicture, dark: logoOnDarkPicture }}>
    <Machina.Slide cover>
      <h1>Мой доклад</h1>
      <p className="machina-lead">Имя докладчика, 2026</p>
    </Machina.Slide>

    <Machina.Section title="Начало">
      <Machina.Slide>
        <h2>Три мысли</h2>
        <ul data-steps>
          <li>Пункт появляется по нажатию пробела</li>
          <li>Слайды лежат в index.tsx, тема - в style.css</li>
          <li>Сохранили файл - слайд обновился на том же шаге</li>
        </ul>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Код по шагам</h2>
        <Machina.Code lang="ts" lines="| 2 | 3">{`
          function greet(name: string) {
            const greeting = "Привет, " + name;
            return greeting;
          }
        `}</Machina.Code>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Схема</h2>
        <Machina.Diagram>
          <Machina.Box id="slides">index.tsx<small>слайды</small></Machina.Box>
          <Machina.Box id="build">Сборка<small>slidemachina build</small></Machina.Box>
          <Machina.Box id="file">HTML-файл</Machina.Box>
          <Machina.Arrow from="slides" to="build" />
          <Machina.Arrow from="build" to="file" step />
        </Machina.Diagram>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Движение">
      <Machina.Slide>
        <h2>Морфинг</h2>
        <div className="flex gap-10">
          <div morph="square" className="size-40 rounded-3xl bg-indigo-500" />
          <div morph="circle" className="size-40 rounded-full bg-emerald-500" />
        </div>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Морфинг</h2>
        <p>Элементы с одинаковым morph перетекают на следующий слайд</p>
        <div className="flex gap-10">
          <div morph="circle" className="h-24 w-96 rounded-full bg-emerald-500" />
          <div morph="square" className="size-24 rounded-xl bg-amber-400" />
        </div>
      </Machina.Slide>

      <Machina.Slide background={duskPicture} plain align="center">
        <h1>Картинка на весь слайд</h1>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Slide cover>
      <h1>Спасибо</h1>
      <p className="machina-lead">Вопросы?</p>
    </Machina.Slide>
  </Machina.Presentation>
);

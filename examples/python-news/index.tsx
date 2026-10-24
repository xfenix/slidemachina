import * as Machina from "slidemachina";
import logoOnDarkPicture from "../theme/logo-on-dark.svg";
import logoPicture from "../theme/logo.svg";

export default (
  <Machina.Presentation title="Python 3.15: что нового" date="2026-10-02" lang="ru" logo={{ light: logoPicture, dark: logoOnDarkPicture }}>
    <Machina.Slide cover background="#2B2D33">
      <h1>Python 3.15</h1>
      <p className="text-(--muted-color)">Что нового для нашего кода</p>
    </Machina.Slide>

    <Machina.Section title="Ленивый импорт">
      <Machina.Slide>
        <h2>Было</h2>
        <Machina.Code lang="py">{`
          import json
          from pathlib import Path

          def load_settings(file_name):
              return json.loads(Path(file_name).read_text())
        `}</Machina.Code>
        <Machina.Caption>Модули грузятся на старте, даже если функция не вызвана</Machina.Caption>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Стало</h2>
        <Machina.Code lang="py">{`
          lazy import json
          lazy from pathlib import Path

          def load_settings(file_name):
              return json.loads(Path(file_name).read_text())
        `}</Machina.Code>
        <Machina.Caption>Модуль загрузится при первом обращении. Консольные утилиты стартуют быстрее</Machina.Caption>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Как это работает</h2>
        <Machina.Diagram>
          <Machina.Box id="name">json<small>имя в модуле</small></Machina.Box>
          <Machina.Box id="proxy">Заглушка</Machina.Box>
          <Machina.Box id="module">Модуль json</Machina.Box>
          <Machina.Arrow from="name" to="proxy" />
          <Machina.Arrow from="proxy" to="module" label="первое обращение" step />
        </Machina.Diagram>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Ещё">
      <Machina.Slide>
        <h2>Что ещё</h2>
        <Machina.List step>
          <li>UTF-8 по умолчанию: open() без encoding читает и пишет UTF-8</li>
          <li>profiling.sampling: профилировщик, который подключается к запущенному процессу</li>
        </Machina.List>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Slide cover>
      <h1>Обновляемся</h1>
      <p className="text-(--muted-color)">Вопросы?</p>
    </Machina.Slide>
  </Machina.Presentation>
);

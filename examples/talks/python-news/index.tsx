import { Arrow, Box, Caption, Code, Diagram, List, Presentation, Section, Slide } from "slidemachina";
import logoOnDarkPicture from "../theme/logo-on-dark.svg";
import logoPicture from "../theme/logo.svg";

export default (
  <Presentation title="Python 3.15: что нового" date="2026-10-02" lang="ru" logo={{ light: logoPicture, dark: logoOnDarkPicture }}>
    <Slide cover background="#2B2D33">
      <h1>Python 3.15</h1>
      <p className="text-(--muted-color)">Что нового для нашего кода</p>
    </Slide>

    <Section title="Ленивый импорт">
      <Slide>
        <h2>Было</h2>
        <Code lang="py">{`
          import json
          from pathlib import Path

          def load_settings(file_name):
              return json.loads(Path(file_name).read_text())
        `}</Code>
        <Caption>Модули грузятся на старте, даже если функция не вызвана</Caption>
      </Slide>

      <Slide>
        <h2>Стало</h2>
        <Code lang="py">{`
          lazy import json
          lazy from pathlib import Path

          def load_settings(file_name):
              return json.loads(Path(file_name).read_text())
        `}</Code>
        <Caption>Модуль загрузится при первом обращении. Консольные утилиты стартуют быстрее</Caption>
      </Slide>

      <Slide>
        <h2>Как это работает</h2>
        <Diagram>
          <Box id="name">json<small>имя в модуле</small></Box>
          <Box id="proxy">Заглушка</Box>
          <Box id="module">Модуль json</Box>
          <Arrow from="name" to="proxy" />
          <Arrow from="proxy" to="module" label="первое обращение" step />
        </Diagram>
      </Slide>
    </Section>

    <Section title="Ещё">
      <Slide>
        <h2>Что ещё</h2>
        <List step>
          <li>UTF-8 по умолчанию: open() без encoding читает и пишет UTF-8</li>
          <li>profiling.sampling: профилировщик, который подключается к запущенному процессу</li>
        </List>
      </Slide>
    </Section>

    <Slide cover>
      <h1>Обновляемся</h1>
      <p className="text-(--muted-color)">Вопросы?</p>
    </Slide>
  </Presentation>
);

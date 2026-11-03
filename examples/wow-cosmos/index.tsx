import * as Machina from "slidemachina";

export default (
  <Machina.Presentation title="Глубокий космос" lang="ru" date="2026-11-02">
    <Machina.Slide cover>
      <h1>Глубокий космос</h1>
      <p className="machina-lead">Тема для докладов, которые показывают в темноте</p>
      <Machina.Notes>
        <p>Поприветствуйте зал, дайте тему доклада.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Section title="Сцена">
      <Machina.Slide>
        <h2>Орбитальная сцена</h2>
        <Machina.Scene orbit={6} floor={false}>
          <Machina.Sphere id="planet" size={2.5} color="#2a4a9e" material="glossy" spin />
          <Machina.Sphere id="cyan-moon" size={0.3} color="#6ee7ff" position={[2.6, 0.4, -0.4]} material="glossy" />
          <Machina.Sphere id="violet-moon" size={0.22} color="#b49bff" position={[-2.2, 0.7, 1]} />
          <Machina.Move on="cyan-moon" position={[-1.2, 0.6, 2.2]} step />
          <Machina.Move on="violet-moon" position={[-0.8, -0.5, -2.2]} step />
          <Machina.Text position={[0, 1.9, 0]} size={0.45} step>
            орбита
          </Machina.Text>
        </Machina.Scene>
        <Machina.Notes>
          <p>Сцена на three.js: планета и два спутника. Шаги двигают спутники, камера сама ловит кадр.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Сцена в цифрах</h2>
        <div className="machina-columns" data-steps data-step-effect="fade">
          <figure className="machina-big-number">
            <p>2</p>
            <figcaption>спутника на орбите</figcaption>
          </figure>
          <figure className="machina-big-number">
            <p>6</p>
            <figcaption>градусов в секунду</figcaption>
          </figure>
          <figure className="machina-big-number">
            <p>0</p>
            <figcaption>текстур у планеты</figcaption>
          </figure>
        </div>
        <Machina.Notes>
          <p>По цифре на шаг. Подписи не читайте.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Сборка станции</h2>
        <Machina.Scene orbit={5} floor={false}>
          <Machina.Cube id="station-core" size={1.6} color="#2a4a9e" spin />
          <Machina.Cube id="station-module" size={0.6} color="#6ee7ff" position={[2, 0.4, 0]} material="glossy" />
          <Machina.Move on="station-module" position={[-2, 0.4, 0]} step />
          <Machina.Text position={[0, -1.7, 0]} size={0.4} step>
            модуль на месте
          </Machina.Text>
        </Machina.Scene>
        <Machina.Notes>
          <p>Вторая сцена: куб вращается сам, шаг переносит модуль на другую сторону.</p>
        </Machina.Notes>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Section title="Свет">
      <Machina.Slide>
        <h2>Из чего собран стиль</h2>
        <ul data-steps>
          <li>
            Звёздное небо: <span data-step data-step-effect="highlight">точки на черепичных плитках</span>
          </li>
          <li>Туманности — мягкие радиальные свечения</li>
          <li>Градиент от ледяного белого к неону в заголовках</li>
          <li>Стеклянные карточки с тонкой рамкой</li>
          <li>Моноширинные подписи, как бирки космического интерфейса</li>
        </ul>
        <Machina.Notes>
          <p>Каждый пункт — один шаг. Пункт про заголовок подсвечивается.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Вся тема — переменные</h2>
        <Machina.Code lang="css" title="style.css" lines="2 | 3-4 | 6">{`:root {
  --slide-background: #060913;
  --accent-color: #6ee7ff;
  --second-accent-color: #b49bff;
  --heading-weight: 300;
}`}</Machina.Code>
        <Machina.Notes>
          <p>Фон, два акцента и толщина заголовков — всё тема, кода движка не трогаем.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Палитра миссии</h2>
        <table>
          <thead>
            <tr>
              <th>Токен</th>
              <th>Роль</th>
              <th>Где светится</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>--slide-background</code>
              </td>
              <td>Ночь</td>
              <td>Всё полотно слайда</td>
            </tr>
            <tr>
              <td>
                <code>--accent-color</code>
              </td>
              <td>Лёд</td>
              <td>Заголовки и крупные цифры</td>
            </tr>
            <tr>
              <td>
                <code>--second-accent-color</code>
              </td>
              <td>Неон</td>
              <td>Градиент и номера разделов</td>
            </tr>
            <tr>
              <td>
                <code>--muted-color</code>
              </td>
              <td>Пыль</td>
              <td>Подписи и сноски</td>
            </tr>
          </tbody>
        </table>
        <Machina.Notes>
          <p>Четыре токена закрывают всю тему, остальное движок считает сам.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide className="[--diagram-max-scale:1.6]">
        <h2>Кто рисует сцену</h2>
        <Machina.Diagram>
          <Machina.Box id="scene-tags">Теги сцены</Machina.Box>
          <Machina.Group id="webgl" title="WebGL">
            <Machina.Box id="shaders">Шейдеры</Machina.Box>
            <Machina.Box id="canvas">Канвас</Machina.Box>
            <Machina.Arrow from="shaders" to="canvas" />
          </Machina.Group>
          <Machina.Arrow from="scene-tags" to="webgl" label="рендер" step />
          <Machina.Focus on={["webgl"]} step />
        </Machina.Diagram>
        <figcaption>three.js грузится, только если сцена есть</figcaption>
        <Machina.Notes>
          <p>Схема из тегов, раскладку считает ELK. Фокус приглушает лишнее.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Эволюция интерфейса</h2>
        <div className="machina-columns">
          <div className="machina-card">
            <h3>2024</h3>
            <p>Тёмная тема</p>
          </div>
          <div className="machina-card">
            <h3>2025</h3>
            <p>Градиенты</p>
          </div>
        </div>
        <Machina.Notes>
          <p>Две карточки. Следующий слайд перетечёт в них морфингом.</p>
        </Machina.Notes>
      </Machina.Slide>

      <Machina.Slide>
        <h2>Эволюция интерфейса</h2>
        <div className="machina-columns">
          <div className="machina-card">
            <h3>2025</h3>
            <p>Градиенты</p>
          </div>
          <div className="machina-card">
            <h3>2026</h3>
            <p>Живые сцены</p>
          </div>
        </div>
        <Machina.Notes>
          <p>Карточки перетекли сами: общие теги и текст нашлись без разметки.</p>
        </Machina.Notes>
      </Machina.Slide>
    </Machina.Section>

    <Machina.Slide>
      <h2>Голос зала</h2>
      <figure>
        <blockquote>В темноте зала слайд должен светиться сам, без проектора.</blockquote>
        <figcaption>Арт-директор после репетиции</figcaption>
      </figure>
      <Machina.Notes>
        <p>Цитата короткая, автор подписан.</p>
      </Machina.Notes>
    </Machina.Slide>

    <Machina.Slide background="var(--accent-color)" transition="fade">
      <p className="machina-thesis">Свет на слайде — часть смысла, а не украшение</p>
    </Machina.Slide>

    <Machina.Slide plain>
      <h1>Спасибо</h1>
      <div className="machina-columns" style={{ gridTemplateColumns: "1fr 1fr", height: "56cqh", flex: "0 0 auto" }}>
        <div>
          <Machina.QR value="https://github.com/xfenix/slidemachina">
            <figcaption>репозиторий движка</figcaption>
          </Machina.QR>
        </div>
        <div>
          <p className="machina-lead">Заберите тему: она вся в style.css</p>
          <p>Звёзды, туманности и неон — обычные переменные и два псевдоэлемента.</p>
        </div>
      </div>
      <Machina.Notes>
        <p>Поблагодарите зал, покажите QR.</p>
      </Machina.Notes>
    </Machina.Slide>
  </Machina.Presentation>
);

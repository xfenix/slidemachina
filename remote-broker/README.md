# Пульт без 0.peerjs.com: свои бесплатные брокеры

`0.peerjs.com` из российских сетей не отвечает (Cloudflare отдаёт 403). Поэтому пульт ходит по
**цепочке брокеров** — все говорят на протоколе PeerJS, экран и телефон встречаются на первом,
который ответил (`packages/slidemachina/browser-runtime/remote-control/remote-transport.ts`):

1. `slidemachina-broker.xfenix.workers.dev` — наш брокер на Cloudflare Workers (`remote-broker/`)
2. `slidemachina-remote-broker.hf.space` — официальный сервер PeerJS в Hugging Face Space (`huggingface-space/`)
3. `0.peerjs.com` — публичное облако PeerJS, запасной вариант

Для отладки цепочку можно подменить параметром адреса: `?remote-broker=host:port,host:port`
(несколько через запятую, `localhost` и `127.0.0.1` получают `ws` без STUN).

Оба сервера бесплатны и бессрочны:

- **Cloudflare Workers Free** — 100 000 запросов в день; сообщения по WebSocket считаются как 1/20 запроса.
  Брокер написан на WebSocket Hibernation API: спящее соединение не тратит выделенную дневную
  квоту вычислительного времени Durable Objects. Карта не нужна.
  Условия: https://developers.cloudflare.com/workers/platform/pricing/
- **Hugging Face Spaces** — тариф CPU Basic (2 vCPU / 16 GB) бесплатен. Нюанс: Space засыпает
  после ~48 часов без трафика, первое подключение после сна прогревает его пару десятков секунд
  (пульт при этом сам переходит на следующее звено цепочки, повторная попытка — через пару секунд).
  Условия: https://huggingface.co/pricing

## Шаг 1. Cloudflare Workers (основной брокер)

1. Регистрация: https://dash.cloudflare.com — тариф Free, карта не просится.
2. Задать поддомен workers.dev: Workers & Pages → выбрать имя аккаунта (например `xfenix`) —
   брокер получит адрес `slidemachina-broker.<имя>.workers.dev`. Если имя другое — поправьте
   первую запись `fallbackBrokerChain` в `remote-transport.ts`.
3. Токен для деплоя из GitHub: My Profile → API Tokens → Create Token → шаблон
   **Edit Cloudflare Workers** → создать, скопировать.
4. В репозитории GitHub: Settings → Secrets and variables → Actions → добавить
   `CLOUDFLARE_API_TOKEN` (токен) и `CLOUDFLARE_ACCOUNT_ID` (ид аккаунта, на его обзорной странице
   в правой колонке).
5. Workflow `.github/workflows/deploy-remote-broker.yml` уже в репо: любой пуш в `remote-broker/`
   выкатывает брокера автоматически. Пока секреты не заданы, прогоны workflow пропускаются (не падают).
   Проверить можно вручную: Actions → Deploy the remote broker → Run workflow.

Проверка после деплоя:

```bash
curl https://slidemachina-broker.<имя>.workers.dev/peerjs        # JSON с описанием
curl "https://slidemachina-broker.<имя>.workers.dev/peerjs/id"   # случайный id
```

Локальная отладка без деплоя: `cd remote-broker && npm install && npm run dev` — поднимется
на `http://127.0.0.1:8787`, движку его можно указать как `?remote-broker=127.0.0.1:8787`.

## Шаг 2. Hugging Face Space (второй брокер)

1. Регистрация: https://huggingface.co — бесплатно.
2. Create new Space: имя `slidemachina-remote-broker`, SDK — **Docker**, тариф CPU Basic (free).
   Если имя другое — поправьте вторую запись `fallbackBrokerChain`.
3. Токен: Settings → Access Tokens → New token → тип **write**, скопировать.
4. В GitHub добавить секрет `HUGGINGFACE_TOKEN`.
5. Workflow `.github/workflows/sync-huggingface-space.yml` уже в репо: пуш в `huggingface-space/`
   отправляет папку в Space (subtree push).

Проверка после сборки Space (займёт пару минут, статус — в логах Space):

```bash
curl https://slidemachina-remote-broker.hf.space/peerjs        # JSON "PeerJS Server"
curl "https://slidemachina-remote-broker.hf.space/peerjs/id"   # случайный id
```

## Шаг 3. Проверка пульта

Откройте любую презентацию, включите пульт — панель должна показать «Ожидает подключения телефона»
(значит экран зарегистрировался на первом живом брокере), телефон по QR-коду подключается как раньше.

Полный сетевой путь с пробросом по цепочке покрыт интеграционным тестом «пульт с телефона»
в `tests/presentation-core.spec.ts`.

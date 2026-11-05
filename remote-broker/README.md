# Пульт без 0.peerjs.com: свой бесплатный брокер

`0.peerjs.com` из российских сетей не отвечает (Cloudflare отдаёт 403). Поэтому пульт ходит по
**цепочке брокеров** — все говорят на протоколе PeerJS, экран и телефон встречаются на первом,
который ответил (`packages/slidemachina/browser-runtime/remote-control/remote-transport.ts`):

1. `slidemachina-broker.xfenix.workers.dev` — наш брокер на Cloudflare Workers (`remote-broker/`)
2. `0.peerjs.com` — публичное облако PeerJS: запасной вариант для сетей вне России

Для отладки цепочку можно подменить параметром адреса: `?remote-broker=host:port,host:port`
(несколько через запятую, `localhost` и `127.0.0.1` получают `ws` без STUN).

**Cloudflare Workers Free бесплатен бессрочно**: 100 000 запросов в день, сообщения по WebSocket
считаются как 1/20 запроса. Брокер написан на WebSocket Hibernation API: спящее соединение не тратит
выделенную дневную квоту вычислительного времени Durable Objects. Карта не нужна.
Условия: https://developers.cloudflare.com/workers/platform/pricing/

В папке `huggingface-space/` лежит вариант брокера на официальном сервере PeerJS в Hugging Face
Space, но Docker-спейсы там стали платными — поэтому он не входит в цепочку по умолчанию
(подойдёт владельцам платного тарифа HF: workflow `.github/workflows/sync-huggingface-space.yml`
выкатывает папку в Space по секрету `HUGGINGFACE_TOKEN`).

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
   выкатывает брокера автоматически. Пока секреты не заданы, прогоны пропускаются (не падают).
   Запустить руками: Actions → Deploy the remote broker → Run workflow.

Проверка после деплоя:

```bash
curl https://slidemachina-broker.<имя>.workers.dev/peerjs        # JSON с описанием
curl "https://slidemachina-broker.<имя>.workers.dev/peerjs/id"   # случайный id
```

Локальная отладка без деплоя: `cd remote-broker && npm install && npm run dev` — поднимется
на `http://127.0.0.1:8787`, движку его можно указать как `?remote-broker=127.0.0.1:8787`.

## Шаг 2. Проверка пульта

Откройте любую презентацию, включите пульт — панель должна показать «Ожидает подключения телефона»
(значит экран зарегистрировался на брокере), телефон по QR-коду подключается как раньше.

Полный сетевой путь с пробросом по цепочке покрыт интеграционным тестом «пульт с телефона»
в `tests/presentation-core.spec.ts`.

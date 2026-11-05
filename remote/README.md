# Своя инфраструктура пульта

Пульт соединяет экран и телефон через **цепочку брокеров** — все звенья говорят на протоколе
PeerJS, экран и телефон встречаются на первом, который ответил. Порядок звеньёв (константа
`fallbackBrokerChain` в `packages/slidemachina/browser-runtime/remote-control/remote-transport.ts`):

1. `xfenix.ru` — личный сервер: официальный сервер PeerJS в Docker за nginx (`own-server/`)
2. `slidemachina-broker.xfenix.workers.dev` — брокер на Cloudflare Workers (`cloudflare/`)
3. `0.peerjs.com` — публичное облако PeerJS, запасной вариант для сетей вне России

Подключение ленивое: ни модуль WebRTC, ни сессия брокера не трогаются, пока пульт не открыли
первый раз кнопкой «Пульт с телефона».

Для отладки цепочку можно подменить параметром адреса: `?remote-broker=host:port,host:port`
(несколько через запятой, `localhost` и `127.0.0.1` получают `ws` без STUN).

## Папки

- `own-server/` — файлы для личного сервера (репозиторий xfenix.ru): сервис в docker-compose
  и location в nginx. Готовый образ `peerjs/peerjs-server`, своего кода нет.
- `cloudflare/` — брокер на бесплатном тарифе Cloudflare Workers (100k запросов/день, WebSocket
  Hibernation). Деплоится GitHub Actions (`.github/workflows/deploy-remote-broker.yml`) по любому
  пушу в эту папку; секреты `CLOUDFLARE_API_TOKEN` и `CLOUDFLARE_ACCOUNT_ID`.

Полный сетевой путь пульта с пробросом по цепочке покрыт интеграционным тестом «пульт с телефона»
в `tests/presentation-core.spec.ts`.

## Проверка живости цепочки

```bash
curl https://xfenix.ru/peerjs                              # JSON "PeerJS Server"
curl "https://xfenix.ru/peerjs/id"                         # случайный id
curl https://slidemachina-broker.xfenix.workers.dev/peerjs # JSON с описанием
```

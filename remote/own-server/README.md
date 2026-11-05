# Личный сервер: брокер пульта на xfenix.ru

Готовый официальный сервер PeerJS в Docker (`peerjs/peerjs-server`), проксируется nginx'ом
сайта по пути `/peerjs`. Актуальные правки живут в репозитории сайта https://github.com/xfenix/xfenix.ru
(`docker-compose.yml` и `front/nginx.conf`); ниже — те же фрагменты для справки.

## docker-compose.yml — добавить сервис

```yaml
  remote-broker:
    image: peerjs/peerjs-server:latest
    # ENTRYPOINT образа — node peerjs.js, аргументы подставляются к нему.
    # --proxied: nginx терминирует TLS, серверу нужны реальные IP клиентов для лимитов.
    command: "--port 9000 --path / --key peerjs --proxied"
    deploy:
      restart_policy:
        condition: on-failure
        max_attempts: 5
```

## front/nginx.conf — добавить location в server-блок xfenix.ru

```nginx
        # Сигнальный сервер пульта slidemachina: WebSocket + пара REST-запросов.
        # Сессия живёт, пока открыта презентация, — таймауты длинные.
        location ^~ /peerjs {
            proxy_pass http://remote-broker:9000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
        }
```

## Проверка после деплоя

```bash
curl https://xfenix.ru/peerjs        # {"name":"PeerJS Server", ...}
curl "https://xfenix.ru/peerjs/id"   # случайный id
```

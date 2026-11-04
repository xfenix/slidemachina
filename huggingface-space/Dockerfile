# Официальный сервер PeerJS в бесплатном Docker-контейнере Hugging Face Spaces.
# Занимает порт 7860 — его HF проксирует наружу как https://<имя-спейса>.hf.space.
FROM node:24-alpine

RUN npm install --global peer@1.0.2

EXPOSE 7860

# --proxied: HF терминирует HTTPS у себя, серверу нужны реальные IP клиентов для лимитов.
CMD ["peerjs", "--port", "7860", "--path", "/", "--key", "peerjs", "--proxied"]

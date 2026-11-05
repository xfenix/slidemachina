# The remote-control broker on Cloudflare Workers

`0.peerjs.com` is unreachable from Russian networks (Cloudflare answers 403), so the phone remote
walks a **chain of signaling brokers** — every link speaks the PeerJS protocol, and the presenting
screen meets the phone on the first link that answers. The chain lives in
`packages/slidemachina/browser-runtime/remote-control/remote-transport.ts`:

1. `0.peerjs.com` — the public PeerJS cloud, free for everyone, first in line
2. `xfenix.ru` — the author's own server: the official `peerjs/peerjs-server` behind nginx plus a coturn
   TURN relay (port 3478) that carries the sessions no direct path reaches — a VPN phone against a plain
   network is the usual one
3. `slidemachina-broker.xfenix.workers.dev` — this Worker, the backup

The connection is lazy: neither the WebRTC module nor a broker session starts until the user opens
the remote panel for the first time. The presenting screen registers its code on **every** link of the
chain at once — different networks reach different links, and a phone walks the chain until the first
live one, where its host is already waiting.

For debugging, the chain can be overridden with a URL parameter:
`?remote-broker=host:port,host:port` (comma-separated; `localhost` and `127.0.0.1` get plain `ws`
and no STUN).

## Why a hand-written Worker and not the official peerjs server

The free Cloudflare plan runs only JavaScript/WebAssembly isolates — no Docker, no Node `http`/`ws`.
The paid plan has Containers, but for a dumb signaling relay that just forwards JSON handshake
messages there is nothing to gain: the Worker does the same job, and WebSocket Hibernation keeps
idle phones from spending the free compute quota. The official `peerjs` package runs unmodified on
any regular host (that is what the `xfenix.ru` link uses).

## The free tier, in numbers

100,000 requests a day; WebSocket messages count as 1/20 of a request; Durable Objects are
SQLite-backed on the free plan (that is why the migration uses `new_sqlite_classes`). No card needed.
Details: https://developers.cloudflare.com/workers/platform/pricing/

## One-time setup

1. Sign up: https://dash.cloudflare.com — the Free plan, no card.
2. Pick a workers.dev subdomain: Workers & Pages → choose the account subdomain (for example
   `xfenix`). The broker gets `slidemachina-broker.<subdomain>.workers.dev`; a different name means
   editing the `fallbackBrokerChain` constant in `remote-transport.ts`.
3. A deploy token: My Profile → API Tokens → Create Token → the **Edit Cloudflare Workers**
   template.
4. In the GitHub repository: Settings → Secrets and variables → Actions → add
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (the account id sits on the dashboard overview).
5. `.github/workflows/deploy-remote-broker.yml` deploys on any push to this folder. Until the
   secrets exist, runs skip quietly. Manual run: Actions → Deploy the remote broker → Run workflow.

## Verification

```bash
curl https://slidemachina-broker.<subdomain>.workers.dev/peerjs        # JSON description
curl "https://slidemachina-broker.<subdomain>.workers.dev/peerjs/id"   # a random peer id
```

Local development without deploying: `cd remote-cloudflare && npm install && npm run dev` —
serves on `http://127.0.0.1:8787`, point the engine at it with `?remote-broker=127.0.0.1:8787`.

The full network path of the remote, including chain failover, is covered by the
"пульт с телефона" integration test in `tests/presentation-core.spec.ts`.

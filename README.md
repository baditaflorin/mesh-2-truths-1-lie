# mesh-2-truths-1-lie

[![pages](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh-2-truths-1-lie-3aa8a1)](https://baditaflorin.github.io/mesh-2-truths-1-lie/)
[![version](https://img.shields.io/badge/version-0.1.1-blue)](https://github.com/baditaflorin/mesh-2-truths-1-lie/blob/main/package.json)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> Submit two truths and a lie privately — commit-reveal so others can't peek before the deadline

Live: **https://baditaflorin.github.io/mesh-2-truths-1-lie/**

Source: **https://github.com/baditaflorin/mesh-2-truths-1-lie**

Tip the dev: **https://www.paypal.com/paypalme/florinbadita**

---

## What it is

Peer-to-peer browser app, no backend of its own beyond the self-hosted WebRTC stack listed below. Built on `@baditaflorin/mesh-common`, hosted on GitHub Pages from `docs/`.

## Quickstart (local)

```bash
git clone https://github.com/baditaflorin/mesh-common
git clone https://github.com/baditaflorin/mesh-2-truths-1-lie
cd mesh-2-truths-1-lie
npm install
npm run dev
```

`mesh-common` must sit as a **sibling** directory because `package.json` references it via `file:../mesh-common`.

## Self-hosted infrastructure

| Repo                                              | Endpoint                               | Purpose                     |
| ------------------------------------------------- | -------------------------------------- | --------------------------- |
| https://github.com/baditaflorin/signaling-server  | `wss://turn.0docker.com/ws`            | y-webrtc signaling fan-out  |
| https://github.com/baditaflorin/turn-token-server | `https://turn.0docker.com/credentials` | HMAC TURN creds, 1-hour TTL |
| https://github.com/baditaflorin/coturn-hetzner    | `turn:turn.0docker.com:3479`           | TURN relay                  |

## Settings overrides (localStorage keys)

The settings drawer lets the user override signaling and TURN endpoints. Keys:

- `mesh-2-truths-1-lie:signalingUrl`
- `mesh-2-truths-1-lie:turnTokenUrl`
- `mesh-2-truths-1-lie:iceServers`
- `mesh-2-truths-1-lie:room`

If endpoints are blank or unreachable, the app falls back to STUN-only.

## Build & deploy

GitHub Pages serves the committed `docs/` directory on the `main` branch. There is **no GitHub Actions build workflow**; the Husky pre-commit + pre-push hooks gate formatting / typecheck / smoke build locally.

```bash
npm run smoke   # build + sanity-check docs/
```

## Privacy

See `docs/privacy.md` for the threat model — what other peers in the mesh see, what the self-hosted infra sees, what stays local.

## License

MIT — see `LICENSE`.

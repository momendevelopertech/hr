# WhatsApp / Evolution Recovery Runbook

## Purpose

This document explains how the HR project sends WhatsApp messages in local development, what survives a reboot, and how to recover the full stack after a shutdown or machine restart.

Use this file as the handoff document for any new Codex chat.

## Current Local Architecture

- The HR API sends WhatsApp requests to `EVOLUTION_API_BASE_URL/message/sendText`.
- The repo `.env` currently points `EVOLUTION_API_BASE_URL` to an `ngrok` public URL.
- `ngrok` must forward the public URL to `http://127.0.0.1:8080`.
- The local bridge lives in `scripts/evolution-bridge.js`.
- The bridge rewrites `/message/sendText` to `/message/sendText/sphinxhr` and injects the global Evolution API key.
- Evolution API runs outside the repo from `F:\tools\evolution-api`.
- Evolution API listens on `http://127.0.0.1:8081`.
- Evolution Manager is available at `http://127.0.0.1:8081/manager`.
- The WhatsApp instance name is `sphinxhr`.

## What Survives a Reboot

- The HR repo files.
- The repo `.env`.
- The Evolution API folder at `F:\tools\evolution-api`.
- The Evolution API local `.env` at `F:\tools\evolution-api\.env`.
- The stored WhatsApp session files in `F:\tools\evolution-api\instances`.
- The Evolution database state.

If the instance was already connected before shutdown, it will usually reconnect without scanning a new QR code.

## What Does Not Survive a Reboot

- The local Evolution API process on port `8081`.
- The local bridge process on port `8080`.
- The `ngrok` process and public tunnel.
- Any locally running HR API or web dev server processes.

## One-Command Recovery

From the repo root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-whatsapp-stack.ps1
```

If you want a double-click launcher from Windows Explorer, use:

```text
Start WhatsApp Service.cmd
```

That file runs the WhatsApp service only:

- starts Evolution API
- starts the local bridge
- starts `ngrok` using the current `EVOLUTION_API_BASE_URL` from the repo `.env`
- prints the final local and public health URLs

It does not start the main HR API or web app.

This script will:

- start Evolution API on `8081` if it is not already running
- start the local bridge on `8080` if it is not already running
- read the Evolution global API key from `F:\tools\evolution-api\.env`
- print the current `sphinxhr` instance state
- show the manager and health URLs

## If the ngrok URL Changed

Start ngrok:

```powershell
ngrok http 127.0.0.1:8080
```

If ngrok returns a new public URL, update the repo `.env` through the script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-whatsapp-stack.ps1 -NgrokUrl "https://your-new-ngrok-url/"
```

That updates `EVOLUTION_API_BASE_URL` in the repo `.env`.

Important:

- keep the trailing slash in the URL
- if the repo API is already running locally, restart it after changing `.env`

## Optional Local HR App Startup

If the HR app itself is not running locally, use the normal repo workflow:

```powershell
npm run dev
```

If Redis is not available locally and you only need to test the API quickly, the API supports:

```powershell
$env:DISABLE_REDIS='1'
```

## Verification Checklist

1. Evolution API responds at `http://127.0.0.1:8081`.
2. Bridge health responds at `http://127.0.0.1:8080/__bridge/health`.
3. Evolution Manager opens at `http://127.0.0.1:8081/manager`.
4. The instance `sphinxhr` is `open`.
5. The repo `.env` has the correct `EVOLUTION_API_BASE_URL`.
6. ngrok forwards to `127.0.0.1:8080`.

## If the Instance Is Not Open

If the state is `connecting` or `close`:

1. Open the manager at `http://127.0.0.1:8081/manager`.
2. Open the `sphinxhr` instance.
3. Click `Generate QR Code` or `Gerar QR Code`.
4. In WhatsApp on the phone, go to `Settings > Linked Devices > Link a Device`.
5. Scan the QR code.
6. Wait for the state to become `open`.

Do not delete the instance unless you intentionally want to create a new session.

## Troubleshooting

### Symptom: ngrok returns `502 Bad Gateway`

Cause:

- nothing is listening on `8080`

Fix:

- rerun `scripts/start-whatsapp-stack.ps1`

### Symptom: bridge health is OK but messages still fail

Cause:

- Evolution API is up, but the WhatsApp instance is not `open`

Fix:

- open the manager and reconnect the instance

### Symptom: new ngrok URL but HR still sends to the old one

Cause:

- `EVOLUTION_API_BASE_URL` in the repo `.env` still points to the previous tunnel

Fix:

- rerun the startup script with `-NgrokUrl`
- then restart the local HR API if it is already running

### Symptom: Evolution API folder is missing

Cold setup:

```powershell
git clone --depth 1 https://github.com/EvolutionAPI/evolution-api.git F:\tools\evolution-api
cd F:\tools\evolution-api
npm.cmd install
npm.cmd run db:generate
npm.cmd run db:deploy:win
```

Then come back to the repo and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-whatsapp-stack.ps1
```

## Secret Handling

- Do not hardcode secrets in the repo.
- The recovery script reads the Evolution global API key from `F:\tools\evolution-api\.env`.
- Keep real credentials in local `.env` files, not in tracked markdown files.

## Handoff Prompt for a New Codex Chat

Use this exact prompt in a new Codex session:

```text
Read docs/whatsapp-evolution-runbook.md and run scripts/start-whatsapp-stack.ps1.

Then:
- verify Evolution API is listening on 8081
- verify bridge health on 8080
- verify the instance sphinxhr state is open
- if ngrok generated a new public URL, update F:\hr\.env EVOLUTION_API_BASE_URL or rerun the script with -NgrokUrl
- if the instance is not open, open the manager and generate a QR code
- once the stack is healthy, test WhatsApp sending from the HR app
```

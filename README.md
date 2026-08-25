# SK Coder Frontend

This repository contains the Vite frontend for SK Coder. Deploy it to Vercel as a static frontend project. The terminal, runners, temporary execution workspaces, API routes, and WebSocket terminal service belong on the separate backend host.

## Vercel Setup

Import this repository into Vercel and use the Vite framework preset. The repository root is the frontend project root. The build output is `dist/public`.

Before deployment, add the following public browser endpoint values in Vercel Project Settings. They are URLs, not private credentials.

| Name | Example |
|---|---|
| `VITE_API_URL` | `https://api.medical4me.com/api` |
| `VITE_WS_URL` | `wss://api.medical4me.com/api/ws/terminal` |

Do not add SSH keys, API keys, backend passwords, Docker credentials, or server environment files to Vercel. The backend host must allow the final Vercel origin and provide the matching HTTPS API and WSS terminal routes.

## Local Check

```bash
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
```

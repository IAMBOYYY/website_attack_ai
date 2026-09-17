# Nexus Swarm

Multi-agent orchestration. Bring your own API keys. Every model you connect joins the swarm.

## What it does

1. **Keys** — paste an API key for any provider (OpenAI, Anthropic, OpenRouter, Groq, NVIDIA NIM, Gemini, Mistral, DeepSeek, xAI, Together, Cerebras, Fireworks, Perplexity, Ollama, LM Studio, or any OpenAI-compatible endpoint). Keys live in your browser's localStorage. Nothing is sent anywhere except the provider you chose.
2. **Models** — click *Fetch models* and the live catalog is pulled from the provider. Pick one.
3. **Agents** — turn each provider+model into an agent. Assign a role (director / scout / builder / critic / executor). One agent is the director: it plans, judges, and calls the finish line.
4. **Targets** — add URLs the swarm should focus on.
5. **Mission** — describe the objective in the console.
6. **Launch** — every agent runs in a loop. They share a blackboard, see each other's tool results, write to a shared workspace, and keep going until the director declares the mission complete or a budget runs out.

## Tools the agents get

| Tool | What it does |
|---|---|
| `http_request` | Raw HTTP from the server (no CORS). Any method, headers, body. |
| `web_search` | DuckDuckGo by default; Serper / Brave / Tavily if you add a key. |
| `fetch_url` | Fetch a page, strip HTML, return readable text. |
| `fs_write` / `fs_read` / `fs_list` / `fs_delete` | Shared virtual workspace, persisted in IndexedDB. |
| `shell` | Workspace commands: ls, cat, echo >, mkdir, rm, mv, grep, head, tail, tree, wc. |
| `js_eval` | Sandboxed JS in a Web Worker, 5s timeout. |
| `report` | Publish a finding to the blackboard and end the turn. |

## Architecture notes

- **LLM calls go browser → provider directly.** All major providers ship CORS headers. This means swarms can loop for an hour with no serverless timeout. If a provider blocks direct calls, toggle *route through server proxy* on that key — `/api/chat` handles it (60s cap).
- **API routes exist only for what a browser can't do:** URL fetching, raw HTTP recon, and search.
- **The swarm runs in the browser.** The tab must stay open during a run. The tradeoff for hosting on Vercel with zero backend.
- **The workspace persists** across reloads in IndexedDB. Wipe it with `wipe` in the terminal.

## Run locally

```bash
npm install
npm run dev
# http://localhost:3000
```

## Deploy

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "nexus swarm"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nexus-swarm.git
git push -u origin main
```

### 2. Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import the repo.
3. Framework preset auto-detects **Next.js**. Leave everything default.
4. **Deploy.**

No environment variables. No configuration. Keys never touch the server.

### 3. Optional — CLI

```bash
npm i -g vercel
vercel
vercel --prod
```

## Notes & limits

- **Hobby plan function timeout** caps `/api/chat` (proxy mode only) at 10s. Direct browser calls bypass this. If you rely on proxy mode, move to Pro or use Groq/Cerebras (sub-second).
- **`shell` and `js_eval` are workspace-scoped, not OS-level.** A browser can't spawn processes. These run on the virtual filesystem and in a Web Worker. If you need real command execution, that belongs in a backend container (Fly, Railway, a VPS) — different architecture, not this one.
- **Provider model catalogs change.** The *Fetch models* button hits the live endpoint; the fallback list is only used if the endpoint is unreachable.
- **Keys are in localStorage.** Anyone with access to your browser profile can read them. Don't use a shared machine.

## Provider quick links

| Provider | Get a key |
|---|---|
| OpenAI | https://platform.openai.com/api-keys |
| Anthropic | https://console.anthropic.com/settings/keys |
| OpenRouter | https://openrouter.ai/keys |
| Groq | https://console.groq.com/keys |
| NVIDIA NIM | https://build.nvidia.com/ |
| Google Gemini | https://aistudio.google.com/apikey |
| Mistral | https://console.mistral.ai/api-keys |
| DeepSeek | https://platform.deepseek.com/api_keys |
| xAI | https://console.x.ai/ |
| Together | https://api.together.xyz/settings/api-keys |
| Cerebras | https://cloud.cerebras.ai/ |
| Fireworks | https://fireworks.ai/account/api-keys |
| Perplexity | https://www.perplexity.ai/settings/api |

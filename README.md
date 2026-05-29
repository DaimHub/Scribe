<div align="center">

# 🎙️ Scribe

**Record, transcribe, diarize, and summarize your meetings — entirely on your Mac.**

_Local-first · Private by default · No cloud required_

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20Apple%20Silicon-black?logo=apple&logoColor=white)](#requirements)
[![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Whisper](https://img.shields.io/badge/transcription-WhisperX-FFD21E)](https://github.com/m-bain/whisperX)

</div>

---

Scribe captures both sides of a conversation — **your microphone and the audio playing on your Mac** — then turns the recording into a clean, speaker-labelled transcript and an AI summary with bullet points and action items. Everything that _can_ run on-device, does: SQLite for state, [WhisperX](https://github.com/m-bain/whisperX) for transcription, [pyannote.audio](https://github.com/pyannote/pyannote-audio) for diarization, and a bundled local LLM for summaries. Reach for a cloud model only if you want to — it's a setting, not a requirement.

> [!NOTE]
> Scribe is young (`v0.0.1`) and currently targets **macOS on Apple Silicon** only. Packaged builds are unsigned — see [Building a desktop app](#-building-a-desktop-app).

## Table of contents

- [Highlights](#highlights)
- [Screenshots](#screenshots)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Building a desktop app](#-building-a-desktop-app)
- [MCP server](#mcp-server)
- [Data & privacy](#data--privacy)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Highlights

- 🎙️ **Dual-channel recording** — captures your mic *and* system audio at once, so remote participants are transcribed too.
- 📝 **High-quality transcription** — WhisperX (`large-v3-turbo` by default) with word-level alignment.
- 🗣️ **Speaker diarization** — pyannote's community-1 pipeline separates who-said-what, even with overlapping in-room voices.
- 👥 **Voice library & people** — Scribe learns voices over time and auto-matches speakers to known people across meetings.
- 🤖 **AI summaries, your way** — generate notes, key-point bullets, and action items from customizable templates. Pick a fully on-device model or a cloud provider.
- 📅 **Calendar-aware** — connect Google Calendar to auto-link recordings to the right event and get a heads-up before meetings start.
- 🗂️ **Organize everything** — a draggable folder tree, tags, pinning, full-text search, and a `⌘K` command palette.
- 🪟 **Floating mini-recorder** — a compact always-on-top window to start/stop and watch progress without leaving your current app.
- 🔌 **MCP server built in** — expose your meetings to AI agents (Claude Code, Claude Desktop, …) to query and edit transcripts, summaries, and tasks.
- 🌍 **Multilingual** — UI in English, French, Spanish & German; summaries in the language of your choice.
- 🔒 **Local-first** — your audio, transcripts, and notes live in a local SQLite database. Nothing leaves your Mac unless you opt into a remote LLM or calendar sync.

## Screenshots

> _Add yours under `docs/` and uncomment below — the layout is ready to go._

<!--
| Meetings & transcript | AI summary |
| --- | --- |
| ![Transcript view](docs/transcript.png) | ![Summary view](docs/summary.png) |

| People & voice library | Floating recorder |
| --- | --- |
| ![People view](docs/people.png) | ![Mini recorder](docs/mini-recorder.png) |
-->

## How it works

```
   ┌──────────────┐     ┌───────────────┐     ┌──────────────────┐     ┌───────────────┐
   │  🎙️ Record    │ ──▶ │ 📝 Transcribe  │ ──▶ │ 🗣️ Diarize &      │ ──▶ │ 🤖 Summarize   │
   │ mic + system │     │   (WhisperX)  │     │  match speakers  │     │     (LLM)     │
   └──────────────┘     └───────────────┘     └──────────────────┘     └───────────────┘
          │                                            │                       │
     WAV on disk                                 voice library         notes · bullets · tasks
```

1. **Record.** Scribe captures your microphone and your Mac's system audio into separate WAV tracks. When you stop, it auto-links the recording to a calendar event if it finds a match — but it does **not** start processing automatically.
2. **Process.** You click **Process meeting** when you're ready. The Python sidecar transcribes with WhisperX and, if a Hugging Face token is configured, diarizes with pyannote.
3. **Match speakers.** Detected speakers are matched against your voice library; unknown voices can be tagged once and recognized in every future meeting.
4. **Summarize.** Your chosen LLM turns the transcript into a structured summary, key-point bullets, and action items, following a template you can customize.

## Architecture

Scribe runs as **three cooperating runtimes**. The renderer never imports from `electron/` — it talks to the main process exclusively through the typed `window.scribe.*` bridge.

```
┌────────────────────────────────────────────────────────────────────┐
│  Renderer   Next.js · React · Tailwind            ── UI only ──      │
│  app/ · components/ · lib/                                           │
│             │  window.scribe.*   (contextBridge · typed IPC)         │
└─────────────┼────────────────────────────────────────────────────────┘
              ▼
┌────────────────────────────────────────────────────────────────────┐
│  Main process   Electron · Node                                      │
│  electron/ — SQLite · recorder · calendar OAuth · LLM providers      │
│             │  spawns + manages                                      │
└─────────────┼────────────────────────────────────────────────────────┘
              ▼
┌────────────────────────────────────────────────────────────────────┐
│  Python sidecar   python/whisperx_runner.py                          │
│  WhisperX (faster-whisper / CTranslate2) + pyannote.audio            │
└────────────────────────────────────────────────────────────────────┘
```

- **Main process** (`electron/`) owns SQLite, the audio recorder, the Python sidecar, calendar OAuth, and the LLM providers.
- **Renderer** (`app/`, `components/`, `lib/`) is UI only, statically exported to `out/`.
- **Python sidecar** (`python/whisperx_runner.py`) does transcription and diarization, spawned and managed from `electron/services/python-sidecar.ts`.

There's a deeper write-up of the cross-layer invariants (IPC layering, LLM provider dispatch, recording lifecycle, …) in [`CLAUDE.md`](CLAUDE.md) — worth a read before touching the main/renderer boundary.

## Tech stack

| Layer | Technology |
| --- | --- |
| Desktop shell | [Electron](https://www.electronjs.org/) 42 |
| UI | [Next.js](https://nextjs.org/) 16 (App Router, static export), [React](https://react.dev/) 19, TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) 4, [shadcn/ui](https://ui.shadcn.com/), [Base UI](https://base-ui.com/) |
| State | [Zustand](https://github.com/pmndrs/zustand) |
| UI bits | [Hugeicons](https://hugeicons.com/), [react-arborist](https://github.com/brimdata/react-arborist) (tree), [dnd-kit](https://dndkit.com/) (drag & drop), [cmdk](https://cmdk.paco.me/) (palette), [react-markdown](https://github.com/remarkjs/react-markdown) |
| Database | SQLite via Node's built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) — zero native deps |
| Transcription | [WhisperX](https://github.com/m-bain/whisperX) ([faster-whisper](https://github.com/SYSTRAN/faster-whisper) / [CTranslate2](https://github.com/OpenNMT/CTranslate2)), default `large-v3-turbo` |
| Diarization | [pyannote.audio](https://github.com/pyannote/pyannote-audio) 4.x (community-1 pipeline) |
| On-device LLM | [node-llama-cpp](https://github.com/withcatai/node-llama-cpp) (default `gemma-3-4b`) |
| Remote LLM | Anthropic API, OpenAI-compatible, [Ollama](https://ollama.com/), Claude Code CLI |
| Integrations | Google Calendar (OAuth), [Model Context Protocol](https://modelcontextprotocol.io/) server |
| Packaging | [electron-builder](https://www.electron.build/) → DMG (macOS arm64) |

## Requirements

- **macOS on Apple Silicon** (arm64)
- **Node 20+**
- **Python 3.11 or 3.12** on your `PATH` (e.g. via `pyenv install 3.12.11`) — used for the transcription sidecar
- _(optional)_ A free **Hugging Face token** to enable speaker diarization
- _(optional)_ An LLM provider — the bundled on-device model works offline with no setup

## Getting started

```bash
git clone https://github.com/DaimHub/Scribe.git
cd Scribe

npm install
npm run bootstrap:python   # creates python-venv/ and installs WhisperX + pyannote (idempotent)
npm run dev                # builds electron, then runs Next.js (:3000) + Electron together
```

> The first `bootstrap:python` run downloads PyTorch and friends, so it takes a while. It's a one-time setup — later runs are near-instant.

### First-run setup (inside the app)

1. **Settings → AI** — pick an LLM provider. The bundled on-device model works offline out of the box; see [Configuration](#configuration) for cloud options.
2. **Settings → Transcription** — paste a [Hugging Face token](https://huggingface.co/settings/tokens) to enable speaker diarization. Without it you still get a full transcript, just no speaker labels. (You'll also need to accept the model terms for [`pyannote/speaker-diarization-community-1`](https://huggingface.co/pyannote/speaker-diarization-community-1).)
3. **Settings → Calendar** _(optional)_ — connect Google Calendar to auto-link recordings to events and get pre-meeting notifications.

### Everyday commands

```bash
npm run dev         # build electron + run Next (3000) and Electron together
npm run typecheck   # tsc --noEmit — run after any cross-layer change
npm run lint        # eslint
npm run build       # next export + electron + mcp-server bundles
npm run dist        # package the macOS arm64 app into a DMG
```

## Configuration

### LLM providers

Scribe supports five providers. Switch between them anytime in **Settings → AI**.

| Provider | Where it runs | What you need |
| --- | --- | --- |
| **On-device** (bundled) | Locally via `node-llama-cpp` | Nothing — fully offline. Default model `gemma-3-4b`. |
| **Ollama** | Your local [Ollama](https://ollama.com/) server | Ollama running with a model pulled |
| **OpenAI-compatible** | Any OpenAI-style endpoint | Endpoint + API key (works with OpenAI, LM Studio, etc.) |
| **Anthropic API** | Anthropic cloud | API key (default `claude-sonnet-4-6`) |
| **Claude Code** | Local Claude CLI | A Claude Code subscription |

### Languages

- **Display language:** English, French, Spanish, German.
- **Summary language:** `auto` (match the meeting) or a fixed English / French / Spanish / German.

### Transcription

- **Whisper model** is configurable; `large-v3-turbo` balances speed and quality. Compute type is chosen automatically (`int8` on CPU, `float16` on GPU).
- The **Hugging Face token** is stored encrypted at rest using Electron's `safeStorage`.

### Appearance

Light/dark theme and a customizable accent hue — applied before first paint so there's no color flash on launch.

## 📦 Building a desktop app

One command builds the Python sidecar venv (if missing), packages the app into a DMG, and installs it to `/Applications`:

```bash
npm run release
```

Under the hood it runs:

1. `scripts/bootstrap-python.sh` — creates `python-venv/` from `python/requirements.txt` (idempotent).
2. `npm run build` — Next.js static export + TypeScript compile of `electron/` + MCP server bundle.
3. `electron-builder --mac --arm64` — produces `release/Scribe-<version>-arm64.dmg`.
4. `scripts/install-to-applications.sh` — quits any running Scribe, mounts the DMG, copies `Scribe.app` to `/Applications`, and strips the quarantine attribute.

> [!IMPORTANT]
> The DMG is **unsigned and unnotarized**. It runs fine on the machine that built it. To distribute it to other Macs you'll need an Apple Developer ID and to flip `notarize: true` in [`electron-builder.yml`](electron-builder.yml). Bump `version` in `package.json` before each release so DMGs don't overwrite each other in `release/`.

## MCP server

Scribe ships a local [Model Context Protocol](https://modelcontextprotocol.io/) server so AI agents — Claude Code, Claude Desktop, and any MCP client — can read and edit your meetings programmatically.

- **Read:** list & search meetings, fetch a meeting / transcript / summary / action items, list & look up people.
- **Write** _(gated behind a permission toggle in Settings)_: set the summary, bullets, scratchpad, or title; add / complete / delete action items; tag & untag; rename speakers.

Point your MCP client at the bundled server (built to `mcp-server/dist/mcp-server.mjs` in dev, or shipped at `Resources/mcp-server.mjs` in the packaged app):

```jsonc
{
  "mcpServers": {
    "scribe": {
      "command": "node",
      "args": ["/absolute/path/to/Scribe/mcp-server/dist/mcp-server.mjs"]
    }
  }
}
```

## Data & privacy

Scribe is built to keep your conversations on your machine.

- **Where it lives:** recordings (WAV), transcripts, summaries, the voice library, and all metadata are stored locally — SQLite in the app's user-data directory.
- **What leaves your Mac:** _nothing_, unless you explicitly:
  - choose a **remote LLM provider** (Anthropic / OpenAI) — then transcripts are sent to that provider for summarization, or
  - connect **Google Calendar** — then Scribe reads your events to auto-link meetings.
- **Diarization** downloads the pyannote models once using your Hugging Face token; the actual inference runs locally.
- **Secrets** (HF token, API keys) are stored encrypted via Electron's `safeStorage`.

Local-only setup (on-device LLM, no calendar) is fully offline after the initial model downloads.

## Project structure

```
Scribe/
├── app/                    # Next.js App Router — UI, static-exported to out/
│   ├── page.tsx            #   main window
│   └── mini/               #   floating windows: recorder + meeting notification
├── components/scribe/      # all UI components (meeting, transcript, summary, settings, …)
├── lib/                    # renderer helpers — zustand store, i18n, window.scribe types
├── electron/
│   ├── main.ts             # bootstrap, BrowserWindows, IPC registration
│   ├── preload.cts         # contextBridge → window.scribe
│   ├── ipc/                # one file per domain (audio, meetings, llm, calendar, voice, …)
│   └── services/           # core logic: db, recorder, whisper, calendar, llm-providers/, …
├── python/
│   └── whisperx_runner.py  # transcription + diarization sidecar
├── mcp-server/             # Model Context Protocol server
├── scripts/                # bootstrap-python, release & install helpers
├── build/                  # app icon + macOS entitlements
└── electron-builder.yml    # packaging config (DMG, arm64)
```

## Contributing

Contributions are welcome! A few things that'll make life easier:

- **Run `npm run typecheck` after any change** — it's the cheapest way to catch type drift across the main/renderer boundary, and the bar for a PR.
- **Lint** with `npm run lint` before submitting.
- TypeScript everywhere. `electron/` uses **NodeNext ESM**, so relative imports need the `.js` extension (e.g. `import { x } from "../services/db.js"`).
- **Adding a `window.scribe.*` method touches five layers** — service → `electron/ipc/<domain>.ts` → `electron/main.ts` → `electron/preload.cts` → `lib/scribe-global.d.ts` — and the channel string, args, and types must match across all of them. See [`CLAUDE.md`](CLAUDE.md) for the full set of invariants.
- Keep UI in the renderer and logic in `electron/services/*`; the renderer never imports from `electron/`.

## License

Scribe is licensed under the **GNU Affero General Public License v3.0**. See [`LICENSE`](LICENSE) for the full text.

In short: you're free to use, study, modify, and share Scribe — but if you distribute it or run a modified version as a network service, you must make your source available under the same license.

## Acknowledgments

Scribe stands on a lot of excellent open-source work:

- [WhisperX](https://github.com/m-bain/whisperX) · [faster-whisper](https://github.com/SYSTRAN/faster-whisper) · [CTranslate2](https://github.com/OpenNMT/CTranslate2) — transcription
- [pyannote.audio](https://github.com/pyannote/pyannote-audio) — speaker diarization
- [node-llama-cpp](https://github.com/withcatai/node-llama-cpp) — on-device summaries
- [Next.js](https://nextjs.org/) · [Electron](https://www.electronjs.org/) · [React](https://react.dev/) · [shadcn/ui](https://ui.shadcn.com/) — the app shell

---

<div align="center">
<sub>Built with care, on-device. 🎙️</sub>
</div>

# Scribe

Local-first desktop app (Electron + Next.js) that **records, transcribes,
diarizes, and summarizes meetings**. Everything runs on-device: SQLite for
state, WhisperX (Python sidecar) for transcription/diarization, `node-llama-cpp`
or a remote provider for summaries. Google Calendar auto-links recordings to
events.

## Commands

```bash
npm run dev         # build electron + run Next (3000) and Electron together
npm run typecheck   # tsc --noEmit — run after any cross-layer change
npm run lint        # eslint
npm run format      # prettier --write (no semicolons, double quotes, 2-space)
npm run build       # next + electron + mcp-server bundles
npm run dist        # package the macOS arm64 app
```

Always finish a change with `npm run typecheck`; it's the cheapest way to catch
type drift across the main/renderer boundary.

## Architecture

Three runtimes:
- **Main process** (`electron/`) — owns SQLite, the recorder, the Python
  sidecar, calendar OAuth, and the LLM providers.
- **Renderer** (`app/` Next.js app-router, statically exported to `out/`;
  `components/`, `lib/`) — UI only. **Never imports from `electron/`** — it
  reaches the main process exclusively through `window.scribe.*`.
- **Python sidecar** (`python/whisperx_runner.py`) — transcription + diarization,
  spawned and managed by `electron/services/python-sidecar.ts`.

Where things live:
- `electron/main.ts` — bootstrap, BrowserWindow creation, IPC registration
- `electron/preload.cts` — contextBridge exposing the `window.scribe` API
- `electron/ipc/*.ts` — one file per domain, `ipcMain.handle` registrations
- `electron/services/*.ts` — pure logic (db, recorder, whisper, llm-providers, calendar)
- `lib/scribe-global.d.ts` — the renderer-facing type for `window.scribe`
- `lib/store.ts` — zustand store; sole owner of recording lifecycle in the renderer

## Key invariants — read before editing these areas

- **IPC spans 5 layers.** Adding a `window.scribe.*` method touches service →
  `electron/ipc/<domain>.ts` → `electron/main.ts` (new domain only) →
  `electron/preload.cts` → `lib/scribe-global.d.ts`, and the channel string +
  args + types must match across all of them. Use the **`/new-ipc-channel`**
  skill — it has the templates and the sync rules. Note the trap: there are two
  `ScribeAPI` definitions (a `typeof` in preload and the hand-written interface
  in the `.d.ts`); the renderer uses the hand-written one, so keep both current.

- **LLM provider dispatch branches on `provider.agentMode`, never on
  `provider.kind`.** Three modes: `"none"` (single-shot, call `generate()`),
  `"built-in"` (provider runs its own agent loop, call `generate()`),
  `"via-tool-host"` (call `agenticGenerate({…, toolHost})`). `provider.kind` is
  only for UI badge labels. Shared agent helpers live in
  `electron/services/llm-providers/agentic-shared.ts`.

- **Stopping a recording must NOT auto-trigger processing.** `stopRecording()`
  only flushes audio, runs calendar auto-link, and refreshes the tree/selection.
  The user starts transcription manually via the **Process meeting** button.
  Don't chain `processMeeting()`/`transcribe()`/`generate()` after stop.

- **Null-speaker chips stay non-editable.** Segments with `speaker_id === null`
  render a generic, non-clickable "Speaker" chip (`editable={!!seg.speaker_id}`).
  Don't add per-segment manual assignment. The supported tagging path is the
  header **Tag voices** panel; if diarization produced no speakers the fix is
  configure HF token → re-process, not segment-by-segment labelling.

- **Audio capture lives only in the main window's renderer.** The MediaStream is
  owned there; frames flow renderer → main → WavWriter via `audio:frames`.
  Floating windows (mini-recorder) observe state over IPC and forward actions
  back — they never open a parallel capture.

- **Cross-window DB changes use the broadcast pattern.** When main mutates DB
  state, send an invalidation ping (e.g. `broadcastTreeInvalidated()` in
  `electron/services/broadcast.ts`); renderers listen and refetch. Broadcasts
  carry no payload.

- **Static export routing.** Routes are distinct `app/<route>/page.tsx` files
  exported to separate `index.html`s (no hash routes). Dev loads
  `http://localhost:3000/...`; prod `loadFile`s from `out/`.

## Conventions

- TypeScript everywhere; NodeNext ESM in `electron/` means relative imports need
  the `.js` extension (e.g. `import { x } from "../services/db.js"`).
- Keep `electron/services/*` logic electron-free where it could be unit-tested.
- Prettier owns formatting (`prettier-plugin-tailwindcss` sorts classes; `cn`/`cva` are class functions).

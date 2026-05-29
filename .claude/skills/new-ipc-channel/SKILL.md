---
name: new-ipc-channel
description: >-
  Scaffold a new IPC channel in the Scribe Electron app across every layer it
  touches: service logic -> ipcMain handler -> main.ts registration -> preload
  contextBridge -> renderer types. Use whenever adding a window.scribe.* method,
  a new ipcMain.handle channel, or a main->renderer push event, or when the user
  runs /new-ipc-channel. Keeps the two ScribeAPI sources of truth in sync.
---

# Add an IPC channel (Scribe)

In Scribe every `window.scribe.*` call crosses the Electron main/renderer
boundary through **the same fixed pipeline**. A channel is only correct when
all of these agree on the channel-name string, the argument list, and the
return type. Miss one and you get a silent runtime `undefined` (preload) or a
renderer type that lies about the implementation (`.d.ts`).

```
renderer component
      │  window.scribe.<domain>.<method>(args)
      ▼
lib/scribe-global.d.ts        (5) renderer-facing type — interface ScribeAPI
      │
electron/preload.cts          (4) contextBridge: const scribe.<domain>.<method>
      │  ipcRenderer.invoke("<domain>:<method>", args)
      ▼
electron/ipc/<domain>.ts       (2) ipcMain.handle("<domain>:<method>", …)
      │  registered by register<Domain>Ipc()
electron/main.ts               (3) import + call register<Domain>Ipc()  ← new domain only
      ▼
electron/services/*.ts         (1) the actual logic (usually db.ts)
```

## Conventions (match existing code exactly)

- **Channel name**: `"<domain>:<method>"`, colon-separated, camelCase method.
  e.g. `"tags:listForMeeting"`, `"voice:pendingReview"`.
- **Style**: no semicolons, double quotes, 2-space indent, arrow functions in
  preload with an explicit `Promise<T>` return annotation. Prettier enforces it.
- **The renderer never imports from `electron/`** — it only calls `window.scribe`.
- **Canonical examples**: `electron/ipc/tags.ts` (clean CRUD), `electron/ipc/personal-tasks.ts`. For push events: the `voice` block in `electron/preload.cts` + `electron/services/broadcast.ts`.

## Procedure — request/response channel

Ask the user (or infer) for: **domain**, **method**, **args**, **return type**,
and whether the domain already exists. Then edit in this order:

### 1. Service logic — `electron/services/db.ts` (or the domain's service)
Add the named function that does the work. Keep it electron-free if it could be
unit-tested.
```ts
export function listWidgetsForMeeting(meetingId: string): WidgetRow[] {
  // …query / logic
}
```

### 2. IPC handler — `electron/ipc/<domain>.ts`
If the domain file exists, add a `handle` inside its `register<Domain>Ipc()`.
For a **new domain**, create the file:
```ts
import { ipcMain } from "electron"
import { listWidgetsForMeeting } from "../services/db.js"

export function registerWidgetsIpc(): void {
  ipcMain.handle("widgets:listForMeeting", (_e, meetingId: string) =>
    listWidgetsForMeeting(meetingId),
  )
}
```
Note the `.js` extension on the service import (NodeNext ESM resolution).

### 3. Main registration — `electron/main.ts` *(new domain only)*
Add the import alongside the other `./ipc/*.js` imports, then call it inside the
`app.whenReady()` block next to `registerTagsIpc()` etc.:
```ts
import { registerWidgetsIpc } from "./ipc/widgets.js"
// …
registerWidgetsIpc()
```
If you only added a method to an existing domain, skip this step.

### 4. Preload bridge — `electron/preload.cts`
Add the method to the `const scribe = { … }` object (create the `<domain>: { }`
group if new). The channel string and arg order MUST match step 2:
```ts
  widgets: {
    listForMeeting: (meetingId: string): Promise<WidgetRow[]> =>
      ipcRenderer.invoke("widgets:listForMeeting", meetingId),
  },
```

### 5. Renderer types — `lib/scribe-global.d.ts`
Add a matching signature to `interface ScribeAPI` (and any new `Row` interface).
```ts
  widgets: {
    listForMeeting(meetingId: string): Promise<WidgetRow[]>
  }
```

> **⚠️ The #1 sync trap.** There are TWO `ScribeAPI` definitions:
> `preload.cts` ends with `export type ScribeAPI = typeof scribe` (derived from
> the implementation), but `window.scribe` in the renderer is typed by the
> **hand-written `interface ScribeAPI` in `lib/scribe-global.d.ts`**. The
> hand-written one is what components see — if you update preload but not the
> `.d.ts`, the renderer types silently drift from reality. Always edit both
> (steps 4 **and** 5).

## Variant — main → renderer push event

For events the main process pushes (no request), add a broadcast + a subscriber
instead of an `invoke`:

1. **`electron/services/broadcast.ts`** — add the channel constant + helper:
   ```ts
   export const WIDGETS_CHANGED = "widgets:changed"
   export function broadcastWidgetsChanged(): void { broadcast(WIDGETS_CHANGED) }
   ```
   Call `broadcastWidgetsChanged()` from wherever the state changes in main.
2. **`electron/preload.cts`** — expose an `on…` subscriber that returns an
   unsubscribe function (mirror the `voice.onLibraryChanged` pattern):
   ```ts
   onChanged: (cb: () => void): (() => void) => {
     const handler = () => cb()
     ipcRenderer.on("widgets:changed", handler)
     return () => ipcRenderer.removeListener("widgets:changed", handler)
   },
   ```
3. **`lib/scribe-global.d.ts`** — `onChanged(cb: () => void): () => void`.

Renderers subscribe in an effect and call the returned cleanup on unmount.
Broadcasts are **invalidation pings, not payloads** — the renderer refetches.

## Verify

Run the typechecker — it catches arg/return drift across all 5 layers at once:
```bash
npm run typecheck
```
Then `npm run format` to normalize style. Done when typecheck is clean and the
channel string + args + types are identical in the handler, the preload bridge,
and the `.d.ts`.

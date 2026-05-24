# Scribe — Performance & UX Audit

Findings from the v0 deep-dive. Severities: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low.

Status: `[ ]` open · `[x]` done.

---

## Audio pipeline (hottest path)

- [x] 🔴 **Pre-allocate worklet buffers** — hoisted `monoBuffer` to constructor; transfer the full batch buffer instead of slicing.
- [x] 🔴 **Multi-channel downmix alloc per `process()` call** — done with the above.
- [x] 🟠 **WAV writer re-allocs conversion buffer per chunk** — single growable `convBuf`, reused across the recording.
- [ ] 🟠 **Python sidecar spawned per meeting → model reloaded** — `electron/services/python-sidecar.ts:239`. Persistent daemon over stdio JSON-RPC. **Biggest open perf win.**
- [x] 🟠 **No MPS fallback on Apple Silicon** — `whisperx_runner.py` now uses `cuda → mps → cpu` for PyTorch-native steps (diarize + embed). Whisper itself stays cpu/cuda since ctranslate2 doesn't support MPS.
- [x] 🟠 **LLM model loaded fresh per call** — module-level singleton via `getOrLoadModel(modelPath)`; only the context is disposed per call; full dispose on `app.before-quit`.
- [ ] 🟡 **Mixing is post-recording (sequential)** — `electron/services/audio-mix.ts`. Stream-mix in the worklet or kick off incrementally.
- [x] 🟡 **Voice library re-fetched on every speaker match** — main-process memory cache; invalidated by all four voice-library mutations.
- [ ] 🟢 **Overly broad teardown error swallow** — `lib/audio-capture.ts:58`. At least `console.warn`.

## Database & IPC

- [x] 🔴 **LLM auto-tag + action-item inserts not in a transaction** — new `transaction()` helper; both loops wrapped.
- [x] 🟠 **No FTS for search** — SQLite FTS5 virtual table `transcripts_fts` with triggers + one-time backfill; `searchMeetings` now uses MATCH + `snippet()`.
- [x] 🟠 **`loadTree()` polls every 5s AND fires on every mutation** — replaced with main-process broadcast: mutation sites in `db.ts`/`tree.ts` call `broadcastTreeInvalidated()`; renderer subscribes via `tree.onInvalidated` and reloads with an 80ms debounce. Sidebar 5s poll removed.
- [ ] 🟠 **`listAllMeetingTagPairs` returns everything** — `electron/services/db.ts:900`. Inline tag IDs in tree snapshot.
- [ ] 🟠 **`meetings:get` returns full transcript every time** — split into `getMeta` + paginated `getTranscript`.
- [ ] 🟠 **`updatePipeline` read-modify-write JSON each call** — split into 4 dedicated TEXT columns.
- [x] 🟡 **`autoLink` runs twice per recording (start + stop)** — start call dropped; stop is now authoritative. `loadTree`/`selectMeeting` parallelized.
- [ ] 🟡 **Missing indices on `meetings.title`, `tags.name`** — `db.ts` schema. `CREATE INDEX … COLLATE NOCASE`.
- [ ] 🟡 **DB init blocks `app.whenReady`** — `electron/main.ts:62`. Show window first; defer IPC registration.

## React / rendering

- [x] 🔴 **Transcript view renders every segment, no virtualization** — `@tanstack/react-virtual` with scrollMargin tied to the parent ScrollArea viewport.
- [x] 🟠 **Tab content unmounts on switch** — `keepMounted` on each `<TabsContent>`; preserves scroll, virtualizer measurements, parsed summary JSON.
- [x] 🟠 **`loadTree` then `selectMeeting` sequential after recording** — both branches in `startRecording`/`stopRecording` now `Promise.all`.
- [ ] 🟠 **Tag refetch waterfall after attach/detach** — `lib/store.ts:719-743`. Two IPCs where one optimistic update would do.
- [x] 🟡 **Error toast doesn't auto-dismiss + no `role="alert"`** — extracted `ErrorToast`; auto-dismiss 6s, paused on hover/focus, `aria-label` on close.
- [x] 🟡 **Inline style objects break memo equality** — `speaker-chip` and `tag-chips` style objects memoized.
- [ ] 🟡 **Search result grouping/highlighting recomputes each keystroke** — `components/scribe/search-bar.tsx`. Memo by results identity.

## Bundle / build / Electron

- [x] 🔴 **Source maps shipped to production** — Next + electron tsconfig both flipped off.
- [ ] 🟠 **Hugeicons barrel = 5,000+ icons reach the bundle** — switch to `lucide-react` or per-path imports.
- [x] 🟠 **No code-splitting for non-default views** — `SettingsView` and `CalendarView` now lazy via `React.lazy` + `Suspense`. (TasksView left eager — small enough.)
- [ ] 🟠 **`sandbox: false` in BrowserWindow without documented reason** — flip to `true` or comment why.
- [ ] 🟡 **`tw-animate-css` imported but possibly underused** — audit and inline keyframes if <5 uses.
- [ ] 🟡 **No telemetry / error reporting** — add Sentry main + renderer pre-launch.
- [ ] 🟢 **Notarization off + no auto-update** — fine for v0, plan before external testers.

## UI / UX gaps

- [x] 🔴 **No audio playback wired to transcript timestamps** — custom `scribe-media://` protocol with Range support; `<AudioPlayer>` in MeetingView; timestamps in transcript become buttons that seek + the active segment is highlighted.
- [x] 🔴 **No crash recovery for in-progress recordings** — WAV writer now writes the full header up front; `recoverInterruptedMeetings()` runs at startup and finalizes orphaned recordings.
- [x] 🟠 **Action buttons fire IPC with no disabled/spinner state** — `setMeetingTaskDone`, `setPersonalTaskDone`, `setPinned`, `deleteMeeting` all optimistic with rollback on error. `notes-view` TaskRow uses the store path instead of raw IPC.
- [x] 🟠 **No confirmation for delete** — folder + meeting delete now `window.confirm` first. (Full soft-delete + Trash view still pending.)
- [ ] 🟠 **Empty states have no loading skeletons** — TranscriptView, NotesView, SummaryView render "No X yet" while data is still loading.
- [ ] 🟠 **Keyboard shortcuts thin** — add Cmd+R record toggle, Cmd+1/2/3 tabs, Esc to dismiss toast.
- [ ] 🟡 **Tree-view drop indicator is a background highlight only** — react-arborist supports insertion indicators.
- [ ] 🟡 **Sidebar peek strip undiscoverable** — first-launch hint or always-visible micro-chevron.
- [ ] 🟡 **Tasks view: flat list, no Overdue/Today/Week/Later sections, no group-by-assignee**.
- [ ] 🟡 **Voice Library buried in Settings** — link from speaker chip directly.
- [ ] 🟢 **`muted-foreground` ~2.8:1 contrast on white** — bump lightness to ~0.45.

---

## Done so far

1. ✅ Worklet buffer pre-alloc (mono buffer hoisted + slice removed)
2. ✅ LLM tag/task transactions (new `transaction()` helper)
3. ✅ LLM model singleton (`getOrLoadModel` + dispose on app quit)
4. ✅ Strip source maps from production
5. ✅ Event-driven tree invalidation (5s poll → broadcast + debounce)
6. ✅ Virtualize transcript view (`@tanstack/react-virtual`)
7. ✅ Auto-dismiss error toast + `role="alert"` + a11y
8. ✅ Crash recovery for in-progress recordings
9. ✅ Audio playback + transcript timestamp seek (`scribe-media://` protocol, active segment highlight)
10. ✅ FTS5 search for transcripts
11. ✅ Optimistic UI for delete / pin / task done (+ delete confirms)
12. ✅ Voice library cache
13. ✅ Tab content `keepMounted`
14. ✅ Drop double `autoLink` call + parallelize `loadTree`/`selectMeeting`
15. ✅ WAV writer buffer reuse
16. ✅ MPS fallback on Apple Silicon
17. ✅ Memo inline style objects on chips
18. ✅ Code-split SettingsView + CalendarView

## Remaining (highest impact)

1. Persistent Python sidecar daemon — single biggest perf win for users with multiple recordings (eliminates 10–40s model load per meeting).
2. Optimistic UI for rename + folder mutations + tag attach/detach (waterfall).
3. Hugeicons → per-path imports or `lucide-react`.
4. Keyboard shortcuts (Cmd+R record, Cmd+1/2/3 tabs, Esc toast).
5. Loading skeletons for transcript/notes/summary.
6. Soft delete + Trash view.
7. `meetings:get` split into meta + paginated transcript.
8. `listAllMeetingTagPairs` → tags inlined in tree snapshot.
9. Tree-view drop-zone insertion indicator.
10. Tasks view sectioning (Overdue / Today / Week / Later).
11. Sentry main + renderer.
12. Sandbox flip + reason.

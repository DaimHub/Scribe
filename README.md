# Scribe

Local-first meeting recorder, transcriber, and summarizer for macOS. Electron + Next.js shell, WhisperX (Python) for transcription, node-llama-cpp for summaries.

## Develop

```bash
npm install
npm run dev
```

## Release (build + install to /Applications)

One command. Builds the Python sidecar venv if it's missing, packages the app into a DMG, then installs it to `/Applications`:

```bash
npm run release
```

When it finishes, Scribe is in your Applications folder, ready to launch.

### Requirements

- macOS on Apple Silicon
- Node 20+
- Python 3.11 or 3.12 available on PATH (e.g. via `pyenv install 3.12.11`)

### What the release script does

1. `scripts/bootstrap-python.sh` — creates `python-venv/` and installs `python/requirements.txt` (idempotent).
2. `npm run build` — Next.js static export + TypeScript compile of `electron/`.
3. `electron-builder --mac --arm64` — produces `release/Scribe-<version>-arm64.dmg`.
4. `scripts/install-to-applications.sh` — quits any running Scribe, mounts the DMG, copies `Scribe.app` to `/Applications`, strips the quarantine attribute.

The DMG is unsigned and unnotarized. It runs fine on the machine that built it. To distribute it to other Macs you'd need an Apple Developer ID and to flip `notarize: true` in `electron-builder.yml`.

### Bumping the version

Edit `version` in `package.json` before each release so DMGs don't overwrite each other in `release/`.

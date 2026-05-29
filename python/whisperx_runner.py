#!/usr/bin/env python3
"""WhisperX runner for Scribe.

One-shot invocation. Streams progress events to stderr as NDJSON; emits the
final result JSON to stdout, wrapped in sentinel markers so the caller can
extract it robustly even if a library library prints to stdout.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import traceback
from typing import Any

# Silence noisy third-party progress bars and warnings BEFORE imports.
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("PYTHONWARNINGS", "ignore")


def _make_kwarg_shim(fn):
    """Return a wrapper that pops `use_auth_token` and forwards it as `token`.

    Idempotent — wrapping a wrapped fn returns the original wrapper. Used by
    `_patch_legacy_auth_token_kwarg` to translate the deprecated kwarg at
    every entry point whisperx still hits.
    """
    if getattr(fn, "__scribe_kwarg_shim__", False):
        return fn

    def wrapper(*args, **kwargs):
        tok = kwargs.pop("use_auth_token", None)
        if tok is not None and "token" not in kwargs:
            kwargs["token"] = tok
        return fn(*args, **kwargs)

    wrapper.__scribe_kwarg_shim__ = True  # type: ignore[attr-defined]
    wrapper.__wrapped__ = fn  # type: ignore[attr-defined]
    return wrapper


def _patch_legacy_auth_token_kwarg() -> None:
    """Translate the deprecated `use_auth_token` kwarg → `token` across both
    huggingface_hub download functions AND pyannote.audio's loader/inference
    classes.

    pyannote.audio 3.x and whisperx 3.x both still pass `use_auth_token` (the
    pre-4.x name). pyannote.audio 4.x removed it from `Pipeline.from_pretrained`,
    `Model.from_pretrained`, `Inference.__init__`, and the VAD pipeline base
    — any call site that still uses the old name now throws TypeError. We're
    pinned to whisperx 3.x for the transcribe + alignment models, so we have
    to translate at the boundary instead of waiting for upstream to migrate.

    Must run BEFORE the first whisperx/pyannote import so the patched
    bindings win when those modules cache the unbound functions/classes.
    """
    try:
        import huggingface_hub  # noqa: F401
        from huggingface_hub import file_download as _hf_file_download
    except Exception:
        _hf_file_download = None  # type: ignore[assignment]
        return

    import huggingface_hub as _hf

    for name in ("hf_hub_download", "snapshot_download", "hf_hub_url"):
        for module in (_hf, _hf_file_download):
            if module is None:
                continue
            orig = getattr(module, name, None)
            if callable(orig):
                setattr(module, name, _make_kwarg_shim(orig))

    # Patch pyannote.audio class methods. These are what whisperx 3.x's VAD
    # + diarization wrappers call internally with `use_auth_token=`. Wrap
    # `__init__` and `from_pretrained` (classmethod) to strip the deprecated
    # kwarg. Done lazily inside try blocks so missing imports don't crash
    # the runtime — the sidecar still works without pyannote (no diarize).
    try:
        from pyannote.audio import Inference, Model, Pipeline

        # __init__ is a regular function on Inference; wrap and re-assign.
        Inference.__init__ = _make_kwarg_shim(Inference.__init__)  # type: ignore[method-assign]

        # `from_pretrained` is a classmethod — unwrap, shim, re-wrap.
        for cls in (Model, Pipeline):
            cur = cls.__dict__.get("from_pretrained")
            if cur is None:
                continue
            func = cur.__func__ if isinstance(cur, classmethod) else cur
            setattr(cls, "from_pretrained", classmethod(_make_kwarg_shim(func)))
    except Exception:  # noqa: BLE001
        # pyannote may not be installed (selftest-only invocations don't
        # need it); the diarize path will fail later with a clearer error.
        pass


_patch_legacy_auth_token_kwarg()

RESULT_BEGIN = "---SCRIBE-RESULT-BEGIN---"
RESULT_END = "---SCRIBE-RESULT-END---"


def emit(
    stage: str,
    pct: int,
    note: str | None = None,
    model: str | None = None,
) -> None:
    sys.stderr.write(
        json.dumps({"stage": stage, "pct": pct, "note": note, "model": model})
        + "\n"
    )
    sys.stderr.flush()


# Map language → wav2vec2 alignment model that WhisperX defaults to,
# so we can display it in the progress UI without reaching into the
# library's internals.
_ALIGN_MODEL_BY_LANG = {
    "en": "WAV2VEC2_ASR_BASE_960H",
    "fr": "VOXPOPULI_ASR_BASE_10K_FR",
    "de": "VOXPOPULI_ASR_BASE_10K_DE",
    "es": "VOXPOPULI_ASR_BASE_10K_ES",
    "it": "VOXPOPULI_ASR_BASE_10K_IT",
    "nl": "jonatasgrosman/wav2vec2-large-xlsr-53-dutch",
    "pt": "VOXPOPULI_ASR_BASE_10K_PT",
    "ja": "jonatasgrosman/wav2vec2-large-xlsr-53-japanese",
    "zh": "jonatasgrosman/wav2vec2-large-xlsr-53-chinese-zh-cn",
    "ko": "kresnik/wav2vec2-large-xlsr-korean",
    "ru": "jonatasgrosman/wav2vec2-large-xlsr-53-russian",
    "uk": "Yehor/wav2vec2-xls-r-300m-uk-with-small-lm",
    "ar": "jonatasgrosman/wav2vec2-large-xlsr-53-arabic",
    "tr": "mpoyraz/wav2vec2-xls-r-300m-cv7-turkish",
    "pl": "jonatasgrosman/wav2vec2-large-xlsr-53-polish",
    "hi": "theainerd/Wav2Vec2-large-xlsr-hindi",
    "fa": "jonatasgrosman/wav2vec2-large-xlsr-53-persian",
    "vi": "nguyenvulebinh/wav2vec2-base-vietnamese-250h",
    "el": "jonatasgrosman/wav2vec2-large-xlsr-53-greek",
}


def align_model_for(lang: str) -> str:
    return _ALIGN_MODEL_BY_LANG.get(lang, f"wav2vec2 ({lang})")


def _module_version(mod: str) -> str:
    import importlib
    from importlib.metadata import PackageNotFoundError, version as _pkg_version

    try:
        m = importlib.import_module(mod)
    except Exception as e:  # noqa: BLE001
        return f"ERROR: {e}"
    v = getattr(m, "__version__", None)
    if v:
        return v
    for name in (mod, mod.replace(".", "-"), mod.replace(".", "_")):
        try:
            return _pkg_version(name)
        except PackageNotFoundError:
            continue
    return "?"


def _collect_versions() -> dict[str, str]:
    return {
        mod: _module_version(mod)
        for mod in ("torch", "whisperx", "faster_whisper", "pyannote.audio")
    }


def selftest() -> None:
    print(json.dumps({"ok": True, "versions": _collect_versions()}))


# Module-level caches so repeat calls inside `--serve` skip the model loads
# (the heaviest part of each run, often 10–30 s on first invocation).
_WHISPER_CACHE: dict[tuple[str, str, str, str | None], Any] = {}
_ALIGN_CACHE: dict[tuple[str, str], tuple[Any, Any]] = {}
_DIARIZE_CACHE: dict[tuple[str, str, str], Any] = {}


def _get_whisper_model(
    name: str, device: str, compute_type: str, language: str | None
):
    import whisperx

    key = (name, device, compute_type, language)
    cached = _WHISPER_CACHE.get(key)
    if cached is not None:
        return cached
    model = whisperx.load_model(name, device, compute_type=compute_type, language=language)
    _WHISPER_CACHE[key] = model
    return model


def _get_align_model(language: str, device: str):
    import whisperx

    key = (language, device)
    cached = _ALIGN_CACHE.get(key)
    if cached is not None:
        return cached
    pair = whisperx.load_align_model(language_code=language, device=device)
    _ALIGN_CACHE[key] = pair
    return pair


class _DiarizationCallable:
    """Thin wrapper over `pyannote.audio.Pipeline` that mimics whisperx's
    `DiarizationPipeline` surface — accepts pre-loaded audio + num/min/max
    kwargs and returns a pandas DataFrame with columns ('segment', 'label',
    'speaker', 'start', 'end'), the shape whisperx.assign_word_speakers
    expects.

    Why a hand-rolled wrapper instead of `whisperx.diarize.DiarizationPipeline`:
    that class internally calls `Pipeline.from_pretrained(model, use_auth_token=...)`,
    but pyannote.audio 4.x dropped `use_auth_token` in favor of `token`. We
    can't intercept that internal call without monkey-patching whisperx, so
    bypassing the wrapper is cleaner. Same DataFrame contract, fewer moving
    parts.
    """

    def __init__(self, model_name: str, hf_token: str, device: str):
        import torch
        from pyannote.audio import Pipeline

        pipeline = Pipeline.from_pretrained(model_name, token=hf_token)
        # pyannote returns None (not an exception) when the user hasn't
        # accepted the model terms on HF. Surface a single actionable error
        # naming all three gated models the pipeline pulls — accepting the
        # top-level repo alone is never enough.
        if pipeline is None:
            raise RuntimeError(
                f"Could not load diarization pipeline '{model_name}'. "
                "Make sure you've accepted the user conditions on Hugging Face "
                "for the pipeline AND its sub-models:\n"
                f"  1. https://hf.co/{model_name}\n"
                "  2. https://hf.co/pyannote/segmentation-3.0\n"
                "  3. https://hf.co/pyannote/wespeaker-voxceleb-resnet34-LM\n"
                "Then verify your HF token has read access."
            )
        try:
            self.model = pipeline.to(torch.device(device))
        except Exception:  # noqa: BLE001
            # Some sub-modules (e.g. PLDA in community-1) can't move to MPS
            # cleanly; fall back to CPU rather than crashing the whole run.
            self.model = pipeline.to(torch.device("cpu"))

    def __call__(
        self,
        audio,
        num_speakers=None,
        min_speakers=None,
        max_speakers=None,
    ):
        import pandas as pd
        import torch
        from whisperx.audio import SAMPLE_RATE

        if isinstance(audio, str):
            # Let pyannote read from disk itself — torchcodec issues only
            # surface here on broken installs. Our caller always pre-loads
            # the audio though, so this branch is mostly for completeness.
            input_data = audio
        else:
            input_data = {
                "waveform": torch.from_numpy(audio[None, :]),
                "sample_rate": SAMPLE_RATE,
            }

        kwargs = {}
        if num_speakers and num_speakers > 0:
            # Exact count wins — pyannote uses constrained clustering, much
            # tighter than its similarity-threshold default.
            kwargs["num_speakers"] = int(num_speakers)
        else:
            if min_speakers and min_speakers > 0:
                kwargs["min_speakers"] = int(min_speakers)
            if max_speakers and max_speakers > 0:
                kwargs["max_speakers"] = int(max_speakers)

        result = self.model(input_data, **kwargs)
        # pyannote 4.x wraps the Annotation in a `DiarizeOutput` dataclass
        # exposing `.speaker_diarization` (with overlaps) and
        # `.exclusive_speaker_diarization` (overlaps resolved). 3.x returned
        # the Annotation directly. Prefer the exclusive variant — that
        # matches what `whisperx.assign_word_speakers` expects (one speaker
        # per timestamp) and keeps our overlap-based segment-to-speaker
        # mapping unambiguous.
        annotation = getattr(
            result,
            "exclusive_speaker_diarization",
            None,
        ) or getattr(result, "speaker_diarization", None) or result

        # `itertracks(yield_label=True)` yields (Segment, track_id, speaker).
        df = pd.DataFrame(
            annotation.itertracks(yield_label=True),
            columns=["segment", "label", "speaker"],
        )
        df["start"] = df["segment"].apply(lambda x: x.start)
        df["end"] = df["segment"].apply(lambda x: x.end)
        return df


def _get_diarize_pipeline(model_name: str, hf_token: str, device: str):
    # Auth tokens shouldn't appear in cache keys (memory + logs hygiene), but
    # only one token is ever in play per run, so model+device is enough.
    key = (model_name, device, hf_token[:8])
    cached = _DIARIZE_CACHE.get(key)
    if cached is not None:
        return cached
    pipe = _DiarizationCallable(model_name, hf_token, device)
    _DIARIZE_CACHE[key] = pipe
    return pipe


_TORCH_LOAD_PATCHED = False


def _patch_torch_load_for_pyannote() -> None:
    """PyTorch 2.6 flipped `weights_only` default to True, which refuses to
    unpickle pyannote's checkpoints (they contain `omegaconf.ListConfig` and
    other non-tensor objects). The "proper" fix — registering safe globals —
    is fragile because pyannote keeps adding new classes across versions, and
    lightning_fabric (which pyannote uses) explicitly passes `weights_only=True`
    so `setdefault` won't help — we have to override.

    Safe here: the only checkpoints loaded are ones the user (and we) trust —
    pyannote/wespeaker models fetched from HuggingFace by `pyannote.audio`
    itself, plus the whisper/faster-whisper weights bundled with whisperx.
    """
    global _TORCH_LOAD_PATCHED
    if _TORCH_LOAD_PATCHED:
        return
    import torch

    _orig_load = torch.load

    def _patched_load(*args, **kwargs):  # type: ignore[no-untyped-def]
        kwargs["weights_only"] = False
        return _orig_load(*args, **kwargs)

    torch.load = _patched_load  # type: ignore[assignment]
    _TORCH_LOAD_PATCHED = True


def run(args: argparse.Namespace) -> None:
    # All pct values are LOCAL to the current UI step (0-100 within that step).
    # The JS side multiplies by the step's weight; emitting global pcts would
    # produce nonsense progression. Stage→step mapping lives in the renderer's
    # processing-progress.tsx.
    emit("loading-runtime", 5)
    import torch
    _patch_torch_load_for_pyannote()
    import whisperx

    device = args.device
    if device == "auto":
        # ctranslate2 (whisperx's transcribe backend) only supports cuda/cpu,
        # not Apple MPS — so the whisper step itself stays on CPU on Mac.
        device = "cuda" if torch.cuda.is_available() else "cpu"

    compute_type = args.compute_type
    if compute_type == "auto":
        compute_type = "int8" if device == "cpu" else "float16"

    # PyTorch-native steps (diarization, embeddings) CAN use MPS on Apple
    # Silicon. Fall through to CPU if MPS isn't built or fails at runtime.
    def pytorch_device() -> str:
        if device == "cuda":
            return "cuda"
        try:
            if (
                hasattr(torch.backends, "mps")
                and torch.backends.mps.is_available()
                and torch.backends.mps.is_built()
            ):
                return "mps"
        except Exception:  # noqa: BLE001
            pass
        return "cpu"

    emit("loading-audio", 15)
    audio = whisperx.load_audio(args.wav)

    emit("loading-model", 25, f"device={device}", model=f"whisperx · {args.model}")
    model = _get_whisper_model(
        args.model,
        device,
        compute_type,
        args.language if args.language and args.language != "auto" else None,
    )

    emit("transcribing", 35, model=f"whisperx · {args.model}")
    result = model.transcribe(audio, batch_size=int(args.batch_size))
    language: str = result.get("language") or args.language or "en"
    emit("transcribed", 100, f"language={language}", model=f"whisperx · {args.model}")

    align_name = align_model_for(language)

    # Word-level alignment via wav2vec2 (greatly improves segment boundaries)
    if not args.no_align:
        try:
            emit("loading-align", 15, f"language={language}", model=f"wav2vec2 · {align_name}")
            align_model, align_meta = _get_align_model(language, device)
            emit("aligning", 35, model=f"wav2vec2 · {align_name}")
            result = whisperx.align(
                result["segments"],
                align_model,
                align_meta,
                audio,
                device,
                return_char_alignments=False,
            )
        except Exception as e:  # noqa: BLE001
            emit("align-failed", 100, str(e))

    # Speaker diarization (requires HF token + accepted pyannote terms).
    # community-1 clusters with PLDA, which separates speakers noticeably
    # better than the older 3.1 pipeline — especially on meetings with 3+
    # people sharing a room mic. Requires pyannote.audio >= 4 (the `plda`
    # kwarg arrived there); we pin that in requirements.txt and the venv
    # bootstrap so this default is always reachable.
    diarized = False
    diarize_model = (
        args.diarize_model or "pyannote/speaker-diarization-community-1"
    )
    if args.diarize and args.hf_token:
        try:
            emit("loading-diarize", 8, model=f"pyannote · {diarize_model.split('/')[-1]}")
            diarize_device = pytorch_device()
            diarize_pipeline = _get_diarize_pipeline(
                diarize_model, args.hf_token, diarize_device
            )
            short_name = f"pyannote · {diarize_model.split('/')[-1]}"
            emit("diarize-loaded", 18, model=short_name)
            emit("diarizing", 30, model=short_name)
            # Same precedence as run_diarize_only: exact count wins over the
            # min/max range. Avoids pyannote over-counting (e.g. estimating
            # 11 speakers in a meeting where the user knows it was 9).
            if getattr(args, "num_speakers", 0) and args.num_speakers > 0:
                diarize_segments = diarize_pipeline(
                    audio, num_speakers=int(args.num_speakers)
                )
            else:
                diarize_segments = diarize_pipeline(
                    audio,
                    min_speakers=args.min_speakers if args.min_speakers > 0 else None,
                    max_speakers=args.max_speakers if args.max_speakers > 0 else None,
                )
            # diarize_segments is a pandas DataFrame in WhisperX; len() works.
            try:
                n_diarize = len(diarize_segments)
            except Exception:  # noqa: BLE001
                n_diarize = -1
            emit("diarize-segments", 70, f"{n_diarize} rows", model=short_name)
            result = whisperx.assign_word_speakers(diarize_segments, result)
            diarized = True
            # Diagnostic: how many words actually got a speaker assignment?
            n_words = 0
            n_words_with_speaker = 0
            for s in result.get("segments", []):
                for w in (s.get("words") or []):
                    n_words += 1
                    if w.get("speaker"):
                        n_words_with_speaker += 1
            emit(
                "diarize-assigned",
                82,
                f"{n_words_with_speaker}/{n_words} words tagged",
                model=short_name,
            )
        except Exception as e:  # noqa: BLE001
            tb = traceback.format_exc().splitlines()[-1]
            emit("diarize-failed", 100, f"{type(e).__name__}: {e} ({tb})")
    elif args.diarize and not args.hf_token:
        emit("diarize-skipped", 100, "no HF token configured")
    else:
        emit("diarize-skipped", 100, "diarization not requested")

    # Build the segments payload. Fast — no progress emit needed; the next
    # heavy step is embedding extraction below (which emits its own progress).

    from collections import Counter, defaultdict

    segments_out: list[dict[str, Any]] = []
    speaker_set: set[str] = set()
    # Per-speaker segment list (start_sec, end_sec, duration_sec) — used later
    # to pick top-N for embedding extraction and to choose a sample clip.
    speaker_segments: dict[str, list[tuple[float, float, float]]] = defaultdict(list)
    for seg in result.get("segments", []):
        words_out = []
        word_speakers: list[str] = []
        for w in seg.get("words", []) or []:
            wsp = w.get("speaker")
            if wsp:
                word_speakers.append(wsp)
            words_out.append(
                {
                    "text": w.get("word") or w.get("text") or "",
                    "start_ms": int(round(float(w["start"]) * 1000)) if "start" in w else None,
                    "end_ms": int(round(float(w["end"]) * 1000)) if "end" in w else None,
                    "speaker": wsp,
                    "score": w.get("score"),
                }
            )

        # Prefer the segment-level speaker; if absent, derive from the majority
        # word-level speaker (some whisperx versions only annotate words).
        seg_speaker = seg.get("speaker")
        if not seg_speaker and word_speakers:
            seg_speaker = Counter(word_speakers).most_common(1)[0][0]
        if seg_speaker:
            speaker_set.add(seg_speaker)
            try:
                s_start = float(seg["start"])
                s_end = float(seg["end"])
                if s_end > s_start:
                    speaker_segments[seg_speaker].append(
                        (s_start, s_end, s_end - s_start)
                    )
            except (KeyError, TypeError, ValueError):
                pass

        segments_out.append(
            {
                "text": (seg.get("text") or "").strip(),
                "start_ms": int(round(float(seg["start"]) * 1000)),
                "end_ms": int(round(float(seg["end"]) * 1000)),
                "speaker": seg_speaker,
                "words": words_out,
            }
        )

    # Per-speaker voice embeddings (used to match against the global voice
    # library across meetings). Only attempted when diarization succeeded and
    # the caller passed --extract-embeddings.
    speakers_out: list[dict[str, Any]] = []
    if diarized and speaker_segments and args.extract_embeddings and args.hf_token:
        try:
            speakers_out = _extract_speaker_embeddings(
                wav_path=args.wav,
                speaker_segments=speaker_segments,
                hf_token=args.hf_token,
                device=pytorch_device(),
            )
        except Exception as e:  # noqa: BLE001
            tb = traceback.format_exc().splitlines()[-1]
            emit("embed-failed", 100, f"{type(e).__name__}: {e} ({tb})")
            speakers_out = _speaker_samples_only(speaker_segments)
    elif diarized and speaker_segments:
        # No embedding extraction, but still emit sample clip ranges so the UI
        # can play a preview when prompting for tags.
        speakers_out = _speaker_samples_only(speaker_segments)

    emit(
        "done",
        100,
        f"{len(segments_out)} segments, {len(speaker_set)} speaker(s)"
        + (f" (diarized: {sorted(speaker_set)})" if speaker_set else " (no speakers)"),
    )
    payload = json.dumps(
        {
            "language": language,
            "segments": segments_out,
            "speakers": speakers_out,
        }
    )
    # Wrap in sentinels so the host can extract the JSON even if some library
    # printed unexpected output to stdout earlier in the run.
    sys.stdout.write(f"{RESULT_BEGIN}\n{payload}\n{RESULT_END}\n")
    sys.stdout.flush()


def _speaker_samples_only(
    speaker_segments: dict[str, list[tuple[float, float, float]]],
) -> list[dict[str, Any]]:
    """Emit per-speaker payload with only a sample clip range (no embedding)."""
    out: list[dict[str, Any]] = []
    for sid, segs in speaker_segments.items():
        if not segs:
            continue
        longest = max(segs, key=lambda s: s[2])
        total = sum(s[2] for s in segs)
        out.append(
            {
                "id": sid,
                "embedding": None,
                "sample_start_ms": int(round(longest[0] * 1000)),
                "sample_end_ms": int(round(longest[1] * 1000)),
                "total_duration_ms": int(round(total * 1000)),
            }
        )
    return out


# Standalone wespeaker model — chosen so our cross-meeting voice matching
# uses one stable embedding space, independent of whichever diarization
# pipeline the user is on (3.1 uses speechbrain ECAPA internally; community-1
# uses a different stack). Picking this model up front means voices stay
# matchable across meetings even if the default diarizer changes later.
_EMBEDDING_MODEL = "pyannote/wespeaker-voxceleb-resnet34-LM"
# Cap segments fed per speaker so embedding extraction stays bounded.
_MAX_SEGMENTS_PER_SPEAKER = 5
# Ignore very short bursts when computing embeddings — they're noisier and
# pyannote's window framing can't run on them cleanly.
_MIN_EMBED_SEGMENT_SEC = 1.0


def _extract_speaker_embeddings(
    *,
    wav_path: str,
    speaker_segments: dict[str, list[tuple[float, float, float]]],
    hf_token: str,
    device: str,
) -> list[dict[str, Any]]:
    """For each speaker cluster, compute a mean voice embedding using
    pyannote's wespeaker model. Returns a list of per-speaker dicts with the
    embedding (list[float]), the longest segment as a sample clip range, and
    the total spoken duration."""
    import numpy as np
    import torch
    from pyannote.audio import Inference, Model
    from pyannote.core import Segment

    # Embedding extraction is part of the diarize UI step. Local pcts here
    # cover the tail of that step (90 → 100).
    emit("loading-embed", 90, model=f"pyannote · {_EMBEDDING_MODEL.split('/')[-1]}")
    # pyannote.audio 4.x renamed `use_auth_token` → `token` on Model.from_pretrained.
    # The huggingface_hub kwarg shim doesn't catch this call because Model
    # goes through pyannote's own loader, not hf_hub_download directly. Try
    # `token` first and fall back to `use_auth_token` only if pyannote 3.x
    # is somehow still in the venv.
    try:
        model = Model.from_pretrained(_EMBEDDING_MODEL, token=hf_token)
    except TypeError:
        model = Model.from_pretrained(_EMBEDDING_MODEL, use_auth_token=hf_token)
    if model is None:
        raise RuntimeError(
            f"Could not load embedding model '{_EMBEDDING_MODEL}'. "
            f"Accept the terms at https://hf.co/{_EMBEDDING_MODEL} and confirm "
            "your HF token has read access."
        )
    try:
        model.to(torch.device(device))
    except Exception:  # noqa: BLE001
        pass
    inference = Inference(model, window="whole")

    out: list[dict[str, Any]] = []
    for sid, segs in speaker_segments.items():
        if not segs:
            continue
        # Sort longest first, take top-N usable segments
        usable = [s for s in segs if s[2] >= _MIN_EMBED_SEGMENT_SEC]
        if not usable:
            # Fall back to the longest available segment, even if short.
            usable = sorted(segs, key=lambda s: s[2], reverse=True)[:1]
        else:
            usable = sorted(usable, key=lambda s: s[2], reverse=True)[
                :_MAX_SEGMENTS_PER_SPEAKER
            ]

        vectors: list[np.ndarray] = []
        for start_sec, end_sec, _dur in usable:
            try:
                vec = inference.crop(wav_path, Segment(start_sec, end_sec))
                # pyannote returns either an ndarray or SlidingWindowFeature;
                # in "whole" mode it's a 1-D ndarray.
                arr = np.asarray(vec).reshape(-1)
                if arr.size > 0 and np.isfinite(arr).all():
                    vectors.append(arr)
            except Exception:  # noqa: BLE001
                continue

        longest = max(segs, key=lambda s: s[2])
        total = sum(s[2] for s in segs)
        if vectors:
            stacked = np.stack(vectors, axis=0)
            mean = stacked.mean(axis=0)
            # L2-normalize so cosine similarity == dot product on the JS side.
            norm = float(np.linalg.norm(mean))
            if norm > 0:
                mean = mean / norm
            embedding: list[float] | None = mean.astype(float).tolist()
        else:
            embedding = None

        out.append(
            {
                "id": sid,
                "embedding": embedding,
                "sample_start_ms": int(round(longest[0] * 1000)),
                "sample_end_ms": int(round(longest[1] * 1000)),
                "total_duration_ms": int(round(total * 1000)),
            }
        )

    emit("embed-done", 100, f"{sum(1 for s in out if s['embedding']) }/{len(out)} embedded")
    return out


def run_diarize_only(args: argparse.Namespace) -> dict[str, Any]:
    """Run pyannote diarization against an existing transcript.

    Caller supplies the wav path and the already-persisted segments (idx +
    timing). We never invoke whisper/align — only pyannote — and return a
    map of `segment_idx -> speaker_id` derived from temporal overlap. Used
    by the "Re-diarize only" UX path when transcription is already correct
    but speakers were never tagged (typically because the HF token wasn't
    set on the first run).
    """
    if not args.hf_token:
        raise RuntimeError("hf_token is required for diarization")
    if not args.segments:
        raise RuntimeError("segments is required for diarize-only")

    emit("loading-runtime", 2)
    import torch
    _patch_torch_load_for_pyannote()
    import whisperx

    device = args.device
    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"

    def pytorch_device() -> str:
        if device == "cuda":
            return "cuda"
        try:
            if (
                hasattr(torch.backends, "mps")
                and torch.backends.mps.is_available()
                and torch.backends.mps.is_built()
            ):
                return "mps"
        except Exception:  # noqa: BLE001
            pass
        return "cpu"

    emit("loading-audio", 8)
    audio = whisperx.load_audio(args.wav)

    diarize_model = (
        args.diarize_model or "pyannote/speaker-diarization-community-1"
    )
    short_name = f"pyannote · {diarize_model.split('/')[-1]}"
    emit("loading-diarize", 20, model=short_name)
    diarize_device = pytorch_device()
    diarize_pipeline = _get_diarize_pipeline(
        diarize_model, args.hf_token, diarize_device
    )
    emit("diarize-loaded", 30, model=short_name)
    emit("diarizing", 45, model=short_name)
    # num_speakers (exact count) gives pyannote far better clustering than
    # min/max ranges — forces it to produce exactly N clusters instead of
    # estimating with its similarity threshold. We use it whenever the user
    # tells us how many people spoke; otherwise we fall back to the range.
    if getattr(args, "num_speakers", 0) and args.num_speakers > 0:
        diarize_segments = diarize_pipeline(
            audio, num_speakers=args.num_speakers
        )
    else:
        diarize_segments = diarize_pipeline(
            audio,
            min_speakers=args.min_speakers if args.min_speakers > 0 else None,
            max_speakers=args.max_speakers if args.max_speakers > 0 else None,
        )

    # diarize_segments is a pandas DataFrame in WhisperX with columns
    # `start` (sec), `end` (sec), `speaker`. We iterate it once to build a
    # lightweight in-memory list and to feed both the overlap mapping and
    # the per-speaker segment range collection (used for embeddings).
    from collections import defaultdict

    diarize_rows: list[tuple[float, float, str]] = []
    speaker_segments: dict[str, list[tuple[float, float, float]]] = defaultdict(list)
    try:
        iterator = diarize_segments.itertuples(index=False)
        for row in iterator:
            try:
                start_sec = float(getattr(row, "start"))
                end_sec = float(getattr(row, "end"))
                spk = str(getattr(row, "speaker"))
            except (AttributeError, ValueError, TypeError):
                continue
            if end_sec <= start_sec:
                continue
            diarize_rows.append((start_sec, end_sec, spk))
            speaker_segments[spk].append(
                (start_sec, end_sec, end_sec - start_sec)
            )
    except Exception:  # noqa: BLE001
        # If pandas itertuples isn't available for some reason, fall back
        # to whatever iteration interface the object supports.
        for entry in diarize_segments:
            try:
                start_sec = float(entry["start"])
                end_sec = float(entry["end"])
                spk = str(entry["speaker"])
            except (KeyError, ValueError, TypeError):
                continue
            if end_sec <= start_sec:
                continue
            diarize_rows.append((start_sec, end_sec, spk))
            speaker_segments[spk].append(
                (start_sec, end_sec, end_sec - start_sec)
            )

    emit(
        "diarize-segments",
        70,
        f"{len(diarize_rows)} rows, {len(speaker_segments)} speakers",
        model=short_name,
    )

    # For each input segment, pick the speaker with the largest temporal
    # overlap. Falls back to None when there's no overlap at all (very rare
    # — usually means the diarize run produced zero rows in that window).
    assignments: list[dict[str, Any]] = []
    for seg in args.segments:
        try:
            seg_idx = int(seg["idx"])
            seg_start = float(seg["start_ms"]) / 1000.0
            seg_end = float(seg["end_ms"]) / 1000.0
        except (KeyError, ValueError, TypeError):
            continue
        if seg_end <= seg_start:
            continue
        overlap_by_speaker: dict[str, float] = defaultdict(float)
        for rs, re_, spk in diarize_rows:
            ov = min(seg_end, re_) - max(seg_start, rs)
            if ov > 0:
                overlap_by_speaker[spk] += ov
        if overlap_by_speaker:
            best_spk, _best_dur = max(
                overlap_by_speaker.items(), key=lambda kv: kv[1]
            )
            assignments.append({"segment_idx": seg_idx, "speaker": best_spk})

    emit("diarize-assigned", 85, f"{len(assignments)}/{len(args.segments)} segments mapped")

    # Embeddings: same pipeline as the full run so cross-meeting voice
    # matching keeps working after a re-diarize.
    speakers_out: list[dict[str, Any]] = []
    if speaker_segments:
        try:
            speakers_out = _extract_speaker_embeddings(
                wav_path=args.wav,
                speaker_segments=speaker_segments,
                hf_token=args.hf_token,
                device=pytorch_device(),
            )
        except Exception as e:  # noqa: BLE001
            tb = traceback.format_exc().splitlines()[-1]
            emit("embed-failed", 99, f"{type(e).__name__}: {e} ({tb})")
            speakers_out = _speaker_samples_only(speaker_segments)

    emit("done", 100, f"{len(assignments)} segments, {len(speaker_segments)} speaker(s)")
    return {
        "assignments": assignments,
        "speakers": speakers_out,
    }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--selftest", action="store_true")
    parser.add_argument(
        "--serve",
        action="store_true",
        help="Persistent daemon mode: read JSON commands from stdin, emit "
        "results on stdout, progress on stderr. Models stay loaded across "
        "commands.",
    )
    parser.add_argument("--wav")
    parser.add_argument("--model", default="large-v3-turbo")
    parser.add_argument("--language", default="auto")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--compute-type", default="auto")
    parser.add_argument("--batch-size", default="16")
    parser.add_argument("--no-align", action="store_true")
    parser.add_argument("--diarize", action="store_true")
    parser.add_argument("--hf-token", default=None)
    parser.add_argument("--diarize-model", default=None)
    parser.add_argument("--num-speakers", type=int, default=0)
    parser.add_argument("--min-speakers", type=int, default=0)
    parser.add_argument("--max-speakers", type=int, default=0)
    parser.add_argument("--extract-embeddings", action="store_true")
    return parser


# In --serve mode, every emit/print needs to carry the in-flight request id so
# the Node side can correlate. This is set per-command in the loop.
_CURRENT_REQUEST_ID: str | None = None
_SERVE_MODE = False


def emit_serve(stage: str, pct: int, note: str | None = None, model: str | None = None) -> None:
    sys.stderr.write(
        json.dumps({
            "event": "progress",
            "id": _CURRENT_REQUEST_ID,
            "stage": stage,
            "pct": pct,
            "note": note,
            "model": model,
        })
        + "\n"
    )
    sys.stderr.flush()


def _payload_to_namespace(payload: dict) -> argparse.Namespace:
    """Map the JSON command payload to the same shape `run()` already expects."""
    ns = argparse.Namespace(
        selftest=False,
        serve=False,
        wav=payload.get("wav"),
        model=payload.get("model") or "large-v3-turbo",
        language=payload.get("language") or "auto",
        device=payload.get("device") or "auto",
        compute_type=payload.get("compute_type") or "auto",
        batch_size=str(payload.get("batch_size", 16)),
        no_align=bool(payload.get("no_align", False)),
        diarize=bool(payload.get("diarize", False)),
        hf_token=payload.get("hf_token"),
        diarize_model=payload.get("diarize_model"),
        num_speakers=int(payload.get("num_speakers", 0) or 0),
        min_speakers=int(payload.get("min_speakers", 0) or 0),
        max_speakers=int(payload.get("max_speakers", 0) or 0),
        extract_embeddings=bool(payload.get("extract_embeddings", False)),
    )
    return ns


def serve() -> None:
    """Daemon loop: read one JSON command per line on stdin, dispatch, emit
    a single completion event on stdout. Imports + model loads on first use
    are cached for subsequent commands (the win this mode exists for)."""
    global _CURRENT_REQUEST_ID, _SERVE_MODE, emit
    _SERVE_MODE = True
    emit = emit_serve  # type: ignore[assignment]

    # Signal readiness so the Node side knows we're listening.
    sys.stdout.write(json.dumps({"event": "ready"}) + "\n")
    sys.stdout.flush()

    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
        except json.JSONDecodeError as e:
            sys.stdout.write(
                json.dumps({"event": "error", "id": None, "message": f"bad JSON: {e}"})
                + "\n"
            )
            sys.stdout.flush()
            continue

        cmd_type = cmd.get("type")
        req_id = cmd.get("id")
        _CURRENT_REQUEST_ID = req_id

        if cmd_type == "shutdown":
            sys.stdout.write(
                json.dumps({"event": "result", "id": req_id, "ok": True, "result": {"shutdown": True}})
                + "\n"
            )
            sys.stdout.flush()
            return

        if cmd_type == "selftest":
            try:
                sys.stdout.write(
                    json.dumps({"event": "result", "id": req_id, "ok": True, "result": {"versions": _collect_versions()}})
                    + "\n"
                )
            except Exception as e:  # noqa: BLE001
                sys.stdout.write(
                    json.dumps({"event": "error", "id": req_id, "message": f"{type(e).__name__}: {e}"})
                    + "\n"
                )
            sys.stdout.flush()
            continue

        if cmd_type == "run":
            payload = cmd.get("payload") or {}
            ns = _payload_to_namespace(payload)
            if not ns.wav:
                sys.stdout.write(
                    json.dumps({"event": "error", "id": req_id, "message": "wav is required"})
                    + "\n"
                )
                sys.stdout.flush()
                continue
            try:
                _run_serve_dispatch(ns, req_id)
            except Exception as e:  # noqa: BLE001
                sys.stdout.write(
                    json.dumps({
                        "event": "error",
                        "id": req_id,
                        "message": f"{type(e).__name__}: {e}",
                        "trace": traceback.format_exc(),
                    })
                    + "\n"
                )
                sys.stdout.flush()
            continue

        if cmd_type == "diarize-only":
            payload = cmd.get("payload") or {}
            ns = argparse.Namespace(
                wav=payload.get("wav"),
                device=payload.get("device") or "auto",
                hf_token=payload.get("hf_token"),
                diarize_model=payload.get("diarize_model"),
                num_speakers=int(payload.get("num_speakers", 0) or 0),
                min_speakers=int(payload.get("min_speakers", 0) or 0),
                max_speakers=int(payload.get("max_speakers", 0) or 0),
                segments=payload.get("segments") or [],
            )
            if not ns.wav:
                sys.stdout.write(
                    json.dumps({"event": "error", "id": req_id, "message": "wav is required"})
                    + "\n"
                )
                sys.stdout.flush()
                continue
            try:
                result = run_diarize_only(ns)
                sys.stdout.write(
                    json.dumps({"event": "result", "id": req_id, "ok": True, "result": result})
                    + "\n"
                )
            except Exception as e:  # noqa: BLE001
                sys.stdout.write(
                    json.dumps({
                        "event": "error",
                        "id": req_id,
                        "message": f"{type(e).__name__}: {e}",
                        "trace": traceback.format_exc(),
                    })
                    + "\n"
                )
            sys.stdout.flush()
            continue

        sys.stdout.write(
            json.dumps({"event": "error", "id": req_id, "message": f"unknown command: {cmd_type}"})
            + "\n"
        )
        sys.stdout.flush()


def _run_serve_dispatch(args: argparse.Namespace, req_id: str) -> None:
    """run() writes its result to stdout via sentinels in one-shot mode. In
    serve mode we capture that output and re-emit it as a structured event."""
    import io

    buf = io.StringIO()
    real_stdout = sys.stdout
    sys.stdout = buf
    try:
        run(args)
    finally:
        sys.stdout = real_stdout

    raw = buf.getvalue()
    begin = raw.find(RESULT_BEGIN)
    end = raw.find(RESULT_END)
    if begin == -1 or end == -1:
        sys.stdout.write(
            json.dumps({"event": "error", "id": req_id, "message": "no result payload"})
            + "\n"
        )
        sys.stdout.flush()
        return
    payload_json = raw[begin + len(RESULT_BEGIN):end].strip()
    try:
        parsed = json.loads(payload_json)
    except json.JSONDecodeError as e:
        sys.stdout.write(
            json.dumps({"event": "error", "id": req_id, "message": f"bad result JSON: {e}"})
            + "\n"
        )
        sys.stdout.flush()
        return
    sys.stdout.write(
        json.dumps({"event": "result", "id": req_id, "ok": True, "result": parsed})
        + "\n"
    )
    sys.stdout.flush()


def main() -> None:
    args = _build_parser().parse_args()

    try:
        if args.serve:
            serve()
            return
        if args.selftest:
            selftest()
            return
        if not args.wav:
            print(json.dumps({"error": "--wav is required"}))
            sys.exit(2)
        run(args)
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(
            json.dumps(
                {
                    "stage": "fatal",
                    "pct": 0,
                    "note": f"{type(e).__name__}: {e}",
                    "trace": traceback.format_exc(),
                }
            )
            + "\n"
        )
        sys.exit(1)


if __name__ == "__main__":
    main()

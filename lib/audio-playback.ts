"use client";

/**
 * Tiny external store for the meeting audio player. Kept out of the Zustand
 * store so per-tick currentTime updates don't ripple through unrelated
 * selectors. Components subscribe via React's `useSyncExternalStore`.
 */

type Listener = () => void;

interface PlaybackState {
  meetingId: string | null;
  isPlaying: boolean;
  /** Index of the currently-playing transcript segment, or -1. */
  activeSegmentIdx: number;
}

let state: PlaybackState = {
  meetingId: null,
  isPlaying: false,
  activeSegmentIdx: -1,
};

const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

function set(patch: Partial<PlaybackState>): void {
  const next = { ...state, ...patch };
  if (
    next.meetingId === state.meetingId &&
    next.isPlaying === state.isPlaying &&
    next.activeSegmentIdx === state.activeSegmentIdx
  ) {
    return;
  }
  state = next;
  emit();
}

export function subscribePlayback(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getPlayback(): PlaybackState {
  return state;
}

let audioEl: HTMLAudioElement | null = null;

/** Called by the `<AudioPlayer>` to register/unregister its <audio> element. */
export function bindAudioElement(
  meetingId: string,
  el: HTMLAudioElement | null,
): void {
  audioEl = el;
  set({
    meetingId: el ? meetingId : null,
    isPlaying: false,
    activeSegmentIdx: -1,
  });
}

export function seekTo(meetingId: string, seconds: number): void {
  if (!audioEl || state.meetingId !== meetingId) return;
  audioEl.currentTime = Math.max(0, seconds);
  void audioEl.play().catch(() => {
    /* user may need to interact first; ignore */
  });
}

export function setActiveSegment(idx: number): void {
  if (idx === state.activeSegmentIdx) return;
  set({ activeSegmentIdx: idx });
}

export function setIsPlaying(playing: boolean): void {
  if (playing === state.isPlaying) return;
  set({ isPlaying: playing });
}

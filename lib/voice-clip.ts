"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Load a sample WAV clip (referenced by absolute path) via the preload bridge
 * and return a Blob URL the renderer can play through an <audio> element or
 * the Web Audio API. Caches per path within the component lifetime.
 */
export function useSampleClipUrl(filePath: string | null): {
  url: string | null;
  loading: boolean;
  error: string | null;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const bytes = await window.scribe.voice.readSampleClip(filePath);
        if (cancelled) return;
        // Copy into a fresh ArrayBuffer to satisfy Blob's BlobPart type
        // (preload may hand back a Uint8Array view over a SharedArrayBuffer).
        const ab = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(ab).set(bytes);
        const blob = new Blob([ab], { type: "audio/wav" });
        const objectUrl = URL.createObjectURL(blob);
        if (currentRef.current) URL.revokeObjectURL(currentRef.current);
        currentRef.current = objectUrl;
        setUrl(objectUrl);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  useEffect(() => {
    return () => {
      if (currentRef.current) {
        URL.revokeObjectURL(currentRef.current);
        currentRef.current = null;
      }
    };
  }, []);

  return { url, loading, error };
}

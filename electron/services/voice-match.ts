import { randomUUID } from "node:crypto";
import {
  createVoiceLibraryEntry,
  getVoiceLibraryEntry,
  listVoiceLibraryWithEmbeddings,
  updateVoiceLibraryEmbedding,
  type VoiceLibraryEntry,
} from "./db.js";

// Cosine similarity thresholds. Tuned against pyannote/wespeaker-voxceleb-resnet34-LM
// (256-dim, L2-normalized embeddings): same speaker tends to land 0.55–0.95,
// different speakers tend to land 0.10–0.45 with occasional outliers.
//
// AUTO_THRESHOLD → assign silently
// REVIEW_THRESHOLD → suggest as top candidate but flag for user review
// Below REVIEW_THRESHOLD → treat as unknown speaker
export const AUTO_THRESHOLD = 0.78;
export const REVIEW_THRESHOLD = 0.62;

export interface MatchCandidate {
  entry: VoiceLibraryEntry;
  similarity: number;
}

export interface MatchVerdict {
  /** Best library entry above REVIEW_THRESHOLD, if any. */
  best: MatchCandidate | null;
  /** Top-K candidates ranked by similarity (for "did you mean X?" UI). */
  candidates: MatchCandidate[];
  /** What the pipeline should do with this cluster. */
  decision: "auto-assign" | "needs-review" | "unknown";
}

/** Cosine similarity between two L2-normalized embeddings. Falls back to
 *  dividing by norms if either side isn't normalized. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  // Skip the sqrt when both are already unit-norm.
  if (Math.abs(na - 1) < 1e-4 && Math.abs(nb - 1) < 1e-4) return dot;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function findBestMatch(
  embedding: Float32Array,
  topK: number = 3,
): MatchVerdict {
  const library = listVoiceLibraryWithEmbeddings();
  if (library.length === 0) {
    return { best: null, candidates: [], decision: "unknown" };
  }

  const scored: MatchCandidate[] = [];
  for (const entry of library) {
    if (entry.dim !== embedding.length) continue;
    const sim = cosineSimilarity(embedding, entry.embedding);
    scored.push({ entry, similarity: sim });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  const candidates = scored.slice(0, topK);
  const best = candidates[0] ?? null;

  let decision: MatchVerdict["decision"] = "unknown";
  if (best) {
    if (best.similarity >= AUTO_THRESHOLD) decision = "auto-assign";
    else if (best.similarity >= REVIEW_THRESHOLD) decision = "needs-review";
  }
  return { best, candidates, decision };
}

/** Update the library entry's embedding using a running mean weighted by the
 *  number of meetings already aggregated. New embedding is normalized to
 *  preserve unit-norm invariant. */
export function mergeIntoLibrary(opts: {
  libraryId: string;
  newEmbedding: Float32Array;
}): void {
  const existing = getVoiceLibraryEntry(opts.libraryId);
  if (!existing) return;
  if (existing.dim !== opts.newEmbedding.length) return;

  const n = existing.n_meetings;
  const merged = new Float32Array(existing.dim);
  for (let i = 0; i < merged.length; i++) {
    // Weighted mean: keep n historical observations + 1 new = (n+1) total
    merged[i] = (existing.embedding[i] * n + opts.newEmbedding[i]) / (n + 1);
  }
  // Re-normalize so subsequent cosine sim shortcut (dot product) stays valid.
  let norm = 0;
  for (let i = 0; i < merged.length; i++) norm += merged[i] * merged[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < merged.length; i++) merged[i] /= norm;
  }

  updateVoiceLibraryEmbedding({ id: opts.libraryId, newEmbedding: merged });
}

/** Create a fresh voice library entry from a confirmed new speaker. Returns
 *  the new id so the caller can wire it to the per-meeting speaker row. */
export function addToLibrary(opts: {
  displayName: string;
  embedding: Float32Array;
  sampleClipPath: string | null;
}): VoiceLibraryEntry {
  return createVoiceLibraryEntry({
    id: randomUUID(),
    displayName: opts.displayName,
    embedding: opts.embedding,
    sampleClipPath: opts.sampleClipPath,
  });
}

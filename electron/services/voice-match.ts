import { randomUUID } from "node:crypto";
import {
  addCentroid,
  createVoiceLibraryEntry,
  getCentroidsForPerson,
  listPeopleWithCentroids,
  touchPerson,
  updateCentroid,
} from "./db.js";

// Cosine similarity thresholds. Tuned against pyannote/wespeaker-voxceleb-resnet34-LM
// (256-dim, L2-normalized embeddings): same speaker tends to land 0.55–0.95,
// different speakers tend to land 0.10–0.45 with occasional outliers.
//
// We score a person as the MAX similarity over their centroids, so the same
// voice in a new acoustic setup still matches as long as one centroid covers
// that setup. Because that raises recall, we pair a lower absolute floor with
// a relative MARGIN test (the winner must clearly beat the runner-up) to keep
// precision — auto-assigning the WRONG person is worse than asking.
//
// AUTO_THRESHOLD + AUTO_MARGIN → assign silently
// REVIEW_THRESHOLD → suggest as top candidate but flag for user review
// Below REVIEW_THRESHOLD → treat as unknown speaker
//
// These are conservative starting points; real-world data may warrant tuning.
export const AUTO_THRESHOLD = 0.66;
export const REVIEW_THRESHOLD = 0.48;
/** The top person must beat the 2nd-best person by at least this to auto-assign.
 *  Guards against two library people being acoustically close. */
export const AUTO_MARGIN = 0.08;
/** A new observation within this of an existing centroid refines it (same
 *  acoustic condition); below it spawns a new centroid (new condition). */
export const CENTROID_MERGE_THRESHOLD = 0.7;
/** Cap centroids per person so a chatty regular doesn't accumulate forever. */
export const MAX_CENTROIDS = 4;

/** Light identity for a matched person — all the matcher's callers need. */
export interface MatchedPerson {
  id: string;
  display_name: string;
}

export interface MatchCandidate {
  entry: MatchedPerson;
  similarity: number;
}

export interface MatchVerdict {
  /** Best library person above REVIEW_THRESHOLD, if any. */
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

function l2normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return new Float32Array(v);
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

/** Weighted running mean of an existing centroid (with n prior samples) and a
 *  new observation, re-normalized to unit length. */
function runningMean(
  existing: Float32Array,
  n: number,
  incoming: Float32Array,
): Float32Array {
  const merged = new Float32Array(existing.length);
  for (let i = 0; i < merged.length; i++) {
    merged[i] = (existing[i] * n + incoming[i]) / (n + 1);
  }
  return l2normalize(merged);
}

export function findBestMatch(
  embedding: Float32Array,
  topK: number = 3,
): MatchVerdict {
  const people = listPeopleWithCentroids();
  if (people.length === 0) {
    return { best: null, candidates: [], decision: "unknown" };
  }

  const scored: MatchCandidate[] = [];
  for (const p of people) {
    // A person's similarity is the best of any of their centroids — covers
    // the same voice recorded under different conditions.
    let personSim = -1;
    for (const c of p.centroids) {
      if (c.embedding.length !== embedding.length) continue;
      const sim = cosineSimilarity(embedding, c.embedding);
      if (sim > personSim) personSim = sim;
    }
    if (personSim < 0) continue; // name-only person, not yet matchable
    scored.push({
      entry: { id: p.id, display_name: p.display_name },
      similarity: personSim,
    });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  const candidates = scored.slice(0, topK);
  const best = candidates[0] ?? null;

  let decision: MatchVerdict["decision"] = "unknown";
  if (best) {
    const second = candidates[1];
    const margin = second ? best.similarity - second.similarity : Infinity;
    if (best.similarity >= AUTO_THRESHOLD && margin >= AUTO_MARGIN) {
      decision = "auto-assign";
    } else if (best.similarity >= REVIEW_THRESHOLD) {
      decision = "needs-review";
    }
  }
  return { best, candidates, decision };
}

/** Fold a new observation into a person's voice fingerprints. Refines the
 *  nearest centroid when the new vector matches an existing acoustic condition,
 *  spawns a new centroid for a distinctly different one (up to MAX_CENTROIDS),
 *  and seeds the first centroid for a name-only person. */
export function mergeIntoLibrary(opts: {
  libraryId: string;
  newEmbedding: Float32Array;
}): void {
  if (opts.newEmbedding.length === 0) return;
  const normalized = l2normalize(opts.newEmbedding);
  const centroids = getCentroidsForPerson(opts.libraryId);

  // Name-only person (created before any embedding was available) → seed.
  if (centroids.length === 0) {
    addCentroid({
      libraryId: opts.libraryId,
      idx: 0,
      embedding: normalized,
      nSamples: 1,
    });
    touchPerson(opts.libraryId);
    return;
  }

  let nearest = centroids[0];
  let nearestSim = -1;
  for (const c of centroids) {
    if (c.embedding.length !== normalized.length) continue;
    const sim = cosineSimilarity(normalized, c.embedding);
    if (sim > nearestSim) {
      nearestSim = sim;
      nearest = c;
    }
  }
  const sameLen = nearest.embedding.length === normalized.length;

  if (sameLen && nearestSim >= CENTROID_MERGE_THRESHOLD) {
    updateCentroid({
      libraryId: opts.libraryId,
      idx: nearest.idx,
      embedding: runningMean(nearest.embedding, nearest.nSamples, normalized),
      nSamples: nearest.nSamples + 1,
    });
  } else if (centroids.length < MAX_CENTROIDS) {
    const nextIdx = Math.max(...centroids.map((c) => c.idx)) + 1;
    addCentroid({
      libraryId: opts.libraryId,
      idx: nextIdx,
      embedding: normalized,
      nSamples: 1,
    });
  } else if (sameLen) {
    // At capacity: fold into the nearest condition rather than dropping it.
    updateCentroid({
      libraryId: opts.libraryId,
      idx: nearest.idx,
      embedding: runningMean(nearest.embedding, nearest.nSamples, normalized),
      nSamples: nearest.nSamples + 1,
    });
  }
  touchPerson(opts.libraryId);
}

/** Create a fresh person from a confirmed new speaker. Seeds a first centroid
 *  when an embedding is available; otherwise the person exists name-only (and
 *  optionally email-only) until their first real recording is folded in via
 *  mergeIntoLibrary. Returns the new id so the caller can wire it to the
 *  per-meeting speaker row. */
export function addToLibrary(opts: {
  displayName: string;
  embedding: Float32Array | null;
  sampleClipPath: string | null;
  email: string | null;
}): { id: string } {
  const id = randomUUID();
  createVoiceLibraryEntry({
    id,
    displayName: opts.displayName,
    email: opts.email,
    sampleClipPath: opts.sampleClipPath,
  });
  if (opts.embedding && opts.embedding.length > 0) {
    addCentroid({
      libraryId: id,
      idx: 0,
      embedding: l2normalize(opts.embedding),
      nSamples: 1,
    });
  }
  return { id };
}

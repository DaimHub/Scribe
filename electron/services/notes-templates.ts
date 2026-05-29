import { randomUUID } from "node:crypto";
import {
  getNotesTemplatesState,
  saveNotesTemplatesState,
  type NotesTemplatesState,
} from "./settings.js";

/**
 * A notes template is the per-meeting "persona" that prefixes the locked
 * schema spec inside the LLM prompt. The schema, language rules and
 * transcript are immutable — the user only edits the prose that tells the
 * model what kind of meeting it is summarizing and what tone/focus to use.
 *
 * Templates come in two flavours:
 *   - builtin: shipped with the app, identified by "builtin:<slug>". They
 *     cannot be deleted but their instructions can be overridden, and reset.
 *   - custom: user-created, identified by a random UUID. Full CRUD.
 */
export interface NotesTemplate {
  id: string;
  name: string;
  instructions: string;
  builtin: boolean;
}

interface BuiltinDef {
  id: string;
  name: string;
  instructions: string;
}

const BUILTIN_TEMPLATES: BuiltinDef[] = [
  {
    id: "builtin:general",
    name: "General meeting",
    instructions:
      "You are an assistant that produces thorough, structured meeting notes from transcripts. Be concrete and quote specifics from the transcript — dates, names, numbers, commitments. Cover every distinct topic discussed; do not collapse multiple topics into a single section. Each section should stand on its own as a complete account of that topic.",
  },
  {
    id: "builtin:standup",
    name: "Daily standup",
    instructions:
      "You are summarizing a daily team standup. Be terse — engineers will skim this. Each section should be one team member's update with three short buckets: what they shipped since yesterday, what they're picking up today, and any blockers. Decisions should only list things the team explicitly agreed on out loud (e.g. 'we'll skip the design review this sprint'). Action items must have a clear owner from the call — do not invent owners.",
  },
  {
    id: "builtin:sales",
    name: "Sales discovery call",
    instructions:
      "You are summarizing a sales discovery call between an account executive and a prospect. Focus on: the prospect's pain points and current workflow, their decision criteria, budget and timing signals, the identity and role of decision-makers, objections raised, and concrete next steps from both sides. Quote the prospect verbatim when they describe their pain — those quotes are the most valuable part of the call. Treat 'decisions' as anything the prospect committed to (a follow-up call, a trial, an intro). Action items should split cleanly between AE-owned and prospect-owned.",
  },
  {
    id: "builtin:interview",
    name: "User research interview",
    instructions:
      "You are synthesizing a user research interview. Surface the themes that emerged organically, not just the questions the interviewer asked. Capture verbatim quotes that are vivid, surprising, or contradict assumptions — these are the gold. Note moments where the participant hesitated, contradicted themselves, or seemed unsure: that ambiguity is research signal, not noise. The 'decisions' array should usually be empty (an interview rarely decides anything). Action items are research follow-ups the interviewer should do next (e.g. 'review the workflow Sarah sketched out at 14:20', 'check whether the pricing concern is shared by other interviewees').",
  },
];

const DEFAULT_TEMPLATE_ID = "builtin:general";

/** Apply user overrides to builtins and append customs. */
export async function listTemplates(): Promise<NotesTemplate[]> {
  const state = await getNotesTemplatesState();
  const builtins: NotesTemplate[] = BUILTIN_TEMPLATES.map((b) => ({
    id: b.id,
    name: b.name,
    instructions: state.overrides[b.id] ?? b.instructions,
    builtin: true,
  }));
  const customs: NotesTemplate[] = state.custom.map((c) => ({
    id: c.id,
    name: c.name,
    instructions: c.instructions,
    builtin: false,
  }));
  return [...builtins, ...customs];
}

export async function getTemplate(id: string): Promise<NotesTemplate | null> {
  const all = await listTemplates();
  return all.find((t) => t.id === id) ?? null;
}

export async function getDefaultTemplateId(): Promise<string> {
  const state = await getNotesTemplatesState();
  const id = state.default_id || DEFAULT_TEMPLATE_ID;
  // Defensive: if the user deleted the template that was the default,
  // fall back to the seed default rather than throwing later.
  const exists = (await listTemplates()).some((t) => t.id === id);
  return exists ? id : DEFAULT_TEMPLATE_ID;
}

/** Resolve a template by id, falling back to the global default. Used by
 *  generateNotes to pick the right instructions block for a meeting. */
export async function resolveTemplate(
  templateId: string | null | undefined,
): Promise<NotesTemplate> {
  if (templateId) {
    const t = await getTemplate(templateId);
    if (t) return t;
  }
  const defaultId = await getDefaultTemplateId();
  const t = await getTemplate(defaultId);
  // If even the seed default is missing (shouldn't happen — builtins are
  // baked into the binary), synthesize one in-memory so generation can
  // always proceed.
  if (t) return t;
  const seed = BUILTIN_TEMPLATES.find((b) => b.id === DEFAULT_TEMPLATE_ID)!;
  return { ...seed, builtin: true };
}

export async function setDefaultTemplate(id: string): Promise<void> {
  const exists = (await listTemplates()).some((t) => t.id === id);
  if (!exists) throw new Error(`unknown template: ${id}`);
  const state = await getNotesTemplatesState();
  state.default_id = id;
  await saveNotesTemplatesState(state);
}

export async function createCustomTemplate(opts: {
  name: string;
  instructions: string;
}): Promise<NotesTemplate> {
  const name = opts.name.trim();
  const instructions = opts.instructions.trim();
  if (!name) throw new Error("template name is required");
  if (!instructions) throw new Error("template instructions are required");
  const state = await getNotesTemplatesState();
  const id = `custom:${randomUUID()}`;
  state.custom.push({ id, name, instructions });
  await saveNotesTemplatesState(state);
  return { id, name, instructions, builtin: false };
}

export async function updateTemplate(
  id: string,
  patch: { name?: string; instructions?: string },
): Promise<NotesTemplate> {
  const state = await getNotesTemplatesState();
  if (id.startsWith("builtin:")) {
    const builtin = BUILTIN_TEMPLATES.find((b) => b.id === id);
    if (!builtin) throw new Error(`unknown builtin template: ${id}`);
    // Builtins always keep their name; the user only overrides instructions.
    if (patch.instructions !== undefined) {
      const next = patch.instructions.trim();
      if (!next) {
        delete state.overrides[id];
      } else if (next === builtin.instructions) {
        // Identical to the seed — drop the override so the entry is clean.
        delete state.overrides[id];
      } else {
        state.overrides[id] = next;
      }
    }
    await saveNotesTemplatesState(state);
    return {
      id,
      name: builtin.name,
      instructions: state.overrides[id] ?? builtin.instructions,
      builtin: true,
    };
  }
  const idx = state.custom.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error(`unknown template: ${id}`);
  const cur = state.custom[idx];
  const nextName = patch.name !== undefined ? patch.name.trim() : cur.name;
  const nextInstructions =
    patch.instructions !== undefined
      ? patch.instructions.trim()
      : cur.instructions;
  if (!nextName) throw new Error("template name cannot be empty");
  if (!nextInstructions)
    throw new Error("template instructions cannot be empty");
  state.custom[idx] = {
    id,
    name: nextName,
    instructions: nextInstructions,
  };
  await saveNotesTemplatesState(state);
  return { id, name: nextName, instructions: nextInstructions, builtin: false };
}

export async function deleteTemplate(id: string): Promise<void> {
  if (id.startsWith("builtin:")) {
    throw new Error("builtin templates cannot be deleted — use reset instead");
  }
  const state = await getNotesTemplatesState();
  const before = state.custom.length;
  state.custom = state.custom.filter((c) => c.id !== id);
  if (state.custom.length === before) {
    throw new Error(`unknown template: ${id}`);
  }
  // If the deleted template was the default, fall back to the seed default
  // so the next generation doesn't fail with "unknown template".
  if (state.default_id === id) state.default_id = DEFAULT_TEMPLATE_ID;
  await saveNotesTemplatesState(state);
}

/** Reset a builtin template's instructions to the shipped seed. No-op on
 *  customs (caller is expected to gate the UI to builtins only). */
export async function resetTemplate(id: string): Promise<NotesTemplate> {
  if (!id.startsWith("builtin:")) {
    throw new Error("only builtin templates can be reset");
  }
  const builtin = BUILTIN_TEMPLATES.find((b) => b.id === id);
  if (!builtin) throw new Error(`unknown builtin template: ${id}`);
  const state = await getNotesTemplatesState();
  delete state.overrides[id];
  await saveNotesTemplatesState(state);
  return {
    id,
    name: builtin.name,
    instructions: builtin.instructions,
    builtin: true,
  };
}

// Re-exported so consumers don't need to import from settings.
export type { NotesTemplatesState };

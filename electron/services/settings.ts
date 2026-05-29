import { app, safeStorage } from "electron";
import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

const SETTINGS_FILE = (): string =>
  path.join(app.getPath("userData"), "settings.json");

export type DisplayLanguage = "en" | "fr" | "es" | "de";
export type AiLanguage = "auto" | "en" | "fr" | "es" | "de";
export type LlmProvider =
  | "bundled"
  | "ollama"
  | "openai"
  | "anthropic"
  | "claude-code";

export const DEFAULT_DISPLAY_LANGUAGE: DisplayLanguage = "en";
export const DEFAULT_AI_LANGUAGE: AiLanguage = "auto";
export const DEFAULT_LLM_PROVIDER: LlmProvider = "bundled";
export const DEFAULT_BUNDLED_LLM_MODEL = "gemma-3-4b";
export const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434";
// OpenAI's own API URL — also the default LM Studio runs on a different port
// (1234), so we ship the official one and let the user override.
export const DEFAULT_OPENAI_ENDPOINT = "https://api.openai.com/v1";
export const DEFAULT_ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1";
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
export const DEFAULT_CLAUDE_CODE_MODEL = "claude-sonnet-4-6";

const DISPLAY_LANGUAGES: ReadonlySet<DisplayLanguage> = new Set([
  "en",
  "fr",
  "es",
  "de",
]);
const AI_LANGUAGES: ReadonlySet<AiLanguage> = new Set([
  "auto",
  "en",
  "fr",
  "es",
  "de",
]);
const LLM_PROVIDERS: ReadonlySet<LlmProvider> = new Set([
  "bundled",
  "ollama",
  "openai",
  "anthropic",
  "claude-code",
]);

export interface LlmProviderConfig {
  provider: LlmProvider;
  bundled_model: string;
  ollama_endpoint: string;
  ollama_model: string | null;
  openai_endpoint: string;
  openai_model: string | null;
  has_openai_key: boolean;
  anthropic_endpoint: string;
  anthropic_model: string | null;
  has_anthropic_key: boolean;
  claude_code_model: string;
}

interface Settings {
  hf_token_enc?: string; // base64 of safeStorage-encrypted token
  preferred_whisper_model?: string;
  display_language?: DisplayLanguage;
  ai_language?: AiLanguage;
  llm_provider?: LlmProvider;
  bundled_llm_model?: string;
  ollama_endpoint?: string;
  ollama_model?: string | null;
  openai_endpoint?: string;
  openai_model?: string | null;
  openai_api_key_enc?: string;
  anthropic_endpoint?: string;
  anthropic_model?: string | null;
  anthropic_api_key_enc?: string;
  /** Model id passed to `claude -p --model` when using the subscription
   *  provider. Stored separately from `anthropic_model` so the user can
   *  prefer different defaults between API and CLI flows (e.g. Opus on
   *  subscription where it's free under Max, Sonnet on metered API). */
  claude_code_model?: string;
  /** Absolute path to a folder the agent can read during notes generation.
   *  When provider=anthropic this is exposed via an MCP filesystem server;
   *  when provider=claude-code it's passed as `--add-dir`. Empty/unset
   *  disables KB access. */
  kb_filesystem_path?: string;
  notes_templates?: NotesTemplatesState;
  /** Gate for write tools exposed by the bundled MCP server. The MCP server
   *  reads settings.json directly on every write call, so this can be
   *  toggled without restarting Claude Desktop. Default: false (read-only). */
  mcp_allow_writes?: boolean;
}

export interface NotesTemplatesState {
  /** Per-builtin-id overrides of the shipped `instructions` text. Missing
   *  entries mean the builtin renders with its seed text. Empty string is
   *  treated as "reset to seed" (caller normalizes this). */
  overrides: Record<string, string>;
  /** User-created templates. Builtins live in code; this array is purely
   *  custom entries identified by "custom:<uuid>" ids. */
  custom: Array<{ id: string; name: string; instructions: string }>;
  /** Active default template id. Falls back to "builtin:general" when
   *  missing or pointing at a deleted custom. */
  default_id?: string;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function load(): Promise<Settings> {
  if (!(await exists(SETTINGS_FILE()))) return {};
  try {
    const raw = await readFile(SETTINGS_FILE(), "utf8");
    return JSON.parse(raw) as Settings;
  } catch {
    return {};
  }
}

async function save(s: Settings): Promise<void> {
  await mkdir(path.dirname(SETTINGS_FILE()), { recursive: true });
  await writeFile(SETTINGS_FILE(), JSON.stringify(s, null, 2), "utf8");
}

export async function setHfToken(token: string): Promise<void> {
  const s = await load();
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback (rare): store plain. The DB and settings live in user-only userData,
    // so this is still local-only.
    s.hf_token_enc = Buffer.from(`plain:${token}`, "utf8").toString("base64");
  } else {
    s.hf_token_enc = safeStorage.encryptString(token).toString("base64");
  }
  await save(s);
}

export async function getHfToken(): Promise<string | null> {
  const s = await load();
  if (!s.hf_token_enc) return null;
  const buf = Buffer.from(s.hf_token_enc, "base64");
  if (buf.toString("utf8").startsWith("plain:")) {
    return buf.toString("utf8").slice("plain:".length);
  }
  try {
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

export async function hasHfToken(): Promise<boolean> {
  return (await getHfToken()) != null;
}

export async function clearHfToken(): Promise<void> {
  const s = await load();
  delete s.hf_token_enc;
  await save(s);
}

export async function getDisplayLanguage(): Promise<DisplayLanguage> {
  const s = await load();
  const v = s.display_language;
  return v && DISPLAY_LANGUAGES.has(v) ? v : DEFAULT_DISPLAY_LANGUAGE;
}

export async function setDisplayLanguage(lang: DisplayLanguage): Promise<void> {
  if (!DISPLAY_LANGUAGES.has(lang)) {
    throw new Error(`unknown display language: ${lang}`);
  }
  const s = await load();
  s.display_language = lang;
  await save(s);
}

export async function getAiLanguage(): Promise<AiLanguage> {
  const s = await load();
  const v = s.ai_language;
  return v && AI_LANGUAGES.has(v) ? v : DEFAULT_AI_LANGUAGE;
}

export async function setAiLanguage(lang: AiLanguage): Promise<void> {
  if (!AI_LANGUAGES.has(lang)) {
    throw new Error(`unknown AI language: ${lang}`);
  }
  const s = await load();
  s.ai_language = lang;
  await save(s);
}

// --- LLM provider config ---------------------------------------------------
//
// Read-side returns a fully-populated config object with defaults applied so
// the caller (UI, llm-providers/index) never has to handle missing fields.
// API keys are never returned — only the `has_*_key` flags. Use the
// matching `get*ApiKey()` from main-process code only.

export async function getLlmProviderConfig(): Promise<LlmProviderConfig> {
  const s = await load();
  const provider = s.llm_provider && LLM_PROVIDERS.has(s.llm_provider)
    ? s.llm_provider
    : DEFAULT_LLM_PROVIDER;
  return {
    provider,
    bundled_model: s.bundled_llm_model || DEFAULT_BUNDLED_LLM_MODEL,
    ollama_endpoint: s.ollama_endpoint || DEFAULT_OLLAMA_ENDPOINT,
    ollama_model: s.ollama_model ?? null,
    openai_endpoint: s.openai_endpoint || DEFAULT_OPENAI_ENDPOINT,
    openai_model: s.openai_model ?? null,
    has_openai_key: !!s.openai_api_key_enc,
    anthropic_endpoint: s.anthropic_endpoint || DEFAULT_ANTHROPIC_ENDPOINT,
    anthropic_model: s.anthropic_model ?? DEFAULT_ANTHROPIC_MODEL,
    has_anthropic_key: !!s.anthropic_api_key_enc,
    claude_code_model: s.claude_code_model || DEFAULT_CLAUDE_CODE_MODEL,
  };
}

export async function setLlmProvider(provider: LlmProvider): Promise<void> {
  if (!LLM_PROVIDERS.has(provider)) {
    throw new Error(`unknown LLM provider: ${provider}`);
  }
  const s = await load();
  s.llm_provider = provider;
  await save(s);
}

export async function setBundledLlmModel(model: string): Promise<void> {
  const s = await load();
  s.bundled_llm_model = model;
  await save(s);
}

export async function setOllamaConfig(opts: {
  endpoint?: string;
  model?: string | null;
}): Promise<void> {
  const s = await load();
  if (opts.endpoint !== undefined) {
    const trimmed = opts.endpoint.trim().replace(/\/+$/, "");
    s.ollama_endpoint = trimmed || DEFAULT_OLLAMA_ENDPOINT;
  }
  if (opts.model !== undefined) {
    s.ollama_model = opts.model;
  }
  await save(s);
}

export async function setOpenAiConfig(opts: {
  endpoint?: string;
  model?: string | null;
}): Promise<void> {
  const s = await load();
  if (opts.endpoint !== undefined) {
    const trimmed = opts.endpoint.trim().replace(/\/+$/, "");
    s.openai_endpoint = trimmed || DEFAULT_OPENAI_ENDPOINT;
  }
  if (opts.model !== undefined) {
    s.openai_model = opts.model;
  }
  await save(s);
}

export async function setOpenAiApiKey(key: string): Promise<void> {
  const s = await load();
  if (!key) {
    delete s.openai_api_key_enc;
  } else if (!safeStorage.isEncryptionAvailable()) {
    s.openai_api_key_enc = Buffer.from(`plain:${key}`, "utf8").toString("base64");
  } else {
    s.openai_api_key_enc = safeStorage.encryptString(key).toString("base64");
  }
  await save(s);
}

export async function getOpenAiApiKey(): Promise<string | null> {
  const s = await load();
  if (!s.openai_api_key_enc) return null;
  const buf = Buffer.from(s.openai_api_key_enc, "base64");
  if (buf.toString("utf8").startsWith("plain:")) {
    return buf.toString("utf8").slice("plain:".length);
  }
  try {
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

export async function clearOpenAiApiKey(): Promise<void> {
  const s = await load();
  delete s.openai_api_key_enc;
  await save(s);
}

export async function setAnthropicConfig(opts: {
  endpoint?: string;
  model?: string | null;
}): Promise<void> {
  const s = await load();
  if (opts.endpoint !== undefined) {
    const trimmed = opts.endpoint.trim().replace(/\/+$/, "");
    s.anthropic_endpoint = trimmed || DEFAULT_ANTHROPIC_ENDPOINT;
  }
  if (opts.model !== undefined) {
    s.anthropic_model = opts.model;
  }
  await save(s);
}

export async function setAnthropicApiKey(key: string): Promise<void> {
  const s = await load();
  if (!key) {
    delete s.anthropic_api_key_enc;
  } else if (!safeStorage.isEncryptionAvailable()) {
    s.anthropic_api_key_enc = Buffer.from(`plain:${key}`, "utf8").toString(
      "base64",
    );
  } else {
    s.anthropic_api_key_enc = safeStorage.encryptString(key).toString("base64");
  }
  await save(s);
}

export async function getAnthropicApiKey(): Promise<string | null> {
  const s = await load();
  if (!s.anthropic_api_key_enc) return null;
  const buf = Buffer.from(s.anthropic_api_key_enc, "base64");
  if (buf.toString("utf8").startsWith("plain:")) {
    return buf.toString("utf8").slice("plain:".length);
  }
  try {
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

export async function setClaudeCodeConfig(opts: {
  model?: string;
}): Promise<void> {
  const s = await load();
  if (opts.model !== undefined) {
    s.claude_code_model = opts.model || DEFAULT_CLAUDE_CODE_MODEL;
  }
  await save(s);
}

export async function getKbFilesystemPath(): Promise<string | null> {
  const s = await load();
  const v = s.kb_filesystem_path?.trim();
  return v ? v : null;
}

export async function setKbFilesystemPath(p: string | null): Promise<void> {
  const s = await load();
  const trimmed = p?.trim();
  if (!trimmed) {
    delete s.kb_filesystem_path;
  } else {
    s.kb_filesystem_path = trimmed;
  }
  await save(s);
}

export async function clearAnthropicApiKey(): Promise<void> {
  const s = await load();
  delete s.anthropic_api_key_enc;
  await save(s);
}

// --- MCP server write gate -------------------------------------------------

export async function getMcpAllowWrites(): Promise<boolean> {
  const s = await load();
  return !!s.mcp_allow_writes;
}

export async function setMcpAllowWrites(allow: boolean): Promise<void> {
  const s = await load();
  s.mcp_allow_writes = !!allow;
  await save(s);
}

// --- Notes templates -------------------------------------------------------
//
// The templates module owns the schema and validation; this layer just
// persists raw state alongside the rest of Settings so we don't need a new
// file format. Defaults are filled in here so callers always see a fully
// populated state object.

export async function getNotesTemplatesState(): Promise<NotesTemplatesState> {
  const s = await load();
  const raw = s.notes_templates;
  return {
    overrides: raw?.overrides ?? {},
    custom: Array.isArray(raw?.custom) ? raw!.custom : [],
    default_id: raw?.default_id,
  };
}

export async function saveNotesTemplatesState(
  state: NotesTemplatesState,
): Promise<void> {
  const s = await load();
  s.notes_templates = {
    overrides: state.overrides,
    custom: state.custom,
    default_id: state.default_id,
  };
  await save(s);
}

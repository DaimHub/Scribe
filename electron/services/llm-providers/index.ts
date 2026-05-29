import {
  getAnthropicApiKey,
  getKbFilesystemPath,
  getLlmProviderConfig,
  getOpenAiApiKey,
} from "../settings.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createBundledProvider, disposeCachedLlmModel } from "./bundled.js";
import { createClaudeCodeProvider } from "./claude-code.js";
import { createOllamaProvider } from "./ollama.js";
import { createOpenAiProvider } from "./openai.js";
import type { LlmProviderInstance } from "./types.js";

/**
 * Resolve and instantiate the LLM provider per current Settings. Called once
 * per `generateNotes` run; instantiation is cheap (no model load until the
 * first `generate()` call).
 */
export async function getActiveProvider(): Promise<LlmProviderInstance> {
  const cfg = await getLlmProviderConfig();
  switch (cfg.provider) {
    case "bundled":
      return createBundledProvider(cfg.bundled_model);
    case "ollama":
      return createOllamaProvider({
        endpoint: cfg.ollama_endpoint,
        model: cfg.ollama_model,
      });
    case "openai": {
      const apiKey = await getOpenAiApiKey();
      return createOpenAiProvider({
        endpoint: cfg.openai_endpoint,
        apiKey,
        model: cfg.openai_model,
      });
    }
    case "anthropic": {
      const apiKey = await getAnthropicApiKey();
      return createAnthropicProvider({
        endpoint: cfg.anthropic_endpoint,
        apiKey,
        model: cfg.anthropic_model,
      });
    }
    case "claude-code": {
      // Reuse the same KB folder setting as the anthropic provider — the
      // CLI consumes it via `--add-dir` instead of an MCP filesystem
      // server, but the user-facing config is the same string.
      const kbPath = await getKbFilesystemPath();
      return createClaudeCodeProvider({
        model: cfg.claude_code_model,
        kbPath,
      });
    }
  }
}

export { disposeCachedLlmModel };
export type { LlmProviderInstance, LlmGenerateOpts } from "./types.js";
export { LlmProviderConfigError } from "./types.js";
export {
  BUNDLED_LLM_MODELS,
  BundledModelNotDownloadedError,
  deleteBundledModel,
  downloadBundledModel,
  getBundledModelDef,
  isBundledModelDownloaded,
  type DownloadProgress,
  type LlmModel,
} from "./bundled.js";
export { detectOllama, type OllamaDetectResult } from "./ollama.js";
export { detectOpenAi, type OpenAiDetectResult } from "./openai.js";
export { detectAnthropic, type AnthropicDetectResult } from "./anthropic.js";
export {
  detectClaudeCode,
  CLAUDE_CODE_MODELS,
  CLAUDE_CODE_ASK_SENTINEL,
  type ClaudeCodeDetectResult,
} from "./claude-code.js";

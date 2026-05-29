import type { LlmGenerateOpts, LlmProviderInstance } from "./types.js";
import { LlmProviderConfigError } from "./types.js";

export interface OllamaModelInfo {
  name: string;
  size: number;
  modified_at: string;
}

export interface OllamaDetectResult {
  running: boolean;
  endpoint: string;
  error?: string;
  models?: OllamaModelInfo[];
}

/**
 * Ping the Ollama daemon and list installed models. Used by the Settings UI
 * to populate the model dropdown and surface an actionable status message.
 */
export async function detectOllama(endpoint: string): Promise<OllamaDetectResult> {
  const url = `${endpoint.replace(/\/+$/, "")}/api/tags`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) {
      return { running: false, endpoint, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { models?: OllamaModelInfo[] };
    return {
      running: true,
      endpoint,
      models: Array.isArray(data.models) ? data.models : [],
    };
  } catch (err) {
    return {
      running: false,
      endpoint,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function ollamaLabel(model: string): string {
  return `ollama · ${model}`;
}

export function createOllamaProvider(opts: {
  endpoint: string;
  model: string | null;
}): LlmProviderInstance {
  if (!opts.model) {
    throw new LlmProviderConfigError(
      "Ollama provider selected but no model configured. Pick one in Settings.",
    );
  }
  const endpoint = opts.endpoint.replace(/\/+$/, "");
  const model = opts.model;
  const label = ollamaLabel(model);
  return {
    kind: "ollama",
    label,
    labelFor: () => label,
    agentMode: "none",
    async generate(
      genOpts: LlmGenerateOpts,
    ): Promise<{ raw: string; usage?: import("./types.js").LlmUsage }> {
      const startedAt = Date.now();
      genOpts.onProgress?.("model", 2, `ollama ${model}`, label);
      const messages: Array<{ role: "system" | "user"; content: string }> = [];
      if (genOpts.system && genOpts.system.length > 0) {
        messages.push({ role: "system", content: genOpts.system });
      }
      messages.push({ role: "user", content: genOpts.prompt });
      const body = {
        model,
        messages,
        // Ollama 0.5+ accepts a JSON schema directly here and constrains the
        // sampler to produce conforming output.
        format: genOpts.schema as object,
        stream: false,
        options: {
          temperature: genOpts.temperature ?? 0.2,
          num_predict: genOpts.maxTokens ?? 4000,
        },
      };
      genOpts.onProgress?.("generating", 35, undefined, label);
      const url = `${endpoint}/api/chat`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (err) {
        throw new Error(
          `Ollama request failed at ${url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Ollama returned HTTP ${res.status}: ${text.slice(0, 300)}`,
        );
      }
      const data = (await res.json()) as {
        message?: { content?: string };
        done?: boolean;
        error?: string;
        prompt_eval_count?: number;
        eval_count?: number;
      };
      if (data.error) {
        throw new Error(`Ollama error: ${data.error}`);
      }
      const raw = data.message?.content ?? "";
      if (!raw) {
        throw new Error("Ollama returned an empty response");
      }
      genOpts.onProgress?.("writing", 90, undefined, label);
      const usage: import("./types.js").LlmUsage = {
        // Ollama runs locally — no metering, mark as subscription so the
        // cost column stays empty instead of showing $0 metered.
        billing_kind: "subscription",
        model,
        input_tokens: data.prompt_eval_count,
        output_tokens: data.eval_count,
        duration_ms: Date.now() - startedAt,
        num_turns: 1,
      };
      return { raw, usage };
    },
  };
}

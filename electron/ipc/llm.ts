import { BrowserWindow, ipcMain } from "electron";
import { generateNotes } from "../services/llm.js";
import {
  aggregateUsage,
  setMeetingTemplate,
  setStatus,
} from "../services/db.js";
import { checkKbFilesystem } from "../services/kb-check.js";
import {
  clearAnthropicApiKey,
  clearOpenAiApiKey,
  getAnthropicApiKey,
  getKbFilesystemPath,
  getLlmProviderConfig,
  getOpenAiApiKey,
  setAnthropicApiKey,
  setAnthropicConfig,
  setBundledLlmModel,
  setClaudeCodeConfig,
  setKbFilesystemPath,
  setLlmProvider,
  setOllamaConfig,
  setOpenAiApiKey,
  setOpenAiConfig,
  type LlmProvider,
  type LlmProviderConfig,
} from "../services/settings.js";
import {
  BUNDLED_LLM_MODELS,
  CLAUDE_CODE_MODELS,
  deleteBundledModel,
  detectAnthropic,
  detectClaudeCode,
  detectOllama,
  detectOpenAi,
  downloadBundledModel,
  getBundledModelDef,
  isBundledModelDownloaded,
  type LlmModel,
} from "../services/llm-providers/index.js";
import {
  createCustomTemplate,
  deleteTemplate,
  getDefaultTemplateId,
  listTemplates,
  resetTemplate,
  setDefaultTemplate,
  updateTemplate,
  type NotesTemplate,
} from "../services/notes-templates.js";

// In-flight bundled-model downloads, keyed by model id. Tracked here (and
// not inside bundled.ts) so the IPC can refuse parallel triggers and so a
// re-opened Settings panel can resubscribe to whatever's already running.
interface DownloadState {
  downloadedBytes: number;
  totalBytes: number | null;
}
const activeDownloads = new Map<LlmModel, DownloadState>();

function emitDownloadProgress(model: LlmModel, state: DownloadState): void {
  activeDownloads.set(model, state);
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("llm:bundled-download-progress", { model, ...state });
  }
}

function emitDownloadDone(
  model: LlmModel,
  ok: boolean,
  error?: string,
): void {
  activeDownloads.delete(model);
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("llm:bundled-download-done", { model, ok, error });
  }
}

export function registerLlmIpc(): void {
  ipcMain.handle(
    "llm:generate",
    async (_e, meetingId: string, opts?: { modelOverride?: string }) => {
      try {
        return await generateNotes({
          meetingId,
          modelOverride: opts?.modelOverride,
        });
      } catch (err) {
        setStatus(meetingId, "error");
        throw err;
      }
    },
  );

  // --- Provider configuration ---------------------------------------------

  ipcMain.handle(
    "llm:getProviderConfig",
    async (): Promise<
      LlmProviderConfig & { bundled_models: readonly string[] }
    > => {
      const cfg = await getLlmProviderConfig();
      return { ...cfg, bundled_models: BUNDLED_LLM_MODELS };
    },
  );

  ipcMain.handle("llm:setProvider", async (_e, provider: LlmProvider) => {
    await setLlmProvider(provider);
    return { ok: true };
  });

  ipcMain.handle("llm:setBundledModel", async (_e, model: string) => {
    await setBundledLlmModel(model);
    return { ok: true };
  });

  ipcMain.handle(
    "llm:setOllamaConfig",
    async (_e, opts: { endpoint?: string; model?: string | null }) => {
      await setOllamaConfig(opts);
      return { ok: true };
    },
  );

  ipcMain.handle(
    "llm:setOpenAiConfig",
    async (_e, opts: { endpoint?: string; model?: string | null }) => {
      await setOpenAiConfig(opts);
      return { ok: true };
    },
  );

  ipcMain.handle("llm:setOpenAiKey", async (_e, key: string) => {
    await setOpenAiApiKey(key);
    return { ok: true };
  });

  ipcMain.handle("llm:clearOpenAiKey", async () => {
    await clearOpenAiApiKey();
    return { ok: true };
  });

  ipcMain.handle(
    "llm:setAnthropicConfig",
    async (_e, opts: { endpoint?: string; model?: string | null }) => {
      await setAnthropicConfig(opts);
      return { ok: true };
    },
  );

  ipcMain.handle("llm:setAnthropicKey", async (_e, key: string) => {
    await setAnthropicApiKey(key);
    return { ok: true };
  });

  ipcMain.handle("llm:clearAnthropicKey", async () => {
    await clearAnthropicApiKey();
    return { ok: true };
  });

  ipcMain.handle("llm:getKbFilesystemPath", async () => {
    return (await getKbFilesystemPath()) ?? "";
  });

  ipcMain.handle("llm:setKbFilesystemPath", async (_e, p: string) => {
    await setKbFilesystemPath(p || null);
    return { ok: true };
  });

  ipcMain.handle("llm:checkKbFilesystem", async (_e, override?: string) => {
    // When the caller passes a string (typically the in-flight draft from
    // the Settings input), check that path rather than the persisted one.
    // Lets the user validate before committing on blur.
    const p =
      typeof override === "string" ? override : (await getKbFilesystemPath()) ?? "";
    return checkKbFilesystem(p);
  });

  // --- Provider detection (live probes) -----------------------------------

  ipcMain.handle("llm:detectOllama", async (_e, endpoint?: string) => {
    const cfg = await getLlmProviderConfig();
    return detectOllama(endpoint || cfg.ollama_endpoint);
  });

  ipcMain.handle(
    "llm:detectOpenAi",
    async (
      _e,
      override?: { endpoint?: string; apiKey?: string | null },
    ) => {
      const cfg = await getLlmProviderConfig();
      const endpoint = override?.endpoint || cfg.openai_endpoint;
      // If the user typed a key in the test field, use that; otherwise fall
      // back to the stored key so the existing-key Test button works without
      // re-entry.
      const apiKey =
        override?.apiKey !== undefined
          ? override.apiKey
          : await getOpenAiApiKey();
      return detectOpenAi({ endpoint, apiKey });
    },
  );

  ipcMain.handle(
    "llm:detectAnthropic",
    async (
      _e,
      override?: { endpoint?: string; apiKey?: string | null },
    ) => {
      const cfg = await getLlmProviderConfig();
      const endpoint = override?.endpoint || cfg.anthropic_endpoint;
      const apiKey =
        override?.apiKey !== undefined
          ? override.apiKey
          : await getAnthropicApiKey();
      return detectAnthropic({ endpoint, apiKey });
    },
  );

  ipcMain.handle("llm:detectClaudeCode", async () => detectClaudeCode());

  ipcMain.handle(
    "llm:setClaudeCodeConfig",
    async (_e, opts: { model?: string }) => {
      await setClaudeCodeConfig(opts);
      return { ok: true };
    },
  );

  ipcMain.handle("llm:listClaudeCodeModels", async () => [
    ...CLAUDE_CODE_MODELS,
  ]);

  ipcMain.handle(
    "llm:getUsageStats",
    async (
      _e,
      filter?: { billingKind?: "subscription" | "metered" },
    ) => {
      return aggregateUsage(filter);
    },
  );

  // --- Notes templates ----------------------------------------------------

  ipcMain.handle(
    "templates:list",
    async (): Promise<{ templates: NotesTemplate[]; defaultId: string }> => {
      const [templates, defaultId] = await Promise.all([
        listTemplates(),
        getDefaultTemplateId(),
      ]);
      return { templates, defaultId };
    },
  );

  ipcMain.handle(
    "templates:create",
    async (
      _e,
      opts: { name: string; instructions: string },
    ): Promise<NotesTemplate> => {
      return createCustomTemplate(opts);
    },
  );

  ipcMain.handle(
    "templates:update",
    async (
      _e,
      args: {
        id: string;
        patch: { name?: string; instructions?: string };
      },
    ): Promise<NotesTemplate> => {
      return updateTemplate(args.id, args.patch);
    },
  );

  ipcMain.handle("templates:delete", async (_e, id: string) => {
    await deleteTemplate(id);
    return { ok: true };
  });

  ipcMain.handle(
    "templates:reset",
    async (_e, id: string): Promise<NotesTemplate> => {
      return resetTemplate(id);
    },
  );

  ipcMain.handle("templates:setDefault", async (_e, id: string) => {
    await setDefaultTemplate(id);
    return { ok: true };
  });

  ipcMain.handle(
    "templates:setMeetingTemplate",
    (_e, args: { meetingId: string; templateId: string | null }) => {
      setMeetingTemplate(args.meetingId, args.templateId);
      return { ok: true };
    },
  );

  // --- Bundled model downloads --------------------------------------------

  ipcMain.handle(
    "llm:listBundledModels",
    async (): Promise<
      Array<{
        id: LlmModel;
        displayName: string;
        approxSizeMb: number;
        downloaded: boolean;
        /** Echoes any in-flight download so a re-opened Settings panel can
         *  immediately pick up the progress bar. */
        downloading?: { downloadedBytes: number; totalBytes: number | null };
      }>
    > => {
      const results = await Promise.all(
        BUNDLED_LLM_MODELS.map(async (id) => {
          const def = getBundledModelDef(id);
          const downloaded = await isBundledModelDownloaded(id);
          const active = activeDownloads.get(id);
          return {
            id,
            displayName: def.displayName,
            approxSizeMb: def.approxSizeMb,
            downloaded,
            downloading: active ? { ...active } : undefined,
          };
        }),
      );
      return results;
    },
  );

  ipcMain.handle("llm:downloadBundledModel", async (_e, model: LlmModel) => {
    if (!BUNDLED_LLM_MODELS.includes(model)) {
      throw new Error(`Unknown bundled model: ${model}`);
    }
    if (activeDownloads.has(model)) {
      // Already downloading — return success so the UI just resubscribes.
      return { ok: true, alreadyRunning: true };
    }
    emitDownloadProgress(model, { downloadedBytes: 0, totalBytes: null });
    try {
      await downloadBundledModel(model, (p) =>
        emitDownloadProgress(model, {
          downloadedBytes: p.downloadedBytes,
          totalBytes: p.totalBytes,
        }),
      );
      emitDownloadDone(model, true);
      return { ok: true, alreadyRunning: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emitDownloadDone(model, false, message);
      throw err;
    }
  });

  ipcMain.handle("llm:deleteBundledModel", async (_e, model: LlmModel) => {
    if (!BUNDLED_LLM_MODELS.includes(model)) {
      throw new Error(`Unknown bundled model: ${model}`);
    }
    // Refusing mid-download keeps us from unlinking a file the streaming
    // pipeline is still writing to.
    if (activeDownloads.has(model)) {
      throw new Error(
        `Cannot delete ${model} while a download is in progress.`,
      );
    }
    await deleteBundledModel(model);
    return { ok: true };
  });
}

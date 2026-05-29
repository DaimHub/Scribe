import { app } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute path to the bundled Scribe MCP server script. In production it
 * lives at Resources/mcp-server.mjs (see electron-builder.yml extraResources);
 * in dev it's the esbuild output under the repo's mcp-server/dist/.
 *
 * We anchor on `import.meta.url` (this compiled file lives at
 * `dist-electron/services/mcp.js`) rather than `app.getAppPath()` — that
 * helper returns inconsistent values across `electron <main>` vs packaged
 * launches, and silently resolved to the wrong directory in dev.
 *
 * Returns null if the file isn't present — typically because the user is
 * running dev without having run `npm run build:mcp` yet. The UI surfaces
 * that case so the user knows what to do.
 */
export function getMcpServerScriptPath(): string | null {
  if (app.isPackaged) {
    const candidate = path.join(process.resourcesPath, "mcp-server.mjs");
    return existsSync(candidate) ? candidate : null;
  }
  // dist-electron/services/mcp.js → ../../mcp-server/dist/mcp-server.mjs
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidate = path.resolve(
    here,
    "..",
    "..",
    "mcp-server",
    "dist",
    "mcp-server.mjs",
  );
  return existsSync(candidate) ? candidate : null;
}

/**
 * Suggested path to Claude Desktop's MCP config file per platform. We don't
 * write to it — the UI just helps the user locate it.
 */
export function getClaudeDesktopConfigPath(): string {
  const home = app.getPath("home");
  if (process.platform === "darwin") {
    return path.join(
      home,
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
    return path.join(appData, "Claude", "claude_desktop_config.json");
  }
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(home, ".config");
  return path.join(xdg, "Claude", "claude_desktop_config.json");
}

export interface McpServerInfo {
  /** Absolute path to the MCP server script, or null when not built. */
  scriptPath: string | null;
  /** Suggested location of claude_desktop_config.json on this OS. */
  claudeDesktopConfigPath: string;
  /** Ready-to-paste JSON snippet the user merges into their Claude config. */
  configSnippet: string;
  /** True if `node` is required (always for now); useful for future
   *  packaging options (e.g. a self-contained binary). */
  requiresNode: boolean;
}

export function getMcpServerInfo(): McpServerInfo {
  const scriptPath = getMcpServerScriptPath();
  // Snippet uses "node" + args so the user can swap in their own Node
  // binary if needed (Claude Desktop bundles a Node runtime, but command
  // override is more portable than `command: "<path>.mjs"` which only
  // works when the script is executable and the system resolves shebangs).
  const snippet =
    scriptPath !== null
      ? JSON.stringify(
          {
            mcpServers: {
              scribe: {
                command: "node",
                args: [scriptPath],
              },
            },
          },
          null,
          2,
        )
      : "";
  return {
    scriptPath,
    claudeDesktopConfigPath: getClaudeDesktopConfigPath(),
    configSnippet: snippet,
    requiresNode: true,
  };
}

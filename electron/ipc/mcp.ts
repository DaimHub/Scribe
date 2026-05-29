import { ipcMain, shell } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  getClaudeDesktopConfigPath,
  getMcpServerInfo,
} from "../services/mcp.js";
import {
  getMcpAllowWrites,
  setMcpAllowWrites,
} from "../services/settings.js";
import {
  getSkillInfo,
  installSkill,
  uninstallSkill,
} from "../services/skill.js";

export function registerMcpIpc(): void {
  ipcMain.handle("mcp:getServerInfo", async () => {
    const info = getMcpServerInfo();
    const allowWrites = await getMcpAllowWrites();
    return { ...info, allowWrites };
  });

  ipcMain.handle("mcp:setAllowWrites", async (_e, allow: boolean) => {
    await setMcpAllowWrites(!!allow);
    return { ok: true };
  });

  // --- Skill install ------------------------------------------------------

  ipcMain.handle("mcp:getSkillInfo", () => getSkillInfo());

  ipcMain.handle("mcp:installSkill", () => installSkill());

  ipcMain.handle("mcp:uninstallSkill", () => uninstallSkill());

  ipcMain.handle("mcp:revealInstalledSkill", () => {
    const info = getSkillInfo();
    if (info.status === "not-installed" || info.status === "missing") {
      // Nothing to reveal at the install path; open the parent ~/.claude/skills/
      // so the user can see other skills if they have any.
      const parent = path.dirname(info.installedPath);
      if (existsSync(parent)) {
        void shell.openPath(parent);
        return { ok: true, revealed: "parent" as const };
      }
      return { ok: false, revealed: "none" as const };
    }
    shell.showItemInFolder(info.installedPath);
    return { ok: true, revealed: "file" as const };
  });

  // Reveal the Claude Desktop config file (or its parent directory if the
  // file doesn't exist yet) in Finder/Explorer. Saves the user from
  // hunting down ~/Library/Application Support/Claude/.
  ipcMain.handle("mcp:revealClaudeConfig", () => {
    const file = getClaudeDesktopConfigPath();
    if (existsSync(file)) {
      shell.showItemInFolder(file);
      return { ok: true, revealed: "file" as const };
    }
    const dir = path.dirname(file);
    if (existsSync(dir)) {
      void shell.openPath(dir);
      return { ok: true, revealed: "directory" as const };
    }
    return { ok: false, revealed: "none" as const, path: file };
  });
}

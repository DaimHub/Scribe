import { app, safeStorage } from "electron";
import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

const SETTINGS_FILE = (): string =>
  path.join(app.getPath("userData"), "settings.json");

interface Settings {
  hf_token_enc?: string; // base64 of safeStorage-encrypted token
  preferred_whisper_model?: string;
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

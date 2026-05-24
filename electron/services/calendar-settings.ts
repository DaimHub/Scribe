import { app, safeStorage } from "electron";
import path from "node:path";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";

const FILE = (): string =>
  path.join(app.getPath("userData"), "calendar-settings.json");

interface CalendarSettings {
  google_client_id_enc?: string;
  google_client_secret_enc?: string;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function load(): Promise<CalendarSettings> {
  if (!(await exists(FILE()))) return {};
  try {
    return JSON.parse(await readFile(FILE(), "utf8")) as CalendarSettings;
  } catch {
    return {};
  }
}

async function save(s: CalendarSettings): Promise<void> {
  await mkdir(path.dirname(FILE()), { recursive: true });
  await writeFile(FILE(), JSON.stringify(s, null, 2), "utf8");
}

function encrypt(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString("base64");
  }
  return Buffer.from(`plain:${value}`, "utf8").toString("base64");
}

function decrypt(value: string | undefined): string | null {
  if (!value) return null;
  const buf = Buffer.from(value, "base64");
  if (buf.toString("utf8").startsWith("plain:")) {
    return buf.toString("utf8").slice("plain:".length);
  }
  try {
    return safeStorage.decryptString(buf);
  } catch {
    return null;
  }
}

export async function setGoogleCredentials(opts: {
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  const s = await load();
  const id = opts.clientId.trim();
  const secret = opts.clientSecret.trim();
  if (!id || !secret) {
    delete s.google_client_id_enc;
    delete s.google_client_secret_enc;
  } else {
    s.google_client_id_enc = encrypt(id);
    s.google_client_secret_enc = encrypt(secret);
  }
  await save(s);
}

export async function getGoogleCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const s = await load();
  const clientId = decrypt(s.google_client_id_enc);
  const clientSecret = decrypt(s.google_client_secret_enc);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function hasGoogleCredentials(): Promise<boolean> {
  return (await getGoogleCredentials()) != null;
}

export async function clearGoogleCredentials(): Promise<void> {
  const s = await load();
  delete s.google_client_id_enc;
  delete s.google_client_secret_enc;
  await save(s);
}

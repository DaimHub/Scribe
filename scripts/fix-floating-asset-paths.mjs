import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// next.config.ts sets `assetPrefix: "./"` for the production static export, so
// every _next/* asset is referenced document-relative. That resolves correctly
// for the main window (out/index.html, depth 0) but NOT for the floating
// windows, which Electron loadFile()s directly from a nested directory:
//   - static <link>/<script> refs ("./_next/…") point at out/mini/<name>/_next/
//   - the Turbopack runtime ALSO hardcodes `t = "./_next/"` and builds dynamic
//     chunk <script src> from it, resolved against document.baseURI
// so both 404 and the window renders as unstyled, non-interactive HTML that
// never finishes hydrating (frozen timer, dead buttons).
//
// Injecting a <base href> pointing at the out/ root fixes ALL of it at once —
// static refs and runtime-computed chunk URLs alike resolve against the base.
// Kept on file:// (vs a custom protocol) so floating windows share the main
// window's localStorage origin and inherit the user's theme/accent.
//
// Only the windows actually loaded via loadFile need this; the main window
// client-routes everything else from the root index, so its nested HTML files
// are never loaded directly.
const FLOATING_ROUTES = ["mini/recorder", "mini/notification"];

const outDir = path.join(import.meta.dirname, "..", "out");

for (const route of FLOATING_ROUTES) {
  const file = path.join(outDir, route, "index.html");
  const prefix = "../".repeat(route.split("/").length); // mini/recorder -> ../../
  const html = await readFile(file, "utf8");

  if (html.includes("<base ")) {
    throw new Error(
      `[fix-floating-asset-paths] ${file} already has a <base> tag — did the ` +
        `static-export output change? Update this script.`,
    );
  }
  if (!html.includes("<head>")) {
    throw new Error(
      `[fix-floating-asset-paths] no <head> in ${file} — has the static-export ` +
        `layout changed? Update this script.`,
    );
  }

  // <base> must precede every asset ref in <head>, so inject it first.
  const fixed = html.replace("<head>", `<head><base href="${prefix}"/>`);
  await writeFile(file, fixed);
  console.log(`[fix-floating-asset-paths] ${route}: injected <base href="${prefix}">`);
}

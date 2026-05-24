import { app, protocol } from "electron";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";

export const SCHEME = "scribe-media";

/**
 * Must be called BEFORE `app.whenReady()`. Marks the custom scheme as
 * privileged so the renderer can use it from <audio> elements and fetch.
 */
export function registerMediaProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ]);
}

/**
 * Call from `app.whenReady()`. Serves WAV files under
 *   <userData>/meetings/<meetingId>/<channel>.wav
 * via URLs like `scribe-media://<meetingId>/<channel>`. Honors Range headers
 * so the <audio> element can seek without downloading the whole file.
 */
export function installMediaProtocolHandler(): void {
  protocol.handle(SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      const meetingId = url.hostname;
      const channel = url.pathname.replace(/^\//, "");

      if (!/^[a-f0-9-]+$/i.test(meetingId)) {
        return new Response(null, { status: 400 });
      }
      if (channel !== "mic" && channel !== "system") {
        return new Response(null, { status: 400 });
      }

      const filePath = path.join(
        app.getPath("userData"),
        "meetings",
        meetingId,
        `${channel}.wav`,
      );

      const stats = await stat(filePath).catch(() => null);
      if (!stats || stats.size === 0) {
        return new Response(null, { status: 404 });
      }

      const fileSize = stats.size;
      const range = request.headers.get("range");
      if (range) {
        const m = /^bytes=(\d+)-(\d*)$/.exec(range);
        if (m) {
          const start = Math.min(parseInt(m[1], 10), fileSize - 1);
          const end = m[1] && m[2]
            ? Math.min(parseInt(m[2], 10), fileSize - 1)
            : fileSize - 1;
          const stream = createReadStream(filePath, { start, end });
          return new Response(Readable.toWeb(stream) as ReadableStream, {
            status: 206,
            headers: {
              "Content-Type": "audio/wav",
              "Content-Length": String(end - start + 1),
              "Content-Range": `bytes ${start}-${end}/${fileSize}`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "no-cache",
            },
          });
        }
      }

      const stream = createReadStream(filePath);
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-cache",
        },
      });
    } catch (err) {
      console.warn("scribe-media handler failed:", err);
      return new Response(null, { status: 500 });
    }
  });
}

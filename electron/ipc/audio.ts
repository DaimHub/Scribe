import {
  ipcMain,
  desktopCapturer,
  session,
  shell,
  systemPreferences,
} from "electron";
import {
  appendFrames,
  startMeeting,
  stopMeeting,
  type AudioChannel,
  type MeetingResult,
} from "../services/recorder.js";

export interface AudioFramesPayload {
  meetingId: string;
  channel: AudioChannel;
  sampleRate: number;
  samples: ArrayBuffer;
}

export function registerAudioIpc(): void {
  ipcMain.handle(
    "audio:startMeeting",
    async (): Promise<{ meetingId: string; dir: string }> => startMeeting(),
  );

  ipcMain.handle(
    "audio:stopMeeting",
    async (_e, meetingId: string): Promise<MeetingResult> =>
      stopMeeting(meetingId),
  );

  ipcMain.on("audio:frames", (_e, payload: AudioFramesPayload) => {
    const view = new Float32Array(payload.samples);
    appendFrames(payload.meetingId, payload.channel, view, payload.sampleRate);
  });

  ipcMain.handle("audio:listSystemSources", async () => {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      fetchWindowIcons: false,
    });
    return sources.map((s) => ({ id: s.id, name: s.name }));
  });

  // System-audio capture goes through getDisplayMedia, which needs Screen
  // Recording permission on macOS. The renderer checks this before recording to
  // warn up front instead of failing with an opaque "Invalid capture constraints".
  ipcMain.handle(
    "audio:getScreenAccessStatus",
    async (): Promise<string> =>
      process.platform === "darwin"
        ? systemPreferences.getMediaAccessStatus("screen")
        : "granted",
  );

  ipcMain.handle("audio:openScreenSettings", async (): Promise<void> => {
    if (process.platform !== "darwin") return;
    await shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
    );
  });
}

export function installDisplayMediaHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
        });
        const primary = sources[0];
        if (!primary) {
          // No screen sources almost always means Screen Recording permission
          // hasn't been granted (especially for an unsigned build, where the
          // grant doesn't persist across rebuilds). Log the access status so the
          // cause is visible; the renderer surfaces a permission hint to the user.
          const status = systemPreferences.getMediaAccessStatus("screen");
          console.warn(
            `[scribe] getDisplayMedia: no screen sources (screen access: ${status}); ` +
              `system audio needs Screen Recording permission.`,
          );
          callback({});
          return;
        }
        callback({ video: primary, audio: "loopback" });
      } catch {
        callback({});
      }
    },
    { useSystemPicker: false },
  );
}

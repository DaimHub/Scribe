import { ipcMain, desktopCapturer, session } from "electron";
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

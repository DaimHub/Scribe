"use client";

import { useEffect, useRef } from "react";
import { useScribe, type MeetingTab } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MeetingHeader } from "./meeting-header";
import { TranscriptView } from "./transcript-view";
import { NotesView } from "./notes-view";
import { SummaryView } from "./summary-view";
import { ProcessingProgress } from "./processing-progress";
import { VoiceTaggingPanel } from "./voice-tagging-panel";
import { AudioPlayer } from "./audio-player";

export function MeetingView() {
  const detail = useScribe((s) => s.detail);
  const selectedId = useScribe((s) => s.selectedId);
  const activeTab = useScribe((s) => s.meetingTab);
  const setActiveTab = useScribe((s) => s.setMeetingTab);

  const meetingId = detail?.meeting.id;
  const hasSummary = !!detail?.meeting.summary_json;

  // Reset to the appropriate landing tab whenever we switch to a different
  // meeting. Deliberately only react to id changes — hasSummary flipping
  // mid-life shouldn't snap the user back.
  const lastMeetingIdRef = useRef<string | undefined>(meetingId);
  useEffect(() => {
    if (meetingId && meetingId !== lastMeetingIdRef.current) {
      lastMeetingIdRef.current = meetingId;
      setActiveTab(hasSummary ? "summary" : "transcript");
    }
  }, [meetingId, hasSummary, setActiveTab]);

  if (!detail || !selectedId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
        <div className="text-base font-medium">No meeting selected</div>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Start a new recording from the sidebar, or pick one from the list.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ProcessingProgress meetingId={detail.meeting.id} />
      <VoiceTaggingPanel meetingId={detail.meeting.id} />
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as MeetingTab)}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ScrollArea className="min-h-0 flex-1">
          {/* Header scrolls away with the content — keeps real-estate for
              the notes once the user has acknowledged the metadata. */}
          <MeetingHeader detail={detail} />

          {/* Tabs row stays stuck at the top of the viewport once the header
              has scrolled past, so switching between Summary / Transcript /
              Tasks remains one click away. */}
          <div className="sticky top-0 z-10 border-b bg-background">
            <div className="mx-auto w-full max-w-3xl px-8">
              <TabsList className="h-auto rounded-none border-b-0 bg-transparent p-0">
                <TabSlot value="summary" label="Summary" />
                <TabSlot
                  value="transcript"
                  label="Transcript"
                  badge={detail.transcript.length || undefined}
                />
                <TabSlot
                  value="tasks"
                  label="Tasks"
                  badge={detail.tasks.length || undefined}
                />
              </TabsList>
            </div>
          </div>

          {/* keepMounted preserves scroll position, virtualizer measurements,
              and parsed summary JSON across tab switches. Hidden panels get
              the HTML `hidden` attribute (display:none) so they contribute
              zero to scroll height. */}
          <TabsContent value="summary" keepMounted className="m-0 outline-none">
            <SummaryView detail={detail} />
          </TabsContent>
          <TabsContent value="transcript" keepMounted className="m-0 outline-none">
            <div className="mx-auto w-full max-w-3xl px-8">
              <AudioPlayer
                meetingId={detail.meeting.id}
                micWavPath={detail.meeting.mic_wav_path}
                sysWavPath={detail.meeting.sys_wav_path}
                transcript={detail.transcript}
              />
            </div>
            <TranscriptView detail={detail} />
          </TabsContent>
          <TabsContent value="tasks" keepMounted className="m-0 outline-none">
            <NotesView detail={detail} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function TabSlot({
  value,
  label,
  badge,
}: {
  value: string;
  label: string;
  badge?: number;
}) {
  return (
    <TabsTrigger
      value={value}
      className="relative rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 mr-6 font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground">
          {badge}
        </span>
      )}
    </TabsTrigger>
  );
}

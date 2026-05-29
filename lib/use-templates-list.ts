"use client";

import { useEffect, useState } from "react";
import type { NotesTemplate } from "@/lib/scribe-global";

export interface TemplatesListState {
  templates: NotesTemplate[] | null;
  defaultId: string;
  refresh: () => Promise<void>;
}

/** Fetch the templates list + global default id, with a manual refresh
 *  hook for cases where the parent triggers a write (e.g. picking a
 *  template that also persists it on a meeting). Returns `null` while
 *  the first fetch is in flight so callers can skeleton it. */
export function useTemplatesList(): TemplatesListState {
  const [templates, setTemplates] = useState<NotesTemplate[] | null>(null);
  const [defaultId, setDefaultId] = useState<string>("");

  async function refresh() {
    const res = await window.scribe.templates.list();
    setTemplates(res.templates);
    setDefaultId(res.defaultId);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  return { templates, defaultId, refresh };
}

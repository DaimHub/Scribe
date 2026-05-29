"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sidebar as ShadSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  type SidebarSection,
  useScribe,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  FolderAddIcon,
  Settings01Icon,
  TaskDone01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { TreeView } from "./tree/tree-view";
import { PinnedSection } from "./tree/pinned-section";
import { TagsSection } from "./tags-section";
import { Wordmark } from "./wordmark";

export function ScribeSidebar() {
  const createFolder = useScribe((s) => s.createFolder);
  const activeSection = useScribe((s) => s.activeSection);
  const previousSection = useScribe((s) => s.previousSection);
  const setActiveSection = useScribe((s) => s.setActiveSection);
  const t = useT();

  return (
    <ShadSidebar collapsible="offcanvas" variant="sidebar">
      <SidebarHeader className="gap-0 p-0">
        {/* Empty draggable strip — leaves space for macOS traffic lights and
            preserves the window-drag handle that previously sat behind the
            Hide-sidebar button. */}
        <div className="h-12 [-webkit-app-region:drag]" />
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <SectionNav active={activeSection} onChange={setActiveSection} />

        <div className="max-h-[40%] shrink-0 overflow-y-auto">
          <PinnedSection />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-1 px-4 pb-1.5 pt-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/60">
            {t("nav.meetings")}
          </div>
          <button
            type="button"
            onClick={() => void createFolder(null)}
            title={t("nav.newFolder")}
            className="inline-flex size-5 items-center justify-center rounded text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <HugeiconsIcon icon={FolderAddIcon} className="size-3.5" />
          </button>
        </div>
        <TreeView />

        <TagsSection />
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <div className="flex items-center justify-between">
          <Wordmark className="pl-1 text-[15px] leading-none text-sidebar-foreground" />
          <button
            type="button"
            onClick={() =>
              setActiveSection(
                activeSection === "settings" ? previousSection : "settings",
              )
            }
            title={t("nav.settings")}
            aria-label={t("nav.openSettings")}
            aria-pressed={activeSection === "settings"}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors",
              activeSection === "settings"
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <HugeiconsIcon icon={Settings01Icon} className="size-4" />
          </button>
        </div>
      </SidebarFooter>

      <SidebarResizer />
    </ShadSidebar>
  );
}

function SectionNav({
  active,
  onChange,
}: {
  active: SidebarSection;
  onChange: (s: SidebarSection) => void;
}) {
  const t = useT();
  const items: Array<{
    id: Exclude<SidebarSection, "meetings">;
    label: string;
    icon: typeof TaskDone01Icon;
  }> = [
    { id: "tasks", label: t("nav.tasks"), icon: TaskDone01Icon },
    { id: "calendar", label: t("nav.calendar"), icon: Calendar03Icon },
    { id: "people", label: t("nav.people"), icon: UserMultipleIcon },
  ];
  return (
    <nav className="flex flex-col gap-px px-2 pb-2 pt-1">
      {items.map((it) => {
        const isActive = active === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <HugeiconsIcon
              icon={it.icon}
              className={cn(
                "size-4 shrink-0",
                isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/65",
              )}
            />
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

function SidebarResizer() {
  const sidebarWidth = useScribe((s) => s.sidebarWidth);
  const setSidebarWidth = useScribe((s) => s.setSidebarWidth);
  const persistSidebarWidth = useScribe((s) => s.persistSidebarWidth);
  const t = useT();
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; w: number } | null>(null);
  // rAF coalescing — at most one width update per animation frame even if
  // mousemove fires faster than vsync (it does on high-Hz pointers).
  const rafRef = useRef<number | null>(null);
  const pendingXRef = useRef<number | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startRef.current = { x: e.clientX, w: sidebarWidth };
      setDragging(true);
    },
    [sidebarWidth],
  );

  useEffect(() => {
    if (!dragging) return;

    // Disable the shadcn sidebar's 200ms width transition while we drag —
    // otherwise the visible width eases toward the cursor and feels laggy.
    document.body.dataset.sidebarResizing = "1";

    function flush() {
      rafRef.current = null;
      const st = startRef.current;
      const x = pendingXRef.current;
      if (!st || x == null) return;
      setSidebarWidth(st.w + (x - st.x));
    }
    function onMove(ev: MouseEvent) {
      pendingXRef.current = ev.clientX;
      if (rafRef.current == null) {
        rafRef.current = window.requestAnimationFrame(flush);
      }
    }
    function onUp() {
      setDragging(false);
      startRef.current = null;
      pendingXRef.current = null;
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Commit the final width to localStorage once, not on every move.
      persistSidebarWidth();
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      delete document.body.dataset.sidebarResizing;
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [dragging, setSidebarWidth, persistSidebarWidth]);

  return (
    <button
      type="button"
      aria-label={t("sidebar.resize", {
        width: sidebarWidth,
        min: SIDEBAR_MIN_WIDTH,
        max: SIDEBAR_MAX_WIDTH,
      })}
      onMouseDown={onMouseDown}
      onDoubleClick={() => {
        setSidebarWidth(288);
        persistSidebarWidth();
      }}
      data-dragging={dragging || undefined}
      className={cn(
        "group/resize absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize",
        "before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2",
        "before:bg-transparent before:transition-colors hover:before:bg-primary/40",
        "data-[dragging]:before:bg-primary",
      )}
      style={{ touchAction: "none" }}
    />
  );
}

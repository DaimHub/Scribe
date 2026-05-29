"use client";

import { useState } from "react";
import { useScribe } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Cancel01Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";

export function TagsSection() {
  const tags = useScribe((s) => s.allTags);
  const activeTagId = useScribe((s) => s.activeTagId);
  const setActiveTag = useScribe((s) => s.setActiveTag);
  const setSearchQuery = useScribe((s) => s.setSearchQuery);
  const deleteTag = useScribe((s) => s.deleteTag);
  const collapsed = useScribe((s) => s.tagsCollapsed);
  const setTagsCollapsed = useScribe((s) => s.setTagsCollapsed);
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const header = (
    <button
      type="button"
      onClick={() => setTagsCollapsed(!collapsed)}
      aria-expanded={!collapsed}
      title={collapsed ? t("tagsSection.show") : t("tagsSection.hide")}
      className="group flex flex-1 items-center gap-1 rounded text-left text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/55 transition-colors hover:text-sidebar-foreground/80"
    >
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className={cn(
          "size-3 shrink-0 transition-transform",
          !collapsed && "rotate-90",
        )}
      />
      {t("header.tags")}
    </button>
  );

  if (tags.length === 0 && !adding) {
    return (
      <div className="mt-2 flex flex-col gap-1 px-3 pb-3 pt-3">
        <div className="flex items-center px-1">{header}</div>
        {!collapsed && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
            {t("tagsSection.newTag")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 flex shrink-0 flex-col gap-0.5 px-2 pb-3 pt-2">
      <div className="flex items-center justify-between px-1 pb-1">
        {header}
        {activeTagId && !collapsed && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setActiveTag(null)}
            className="h-5 gap-0.5 px-1 text-[10px] text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-2.5" />
            {t("tagsSection.clear")}
          </Button>
        )}
      </div>

      {collapsed ? null : (
        <>
      <ul className="flex max-h-48 flex-col gap-px overflow-y-auto">
        {tags.map((tag) => {
          const isActive = activeTagId === tag.id;
          return (
            <li
              key={tag.id}
              className={cn(
                "group flex items-center rounded-md transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTag(isActive ? null : tag.id);
                }}
                className="flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-[13px]"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: tag.color ?? "#888" }}
                />
                <span className="flex-1 truncate">{tag.name}</span>
                {tag.auto === 1 && (
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    {t("tagsSection.auto")}
                  </span>
                )}
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteTag(tag.id);
                }}
                aria-label={t("tagsSection.deleteTag", { name: tag.name })}
                className="mr-1 size-5 text-muted-foreground opacity-0 hover:bg-sidebar-accent hover:text-foreground group-hover:opacity-100"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </Button>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("tagsSection.tagNamePlaceholder")}
          className="mt-1 h-7 text-[12px]"
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              const name = draft.trim();
              if (!name) {
                setAdding(false);
                return;
              }
              await window.scribe.tags.create(name);
              await useScribe.getState().loadTags();
              setDraft("");
              setAdding(false);
            }
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          onBlur={() => {
            if (!draft.trim()) setAdding(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1 flex items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
          {t("tagsSection.newTag")}
        </button>
      )}
        </>
      )}
    </div>
  );
}

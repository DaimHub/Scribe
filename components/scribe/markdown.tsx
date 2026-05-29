"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders a markdown string from the LLM. The output schema's prose fields
 * (full_summary, sections[].content, decisions, executive bullet detail) may
 * contain bold, italics, lists, links, code, and tables — anything plain
 * GFM. Headings are styled small so a section that opens with `## ...` from
 * the model doesn't blow up the layout. Links open in the browser.
 */
export function Markdown({
  children,
  className,
  components,
  inline = false,
}: {
  children: string;
  className?: string;
  components?: Components;
  /** When true, strips the outer block wrapper from a single paragraph
   *  (useful for rendering markdown inside a flow of inline text like a
   *  bullet list with prefix labels). */
  inline?: boolean;
}) {
  const inlineComponents: Components = inline
    ? {
        p: ({ children }) => <>{children}</>,
      }
    : {};

  return (
    <div className={cn("scribe-md", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            >
              {children}
            </a>
          ),
          p: ({ children }) => (
            <p className="leading-relaxed [&:not(:first-child)]:mt-3">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 ml-5 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-5 list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => (
            <h3 className="mt-4 text-base font-semibold tracking-tight">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h4 className="mt-4 text-sm font-semibold tracking-tight">
              {children}
            </h4>
          ),
          h3: ({ children }) => (
            <h5 className="mt-3 text-sm font-semibold tracking-tight">
              {children}
            </h5>
          ),
          h4: ({ children }) => (
            <h6 className="mt-3 text-sm font-semibold tracking-tight">
              {children}
            </h6>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                  {children}
                </code>
              );
            }
            return (
              <code className="block whitespace-pre-wrap font-mono text-[0.85em]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-[0.85em]">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-4 border-border" />,
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/50 px-2 py-1">{children}</td>
          ),
          ...inlineComponents,
          ...components,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

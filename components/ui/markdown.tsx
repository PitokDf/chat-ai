"use client";

import { Children, isValidElement, memo, useMemo, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

type MarkdownProps = {
  content: string;
  className?: string;
  /** Compact mode tightens spacing for short chat bubbles. */
  compact?: boolean;
  /** Allow the model to emit raw HTML inline (images, divs, etc). */
  allowHtml?: boolean;
  /** When true, skip syntax highlighting + KaTeX to keep streaming cheap. */
  streaming?: boolean;
};

/**
 * Walk React children and collect plain text. ReactMarkdown passes nested
 * elements (e.g. <span>s wrapping syntax-highlighted tokens) and naive
 * stringification yields "[object Object]" for each. This recurses and
 * concatenates only the string nodes.
 */
const nodeToText = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeToText(node.props.children);
  }
  return "";
};

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  // The first child is the <code class="language-xxx"> element.
  let language = "";
  const firstChild = Children.toArray(children)[0];
  if (isValidElement<{ className?: string }>(firstChild)) {
    const match = /language-([\w-]+)/.exec(firstChild.props.className ?? "");
    language = match?.[1] ?? "";
  }

  const text = nodeToText(children).replace(/\n$/, "");

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-(--code-surface)">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre
        className={cn(
          "max-h-[320px] overflow-auto px-3 py-2.5 text-[12px] leading-5",
          className,
        )}
      >
        {children}
      </pre>
    </div>
  );
}

/**
 * Sanitize schema for rehype-sanitize. Extends the default schema to allow
 * className on all elements (needed for syntax highlighting) while still
 * stripping dangerous tags like script/iframe/object/embed.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "style"],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    span: [...(defaultSchema.attributes?.span ?? []), "className", "style"],
    div: [...(defaultSchema.attributes?.div ?? []), "className", "style"],
  },
};

const createComponents = (): Components => ({
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "mt-4 mb-2 text-lg font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "mt-4 mb-2 text-base font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn(
        "mt-3 mb-1.5 text-sm font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={cn("mt-3 mb-1 text-[13px] font-semibold", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn(
        "my-2 text-[13.5px] leading-6 first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn("my-2 ml-5 list-disc space-y-1 text-[13.5px]", className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "my-2 ml-5 list-decimal space-y-1 text-[13.5px]",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li
      className={cn("pl-0.5 marker:text-muted-foreground", className)}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "text-sky-500 underline underline-offset-2 hover:text-sky-400 dark:text-sky-400 dark:hover:text-sky-300",
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "my-3 border-l-2 border-muted-foreground/40 pl-3 text-muted-foreground italic",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-4 border-border", className)} {...props} />
  ),
  table: ({ className, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-md border border-border">
      <table
        className={cn("w-full border-collapse text-[12.5px]", className)}
        {...props}
      />
    </div>
  ),
  thead: ({ className, ...props }) => (
    <thead className={cn("bg-muted/40", className)} {...props} />
  ),
  tbody: ({ className, ...props }) => (
    <tbody className={cn("divide-y divide-border", className)} {...props} />
  ),
  tr: ({ className, ...props }) => (
    <tr className={cn("", className)} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "border-r border-border px-2.5 py-1.5 text-left font-semibold text-foreground last:border-r-0",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "border-r border-border px-2.5 py-1.5 align-top text-foreground/85 last:border-r-0",
        className,
      )}
      {...props}
    />
  ),
  img: ({ className, alt, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      alt={alt ?? ""}
      className={cn(
        "my-2 max-w-full rounded-md border border-border",
        className,
      )}
      {...props}
    />
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={cn(className, "hljs")} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn(
          "rounded bg-muted/60 px-1 py-0.5 font-mono text-[0.85em]",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ className, children }) => (
    <CodeBlock className={className}>{children}</CodeBlock>
  ),
  input: ({ className, type, ...props }) => {
    if (type === "checkbox") {
      return (
        <input
          type="checkbox"
          disabled
          className={cn(
            "mr-1.5 h-3 w-3 translate-y-[2px] accent-primary",
            className,
          )}
          {...props}
        />
      );
    }
    return <input type={type} className={className} {...props} />;
  },
});

function MarkdownImpl({
  content,
  className,
  compact = false,
  allowHtml = false,
  streaming,
}: MarkdownProps) {
  const components = useMemo(createComponents, []);

  // When HTML is allowed, we run raw first, then sanitize, then highlight/KaTeX.
  // While streaming, skip highlight/KaTeX — both traverse the AST on every
  // keystroke and dominate CPU time in long replies.
  const rehypePlugins = useMemo(() => {
    const plugins: Array<[unknown, ...unknown[]] | unknown> = [];
    if (allowHtml) {
      plugins.push(rehypeRaw);
      plugins.push([rehypeSanitize, sanitizeSchema]);
    }
    if (!streaming) {
      plugins.push([rehypeHighlight, { detect: true, ignoreMissing: true }]);
      plugins.push([
        rehypeKatex,
        { output: "htmlAndMathml", throwOnError: false },
      ]);
    }
    return plugins as never;
  }, [allowHtml, streaming]);

  return (
    <div
      className={cn(
        "markdown-body text-[13.5px] text-foreground/90",
        compact && "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Memoized export. ReactMarkdown parsing is expensive (remark + rehype
 * pipelines plus syntax highlighting), so we only rerun when the content
 * or relevant flags actually change.
 */
export const Markdown = memo(MarkdownImpl);

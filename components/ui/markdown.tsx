"use client";

import {
  Children,
  isValidElement,
  memo,
  useMemo,
  useState,
} from "react";

import type {
  ComponentPropsWithoutRef,
  ReactNode,
} from "react";

import ReactMarkdown, {
  type Components,
} from "react-markdown";

import type { PluggableList } from "unified";

import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";

import rehypeSanitize, {
  defaultSchema,
} from "rehype-sanitize";

import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

type MarkdownProps = {
  content: string;
  className?: string;
  compact?: boolean;
  allowHtml?: boolean;
  streaming?: boolean;
};

type HeadingProps =
  ComponentPropsWithoutRef<"h1">;

type ParagraphProps =
  ComponentPropsWithoutRef<"p">;

type ListProps =
  ComponentPropsWithoutRef<"ul">;

type OrderedListProps =
  ComponentPropsWithoutRef<"ol">;

type ListItemProps =
  ComponentPropsWithoutRef<"li">;

type AnchorProps =
  ComponentPropsWithoutRef<"a">;

type BlockquoteProps =
  ComponentPropsWithoutRef<"blockquote">;

type HrProps =
  ComponentPropsWithoutRef<"hr">;

type TableProps =
  ComponentPropsWithoutRef<"table">;

type TableSectionProps =
  ComponentPropsWithoutRef<"thead">;

type TableBodyProps =
  ComponentPropsWithoutRef<"tbody">;

type TableRowProps =
  ComponentPropsWithoutRef<"tr">;

type TableHeaderProps =
  ComponentPropsWithoutRef<"th">;

type TableDataProps =
  ComponentPropsWithoutRef<"td">;

type ImageProps =
  ComponentPropsWithoutRef<"img">;

type CodeProps =
  ComponentPropsWithoutRef<"code">;

type PreProps =
  ComponentPropsWithoutRef<"pre">;

type InputProps =
  ComponentPropsWithoutRef<"input">;

const normalizeMathUnicode = (
  text: string,
): string => {
  return text
    // greek
    .replace(/θ/g, "\\theta")
    .replace(/α/g, "\\alpha")
    .replace(/β/g, "\\beta")
    .replace(/γ/g, "\\gamma")
    .replace(/λ/g, "\\lambda")
    .replace(/μ/g, "\\mu")
    .replace(/π/g, "\\pi")
    .replace(/σ/g, "\\sigma")
    .replace(/Σ/g, "\\sum")
    .replace(/Δ/g, "\\Delta")
    .replace(/Ω/g, "\\Omega")
    .replace(/χ/g, "\\chi")
    .replace(/ζ/g, "\\zeta")

    // math
    .replace(/∫/g, "\\int")
    .replace(/∞/g, "\\infty")
    .replace(/√/g, "\\sqrt")
    .replace(/≈/g, "\\approx")
    .replace(/≠/g, "\\neq")
    .replace(/≤/g, "\\leq")
    .replace(/≥/g, "\\geq")
    .replace(/∂/g, "\\partial")
    .replace(/∇/g, "\\nabla")
    .replace(/×/g, "\\times")
    .replace(/·/g, "\\cdot");
};

/**
 * markdown table sering gagal dengan $$ $$
 * jadi convert ke inline math
 */
const normalizeTableMath = (
  text: string,
): string => {
  return text.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (_, expr: string) => {
      return `$${expr.trim()}$`;
    },
  );
};

const preprocessMarkdown = (text: string): string => {
  if (!text) return "";

  // 1. Handle standard delimiters \[ \] and \( \)
  let processed = text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => `\n$$\n${expr.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => `$${expr.trim()}$`);

  // 2. Handle common LaTeX environments
  // We wrap them in $$ to ensure they are picked up as math blocks
  // only if they are not already wrapped.
  processed = processed.replace(
    /(?<![\\\$])(\\begin\{.*?\}(?:[\s\S]*?)\\end\{.*?\})(?![\\\$])/gm,
    (match) => `\n$$\n${match.trim()}\n$$\n`,
  );

  return processed;
};

const nodeToText = (
  node: ReactNode,
): string => {
  if (
    node === null ||
    node === undefined ||
    typeof node === "boolean"
  ) {
    return "";
  }

  if (typeof node === "string") {
    return node;
  }

  if (typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(nodeToText).join("");
  }

  if (
    isValidElement<{
      children?: ReactNode;
    }>(node)
  ) {
    return nodeToText(
      node.props.children,
    );
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
  const [copied, setCopied] =
    useState(false);

  let language = "";

  const firstChild =
    Children.toArray(children)[0];

  if (
    isValidElement<{
      className?: string;
    }>(firstChild)
  ) {
    const match =
      /language-([\w-]+)/.exec(
        firstChild.props.className ??
        "",
      );

    language = match?.[1] ?? "";
  }

  const text = nodeToText(
    children,
  ).replace(/\n$/, "");

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        text,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1200);
    } catch {
      //
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
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
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

const sanitizeSchema = {
  ...defaultSchema,

  attributes: {
    ...defaultSchema.attributes,

    "*": [
      ...(defaultSchema.attributes?.[
        "*"
      ] ?? []),
      "className",
      "style",
    ],

    code: [
      ...(defaultSchema.attributes
        ?.code ?? []),
      "className",
    ],

    span: [
      ...(defaultSchema.attributes
        ?.span ?? []),
      "className",
      "style",
    ],

    div: [
      ...(defaultSchema.attributes
        ?.div ?? []),
      "className",
      "style",
    ],

    math: ["xmlns"],

    annotation: ["encoding"],

    svg: [
      "width",
      "height",
      "viewBox",
      "preserveAspectRatio",
      "role",
      "aria-hidden",
    ],

    path: ["d"],
  },

  tagNames: [
    ...(defaultSchema.tagNames ??
      []),

    "math",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msup",
    "msub",
    "msubsup",
    "mfrac",
    "msqrt",
    "mroot",
    "mtable",
    "mtr",
    "mtd",
    "mtext",
    "mspace",
    "mstyle",
    "merror",
    "mpadded",
    "mphantom",
    "munder",
    "munderover",
    "semantics",
    "annotation",
    "svg",
    "path",
  ],
};

const createComponents = () => ({
  h1: ({
    className,
    ...props
  }: HeadingProps) => (
    <h1
      className={cn(
        "mt-4 mb-2 text-lg font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  ),

  h2: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className={cn(
        "mt-4 mb-2 text-base font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  ),

  h3: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className={cn(
        "mt-3 mb-1.5 text-sm font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  ),

  h4: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<"h4">) => (
    <h4
      className={cn(
        "mt-3 mb-1 text-[13px] font-semibold",
        className,
      )}
      {...props}
    />
  ),

  p: ({
    className,
    ...props
  }: ParagraphProps) => (
    <p
      className={cn(
        "my-2 text-[13.5px] leading-6 first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),

  ul: ({
    className,
    ...props
  }: ListProps) => (
    <ul
      className={cn(
        "my-2 ml-5 list-disc space-y-1 text-[13.5px]",
        className,
      )}
      {...props}
    />
  ),

  ol: ({
    className,
    ...props
  }: OrderedListProps) => (
    <ol
      className={cn(
        "my-2 ml-5 list-decimal space-y-1 text-[13.5px]",
        className,
      )}
      {...props}
    />
  ),

  li: ({
    className,
    ...props
  }: ListItemProps) => (
    <li
      className={cn(
        "pl-0.5 marker:text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),

  a: ({
    className,
    ...props
  }: AnchorProps) => (
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

  blockquote: ({
    className,
    ...props
  }: BlockquoteProps) => (
    <blockquote
      className={cn(
        "my-3 border-l-2 border-muted-foreground/40 pl-3 text-muted-foreground italic",
        className,
      )}
      {...props}
    />
  ),

  hr: ({
    className,
    ...props
  }: HrProps) => (
    <hr
      className={cn(
        "my-4 border-border",
        className,
      )}
      {...props}
    />
  ),

  table: ({
    className,
    ...props
  }: TableProps) => (
    <div className="my-3 overflow-x-auto rounded-md border border-border">
      <table
        className={cn(
          "w-full border-collapse text-[12.5px]",
          className,
        )}
        {...props}
      />
    </div>
  ),

  thead: ({
    className,
    ...props
  }: TableSectionProps) => (
    <thead
      className={cn(
        "bg-muted/40",
        className,
      )}
      {...props}
    />
  ),

  tbody: ({
    className,
    ...props
  }: TableBodyProps) => (
    <tbody
      className={cn(
        "divide-y divide-border",
        className,
      )}
      {...props}
    />
  ),

  tr: ({
    className,
    ...props
  }: TableRowProps) => (
    <tr
      className={cn("", className)}
      {...props}
    />
  ),

  th: ({
    className,
    ...props
  }: TableHeaderProps) => (
    <th
      className={cn(
        "border-r border-border px-2.5 py-1.5 text-left font-semibold text-foreground last:border-r-0",
        className,
      )}
      {...props}
    />
  ),

  td: ({
    className,
    ...props
  }: TableDataProps) => (
    <td
      className={cn(
        "border-r border-border px-2.5 py-1.5 align-top text-foreground/85 last:border-r-0",
        className,
      )}
      {...props}
    />
  ),

  img: ({
    className,
    alt,
    ...props
  }: ImageProps) => (
    <img
      alt={alt ?? ""}
      className={cn(
        "my-2 max-w-full rounded-md border border-border",
        className,
      )}
      {...props}
    />
  ),

  code: ({
    className,
    children,
    ...props
  }: CodeProps) => {
    const isBlock =
      /language-/.test(
        className ?? "",
      );

    if (isBlock) {
      return (
        <code
          className={cn(
            className,
            "hljs",
          )}
          {...props}
        >
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

  pre: ({
    className,
    children,
  }: PreProps) => (
    <CodeBlock className={className}>
      {children}
    </CodeBlock>
  ),

  input: ({
    className,
    type,
    ...props
  }: InputProps) => {
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

    return (
      <input
        type={type}
        className={className}
        {...props}
      />
    );
  },
});

function MarkdownImpl({
  content,
  className,
  compact = false,
  allowHtml = false,
  streaming,
}: MarkdownProps) {
  const components = useMemo(
    createComponents,
    [],
  );

  const processedContent =
    useMemo(() => {
      return preprocessMarkdown(
        content,
      );
    }, [content]);

  const remarkPlugins =
    useMemo<
      NonNullable<
        React.ComponentProps<
          typeof ReactMarkdown
        >["remarkPlugins"]
      >
    >(
      () => [
        remarkGfm,
        [
          remarkMath,
          {
            singleDollar: true,
          },
        ],
      ],
      [],
    );

  const rehypePlugins =
    useMemo<PluggableList>(() => {
      const plugins: PluggableList = [
        rehypeRaw,
        [rehypeKatex, { output: "html", throwOnError: false }],
      ];

      if (allowHtml) {
        plugins.push([
          rehypeSanitize,
          sanitizeSchema,
        ]);
      }

      if (!streaming) {
        plugins.push([
          rehypeHighlight,
          {
            detect: true,
            ignoreMissing: true,
          },
        ]);
      }

      return plugins;
    }, [allowHtml, streaming]);

  return (
    <div
      className={cn(
        "markdown-body text-[13.5px] text-foreground/90",
        compact &&
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={
          components as Components
        }
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(
  MarkdownImpl,
);
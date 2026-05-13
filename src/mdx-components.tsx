import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";
import { Forthbox } from "@/components/article/Forthbox";
import { Notebox } from "@/components/article/Notebox";
import { PullQuote } from "@/components/article/PullQuote";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mt-2 mb-8 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-16 mb-6 border-b border-card-border/30 pb-3 text-2xl font-bold text-foreground sm:text-3xl">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-10 mb-3 text-lg font-bold uppercase tracking-wider text-accent-orange/90 sm:text-xl">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="my-5 text-[15px] leading-[1.75] text-foreground/85 sm:text-base">
        {children}
      </p>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-accent-orange underline decoration-accent-orange/40 underline-offset-2 transition-colors hover:text-accent-warm hover:decoration-accent-warm/60"
        target={href?.startsWith("http") ? "_blank" : undefined}
        rel={href?.startsWith("http") ? "noreferrer" : undefined}
      >
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="my-5 ml-6 list-disc space-y-2 text-[15px] text-foreground/85 marker:text-accent-orange/60 sm:text-base">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-5 ml-6 list-decimal space-y-2 text-[15px] text-foreground/85 marker:text-accent-orange/80 marker:font-bold sm:text-base">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-[1.75] pl-1">{children}</li>,
    strong: ({ children }) => (
      <strong className="font-bold text-foreground">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
    code: ({ children }) => (
      <code className="rounded bg-card-bg px-1.5 py-0.5 text-[13px] text-accent-warm">
        {children}
      </code>
    ),
    pre: ({ children }) => <Forthbox>{children as ReactNode}</Forthbox>,
    blockquote: ({ children }) => <Notebox>{children as ReactNode}</Notebox>,
    hr: () => <hr className="my-12 border-t border-card-border/30" />,
    table: ({ children }) => (
      <div className="my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-accent-orange text-background">{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr className="border-b border-card-border/30 even:bg-card-bg/40">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 align-top text-foreground/85">{children}</td>
    ),
    img: ({ src, alt }) => (
      <figure className="my-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src as string}
          alt={alt}
          className="w-full rounded border border-card-border"
        />
        {alt && (
          <figcaption className="mt-2 text-center text-xs text-muted">
            {alt}
          </figcaption>
        )}
      </figure>
    ),
    Forthbox,
    Notebox,
    PullQuote,
    ...components,
  };
}

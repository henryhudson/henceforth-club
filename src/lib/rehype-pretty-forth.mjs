// Self-contained rehype-pretty-code wrapper that registers a custom
// FORTH grammar and the Henceforth shiki theme.
//
// All options + theme + grammar live inline so this module is
// referenced from next.config.ts as a string-form plugin path
// (Turbopack only accepts serializable plugin specs; a function
// reference would fail the loader-options serializer).

import rehypePrettyCode from "rehype-pretty-code";
import { createHighlighter } from "shiki";

const HENCEFORTH_THEME = {
  name: "henceforth-terminal",
  type: "dark",
  colors: {
    "editor.background": "#0a0e14",
    "editor.foreground": "#00ff41",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { foreground: "#7a8a7a", fontStyle: "italic" },
    },
    {
      scope: ["string", "string.quoted", "constant.character.escape"],
      settings: { foreground: "#a8ff80" },
    },
    {
      scope: ["constant.numeric", "constant.language"],
      settings: { foreground: "#5eead4" },
    },
    {
      scope: [
        "keyword",
        "keyword.control",
        "storage",
        "storage.type",
        "storage.modifier",
      ],
      settings: { foreground: "#fbbf24" },
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: "#00ff41" },
    },
    {
      scope: ["entity.name.type", "support.type", "support.class"],
      settings: { foreground: "#fbbf24" },
    },
    {
      scope: ["variable.parameter", "variable.other"],
      settings: { foreground: "#00ff41" },
    },
    {
      scope: ["punctuation"],
      settings: { foreground: "#7ee787" },
    },
  ],
};

const FORTH_GRAMMAR = {
  name: "forth",
  scopeName: "source.forth",
  fileTypes: ["fs", "forth"],
  patterns: [
    { include: "#comments" },
    { include: "#strings" },
    { include: "#numbers" },
    { include: "#bitcoin" },
    { include: "#control" },
    { include: "#compile" },
    { include: "#stack" },
  ],
  repository: {
    comments: {
      patterns: [
        { name: "comment.line.backslash.forth", match: "\\\\.*$" },
        {
          name: "comment.block.parens.forth",
          begin: "(?<=^|\\s)\\(",
          end: "\\)",
          beginCaptures: {
            "0": { name: "punctuation.definition.comment.forth" },
          },
          endCaptures: {
            "0": { name: "punctuation.definition.comment.forth" },
          },
        },
      ],
    },
    strings: {
      patterns: [
        {
          name: "string.quoted.double.forth",
          begin: '(?<=^|\\s)(s"|\\."|c")\\s',
          end: '"',
          beginCaptures: { "1": { name: "keyword.operator.string.forth" } },
        },
      ],
    },
    numbers: {
      patterns: [
        { name: "constant.numeric.hex.forth", match: "\\b0x[0-9a-fA-F]+\\b" },
        {
          name: "constant.numeric.decimal.forth",
          match: "(?<=^|\\s)-?[0-9_]+\\b",
        },
      ],
    },
    control: {
      patterns: [
        {
          name: "keyword.control.forth",
          match:
            "(?i)(?<=^|\\s)(if|then|else|do|\\?do|loop|\\+loop|begin|until|while|repeat|again|case|of|endof|endcase|exit|recurse|leave|unloop|catch|throw|every|stop|abort|quit)(?=\\s|$)",
        },
      ],
    },
    compile: {
      patterns: [
        {
          name: "storage.type.forth",
          match:
            "(?i)(?<=^|\\s)(:|;|immediate|postpone|literal|create|variable|constant|value|to|does>|allot|include|evaluate|find|state)(?=\\s|$)",
        },
      ],
    },
    bitcoin: {
      patterns: [
        {
          name: "entity.name.function.bitcoin.forth",
          match:
            "(?i)(?<=^|\\s)(tx-[a-z-]+|script-[a-z-]+|bap-[a-z-]+|hex2data|data2hex|>data|>addr|>script|data>script|text>script|file>script|make-[a-z0-9-]+|pay|send|send-many|sign-msg|verify-msg|encrypt-msg|decrypt-msg|SCRIPT-BEGIN|SCRIPT-END|woc[a-z]+|op_[a-z0-9_]+|OP_[A-Z0-9_]+)(?=\\s|$)",
        },
      ],
    },
    stack: {
      patterns: [
        {
          name: "support.function.stack.forth",
          match:
            "(?i)(?<=^|\\s)(dup|drop|swap|over|rot|-rot|nip|tuck|2dup|2drop|2swap|2over|\\?dup|pick|roll|depth|>r|r>|r@|i|i'|j|nth|reversestack|stackcount|\\.s|\\.rs|emit|key|cr|space|spaces|type|page)(?=\\s|$)",
        },
      ],
    },
  },
};

let highlighterPromise = null;

function ensureHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [HENCEFORTH_THEME],
      langs: [
        "swift",
        "javascript",
        "typescript",
        "tsx",
        "jsx",
        "shell",
        "bash",
        "json",
        "css",
        "html",
        "markdown",
        FORTH_GRAMMAR,
      ],
    });
  }
  return highlighterPromise;
}

export default function rehypePrettyForth() {
  return rehypePrettyCode({
    theme: HENCEFORTH_THEME,
    keepBackground: false,
    defaultLang: "plaintext",
    getHighlighter: ensureHighlighter,
  });
}

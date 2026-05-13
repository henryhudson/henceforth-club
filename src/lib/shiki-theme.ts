// Henceforth terminal theme for shiki via rehype-pretty-code.
// - Editor foreground (default text): bright neon green
// - Comments: muted green-gray
// - Background: handled by our own CSS via `keepBackground: false`
//
// Token rules use TextMate scopes — same parser tree VS Code uses,
// so the comment rule fires across Swift, JS/TS, FORTH, shell,
// Python, Ruby, etc., with one definition.

export const HENCEFORTH_THEME = {
  name: "henceforth-terminal",
  type: "dark",
  colors: {
    "editor.background": "#0a0e14",
    "editor.foreground": "#00ff41",
  },
  tokenColors: [
    {
      scope: [
        "comment",
        "punctuation.definition.comment",
        "string.comment",
      ],
      settings: { foreground: "#7a8a7a", fontStyle: "italic" },
    },
    {
      scope: [
        "string",
        "string.quoted",
        "constant.character.escape",
      ],
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
} as const;

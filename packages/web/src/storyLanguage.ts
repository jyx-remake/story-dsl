import type * as monaco from "monaco-editor";
import type { DiagnosticItem } from "@storydsl/core";

const LANGUAGE_ID = "storydsl-web";
const THEME_ID = "storydsl-dark";

export function registerStoryLanguage(monacoApi: typeof monaco): void {
  defineStoryTheme(monacoApi);

  if (!monacoApi.languages.getLanguages().some((language) => language.id === LANGUAGE_ID)) {
    monacoApi.languages.register({
      id: LANGUAGE_ID,
      extensions: [".story"],
      aliases: ["Story DSL", "storydsl"],
    });
  }

  monacoApi.languages.setLanguageConfiguration(LANGUAGE_ID, {
    comments: {
      lineComment: "//",
    },
    brackets: [["(", ")"]],
    autoClosingPairs: [{ open: "(", close: ")" }],
  });

  monacoApi.languages.setMonarchTokensProvider(LANGUAGE_ID, {
    defaultToken: "",
    tokenPostfix: ".story",
    keywords: ["if", "elif", "else", "when", "battle", "jump", "and", "or", "not", "win", "lose", "timeout"],
    operators: ["==", "!=", ">=", "<=", ">", "<", "&&", "||", "!"],
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/^(#)(.*)$/, ["story.segmentMarker", "story.segmentName"]],
        [/^(\s*)(-)(\s*)(win|lose|timeout)\b/, ["", "story.branchMarker", "", "keyword"]],
        [/^(\s*)(-)(\s*)(.*)$/, ["", "story.branchMarker", "", "story.choiceText"]],
        [/^(\s*)(if|elif|else|when)\b/, ["", "keyword"]],
        [/^(\s*)(battle|jump)\b/, ["", "keyword"]],
        [/^(\s*)([A-Za-z_][\w.]*)\b/, ["", "story.commandName"]],
        [/^(\s*)([^:：\s][^:：]*)([:：])/, ["", "story.speaker", "delimiter"]],
        [/\[\/?color(?:=[A-Za-z]+)?\]/, "story.richText"],
        [/\$[A-Za-z_][\w\u4e00-\u9fa5]*/, "variable"],
        [/[+-]?\d+(?:\.\d+)?/, "number"],
        [/[:：]/, "delimiter"],
        [
          /[A-Za-z_][\w.]*/,
          {
            cases: {
              "@keywords": "keyword",
              "@default": "identifier",
            },
          },
        ],
        [/[=!<>]=?|&&|\|\||!/, "operator"],
      ],
    },
  });

}

function defineStoryTheme(monacoApi: typeof monaco): void {
  monacoApi.editor.defineTheme(THEME_ID, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "story.segmentMarker", foreground: "E9B15E", fontStyle: "bold" },
      { token: "story.segmentName", foreground: "F0D7A0", fontStyle: "bold" },
      { token: "story.branchMarker", foreground: "8FBF74", fontStyle: "bold" },
      { token: "story.choiceText", foreground: "BBDCA8" },
      { token: "story.commandName", foreground: "7DB7D9" },
      { token: "story.speaker", foreground: "D99179" },
      { token: "story.richText", foreground: "C68BD9" },
      { token: "keyword", foreground: "8FBF74", fontStyle: "bold" },
      { token: "variable", foreground: "D7C36B" },
      { token: "number", foreground: "9AD0B3" },
      { token: "operator", foreground: "B7C5CA" },
      { token: "delimiter", foreground: "B7C5CA" },
      { token: "comment", foreground: "69777E", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#13181B",
      "editor.lineHighlightBackground": "#1D2628",
      "editorCursor.foreground": "#E9EFED",
    },
  });
}

export function diagnosticToMarker(
  monacoApi: typeof monaco,
  diagnostic: DiagnosticItem,
): monaco.editor.IMarkerData {
  return {
    severity:
      diagnostic.severity === "warning"
        ? monacoApi.MarkerSeverity.Warning
        : monacoApi.MarkerSeverity.Error,
    message: diagnostic.message,
    code: diagnostic.code,
    startLineNumber: diagnostic.span.start.line,
    startColumn: diagnostic.span.start.column,
    endLineNumber: diagnostic.span.end.line,
    endColumn: Math.max(diagnostic.span.end.column, diagnostic.span.start.column + 1),
  };
}

export { LANGUAGE_ID, THEME_ID };

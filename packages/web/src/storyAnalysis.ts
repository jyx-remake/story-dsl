import * as StoryCore from "@storydsl/core";
import type { DiagnosticItem, ScriptAst, ScriptIr } from "@storydsl/core";

export interface StoryAnalysis {
  ast: ScriptAst;
  diagnostics: DiagnosticItem[];
  ir: ScriptIr | null;
  jsonText: string | null;
}

export function analyzeStory(text: string): StoryAnalysis {
  const parseResult = StoryCore.parseStory(text);
  const compileResult = StoryCore.compileScript(parseResult.ast);
  const diagnostics = [...parseResult.diagnostics, ...compileResult.diagnostics];
  const hasErrors = diagnostics.some((item) => item.severity === "error");

  return {
    ast: parseResult.ast,
    diagnostics,
    ir: hasErrors ? null : compileResult.ir,
    jsonText: hasErrors ? null : `${JSON.stringify(compileResult.ir, null, 2)}\n`,
  };
}

import { DiagnosticItem, IfStmtAst, ScriptAst, SourceSpan, StatementAst } from "../ast";
import { BranchIr, BattleIr, CallIr, ChoiceIr, CommandIr, JumpIr, ReturnIr, ScriptIr, SegmentIr, StepIr } from "./ir";
import { transformCommandSource } from "./command-transforms";

export interface CompileResult {
  ir: ScriptIr;
  diagnostics: DiagnosticItem[];
}

function unreachableDiagnostic(span: SourceSpan): DiagnosticItem {
  return {
    message: "jump/return 之后的同级语句不可达，已跳过 IR 输出",
    span,
    severity: "error",
    code: "unreachable",
  };
}

export function compileScript(ast: ScriptAst): CompileResult {
  const diagnostics: DiagnosticItem[] = [];
  const segments: SegmentIr[] = ast.segments.map((segment) => ({
    name: segment.name,
    steps: compileSteps(segment.statements, segment.name, diagnostics),
  }));
  return { ir: { version: 3, segments }, diagnostics };
}

function compileSteps(statements: StatementAst[], segmentName: string, diagnostics: DiagnosticItem[]): StepIr[] {
  const steps: StepIr[] = [];
  let terminated = false;
  for (const statement of statements) {
    if (terminated) {
      diagnostics.push(unreachableDiagnostic(statement.span));
      continue;
    }
    const step = compileStatement(statement, segmentName, diagnostics);
    if (!step) continue;
    steps.push(step);
    if (step.kind === "jump" || step.kind === "return") terminated = true;
  }
  return steps;
}

function compileStatement(statement: StatementAst, segmentName: string, diagnostics: DiagnosticItem[]): StepIr | null {
  switch (statement.type) {
    case "dialogue":
      return { kind: "dialogue", speaker: statement.speaker, text: statement.text, ...(statement.style ? { style: statement.style } : {}) };
    case "command":
      {
        const call = transformCommandSource(statement, { segmentName, diagnostics });
        return call ? { kind: "command", call } satisfies CommandIr : null;
      }
    case "jump": return { kind: "jump", target: statement.target } satisfies JumpIr;
    case "call": return { kind: "call", target: statement.target } satisfies CallIr;
    case "return": return { kind: "return" } satisfies ReturnIr;
    case "choice":
      return {
        kind: "choice",
        ...(statement.style ? { style: statement.style } : {}),
        prompt: { speaker: statement.prompt.speaker, text: statement.prompt.text },
        groups: statement.groups.map((group) => ({
          ...(group.condition && group.rawCondition !== null ? { when: group.rawCondition } : {}),
          options: group.options.map((option) => ({ text: option.text, steps: compileSteps(option.statements, segmentName, diagnostics) })),
        })),
      } satisfies ChoiceIr;
    case "battle": {
      const outcomes: BattleIr["outcomes"] = {};
      for (const outcome of statement.outcomes) outcomes[outcome.outcome] = compileSteps(outcome.statements, segmentName, diagnostics);
      return { kind: "battle", battleId: statement.battleId, outcomes };
    }
    case "if": return compileBranch(statement, segmentName, diagnostics);
  }
}

function compileBranch(statement: IfStmtAst, segmentName: string, diagnostics: DiagnosticItem[]): BranchIr {
  const cases: BranchIr["cases"] = [];
  let fallback: StepIr[] | null = null;
  for (const branch of statement.branches) {
    const steps = compileSteps(branch.statements, segmentName, diagnostics);
    if (branch.keyword === "else") {
      fallback = steps;
    } else if (branch.condition && branch.rawCondition !== null) {
      cases.push({ when: branch.rawCondition, steps });
    }
  }
  return { kind: "branch", cases, fallback };
}

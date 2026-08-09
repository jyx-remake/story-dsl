import { ChoiceOptionAst, DiagnosticItem, IfStmtAst, ScriptAst, SourceSpan, StatementAst } from "../ast";
import { BranchIr, BattleIr, CallIr, ChoiceIr, ChoiceOptionIr, CommandIr, DeleteVariableIr, JumpIr, ReturnIr, ScriptIr, SegmentIr, SetVariableIr, StepIr } from "./ir";
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
    case "assignment": {
      if (!statement.value || !statement.target) return null;
      const value = statement.operator === "="
        ? statement.valueSource
        : `${statement.target} ${statement.operator[0]} (${statement.valueSource})`;
      return { kind: "set", target: statement.target, value } satisfies SetVariableIr;
    }
    case "delete":
      return statement.target
        ? { kind: "delete", target: statement.target } satisfies DeleteVariableIr
        : null;
    case "jump": return { kind: "jump", target: statement.target } satisfies JumpIr;
    case "call": return { kind: "call", target: statement.target } satisfies CallIr;
    case "return": return { kind: "return" } satisfies ReturnIr;
    case "choice":
      return {
        kind: "choice",
        ...(statement.style ? { style: statement.style } : {}),
        prompt: { speaker: statement.prompt.speaker, text: statement.prompt.text },
        blocks: statement.blocks.map((block) => {
          if (block.type === "choiceOptionsBlock") {
            return {
              kind: "options" as const,
              options: compileChoiceOptions(block.options, segmentName, diagnostics),
            };
          }

          const fallback = block.branches.find((branch) => branch.keyword === "else");
          return {
            kind: "branch" as const,
            cases: block.branches.flatMap((branch) =>
              branch.keyword !== "else" && branch.condition && branch.rawCondition !== null
                ? [{ when: branch.rawCondition, options: compileChoiceOptions(branch.options, segmentName, diagnostics) }]
                : []),
            fallback: fallback ? compileChoiceOptions(fallback.options, segmentName, diagnostics) : null,
          };
        }),
      } satisfies ChoiceIr;
    case "battle": {
      const outcomes: BattleIr["outcomes"] = {};
      for (const outcome of statement.outcomes) outcomes[outcome.outcome] = compileSteps(outcome.statements, segmentName, diagnostics);
      return { kind: "battle", battleId: statement.battleId, outcomes };
    }
    case "if": return compileBranch(statement, segmentName, diagnostics);
  }
}

function compileChoiceOptions(
  options: ChoiceOptionAst[],
  segmentName: string,
  diagnostics: DiagnosticItem[],
): ChoiceOptionIr[] {
  return options.map((option) => ({
    text: option.text,
    ...(option.condition && option.rawCondition !== null ? { when: option.rawCondition } : {}),
    steps: compileSteps(option.statements, segmentName, diagnostics),
  }));
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

import {
  ComparisonExprAst,
  DiagnosticItem,
  ExprAst,
  IfStmtAst,
  LiteralExprAst,
  ScriptAst,
  SourceSpan,
  StatementAst,
  ValueArgAst,
  VariableExprAst,
} from "../ast";
import {
  BranchIr,
  BattleIr,
  BinaryExprIr,
  ChoiceIr,
  CommandIr,
  ExprIr,
  JumpIr,
  PredicateExprIr,
  ScriptIr,
  SegmentIr,
  StepIr,
  UnaryExprIr,
  ValueArgIr,
  VariableExprIr as VariableValueIr,
} from "./ir";

export interface CompileResult {
  ir: ScriptIr;
  diagnostics: DiagnosticItem[];
}

function unreachableDiagnostic(span: SourceSpan): DiagnosticItem {
  return {
    message: "jump 之后的同级语句不可达，已跳过 IR 输出",
    span,
    severity: "error",
    code: "unreachable",
  };
}

export function compileScript(ast: ScriptAst): CompileResult {
  const diagnostics: DiagnosticItem[] = [];
  const segments: SegmentIr[] = ast.segments.map((segment) => ({
    name: segment.name,
    steps: compileSteps(segment.statements, diagnostics),
  }));

  return {
    ir: {
      version: 1,
      segments,
    },
    diagnostics,
  };
}

function compileSteps(statements: StatementAst[], diagnostics: DiagnosticItem[]): StepIr[] {
  const steps: StepIr[] = [];
  let terminated = false;

  for (const statement of statements) {
    if (terminated) {
      diagnostics.push(unreachableDiagnostic(statement.span));
      continue;
    }

    const step = compileStatement(statement, diagnostics);
    if (step) {
      steps.push(step);
      if (step.kind === "jump") {
        terminated = true;
      }
    }
  }

  return steps;
}

function compileStatement(statement: StatementAst, diagnostics: DiagnosticItem[]): StepIr | null {
  switch (statement.type) {
    case "dialogue":
      return {
        kind: "dialogue",
        speaker: statement.speaker,
        text: statement.text,
      };
    case "command":
      return {
        kind: "command",
        name: statement.name,
        args: statement.args.map(compileValueArg),
      } satisfies CommandIr;
    case "jump":
      return {
        kind: "jump",
        target: statement.target,
      } satisfies JumpIr;
    case "choice":
      return {
        kind: "choice",
        prompt: {
          speaker: statement.prompt.speaker,
          text: statement.prompt.text,
        },
        options: statement.options.map((option) => ({
          text: option.text,
          steps: compileSteps(option.statements, diagnostics),
        })),
      } satisfies ChoiceIr;
    case "battle": {
      const outcomes: BattleIr["outcomes"] = {};
      statement.outcomes.forEach((outcome) => {
        outcomes[outcome.outcome] = compileSteps(outcome.statements, diagnostics);
      });
      return {
        kind: "battle",
        battleId: statement.battleId,
        outcomes,
      };
    }
    case "if":
      return compileBranch(statement, diagnostics);
    default:
      return null;
  }
}

function compileBranch(statement: IfStmtAst, diagnostics: DiagnosticItem[]): BranchIr {
  const cases: BranchIr["cases"] = [];
  let fallback: StepIr[] | null = null;

  for (const branch of statement.branches) {
    const steps = compileSteps(branch.statements, diagnostics);
    if (branch.keyword === "else") {
      fallback = steps;
      continue;
    }

    if (!branch.condition) {
      continue;
    }

    cases.push({
      when: compileExpr(branch.condition),
      steps,
    });
  }

  return {
    kind: "branch",
    cases,
    fallback,
  };
}

function compileExpr(expr: ExprAst): ExprIr {
  switch (expr.type) {
    case "binary":
      return [expr.operator, compileExpr(expr.left), compileExpr(expr.right)] satisfies BinaryExprIr;
    case "unary":
      return ["not", compileExpr(expr.operand)] satisfies UnaryExprIr;
    case "comparison":
      return compileComparison(expr);
    case "predicate":
      return ["pred", expr.name, ...expr.args.map(compileValueArg)] satisfies PredicateExprIr;
    case "variable":
      return compileVariableExpr(expr);
    case "literal":
      return expr.value;
  }
}

function compileComparison(expr: ComparisonExprAst): BinaryExprIr {
  return [expr.operator, compileExpr(expr.left), compileExpr(expr.right)];
}

function compileValueArg(arg: ValueArgAst): ValueArgIr {
  if (arg.type === "variable") {
    return compileVariableExpr(arg);
  }

  return compileLiteralExpr(arg);
}

function compileVariableExpr(expr: VariableExprAst): VariableValueIr {
  return ["var", expr.name];
}

function compileLiteralExpr(expr: LiteralExprAst): string | number {
  return expr.value;
}

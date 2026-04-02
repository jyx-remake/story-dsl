export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

export interface SourceSpan {
  start: SourcePosition;
  end: SourcePosition;
}

export interface DiagnosticItem {
  message: string;
  span: SourceSpan;
  severity: "error" | "warning";
  code:
    | "syntax"
    | "indentation"
    | "structure"
    | "duplicate"
    | "semantic"
    | "unreachable";
}

export interface ScriptAst {
  type: "script";
  span: SourceSpan;
  segments: SegmentAst[];
}

export interface SegmentAst {
  type: "segment";
  name: string;
  rawName: string;
  span: SourceSpan;
  headerSpan: SourceSpan;
  statements: StatementAst[];
}

export type StatementAst =
  | DialogueStmtAst
  | CommandStmtAst
  | ChoiceStmtAst
  | BattleStmtAst
  | IfStmtAst
  | JumpStmtAst;

export interface DialogueStmtAst {
  type: "dialogue";
  span: SourceSpan;
  speaker: string;
  text: string;
  marker: ":" | "：";
  raw: string;
}

export interface CommandStmtAst {
  type: "command";
  span: SourceSpan;
  name: string;
  args: ValueArgAst[];
  raw: string;
}

export interface JumpStmtAst {
  type: "jump";
  span: SourceSpan;
  target: string;
  raw: string;
}

export interface ChoiceStmtAst {
  type: "choice";
  span: SourceSpan;
  prompt: DialogueStmtAst;
  options: ChoiceOptionAst[];
}

export interface ChoiceOptionAst {
  type: "choiceOption";
  span: SourceSpan;
  text: string;
  statements: StatementAst[];
}

export type BattleOutcomeName = "win" | "lose" | "timeout";

export interface BattleStmtAst {
  type: "battle";
  span: SourceSpan;
  battleId: string;
  outcomes: BattleOutcomeAst[];
  raw: string;
}

export interface BattleOutcomeAst {
  type: "battleOutcome";
  span: SourceSpan;
  outcome: BattleOutcomeName;
  statements: StatementAst[];
}

export interface IfStmtAst {
  type: "if";
  span: SourceSpan;
  branches: ConditionalBranchAst[];
}

export interface ConditionalBranchAst {
  type: "conditionalBranch";
  span: SourceSpan;
  keyword: "if" | "elif" | "else";
  condition: ExprAst | null;
  rawCondition: string | null;
  statements: StatementAst[];
}

export type ExprAst =
  | BinaryExprAst
  | UnaryExprAst
  | ComparisonExprAst
  | PredicateCallExprAst
  | VariableExprAst
  | LiteralExprAst;

export interface BinaryExprAst {
  type: "binary";
  operator: "and" | "or";
  span: SourceSpan;
  rawOperator: string;
  left: ExprAst;
  right: ExprAst;
}

export interface UnaryExprAst {
  type: "unary";
  operator: "not";
  span: SourceSpan;
  rawOperator: string;
  operand: ExprAst;
}

export interface ComparisonExprAst {
  type: "comparison";
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=";
  span: SourceSpan;
  left: ExprAst;
  right: ExprAst;
}

export interface PredicateCallExprAst {
  type: "predicate";
  span: SourceSpan;
  name: string;
  args: ValueArgAst[];
}

export type ValueArgAst = VariableExprAst | LiteralExprAst;

export interface VariableExprAst {
  type: "variable";
  span: SourceSpan;
  name: string;
}

export interface LiteralExprAst {
  type: "literal";
  span: SourceSpan;
  value: string | number;
  valueType: "string" | "number";
}

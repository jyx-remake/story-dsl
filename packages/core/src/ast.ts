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
  | AssignmentStmtAst
  | DeleteStmtAst
  | ChoiceStmtAst
  | BattleStmtAst
  | IfStmtAst
  | JumpStmtAst
  | CallStmtAst
  | ReturnStmtAst;

export interface DialogueStmtAst {
  type: "dialogue";
  span: SourceSpan;
  speaker: string;
  text: string;
  style: string | null;
  marker: ":" | "：";
  raw: string;
}

export interface CommandStmtAst {
  type: "command";
  span: SourceSpan;
  call: CallExprAst | null;
  callSource: string;
  raw: string;
}

export interface AssignmentStmtAst {
  type: "assignment";
  span: SourceSpan;
  target: string;
  operator: "=" | "+=" | "-=";
  value: ExprAst | null;
  valueSource: string;
  raw: string;
}

export interface DeleteStmtAst {
  type: "delete";
  span: SourceSpan;
  target: string;
  raw: string;
}

export interface JumpStmtAst {
  type: "jump";
  span: SourceSpan;
  target: string;
  raw: string;
}

export interface CallStmtAst {
  type: "call";
  span: SourceSpan;
  target: string;
  raw: string;
}

export interface ReturnStmtAst {
  type: "return";
  span: SourceSpan;
  raw: string;
}

export interface ChoiceStmtAst {
  type: "choice";
  span: SourceSpan;
  style: string | null;
  prompt: DialogueStmtAst;
  blocks: ChoiceBlockAst[];
}

export type ChoiceBlockAst = ChoiceOptionsBlockAst | ChoiceBranchBlockAst;

export interface ChoiceOptionsBlockAst {
  type: "choiceOptionsBlock";
  span: SourceSpan;
  options: ChoiceOptionAst[];
}

export interface ChoiceBranchBlockAst {
  type: "choiceBranchBlock";
  span: SourceSpan;
  branches: ChoiceBranchCaseAst[];
}

export interface ChoiceBranchCaseAst {
  type: "choiceBranchCase";
  span: SourceSpan;
  keyword: "if" | "elif" | "else";
  condition: ExprAst | null;
  rawCondition: string | null;
  options: ChoiceOptionAst[];
}

export interface ChoiceOptionAst {
  type: "choiceOption";
  span: SourceSpan;
  text: string;
  condition: ExprAst | null;
  rawCondition: string | null;
  statements: StatementAst[];
}

export type BattleOutcomeName = "win" | "lose" | "timeout";

export interface BattleStmtAst {
  type: "battle";
  span: SourceSpan;
  battleId: string;
  /** Legacy BATTLE's optional repeat count (`#count`). */
  totalBattles?: number;
  /** Legacy BATTLE's optional NPC power level (`#level`). */
  battleLevel?: number;
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
  | CallExprAst
  | IdentifierExprAst
  | ListExprAst
  | LiteralExprAst;

export interface BinaryExprAst {
  type: "binary";
  operator:
    | "*"
    | "/"
    | "%"
    | "+"
    | "-"
    | "<"
    | "<="
    | ">"
    | ">="
    | "in"
    | "not in"
    | "=="
    | "!="
    | "and"
    | "or";
  span: SourceSpan;
  rawOperator: string;
  left: ExprAst;
  right: ExprAst;
}

export interface UnaryExprAst {
  type: "unary";
  operator: "not" | "+" | "-";
  span: SourceSpan;
  rawOperator: string;
  operand: ExprAst;
}

export interface CallExprAst {
  type: "callExpr";
  name: string;
  span: SourceSpan;
  args: ExprAst[];
}

export interface IdentifierExprAst {
  type: "identifier";
  span: SourceSpan;
  name: string;
}

export interface ListExprAst {
  type: "list";
  span: SourceSpan;
  items: ExprAst[];
}

export interface LiteralExprAst {
  type: "literal";
  span: SourceSpan;
  value: string | number | boolean;
  valueType: "string" | "number" | "boolean";
}

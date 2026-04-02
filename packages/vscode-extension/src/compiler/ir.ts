export interface ScriptIr {
  version: 1;
  segments: SegmentIr[];
}

export interface SegmentIr {
  name: string;
  steps: StepIr[];
}

export type StepIr = DialogueIr | CommandIr | ChoiceIr | BattleIr | BranchIr | JumpIr;

export interface DialogueIr {
  kind: "dialogue";
  speaker: string;
  text: string;
}

export interface CommandIr {
  kind: "command";
  name: string;
  args: ValueArgIr[];
}

export interface JumpIr {
  kind: "jump";
  target: string;
}

export interface ChoiceIr {
  kind: "choice";
  prompt: {
    speaker: string;
    text: string;
  };
  options: Array<{
    text: string;
    steps: StepIr[];
  }>;
}

export interface BattleIr {
  kind: "battle";
  battleId: string;
  outcomes: Partial<Record<"win" | "lose" | "timeout", StepIr[]>>;
}

export interface BranchIr {
  kind: "branch";
  cases: Array<{
    when: ExprIr;
    steps: StepIr[];
  }>;
  fallback: StepIr[] | null;
}

export type VariableExprIr = ["var", string];

export type ValueArgIr = string | number | VariableExprIr;

export type PredicateExprIr = ["pred", string, ...ValueArgIr[]];

export type UnaryExprIr = ["not", ExprIr];

export type BinaryExprIr = [
  "and" | "or" | "==" | "!=" | ">" | ">=" | "<" | "<=",
  ExprIr,
  ExprIr,
];

export type ExprIr = string | number | VariableExprIr | PredicateExprIr | UnaryExprIr | BinaryExprIr;

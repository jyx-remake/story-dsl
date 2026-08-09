export interface ScriptIr {
  version: 3;
  segments: SegmentIr[];
}

export interface SegmentIr {
  name: string;
  steps: StepIr[];
}

export type StepIr = DialogueIr | CommandIr | SetVariableIr | DeleteVariableIr | ChoiceIr | BattleIr | BranchIr | JumpIr | CallIr | ReturnIr;

export interface DialogueIr {
  kind: "dialogue";
  speaker: string;
  text: string;
  style?: string;
}

export interface CommandIr {
  kind: "command";
  call: string;
}

export interface SetVariableIr {
  kind: "set";
  target: string;
  value: string;
}

export interface DeleteVariableIr {
  kind: "delete";
  target: string;
}

export interface JumpIr { kind: "jump"; target: string; }
export interface CallIr { kind: "call"; target: string; }
export interface ReturnIr { kind: "return"; }

export interface ChoiceIr {
  kind: "choice";
  style?: string;
  prompt: { speaker: string; text: string };
  blocks: ChoiceBlockIr[];
}

export type ChoiceBlockIr = ChoiceOptionsBlockIr | ChoiceBranchBlockIr;

export interface ChoiceOptionsBlockIr {
  kind: "options";
  options: ChoiceOptionIr[];
}

export interface ChoiceBranchBlockIr {
  kind: "branch";
  cases: Array<{ when: string; options: ChoiceOptionIr[] }>;
  fallback: ChoiceOptionIr[] | null;
}

export interface ChoiceOptionIr {
  text: string;
  when?: string;
  steps: StepIr[];
}

export interface BattleIr {
  kind: "battle";
  battleId: string;
  outcomes: Partial<Record<"win" | "lose" | "timeout", StepIr[]>>;
}

export interface BranchIr {
  kind: "branch";
  cases: Array<{ when: string; steps: StepIr[] }>;
  fallback: StepIr[] | null;
}

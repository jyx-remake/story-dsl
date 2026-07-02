import { DiagnosticItem, SourceSpan } from "../ast";
import { CommandIr } from "./ir";

interface CommandTransformContext {
  segmentName: string;
  span: SourceSpan;
  diagnostics: DiagnosticItem[];
}

export function transformCommand(command: CommandIr, context: CommandTransformContext): CommandIr {
  if (command.name !== "maxlevel" || command.args.length !== 2) {
    return command;
  }

  const skillName = command.args[0];
  if (typeof skillName !== "string") {
    context.diagnostics.push({
      message: "maxlevel 自动补 key 时，技能名必须是字符串字面量",
      span: context.span,
      severity: "error",
      code: "semantic",
    });
    return command;
  }

  return {
    ...command,
    args: [...command.args, `${context.segmentName}_${skillName}`],
  };
}

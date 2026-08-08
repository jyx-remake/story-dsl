import { CommandStmtAst, DiagnosticItem } from "../ast";

interface CommandTransformContext {
  segmentName: string;
  diagnostics: DiagnosticItem[];
}

export function transformCommandSource(
  statement: CommandStmtAst,
  context: CommandTransformContext,
): string | null {
  const call = statement.call;
  if (!call) return null;
  if (call.name !== "maxlevel" || call.args.length !== 2) return statement.callSource;

  const skillName = call.args[0];
  if (skillName.type !== "literal" || skillName.valueType !== "string") {
    context.diagnostics.push({
      message: "maxlevel 自动补 key 时，技能名必须是字符串字面量",
      span: skillName.span,
      severity: "error",
      code: "semantic",
    });
    return statement.callSource;
  }

  const closingParenthesis = statement.callSource.lastIndexOf(")");
  if (closingParenthesis < 0) return statement.callSource;
  const onceKey = quoteString(`${context.segmentName}_${skillName.value}`);
  return `${statement.callSource.slice(0, closingParenthesis)}, ${onceKey}${statement.callSource.slice(closingParenthesis)}`;
}

function quoteString(value: string): string {
  return `'${value.replace(/[\\'\b\f\n\r\t\u0000-\u001f]/gu, (character) => {
    const escapes: Record<string, string> = {
      "\\": "\\\\", "'": "\\'", "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r", "\t": "\\t",
    };
    return escapes[character] ?? `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
  })}'`;
}

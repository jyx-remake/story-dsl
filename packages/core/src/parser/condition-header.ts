import { DiagnosticItem, ExprAst } from "../ast";
import { parseExpression } from "./expression";
import { lineSpan, ParsedLine, position } from "./source-lines";

export interface ParsedConditionHeader {
  condition: ExprAst | null;
  rawCondition: string;
  diagnostics: DiagnosticItem[];
}

export function parseConditionHeader(line: ParsedLine, keyword: string): ParsedConditionHeader {
  const rawCondition = line.trimmed.slice(keyword.length).trim();
  if (!rawCondition) {
    return {
      condition: null,
      rawCondition,
      diagnostics: [
        {
          message: `${keyword} 后缺少条件表达式`,
          span: lineSpan(line),
          code: "syntax",
          severity: "error",
        },
      ],
    };
  }

  const startColumn = line.indentSpaces + 1 + line.text.indexOf(rawCondition);
  const result = parseExpression(rawCondition, position(line, startColumn + 1));
  return {
    condition: result.expr,
    rawCondition,
    diagnostics: result.diagnostics,
  };
}

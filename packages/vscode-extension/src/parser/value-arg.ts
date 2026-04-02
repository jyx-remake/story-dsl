import { SourceSpan, ValueArgAst } from "../ast";

const NUMBER_PATTERN = /^\d+(?:\.\d+)?$/u;

export function parseValueArgAst(raw: string, span: SourceSpan): ValueArgAst {
  if (raw.startsWith("$") && raw.length > 1) {
    return {
      type: "variable",
      name: raw.slice(1),
      span,
    };
  }

  if (NUMBER_PATTERN.test(raw)) {
    return {
      type: "literal",
      value: Number(raw),
      valueType: "number",
      span,
    };
  }

  return {
    type: "literal",
    value: raw,
    valueType: "string",
    span,
  };
}

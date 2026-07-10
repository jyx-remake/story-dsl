import { ConditionalBranchAst, ExprAst, IfStmtAst } from "../ast";
import { parseConditionHeader } from "./condition-header";
import { ParserContext } from "./parser-context";
import { ParseStatements } from "./parser-types";
import { isKeywordLine, lineSpan, mergeSpans, ParsedLine } from "./source-lines";

export function parseIfStatement(
  context: ParserContext,
  expectedIndent: number,
  parseStatements: ParseStatements,
): IfStmtAst {
  const branches: ConditionalBranchAst[] = [];
  const startLine = context.peek()!;

  while (true) {
    context.skipBlankLines();
    const line = context.peek();
    if (!line || line.indentLevel !== expectedIndent) {
      break;
    }

    const keyword = readConditionalKeyword(line);
    if (!keyword) {
      break;
    }

    if (branches.length === 0 && keyword !== "if") {
      context.report("条件分支必须从 if 开始", lineSpan(line), "structure");
    }
    if (branches.some((branch) => branch.keyword === "else")) {
      context.report("else 必须是条件分支的最后一项", lineSpan(line), "structure");
    }

    const rest = line.trimmed.slice(keyword.length).trim();
    let condition: ExprAst | null = null;
    let rawCondition: string | null = null;
    if (keyword === "else") {
      if (rest.length > 0) {
        context.report("else 后不能再跟条件表达式", lineSpan(line), "syntax");
      }
    } else {
      const parsedCondition = parseConditionHeader(line, keyword);
      condition = parsedCondition.condition;
      rawCondition = parsedCondition.rawCondition;
      context.addDiagnostics(parsedCondition.diagnostics);
    }

    context.advance();
    const statements = parseStatements(
      expectedIndent + 1,
      (candidate) =>
        candidate.indentLevel === expectedIndent &&
        (isKeywordLine(candidate, "elif") || isKeywordLine(candidate, "else")),
    );

    branches.push({
      type: "conditionalBranch",
      keyword,
      condition,
      rawCondition,
      statements,
      span: statements.length > 0 ? mergeSpans(lineSpan(line), statements[statements.length - 1].span) : lineSpan(line),
    });

    const nextLine = context.peekNonBlank();
    if (!nextLine || nextLine.indentLevel !== expectedIndent) {
      break;
    }
    if (!isKeywordLine(nextLine, "elif") && !isKeywordLine(nextLine, "else")) {
      break;
    }
  }

  return {
    type: "if",
    branches,
    span: branches.length > 0 ? mergeSpans(lineSpan(startLine), branches[branches.length - 1].span) : lineSpan(startLine),
  };
}

function readConditionalKeyword(line: ParsedLine): "if" | "elif" | "else" | null {
  if (isKeywordLine(line, "if")) {
    return "if";
  }
  if (isKeywordLine(line, "elif")) {
    return "elif";
  }
  if (isKeywordLine(line, "else")) {
    return "else";
  }
  return null;
}

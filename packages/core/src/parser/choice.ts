import {
  ChoiceBlockAst,
  ChoiceBranchBlockAst,
  ChoiceBranchCaseAst,
  ChoiceOptionAst,
  ChoiceOptionsBlockAst,
  ChoiceStmtAst,
  DialogueStmtAst,
  ExprAst,
} from "../ast";
import { parseConditionHeader } from "./condition-header";
import { parseExpression } from "./expression";
import { ParserContext } from "./parser-context";
import { ParseStatements } from "./parser-types";
import { reportOptionPresentationStyle } from "./presentation-style";
import {
  isBranchLine,
  isKeywordLine,
  lineSpan,
  mergeSpans,
  ParsedLine,
  position,
} from "./source-lines";

export function parseChoiceStatement(
  context: ParserContext,
  prompt: DialogueStmtAst,
  expectedIndent: number,
  parseStatements: ParseStatements,
): ChoiceStmtAst {
  const blocks: ChoiceBlockAst[] = [];

  while (true) {
    context.skipBlankLines();
    const line = context.peek();
    if (!line || line.indentLevel !== expectedIndent) break;

    if (isBranchLine(line)) {
      const options = parseChoiceOptions(context, expectedIndent, parseStatements);
      blocks.push({
        type: "choiceOptionsBlock",
        options,
        span: mergeSpans(options[0].span, options[options.length - 1].span),
      } satisfies ChoiceOptionsBlockAst);
      continue;
    }

    if (isChoiceIfStart(context, expectedIndent)) {
      blocks.push(parseChoiceBranchBlock(context, expectedIndent, parseStatements));
      continue;
    }

    break;
  }

  if (blocks.length === 0) {
    context.report("choice 至少需要一个 '- 选项' 分支", prompt.span, "structure");
  } else if (!blocks.some(isGuaranteedChoiceBlock)) {
    context.report("choice 无法静态保证至少存在一个可用选项", prompt.span, "semantic", "warning");
  }

  return {
    type: "choice",
    style: prompt.style,
    prompt: { ...prompt, style: null },
    blocks,
    span: blocks.length > 0 ? mergeSpans(prompt.span, blocks[blocks.length - 1].span) : prompt.span,
  };
}

function isChoiceIfStart(context: ParserContext, expectedIndent: number): boolean {
  const line = context.peekNonBlank();
  if (!line || line.indentLevel !== expectedIndent || !isKeywordLine(line, "if")) return false;
  const bodyLine = context.peekNonBlank(1);
  return bodyLine?.indentLevel === expectedIndent + 1 && isBranchLine(bodyLine);
}

function isGuaranteedChoiceBlock(block: ChoiceBlockAst): boolean {
  if (block.type === "choiceOptionsBlock") {
    return block.options.some((option) => option.condition === null);
  }

  const fallback = block.branches.find((branch) => branch.keyword === "else");
  return fallback !== undefined
    && block.branches.every((branch) => branch.options.some((option) => option.condition === null));
}

function parseChoiceOptions(
  context: ParserContext,
  optionIndent: number,
  parseStatements: ParseStatements,
): ChoiceOptionAst[] {
  const options: ChoiceOptionAst[] = [];
  while (true) {
    context.skipBlankLines();
    const line = context.peek();
    if (!line || line.indentLevel !== optionIndent || !isBranchLine(line)) break;
    options.push(parseChoiceOption(context, optionIndent, parseStatements));
  }
  return options;
}

function parseChoiceOption(
  context: ParserContext,
  optionIndent: number,
  parseStatements: ParseStatements,
): ChoiceOptionAst {
  const line = context.peek()!;
  const rawOptionText = /^-\s*(.*)$/u.exec(line.trimmed)?.[1] ?? "";
  const parsedSuffix = parseOptionConditionSuffix(context, line, rawOptionText);
  reportOptionPresentationStyle(context, line, parsedSuffix.text);
  const optionSpan = lineSpan(line);
  context.advance();
  const statements = parseStatements(
    optionIndent + 1,
    (candidate) => candidate.indentLevel === optionIndent && isBranchLine(candidate),
  );

  return {
    type: "choiceOption",
    text: parsedSuffix.text,
    condition: parsedSuffix.condition,
    rawCondition: parsedSuffix.rawCondition,
    statements,
    span: statements.length > 0 ? mergeSpans(optionSpan, statements[statements.length - 1].span) : optionSpan,
  };
}

function parseOptionConditionSuffix(
  context: ParserContext,
  line: ParsedLine,
  optionText: string,
): { text: string; condition: ExprAst | null; rawCondition: string | null } {
  const delimiterIndex = findTailIfDelimiter(optionText);
  if (delimiterIndex < 0) {
    return { text: optionText, condition: null, rawCondition: null };
  }

  const rawCondition = optionText.slice(delimiterIndex + 2).trim();
  const optionStart = line.trimmed.indexOf(optionText);
  const conditionStart = optionStart + delimiterIndex + 2;
  const leadingWhitespace = /^\s*/u.exec(optionText.slice(delimiterIndex + 2))?.[0].length ?? 0;
  const parsed = parseExpression(
    rawCondition,
    position(line, line.indentSpaces + conditionStart + leadingWhitespace + 1),
  );
  context.addDiagnostics(parsed.diagnostics);
  return {
    text: optionText.slice(0, delimiterIndex).trimEnd(),
    condition: parsed.expr,
    rawCondition,
  };
}

function findTailIfDelimiter(text: string): number {
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let bracketDepth = 0;
  let result = -1;

  for (let index = 0; index < text.length - 1; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote && char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = quote === char ? null : quote ?? char;
      continue;
    }
    if (quote) continue;
    if (char === "[") {
      bracketDepth += 1;
      continue;
    }
    if (char === "]" && bracketDepth > 0) {
      bracketDepth -= 1;
      continue;
    }
    if (
      bracketDepth === 0
      && text.slice(index, index + 2) === "if"
      && index > 0
      && /\s/u.test(text[index - 1])
      && (index + 2 === text.length || /\s/u.test(text[index + 2]))
    ) {
      result = index;
      index += 1;
    }
  }

  return result;
}

function parseChoiceBranchBlock(
  context: ParserContext,
  expectedIndent: number,
  parseStatements: ParseStatements,
): ChoiceBranchBlockAst {
  const branches: ChoiceBranchCaseAst[] = [];
  const startLine = context.peek()!;

  while (true) {
    context.skipBlankLines();
    const line = context.peek();
    if (!line || line.indentLevel !== expectedIndent) break;
    const keyword = readChoiceBranchKeyword(line);
    if (!keyword) break;
    if (branches.length === 0 && keyword !== "if") break;
    if (branches.some((branch) => branch.keyword === "else")) {
      context.report("else 必须是 choice 条件分支的最后一项", lineSpan(line), "structure");
    }

    let condition: ExprAst | null = null;
    let rawCondition: string | null = null;
    const rest = line.trimmed.slice(keyword.length).trim();
    if (keyword === "else") {
      if (rest) context.report("else 后不能再跟条件表达式", lineSpan(line), "syntax");
    } else {
      const parsed = parseConditionHeader(line, keyword);
      context.addDiagnostics(parsed.diagnostics);
      condition = parsed.condition;
      rawCondition = parsed.rawCondition;
    }

    context.advance();
    const options = parseChoiceBranchOptions(context, expectedIndent, parseStatements, keyword, line);
    branches.push({
      type: "choiceBranchCase",
      keyword,
      condition,
      rawCondition,
      options,
      span: options.length > 0 ? mergeSpans(lineSpan(line), options[options.length - 1].span) : lineSpan(line),
    });

    const next = context.peekNonBlank();
    if (!next || next.indentLevel !== expectedIndent) break;
    if (!isKeywordLine(next, "elif") && !isKeywordLine(next, "else")) break;
  }

  return {
    type: "choiceBranchBlock",
    branches,
    span: mergeSpans(lineSpan(startLine), branches[branches.length - 1].span),
  };
}

function parseChoiceBranchOptions(
  context: ParserContext,
  expectedIndent: number,
  parseStatements: ParseStatements,
  keyword: "if" | "elif" | "else",
  headerLine: ParsedLine,
): ChoiceOptionAst[] {
  const optionIndent = expectedIndent + 1;
  const options: ChoiceOptionAst[] = [];
  while (true) {
    context.skipBlankLines();
    const line = context.peek();
    if (!line || line.indentLevel <= expectedIndent) break;
    if (line.indentLevel === optionIndent && isBranchLine(line)) {
      options.push(parseChoiceOption(context, optionIndent, parseStatements));
      continue;
    }
    context.report(
      line.indentLevel === optionIndent
        ? `${keyword} choice 分支只能包含 '- 选项'`
        : `${keyword} choice 分支中出现了意外的缩进层级`,
      lineSpan(line),
      line.indentLevel === optionIndent ? "structure" : "indentation",
    );
    context.advance();
  }
  if (options.length === 0) {
    context.report(`${keyword} choice 分支至少需要一个缩进的 '- 选项'`, lineSpan(headerLine), "structure");
  }
  return options;
}

function readChoiceBranchKeyword(line: ParsedLine): "if" | "elif" | "else" | null {
  if (isKeywordLine(line, "if")) return "if";
  if (isKeywordLine(line, "elif")) return "elif";
  if (isKeywordLine(line, "else")) return "else";
  return null;
}

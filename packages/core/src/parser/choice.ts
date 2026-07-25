import {
  ChoiceOptionAst,
  ChoiceOptionGroupAst,
  ChoiceStmtAst,
  DialogueStmtAst,
} from "../ast";
import { parseConditionHeader } from "./condition-header";
import { ParserContext } from "./parser-context";
import { ParseStatements } from "./parser-types";
import { reportOptionPresentationStyle } from "./presentation-style";
import {
  isBranchLine,
  isKeywordLine,
  lineSpan,
  mergeSpans,
} from "./source-lines";

export function parseChoiceStatement(
  context: ParserContext,
  prompt: DialogueStmtAst,
  expectedIndent: number,
  parseStatements: ParseStatements,
): ChoiceStmtAst {
  const groups: ChoiceOptionGroupAst[] = [];

  while (true) {
    context.skipBlankLines();
    const line = context.peek();
    if (!line || line.indentLevel !== expectedIndent) {
      break;
    }

    if (isBranchLine(line)) {
      const options = parseChoiceOptions(context, expectedIndent, parseStatements);
      groups.push({
        type: "choiceOptionGroup",
        condition: null,
        rawCondition: null,
        options,
        span: mergeSpans(options[0].span, options[options.length - 1].span),
      });
      continue;
    }

    if (isKeywordLine(line, "when")) {
      groups.push(parseConditionalChoiceGroup(context, expectedIndent, parseStatements));
      continue;
    }

    break;
  }

  if (groups.length === 0) {
    context.report("choice 至少需要一个 '- 选项' 分支", prompt.span, "structure");
  }

  if (groups.length > 0 && groups.every((group) => group.condition !== null)) {
    context.report("choice 全部为条件组选项，运行时可能没有可用选项", prompt.span, "semantic", "warning");
  }

  return {
    type: "choice",
    style: prompt.style,
    prompt: { ...prompt, style: null },
    groups,
    span: groups.length > 0 ? mergeSpans(prompt.span, groups[groups.length - 1].span) : prompt.span,
  };
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
    if (!line || line.indentLevel !== optionIndent || !isBranchLine(line)) {
      break;
    }

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
  const optionText = /^-\s*(.*)$/u.exec(line.trimmed)?.[1] ?? "";
  reportOptionPresentationStyle(context, line, optionText);
  const optionSpan = lineSpan(line);
  context.advance();
  const statements = parseStatements(
    optionIndent + 1,
    (candidate) => candidate.indentLevel === optionIndent && isBranchLine(candidate),
  );

  return {
    type: "choiceOption",
    text: optionText,
    statements,
    span: statements.length > 0 ? mergeSpans(optionSpan, statements[statements.length - 1].span) : optionSpan,
  };
}

function parseConditionalChoiceGroup(
  context: ParserContext,
  expectedIndent: number,
  parseStatements: ParseStatements,
): ChoiceOptionGroupAst {
  const whenLine = context.peek()!;
  const parsedCondition = parseConditionHeader(whenLine, "when");
  context.addDiagnostics(parsedCondition.diagnostics);

  context.advance();
  const optionIndent = expectedIndent + 1;
  const options: ChoiceOptionAst[] = [];

  while (true) {
    context.skipBlankLines();
    const line = context.peek();
    if (!line || line.indentLevel <= expectedIndent) {
      break;
    }

    if (line.indentLevel === optionIndent && isBranchLine(line)) {
      options.push(parseChoiceOption(context, optionIndent, parseStatements));
      continue;
    }

    if (line.indentLevel === optionIndent && isKeywordLine(line, "when")) {
      context.report("when 条件组不允许嵌套", lineSpan(line), "structure");
    } else if (line.indentLevel === optionIndent) {
      context.report("when 条件组只能包含 '- 选项'", lineSpan(line), "structure");
    } else {
      context.report("when 条件组中出现了意外的缩进层级", lineSpan(line), "indentation");
    }
    context.advance();
  }

  if (options.length === 0) {
    context.report("when 条件组至少需要一个缩进的 '- 选项'", lineSpan(whenLine), "structure");
  }

  return {
    type: "choiceOptionGroup",
    condition: parsedCondition.condition,
    rawCondition: parsedCondition.rawCondition,
    options,
    span: options.length > 0 ? mergeSpans(lineSpan(whenLine), options[options.length - 1].span) : lineSpan(whenLine),
  };
}

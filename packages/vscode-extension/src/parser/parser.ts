import {
  BattleOutcomeAst,
  BattleOutcomeName,
  BattleStmtAst,
  ChoiceOptionAst,
  ChoiceStmtAst,
  CommandStmtAst,
  ConditionalBranchAst,
  DiagnosticItem,
  DialogueStmtAst,
  ExprAst,
  IfStmtAst,
  JumpStmtAst,
  ScriptAst,
  SegmentAst,
  SourcePosition,
  SourceSpan,
  StatementAst,
  ValueArgAst,
} from "../ast";
import { parseExpression } from "./expression";
import { parseValueArgAst } from "./value-arg";

interface ParsedLine {
  lineNumber: number;
  rawText: string;
  text: string;
  trimmed: string;
  indentSpaces: number;
  indentLevel: number;
  blank: boolean;
  lineStartOffset: number;
}

export interface ParseStoryResult {
  ast: ScriptAst;
  diagnostics: DiagnosticItem[];
}

const RESERVED_COMMAND_NAMES = new Set([
  "if",
  "elif",
  "else",
  "battle",
  "and",
  "or",
  "not",
  "win",
  "lose",
  "timeout",
]);

function position(line: ParsedLine, column: number): SourcePosition {
  return {
    line: line.lineNumber,
    column,
    offset: line.lineStartOffset + column - 1,
  };
}

function lineSpan(line: ParsedLine, startColumn = 1, endColumn?: number): SourceSpan {
  const end = endColumn ?? line.rawText.length + 1;
  return {
    start: position(line, startColumn),
    end: position(line, end),
  };
}

function mergeSpans(start: SourceSpan, end: SourceSpan): SourceSpan {
  return {
    start: start.start,
    end: end.end,
  };
}

function zeroSpan(): SourceSpan {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
  };
}

function stripComment(text: string): string {
  const commentIndex = text.indexOf("//");
  return commentIndex >= 0 ? text.slice(0, commentIndex) : text;
}

function preprocessLines(text: string): ParsedLine[] {
  const rawLines = text.split(/\r?\n/u);
  const lines: ParsedLine[] = [];
  let offset = 0;

  rawLines.forEach((rawText, index) => {
    const withoutComment = stripComment(rawText);
    let indentSpaces = 0;
    while (indentSpaces < withoutComment.length && withoutComment[indentSpaces] === " ") {
      indentSpaces += 1;
    }

    const textWithoutIndent = withoutComment.slice(indentSpaces);
    const trimmed = textWithoutIndent.trimEnd();
    lines.push({
      lineNumber: index + 1,
      rawText,
      text: textWithoutIndent,
      trimmed,
      indentSpaces,
      indentLevel: Math.floor(indentSpaces / 2),
      blank: trimmed.trim().length === 0,
      lineStartOffset: offset,
    });
    offset += rawText.length + 1;
  });

  return lines;
}

function isSegmentHeader(line: ParsedLine): boolean {
  return line.indentSpaces === 0 && line.trimmed.startsWith("#");
}

function isKeywordLine(line: ParsedLine, keyword: string): boolean {
  return line.trimmed === keyword || line.trimmed.startsWith(`${keyword} `);
}

function isBranchLine(line: ParsedLine): boolean {
  return line.trimmed.startsWith("-");
}

function findDialogueSeparator(text: string): { marker: ":" | "："; index: number } | null {
  const asciiIndex = text.indexOf(":");
  const fullWidthIndex = text.indexOf("：");
  if (asciiIndex === -1 && fullWidthIndex === -1) {
    return null;
  }
  if (asciiIndex === -1) {
    return { marker: "：", index: fullWidthIndex };
  }
  if (fullWidthIndex === -1) {
    return { marker: ":", index: asciiIndex };
  }
  return asciiIndex < fullWidthIndex
    ? { marker: ":", index: asciiIndex }
    : { marker: "：", index: fullWidthIndex };
}

export class StoryParser {
  private readonly lines: ParsedLine[];
  private readonly diagnostics: DiagnosticItem[] = [];
  private index = 0;

  constructor(private readonly text: string) {
    this.lines = preprocessLines(text);
    this.validateIndentation();
  }

  parse(): ParseStoryResult {
    const segments: SegmentAst[] = [];
    const seenSegments = new Map<string, SourceSpan>();

    while (true) {
      this.skipBlankLines();
      const line = this.peek();
      if (!line) {
        break;
      }

      if (!isSegmentHeader(line)) {
        this.pushDiagnostic("剧情段必须以顶格 '# 段名' 开始", lineSpan(line), "structure");
        this.index += 1;
        continue;
      }

      const segment = this.parseSegment();
      if (segment) {
        if (seenSegments.has(segment.name)) {
          this.pushDiagnostic(`重复的剧情段名 '${segment.name}'`, segment.headerSpan, "duplicate");
        } else {
          seenSegments.set(segment.name, segment.headerSpan);
        }
        segments.push(segment);
      }
    }

    return {
      ast: {
        type: "script",
        span:
          segments.length > 0 ? mergeSpans(segments[0].span, segments[segments.length - 1].span) : zeroSpan(),
        segments,
      },
      diagnostics: this.diagnostics,
    };
  }

  private validateIndentation(): void {
    for (const line of this.lines) {
      if (line.rawText.includes("\t")) {
        this.pushDiagnostic("禁止使用 Tab 缩进，请统一使用 2 个空格", lineSpan(line), "indentation");
      }
      if (line.indentSpaces % 2 !== 0) {
        this.pushDiagnostic("缩进必须是 2 个空格的整数倍", lineSpan(line), "indentation");
      }
    }
  }

  private parseSegment(): SegmentAst | null {
    const headerLine = this.peek();
    if (!headerLine) {
      return null;
    }

    const rawName = headerLine.trimmed.slice(1);
    const name = rawName.trim();
    if (!name) {
      this.pushDiagnostic("剧情段名不能为空", lineSpan(headerLine), "syntax");
    }

    this.index += 1;
    const statements = this.parseStatements(0, (line) => isSegmentHeader(line));
    const endSpan = statements.length > 0 ? statements[statements.length - 1].span : lineSpan(headerLine);

    return {
      type: "segment",
      name,
      rawName,
      headerSpan: lineSpan(headerLine),
      span: mergeSpans(lineSpan(headerLine), endSpan),
      statements,
    };
  }

  private parseStatements(expectedIndent: number, shouldStop: (line: ParsedLine) => boolean): StatementAst[] {
    const statements: StatementAst[] = [];

    while (true) {
      this.skipBlankLines();
      const line = this.peek();
      if (!line) {
        break;
      }
      if (shouldStop(line)) {
        break;
      }
      if (line.indentLevel < expectedIndent) {
        break;
      }
      if (line.indentLevel > expectedIndent) {
        this.pushDiagnostic("出现了意外的缩进层级", lineSpan(line), "indentation");
        this.index += 1;
        continue;
      }

      const statement = this.parseStatement(expectedIndent);
      if (statement) {
        statements.push(statement);
      }
    }

    return statements;
  }

  private parseStatement(expectedIndent: number): StatementAst | null {
    const line = this.peek();
    if (!line) {
      return null;
    }

    if (isKeywordLine(line, "elif") || isKeywordLine(line, "else")) {
      this.pushDiagnostic("elif/else 必须紧跟在同级 if 之后", lineSpan(line), "structure");
      this.index += 1;
      return null;
    }

    if (isKeywordLine(line, "if")) {
      return this.parseIfStatement(expectedIndent);
    }

    if (isKeywordLine(line, "battle")) {
      return this.parseBattleStatement(expectedIndent);
    }

    if (isBranchLine(line)) {
      this.pushDiagnostic("'- xxx' 只能作为 choice 或 battle 的子结构出现", lineSpan(line), "structure");
      this.index += 1;
      return null;
    }

    const simpleStatement = this.parseSimpleStatement(line);
    this.index += 1;

    if (simpleStatement?.type === "dialogue") {
      const nextLine = this.peekNonBlank();
      if (nextLine && nextLine.indentLevel === expectedIndent && isBranchLine(nextLine)) {
        return this.parseChoiceStatement(simpleStatement, expectedIndent);
      }
    }

    return simpleStatement;
  }

  private parseSimpleStatement(line: ParsedLine): StatementAst | null {
    const dialogueSeparator = findDialogueSeparator(line.trimmed);
    if (dialogueSeparator) {
      return {
        type: "dialogue",
        speaker: line.trimmed.slice(0, dialogueSeparator.index).trim(),
        text: line.trimmed.slice(dialogueSeparator.index + 1).trim(),
        marker: dialogueSeparator.marker,
        raw: line.trimmed,
        span: lineSpan(line),
      } satisfies DialogueStmtAst;
    }

    const parts = line.trimmed.split(/\s+/u).filter(Boolean);
    if (parts.length === 0) {
      return null;
    }

    const name = parts[0];
    if (name === "jump") {
      const target = line.trimmed.slice(name.length).trim();
      if (!target) {
        this.pushDiagnostic("jump 之后必须提供目标段名", lineSpan(line), "syntax");
      }
      return {
        type: "jump",
        target,
        raw: line.trimmed,
        span: lineSpan(line),
      } satisfies JumpStmtAst;
    }

    if (RESERVED_COMMAND_NAMES.has(name)) {
      this.pushDiagnostic(`'${name}' 是保留字，不能作为命令名`, lineSpan(line), "semantic");
    }

    return {
      type: "command",
      name,
      args: parts.slice(1).map((part) => parseValueArgAst(part, lineSpan(line))),
      raw: line.trimmed,
      span: lineSpan(line),
    } satisfies CommandStmtAst;
  }

  private parseChoiceStatement(prompt: DialogueStmtAst, expectedIndent: number): ChoiceStmtAst {
    const options: ChoiceOptionAst[] = [];

    while (true) {
      this.skipBlankLines();
      const line = this.peek();
      if (!line || line.indentLevel !== expectedIndent || !isBranchLine(line)) {
        break;
      }

      const optionText = /^-\s*(.*)$/u.exec(line.trimmed)?.[1] ?? "";
      const optionSpan = lineSpan(line);
      this.index += 1;
      const statements = this.parseStatements(
        expectedIndent + 1,
        (candidate) => candidate.indentLevel === expectedIndent && isBranchLine(candidate),
      );
      options.push({
        type: "choiceOption",
        text: optionText,
        statements,
        span: statements.length > 0 ? mergeSpans(optionSpan, statements[statements.length - 1].span) : optionSpan,
      });
    }

    if (options.length === 0) {
      this.pushDiagnostic("choice 至少需要一个 '- 选项' 分支", prompt.span, "structure");
    }

    return {
      type: "choice",
      prompt,
      options,
      span: options.length > 0 ? mergeSpans(prompt.span, options[options.length - 1].span) : prompt.span,
    };
  }

  private parseBattleStatement(expectedIndent: number): BattleStmtAst {
    const headerLine = this.peek()!;
    const battleId = headerLine.trimmed.slice("battle".length).trim();
    if (!battleId) {
      this.pushDiagnostic("battle 之后必须提供战斗名", lineSpan(headerLine), "syntax");
    }
    this.index += 1;

    const outcomes: BattleOutcomeAst[] = [];
    const seenOutcomes = new Set<BattleOutcomeName>();

    while (true) {
      this.skipBlankLines();
      const line = this.peek();
      if (!line || line.indentLevel !== expectedIndent || !isBranchLine(line)) {
        break;
      }

      const rawOutcome = (/^-\s*(.*)$/u.exec(line.trimmed)?.[1] ?? "").trim();
      const outcomeSpan = lineSpan(line);
      this.index += 1;

      if (rawOutcome !== "win" && rawOutcome !== "lose" && rawOutcome !== "timeout") {
        this.pushDiagnostic("battle 分支只允许 win / lose / timeout", outcomeSpan, "semantic");
        this.parseStatements(
          expectedIndent + 1,
          (candidate) => candidate.indentLevel === expectedIndent && isBranchLine(candidate),
        );
        continue;
      }

      if (seenOutcomes.has(rawOutcome)) {
        this.pushDiagnostic(`battle 结果分支 '${rawOutcome}' 重复`, outcomeSpan, "duplicate");
      }
      seenOutcomes.add(rawOutcome);

      const statements = this.parseStatements(
        expectedIndent + 1,
        (candidate) => candidate.indentLevel === expectedIndent && isBranchLine(candidate),
      );
      outcomes.push({
        type: "battleOutcome",
        outcome: rawOutcome,
        statements,
        span: statements.length > 0 ? mergeSpans(outcomeSpan, statements[statements.length - 1].span) : outcomeSpan,
      });
    }

    if (outcomes.length === 0) {
      this.pushDiagnostic("battle 至少需要一个结果分支", lineSpan(headerLine), "structure");
    }

    return {
      type: "battle",
      battleId,
      outcomes,
      raw: headerLine.trimmed,
      span: outcomes.length > 0 ? mergeSpans(lineSpan(headerLine), outcomes[outcomes.length - 1].span) : lineSpan(headerLine),
    };
  }

  private parseIfStatement(expectedIndent: number): IfStmtAst {
    const branches: ConditionalBranchAst[] = [];
    const startLine = this.peek()!;

    while (true) {
      this.skipBlankLines();
      const line = this.peek();
      if (!line || line.indentLevel !== expectedIndent) {
        break;
      }

      const keyword = this.readConditionalKeyword(line);
      if (!keyword) {
        break;
      }

      if (branches.length === 0 && keyword !== "if") {
        this.pushDiagnostic("条件分支必须从 if 开始", lineSpan(line), "structure");
      }
      if (branches.some((branch) => branch.keyword === "else")) {
        this.pushDiagnostic("else 必须是条件分支的最后一项", lineSpan(line), "structure");
      }

      const rest = line.trimmed.slice(keyword.length).trim();
      let condition: ExprAst | null = null;
      let rawCondition: string | null = null;
      if (keyword === "else") {
        if (rest.length > 0) {
          this.pushDiagnostic("else 后不能再跟条件表达式", lineSpan(line), "syntax");
        }
      } else {
        rawCondition = rest;
        if (!rawCondition) {
          this.pushDiagnostic(`${keyword} 后缺少条件表达式`, lineSpan(line), "syntax");
        } else {
          const startColumn = line.indentSpaces + 1 + line.text.indexOf(rawCondition);
          const expressionResult = parseExpression(rawCondition, position(line, startColumn + 1));
          condition = expressionResult.expr;
          this.diagnostics.push(...expressionResult.diagnostics);
        }
      }

      this.index += 1;
      const statements = this.parseStatements(
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

      const nextLine = this.peekNonBlank();
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

  private readConditionalKeyword(line: ParsedLine): "if" | "elif" | "else" | null {
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

  private skipBlankLines(): void {
    while (this.peek()?.blank) {
      this.index += 1;
    }
  }

  private peek(): ParsedLine | undefined {
    return this.lines[this.index];
  }

  private peekNonBlank(): ParsedLine | undefined {
    let cursor = this.index;
    while (cursor < this.lines.length) {
      const line = this.lines[cursor];
      if (!line.blank) {
        return line;
      }
      cursor += 1;
    }
    return undefined;
  }

  private pushDiagnostic(message: string, span: SourceSpan, code: DiagnosticItem["code"]): void {
    this.diagnostics.push({
      message,
      span,
      code,
      severity: "error",
    });
  }
}

export function parseStory(text: string): ParseStoryResult {
  return new StoryParser(text).parse();
}

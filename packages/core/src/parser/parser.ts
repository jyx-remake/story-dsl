import {
  CallStmtAst,
  CommandStmtAst,
  DiagnosticItem,
  DialogueStmtAst,
  JumpStmtAst,
  ReturnStmtAst,
  ScriptAst,
  SegmentAst,
  SourceSpan,
  StatementAst,
} from "../ast";
import { parseBattleStatement } from "./battle";
import { parseChoiceStatement } from "./choice";
import { parseIfStatement } from "./conditional";
import { parsePresentationStyle } from "./presentation-style";
import {
  findDialogueSeparator,
  isBranchLine,
  isKeywordLine,
  isSegmentHeader,
  lineSpan,
  mergeSpans,
  ParsedLine,
  position,
  zeroSpan,
} from "./source-lines";
import { ParserContext } from "./parser-context";
import { parseCall } from "./expression";

export interface ParseStoryResult {
  ast: ScriptAst;
  diagnostics: DiagnosticItem[];
}

const RESERVED_COMMAND_NAMES = new Set([
  "if", "elif", "else", "when", "battle", "jump", "call", "return", "win", "lose", "timeout",
]);

export class StoryParser {
  private readonly context: ParserContext;

  constructor(text: string) {
    this.context = new ParserContext(text);
    this.validateIndentation();
  }

  parse(): ParseStoryResult {
    const segments: SegmentAst[] = [];
    const seenSegments = new Map<string, SourceSpan>();

    while (true) {
      this.context.skipBlankLines();
      const line = this.context.peek();
      if (!line) {
        break;
      }

      if (!isSegmentHeader(line)) {
        this.context.report("剧情段必须以顶格 '# 段名' 开始", lineSpan(line), "structure");
        this.context.advance();
        continue;
      }

      const segment = this.parseSegment();
      if (segment) {
        if (seenSegments.has(segment.name)) {
          this.context.report(`重复的剧情段名 '${segment.name}'`, segment.headerSpan, "duplicate");
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
      diagnostics: this.context.diagnostics,
    };
  }

  private validateIndentation(): void {
    for (const line of this.context.lines) {
      if (line.rawText.includes("\t")) {
        this.context.report("禁止使用 Tab 缩进，请统一使用 2 个空格", lineSpan(line), "indentation");
      }
      if (line.indentSpaces % 2 !== 0) {
        this.context.report("缩进必须是 2 个空格的整数倍", lineSpan(line), "indentation");
      }
    }
  }

  private parseSegment(): SegmentAst | null {
    const headerLine = this.context.peek();
    if (!headerLine) {
      return null;
    }

    const rawName = headerLine.trimmed.slice(1);
    const name = rawName.trim();
    if (!name) {
      this.context.report("剧情段名不能为空", lineSpan(headerLine), "syntax");
    }

    this.context.advance();
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
      this.context.skipBlankLines();
      const line = this.context.peek();
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
        this.context.report("出现了意外的缩进层级", lineSpan(line), "indentation");
        this.context.advance();
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
    const line = this.context.peek();
    if (!line) {
      return null;
    }

    if (isKeywordLine(line, "elif") || isKeywordLine(line, "else")) {
      this.context.report("elif/else 必须紧跟在同级 if 之后", lineSpan(line), "structure");
      this.context.advance();
      return null;
    }

    if (isKeywordLine(line, "if")) {
      return parseIfStatement(
        this.context,
        expectedIndent,
        (indent, shouldStop) => this.parseStatements(indent, shouldStop),
      );
    }

    if (isKeywordLine(line, "when")) {
      this.context.report("when 只能作为 choice 的条件组选项出现", lineSpan(line), "structure");
      this.context.advance();
      return null;
    }

    if (isKeywordLine(line, "battle")) {
      return parseBattleStatement(
        this.context,
        expectedIndent,
        (indent, shouldStop) => this.parseStatements(indent, shouldStop),
      );
    }

    if (isBranchLine(line)) {
      this.context.report("'- xxx' 只能作为 choice 或 battle 的子结构出现", lineSpan(line), "structure");
      this.context.advance();
      return null;
    }

    const simpleStatement = this.parseSimpleStatement(line);
    this.context.advance();

    if (simpleStatement?.type === "dialogue") {
      const nextLine = this.context.peekNonBlank();
      if (
        nextLine &&
        nextLine.indentLevel === expectedIndent &&
        (isBranchLine(nextLine) || isKeywordLine(nextLine, "when"))
      ) {
        return parseChoiceStatement(
          this.context,
          simpleStatement,
          expectedIndent,
          (indent, shouldStop) => this.parseStatements(indent, shouldStop),
        );
      }
    }

    return simpleStatement;
  }

  private parseSimpleStatement(line: ParsedLine): StatementAst | null {
    const dialogueSeparator = findDialogueSeparator(line.trimmed);
    const looksLikeCommandCall = /^[a-z_][a-z0-9_]*\s*\(/u.test(line.trimmed);
    if (dialogueSeparator && !looksLikeCommandCall) {
      const rawContent = line.trimmed.slice(dialogueSeparator.index + 1);
      const leadingWhitespace = /^\s*/u.exec(rawContent)?.[0].length ?? 0;
      const parsedContent = parsePresentationStyle(
        this.context,
        line,
        rawContent.slice(leadingWhitespace),
        line.indentSpaces + dialogueSeparator.index + 2 + leadingWhitespace,
      );
      return {
        type: "dialogue",
        speaker: line.trimmed.slice(0, dialogueSeparator.index).trim(),
        text: parsedContent.text,
        style: parsedContent.style,
        marker: dialogueSeparator.marker,
        raw: line.trimmed,
        span: lineSpan(line),
      } satisfies DialogueStmtAst;
    }

    const statementMatch = /^(\S+)(?:\s+(.*))?$/u.exec(line.trimmed);
    if (!statementMatch) {
      return null;
    }

    const name = statementMatch[1];
    if (name === "jump") {
      const target = line.trimmed.slice(name.length).trim();
      if (!target) {
        this.context.report("jump 之后必须提供目标段名", lineSpan(line), "syntax");
      }
      return {
        type: "jump",
        target,
        raw: line.trimmed,
        span: lineSpan(line),
      } satisfies JumpStmtAst;
    }

    if (name === "call") {
      const target = line.trimmed.slice(name.length).trim();
      if (!target) {
        this.context.report("call 之后必须提供目标段名", lineSpan(line), "syntax");
      }
      return {
        type: "call",
        target,
        raw: line.trimmed,
        span: lineSpan(line),
      } satisfies CallStmtAst;
    }

    if (name === "return") {
      const rest = line.trimmed.slice(name.length).trim();
      if (rest) {
        this.context.report("return 后不能跟参数", lineSpan(line), "syntax");
      }
      return {
        type: "return",
        raw: line.trimmed,
        span: lineSpan(line),
      } satisfies ReturnStmtAst;
    }

    const callSource = line.trimmed;
    const parsedCall = parseCall(callSource, position(line, line.indentSpaces + 1));
    this.context.addDiagnostics(parsedCall.diagnostics);
    if (parsedCall.call && RESERVED_COMMAND_NAMES.has(parsedCall.call.name)) {
      this.context.report(`'${parsedCall.call.name}' 是 DSL 保留字，不能作为命令名`, parsedCall.call.span, "semantic");
    }

    return {
      type: "command",
      call: parsedCall.call,
      callSource,
      raw: line.trimmed,
      span: lineSpan(line),
    } satisfies CommandStmtAst;
  }

}

export function parseStory(text: string): ParseStoryResult {
  return new StoryParser(text).parse();
}

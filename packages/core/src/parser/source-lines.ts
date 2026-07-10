import { SourcePosition, SourceSpan } from "../ast";

export interface ParsedLine {
  lineNumber: number;
  rawText: string;
  text: string;
  trimmed: string;
  indentSpaces: number;
  indentLevel: number;
  blank: boolean;
  lineStartOffset: number;
}

export class LineCursor {
  readonly lines: ParsedLine[];
  private index = 0;

  constructor(text: string) {
    this.lines = preprocessLines(text);
  }

  peek(): ParsedLine | undefined {
    return this.lines[this.index];
  }

  peekNonBlank(): ParsedLine | undefined {
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

  skipBlankLines(): void {
    while (this.peek()?.blank) {
      this.advance();
    }
  }

  advance(): void {
    this.index += 1;
  }
}

export function position(line: ParsedLine, column: number): SourcePosition {
  return {
    line: line.lineNumber,
    column,
    offset: line.lineStartOffset + column - 1,
  };
}

export function lineSpan(line: ParsedLine, startColumn = 1, endColumn?: number): SourceSpan {
  const end = endColumn ?? line.rawText.length + 1;
  return {
    start: position(line, startColumn),
    end: position(line, end),
  };
}

export function mergeSpans(start: SourceSpan, end: SourceSpan): SourceSpan {
  return {
    start: start.start,
    end: end.end,
  };
}

export function zeroSpan(): SourceSpan {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
  };
}

export function isSegmentHeader(line: ParsedLine): boolean {
  return line.indentSpaces === 0 && line.trimmed.startsWith("#");
}

export function isKeywordLine(line: ParsedLine, keyword: string): boolean {
  return line.trimmed === keyword || line.trimmed.startsWith(`${keyword} `);
}

export function isBranchLine(line: ParsedLine): boolean {
  return line.trimmed.startsWith("-");
}

export function findDialogueSeparator(text: string): { marker: ":" | "："; index: number } | null {
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

function stripComment(text: string): string {
  const commentIndex = text.indexOf("//");
  return commentIndex >= 0 ? text.slice(0, commentIndex) : text;
}

import {
  BinaryExprAst,
  CallExprAst,
  DiagnosticItem,
  ExprAst,
  IdentifierExprAst,
  ListExprAst,
  LiteralExprAst,
  SourcePosition,
  SourceSpan,
  UnaryExprAst,
} from "../ast";

type TokenType =
  | "identifier"
  | "number"
  | "string"
  | "true"
  | "false"
  | "and"
  | "or"
  | "not"
  | "in"
  | "lparen"
  | "rparen"
  | "lbracket"
  | "rbracket"
  | "comma"
  | "plus"
  | "minus"
  | "star"
  | "slash"
  | "percent"
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "notIn"
  | "eof"
  | "invalid";

interface Token {
  type: TokenType;
  lexeme: string;
  start: number;
  end: number;
  value?: string | number | boolean;
  error?: string;
}

export interface ParseExpressionResult {
  expr: ExprAst | null;
  diagnostics: DiagnosticItem[];
}

export interface ParseCallResult {
  call: CallExprAst | null;
  diagnostics: DiagnosticItem[];
}

const RESERVED_WORDS = new Set(["true", "false", "in", "not", "and", "or"]);

function offsetPosition(base: SourcePosition, offset: number): SourcePosition {
  return { line: base.line, column: base.column + offset, offset: base.offset + offset };
}

function spanFromRange(base: SourcePosition, start: number, end: number): SourceSpan {
  return {
    start: offsetPosition(base, start),
    end: offsetPosition(base, Math.max(start + 1, end)),
  };
}

function mergeSpans(left: SourceSpan, right: SourceSpan): SourceSpan {
  return { start: left.start, end: right.end };
}

function isIdentifierStart(char: string): boolean {
  return char === "_" || (char >= "a" && char <= "z");
}

function isIdentifierPart(char: string): boolean {
  return isIdentifierStart(char) || /\d/u.test(char);
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  const push = (type: TokenType, length: number): void => {
    tokens.push({ type, lexeme: text.slice(index, index + length), start: index, end: index + length });
    index += length;
  };

  while (index < text.length) {
    const char = text[index];
    if (/\s/u.test(char)) {
      index += 1;
      continue;
    }

    const pair = text.slice(index, index + 2);
    const pairType: Partial<Record<string, TokenType>> = {
      "&&": "and", "||": "or", "==": "eq", "!=": "ne", ">=": "gte", "<=": "lte", "!i": "invalid",
    };
    if (text.startsWith("!in", index) && !isIdentifierPart(text[index + 3] ?? "")) {
      push("notIn", 3);
      continue;
    }
    if (pairType[pair] && pair !== "!i") {
      push(pairType[pair]!, 2);
      continue;
    }

    const singleType: Partial<Record<string, TokenType>> = {
      "(": "lparen", ")": "rparen", "[": "lbracket", "]": "rbracket", ",": "comma",
      "+": "plus", "-": "minus", "*": "star", "/": "slash", "%": "percent",
      "!": "not", ">": "gt", "<": "lt",
    };
    if (singleType[char]) {
      push(singleType[char]!, 1);
      continue;
    }

    if (char === "'" || char === "\"") {
      const start = index;
      const quote = char;
      index += 1;
      let value = "";
      let error: string | undefined;
      while (index < text.length && text[index] !== quote) {
        if (text[index] !== "\\") {
          value += text[index++];
          continue;
        }
        index += 1;
        if (index >= text.length) {
          error = "字符串转义不完整";
          break;
        }
        const escaped = text[index++];
        const simpleEscapes: Record<string, string> = {
          "\\": "\\", "'": "'", "\"": "\"", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t",
        };
        if (escaped === "u") {
          const hex = text.slice(index, index + 4);
          if (!/^[0-9a-fA-F]{4}$/u.test(hex)) {
            error = "Unicode 转义必须包含 4 位十六进制数字";
            break;
          }
          value += String.fromCharCode(Number.parseInt(hex, 16));
          index += 4;
        } else if (simpleEscapes[escaped] !== undefined) {
          value += simpleEscapes[escaped];
        } else {
          error = `不支持的字符串转义 '\\${escaped}'`;
          break;
        }
      }
      if (!error && text[index] === quote) {
        index += 1;
      } else if (!error) {
        error = `字符串缺少结束引号 ${quote}`;
      }
      tokens.push({ type: error ? "invalid" : "string", lexeme: text.slice(start, index), start, end: index, value, error });
      continue;
    }

    if (/\d/u.test(char) || (char === "." && /\d/u.test(text[index + 1] ?? ""))) {
      const start = index;
      const match = /^(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?/u.exec(text.slice(index));
      const lexeme = match?.[0] ?? char;
      index += lexeme.length;
      const value = Number(lexeme);
      tokens.push({
        type: Number.isFinite(value) ? "number" : "invalid",
        lexeme,
        start,
        end: index,
        value,
        error: Number.isFinite(value) ? undefined : "数值必须是有限 Number",
      });
      continue;
    }

    if (isIdentifierStart(char)) {
      const start = index++;
      while (isIdentifierPart(text[index] ?? "")) index += 1;
      const lexeme = text.slice(start, index);
      const keywords: Partial<Record<string, TokenType>> = {
        true: "true", false: "false", and: "and", or: "or", not: "not", in: "in",
      };
      const type = keywords[lexeme] ?? "identifier";
      tokens.push({ type, lexeme, start, end: index, value: type === "true" ? true : type === "false" ? false : undefined });
      continue;
    }

    const start = index++;
    while (index < text.length && !/\s/u.test(text[index]) && !"()[],+-*/%!<>=&|".includes(text[index])) index += 1;
    tokens.push({ type: "invalid", lexeme: text.slice(start, index), start, end: index, error: "标识符只能使用小写 ASCII、数字和下划线，且不能以数字开头" });
  }

  tokens.push({ type: "eof", lexeme: "", start: text.length, end: text.length });
  return tokens;
}

class ExpressionParser {
  private readonly tokens: Token[];
  private readonly diagnostics: DiagnosticItem[] = [];
  private index = 0;

  constructor(private readonly text: string, private readonly base: SourcePosition) {
    this.tokens = tokenize(text);
  }

  parse(): ParseExpressionResult {
    const expr = this.parseOr();
    if (!expr && this.peek().type === "eof") this.error(this.peek(), "表达式不能为空");
    if (this.peek().type !== "eof") this.error(this.peek(), "表达式存在无法解析的尾随内容");
    return { expr, diagnostics: this.diagnostics };
  }

  private parseOr(): ExprAst | null { return this.parseBinary(() => this.parseAnd(), [["or", "or"]]); }
  private parseAnd(): ExprAst | null { return this.parseBinary(() => this.parseEquality(), [["and", "and"]]); }
  private parseEquality(): ExprAst | null { return this.parseBinary(() => this.parseComparison(), [["eq", "=="], ["ne", "!="]]); }
  private parseComparison(): ExprAst | null {
    return this.parseBinary(() => this.parseAdditive(), [
      ["lte", "<="], ["gte", ">="], ["lt", "<"], ["gt", ">"], ["in", "in"], ["notIn", "not in"],
    ], true);
  }
  private parseAdditive(): ExprAst | null { return this.parseBinary(() => this.parseMultiplicative(), [["plus", "+"], ["minus", "-"]]); }
  private parseMultiplicative(): ExprAst | null { return this.parseBinary(() => this.parseUnary(), [["star", "*"], ["slash", "/"], ["percent", "%"]]); }

  private parseBinary(
    operand: () => ExprAst | null,
    operators: Array<[TokenType, BinaryExprAst["operator"]]>,
    includeTextualNotIn = false,
  ): ExprAst | null {
    let expr = operand();
    while (true) {
      let entry = operators.find(([type]) => this.peek().type === type);
      let textualNotIn = false;
      if (!entry && includeTextualNotIn && this.peek().type === "not" && this.peek(1).type === "in") {
        entry = ["notIn", "not in"];
        textualNotIn = true;
      }
      if (!entry) return expr;
      const operatorToken = this.advance();
      if (textualNotIn) this.advance();
      const right = operand();
      if (!expr || !right) {
        this.error(operatorToken, "二元运算符两侧都必须有表达式");
        return expr ?? right;
      }
      expr = {
        type: "binary", operator: entry[1], rawOperator: textualNotIn ? "not in" : operatorToken.lexeme,
        left: expr, right, span: mergeSpans(expr.span, right.span),
      };
    }
  }

  private parseUnary(): ExprAst | null {
    const map: Partial<Record<TokenType, UnaryExprAst["operator"]>> = { not: "not", plus: "+", minus: "-" };
    const operator = map[this.peek().type];
    if (!operator) return this.parsePrimary();
    const token = this.advance();
    const operand = this.parseUnary();
    if (!operand) {
      this.error(token, "一元运算符后缺少表达式");
      return null;
    }
    return { type: "unary", operator, rawOperator: token.lexeme, operand, span: mergeSpans(spanFromRange(this.base, token.start, token.end), operand.span) };
  }

  private parsePrimary(): ExprAst | null {
    const token = this.peek();
    if (token.type === "invalid") {
      this.error(token, token.error ?? `无法识别 '${token.lexeme}'`);
      this.advance();
      return null;
    }
    if (this.match("true") || this.match("false") || this.match("number") || this.match("string")) {
      const literal = this.previous();
      const valueType = literal.type === "number" ? "number" : literal.type === "string" ? "string" : "boolean";
      return { type: "literal", value: literal.value!, valueType, span: spanFromRange(this.base, literal.start, literal.end) } satisfies LiteralExprAst;
    }
    if (this.match("identifier")) {
      const identifier = this.previous();
      if (!this.match("lparen")) {
        return { type: "identifier", name: identifier.lexeme, span: spanFromRange(this.base, identifier.start, identifier.end) } satisfies IdentifierExprAst;
      }
      const args = this.parseSeparated("rparen", "函数参数");
      const end = this.previous().type === "rparen" ? this.previous().end : identifier.end;
      return { type: "callExpr", name: identifier.lexeme, args, span: spanFromRange(this.base, identifier.start, end) } satisfies CallExprAst;
    }
    if (this.match("lbracket")) {
      const start = this.previous();
      const items = this.parseSeparated("rbracket", "列表");
      const end = this.previous().type === "rbracket" ? this.previous().end : start.end;
      return { type: "list", items, span: spanFromRange(this.base, start.start, end) } satisfies ListExprAst;
    }
    if (this.match("lparen")) {
      const expression = this.parseOr();
      if (!this.match("rparen")) this.error(this.peek(), "缺少右括号 ')'");
      return expression;
    }
    if (token.type !== "eof" && token.type !== "rparen" && token.type !== "rbracket" && token.type !== "comma") {
      this.error(token, `无法识别的表达式片段 '${token.lexeme}'`);
      this.advance();
    }
    return null;
  }

  private parseSeparated(endType: "rparen" | "rbracket", description: string): ExprAst[] {
    const items: ExprAst[] = [];
    if (this.match(endType)) return items;
    while (this.peek().type !== "eof") {
      const item = this.parseOr();
      if (item) items.push(item);
      if (this.match(endType)) return items;
      if (!this.match("comma")) {
        this.error(this.peek(), `${description}之间必须使用 ',' 分隔`);
        if (this.peek().type !== "eof") this.advance();
        continue;
      }
      if (this.match(endType)) {
        this.error(this.previous(), `${description}分隔符后缺少表达式`);
        return items;
      }
    }
    this.error(this.peek(), endType === "rparen" ? "缺少右括号 ')'" : "列表缺少右方括号 ']'");
    return items;
  }

  private match(type: TokenType): boolean { if (this.peek().type !== type) return false; this.advance(); return true; }
  private advance(): Token { const token = this.tokens[this.index]; if (this.index < this.tokens.length - 1) this.index += 1; return token; }
  private previous(): Token { return this.tokens[Math.max(0, this.index - 1)]; }
  private peek(ahead = 0): Token { return this.tokens[Math.min(this.index + ahead, this.tokens.length - 1)]; }
  private error(token: Token, message: string): void {
    this.diagnostics.push({ message, severity: "error", code: "syntax", span: spanFromRange(this.base, token.start, token.end) });
  }
}

export function parseExpression(text: string, base: SourcePosition): ParseExpressionResult {
  return new ExpressionParser(text, base).parse();
}

export function parseCall(text: string, base: SourcePosition): ParseCallResult {
  const parsed = parseExpression(text, base);
  if (parsed.expr?.type === "callExpr") return { call: parsed.expr, diagnostics: parsed.diagnostics };
  if (parsed.expr && parsed.diagnostics.length === 0) {
    parsed.diagnostics.push({
      message: "命令必须是函数调用",
      severity: "error",
      code: "syntax",
      span: parsed.expr.span,
    });
  }
  return { call: null, diagnostics: parsed.diagnostics };
}

export function isReservedExpressionWord(value: string): boolean {
  return RESERVED_WORDS.has(value);
}

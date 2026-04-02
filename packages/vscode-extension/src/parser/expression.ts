import {
  BinaryExprAst,
  ComparisonExprAst,
  DiagnosticItem,
  ExprAst,
  LiteralExprAst,
  PredicateCallExprAst,
  SourcePosition,
  SourceSpan,
  UnaryExprAst,
  ValueArgAst,
  VariableExprAst,
} from "../ast";
import { parseValueArgAst } from "./value-arg";

type TokenType =
  | "identifier"
  | "variable"
  | "number"
  | "and"
  | "or"
  | "not"
  | "lparen"
  | "rparen"
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "eof";

interface Token {
  type: TokenType;
  lexeme: string;
  start: number;
  end: number;
}

interface ParseResult {
  expr: ExprAst | null;
  diagnostics: DiagnosticItem[];
}

const BOUNDARY_CHARS = new Set(["(", ")", "!", "<", ">", "=", "&", "|"]);

function offsetPosition(base: SourcePosition, relativeOffset: number): SourcePosition {
  return {
    line: base.line,
    column: base.column + relativeOffset,
    offset: base.offset + relativeOffset,
  };
}

function spanFromRange(base: SourcePosition, start: number, end: number): SourceSpan {
  return {
    start: offsetPosition(base, start),
    end: offsetPosition(base, end),
  };
}

function mergeSpans(start: SourceSpan, end: SourceSpan): SourceSpan {
  return {
    start: start.start,
    end: end.end,
  };
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (/\s/u.test(char)) {
      index += 1;
      continue;
    }

    const nextTwo = text.slice(index, index + 2);
    if (nextTwo === "&&") {
      tokens.push({ type: "and", lexeme: "&&", start: index, end: index + 2 });
      index += 2;
      continue;
    }
    if (nextTwo === "||") {
      tokens.push({ type: "or", lexeme: "||", start: index, end: index + 2 });
      index += 2;
      continue;
    }
    if (nextTwo === "==") {
      tokens.push({ type: "eq", lexeme: "==", start: index, end: index + 2 });
      index += 2;
      continue;
    }
    if (nextTwo === "!=") {
      tokens.push({ type: "ne", lexeme: "!=", start: index, end: index + 2 });
      index += 2;
      continue;
    }
    if (nextTwo === ">=") {
      tokens.push({ type: "gte", lexeme: ">=", start: index, end: index + 2 });
      index += 2;
      continue;
    }
    if (nextTwo === "<=") {
      tokens.push({ type: "lte", lexeme: "<=", start: index, end: index + 2 });
      index += 2;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "lparen", lexeme: char, start: index, end: index + 1 });
      index += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rparen", lexeme: char, start: index, end: index + 1 });
      index += 1;
      continue;
    }
    if (char === "!") {
      tokens.push({ type: "not", lexeme: char, start: index, end: index + 1 });
      index += 1;
      continue;
    }
    if (char === ">") {
      tokens.push({ type: "gt", lexeme: char, start: index, end: index + 1 });
      index += 1;
      continue;
    }
    if (char === "<") {
      tokens.push({ type: "lt", lexeme: char, start: index, end: index + 1 });
      index += 1;
      continue;
    }

    if (char === "$") {
      let end = index + 1;
      while (end < text.length && !/\s/u.test(text[end]) && !BOUNDARY_CHARS.has(text[end])) {
        end += 1;
      }
      tokens.push({ type: "variable", lexeme: text.slice(index, end), start: index, end });
      index = end;
      continue;
    }

    if (/\d/u.test(char)) {
      let end = index + 1;
      while (end < text.length && /\d/u.test(text[end])) {
        end += 1;
      }
      if (text[end] === "." && /\d/u.test(text[end + 1] ?? "")) {
        end += 1;
        while (end < text.length && /\d/u.test(text[end])) {
          end += 1;
        }
      }
      tokens.push({ type: "number", lexeme: text.slice(index, end), start: index, end });
      index = end;
      continue;
    }

    let end = index + 1;
    while (end < text.length && !/\s/u.test(text[end]) && !BOUNDARY_CHARS.has(text[end])) {
      end += 1;
    }
    const lexeme = text.slice(index, end);
    const type = lexeme === "and" ? "and" : lexeme === "or" ? "or" : lexeme === "not" ? "not" : "identifier";
    tokens.push({ type, lexeme, start: index, end });
    index = end;
  }

  tokens.push({ type: "eof", lexeme: "", start: text.length, end: text.length });
  return tokens;
}

class ExpressionParser {
  private readonly tokens: Token[];
  private readonly diagnostics: DiagnosticItem[] = [];
  private index = 0;

  constructor(
    private readonly text: string,
    private readonly base: SourcePosition,
  ) {
    this.tokens = tokenize(text);
  }

  parse(): ParseResult {
    const expr = this.parseOr();
    if (this.peek().type !== "eof") {
      this.errorAtToken(this.peek(), "表达式存在无法解析的尾随内容");
    }
    return { expr, diagnostics: this.diagnostics };
  }

  private parseOr(): ExprAst | null {
    let expr = this.parseAnd();
    while (this.match("or")) {
      const operatorToken = this.previous();
      const right = this.parseAnd();
      if (!expr || !right) {
        return expr ?? right;
      }
      expr = {
        type: "binary",
        operator: "or",
        rawOperator: operatorToken.lexeme,
        left: expr,
        right,
        span: mergeSpans(expr.span, right.span),
      } satisfies BinaryExprAst;
    }
    return expr;
  }

  private parseAnd(): ExprAst | null {
    let expr = this.parseNot();
    while (this.match("and")) {
      const operatorToken = this.previous();
      const right = this.parseNot();
      if (!expr || !right) {
        return expr ?? right;
      }
      expr = {
        type: "binary",
        operator: "and",
        rawOperator: operatorToken.lexeme,
        left: expr,
        right,
        span: mergeSpans(expr.span, right.span),
      } satisfies BinaryExprAst;
    }
    return expr;
  }

  private parseNot(): ExprAst | null {
    if (this.match("not")) {
      const operatorToken = this.previous();
      const operand = this.parseNot();
      if (!operand) {
        this.errorAtToken(operatorToken, "not 后缺少表达式");
        return null;
      }
      return {
        type: "unary",
        operator: "not",
        rawOperator: operatorToken.lexeme,
        operand,
        span: mergeSpans(spanFromRange(this.base, operatorToken.start, operatorToken.end), operand.span),
      } satisfies UnaryExprAst;
    }
    return this.parseComparison();
  }

  private parseComparison(): ExprAst | null {
    const left = this.parsePrimary();
    const operatorToken = this.peek();
    const operatorMap: Partial<Record<TokenType, ComparisonExprAst["operator"]>> = {
      eq: "==",
      ne: "!=",
      gt: ">",
      gte: ">=",
      lt: "<",
      lte: "<=",
    };

    const operator = operatorMap[operatorToken.type];
    if (!operator) {
      return left;
    }

    this.advance();
    const right = this.parsePrimary();
    if (!left || !right) {
      this.errorAtToken(operatorToken, "比较运算符两侧都必须有表达式");
      return left ?? right;
    }

    return {
      type: "comparison",
      operator,
      left,
      right,
      span: mergeSpans(left.span, right.span),
    } satisfies ComparisonExprAst;
  }

  private parsePrimary(): ExprAst | null {
    const token = this.peek();

    if (this.match("lparen")) {
      const expr = this.parseOr();
      if (!this.match("rparen")) {
        this.errorAtToken(this.peek(), "缺少右括号 ')'");
      }
      return expr;
    }

    if (this.match("variable")) {
      const variableToken = this.previous();
      return {
        type: "variable",
        name: variableToken.lexeme.slice(1),
        span: spanFromRange(this.base, variableToken.start, variableToken.end),
      } satisfies VariableExprAst;
    }

    if (this.match("number")) {
      const numberToken = this.previous();
      return {
        type: "literal",
        value: Number(numberToken.lexeme),
        valueType: "number",
        span: spanFromRange(this.base, numberToken.start, numberToken.end),
      } satisfies LiteralExprAst;
    }

    if (this.match("identifier")) {
      const identifierToken = this.previous();
      const args: ValueArgAst[] = [];
      let endToken = identifierToken;
      while (this.canConsumePredicateArgument()) {
        const argumentToken = this.advance();
        args.push(this.buildPredicateArgument(argumentToken));
        endToken = argumentToken;
      }

      if (args.length > 0) {
        return {
          type: "predicate",
          name: identifierToken.lexeme,
          args,
          span: spanFromRange(this.base, identifierToken.start, endToken.end),
        } satisfies PredicateCallExprAst;
      }

      return {
        type: "literal",
        value: identifierToken.lexeme,
        valueType: "string",
        span: spanFromRange(this.base, identifierToken.start, identifierToken.end),
      } satisfies LiteralExprAst;
    }

    if (token.type !== "eof" && token.type !== "rparen") {
      this.errorAtToken(token, `无法识别的表达式片段 '${token.lexeme}'`);
      this.advance();
    }

    return null;
  }

  private canConsumePredicateArgument(): boolean {
    const token = this.peek();
    return token.type === "identifier" || token.type === "number" || token.type === "variable";
  }

  private buildPredicateArgument(token: Token): ValueArgAst {
    return parseValueArgAst(token.lexeme, spanFromRange(this.base, token.start, token.end));
  }

  private match(type: TokenType): boolean {
    if (this.peek().type === type) {
      this.advance();
      return true;
    }
    return false;
  }

  private advance(): Token {
    const token = this.tokens[this.index];
    if (this.index < this.tokens.length - 1) {
      this.index += 1;
    }
    return token;
  }

  private previous(): Token {
    return this.tokens[Math.max(0, this.index - 1)];
  }

  private peek(): Token {
    return this.tokens[this.index];
  }

  private errorAtToken(token: Token, message: string): void {
    this.diagnostics.push({
      message,
      severity: "error",
      code: "syntax",
      span: spanFromRange(this.base, token.start, Math.max(token.end, token.start + 1)),
    });
  }
}

export function parseExpression(text: string, base: SourcePosition): ParseResult {
  return new ExpressionParser(text, base).parse();
}

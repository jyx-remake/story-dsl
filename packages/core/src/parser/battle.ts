import { BattleOutcomeAst, BattleOutcomeName, BattleStmtAst } from "../ast";
import { ParserContext } from "./parser-context";
import { ParseStatements } from "./parser-types";
import { isBranchLine, lineSpan, mergeSpans } from "./source-lines";

export function parseBattleStatement(
  context: ParserContext,
  expectedIndent: number,
  parseStatements: ParseStatements,
): BattleStmtAst {
  const headerLine = context.peek()!;
  const battleId = headerLine.trimmed.slice("battle".length).trim();
  if (!battleId) {
    context.report("battle 之后必须提供战斗名", lineSpan(headerLine), "syntax");
  }
  context.advance();

  const outcomes: BattleOutcomeAst[] = [];
  const seenOutcomes = new Set<BattleOutcomeName>();

  while (true) {
    context.skipBlankLines();
    const line = context.peek();
    if (!line || line.indentLevel !== expectedIndent || !isBranchLine(line)) {
      break;
    }

    const rawOutcome = (/^-\s*(.*)$/u.exec(line.trimmed)?.[1] ?? "").trim();
    const outcomeSpan = lineSpan(line);
    context.advance();

    if (rawOutcome !== "win" && rawOutcome !== "lose" && rawOutcome !== "timeout") {
      context.report("battle 分支只允许 win / lose / timeout", outcomeSpan, "semantic");
      parseStatements(
        expectedIndent + 1,
        (candidate) => candidate.indentLevel === expectedIndent && isBranchLine(candidate),
      );
      continue;
    }

    if (seenOutcomes.has(rawOutcome)) {
      context.report(`battle 结果分支 '${rawOutcome}' 重复`, outcomeSpan, "duplicate");
    }
    seenOutcomes.add(rawOutcome);

    const statements = parseStatements(
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

  return {
    type: "battle",
    battleId,
    outcomes,
    raw: headerLine.trimmed,
    span: outcomes.length > 0 ? mergeSpans(lineSpan(headerLine), outcomes[outcomes.length - 1].span) : lineSpan(headerLine),
  };
}

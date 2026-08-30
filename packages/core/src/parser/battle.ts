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
  // Accept legacy story files that still contain packed battle parameters
  // (`battle id#count#level`) while exposing the catalog id and options as
  // typed IR fields.  This keeps the old repeat/power semantics available to
  // the Godot host without treating the packed value as a catalog key.
  const packed = headerLine.trimmed.slice("battle".length).trim().split("#").map((part) => part.trim());
  const battleId = packed.shift() ?? "";
  let totalBattles: number | undefined;
  let battleLevel: number | undefined;
  if (packed.length > 0 && packed[0] !== "") {
    const parsed = parseIntegerOption(context, packed[0], "battle 次数", headerLine);
    // Legacy runtime uses Math.Max(1, value), including for zero/negative
    // values.  Apply that compatibility rule while keeping the field safe.
    totalBattles = parsed === undefined ? undefined : Math.max(1, parsed);
  }
  if (packed.length > 1 && packed[1] !== "") {
    const parsed = parseIntegerOption(context, packed[1], "battle 强化等级", headerLine);
    // Legacy only applies levels in the inclusive range 1..1000.
    battleLevel = parsed !== undefined && parsed > 0 && parsed <= 1000 ? parsed : 0;
  }
  if (packed.length > 2 && packed.slice(2).some(Boolean)) {
    context.report("battle 最多支持次数和强化等级两个旧版参数", lineSpan(headerLine), "semantic");
  }
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
    ...(totalBattles === undefined ? {} : { totalBattles }),
    ...(battleLevel === undefined ? {} : { battleLevel }),
    outcomes,
    raw: headerLine.trimmed,
    span: outcomes.length > 0 ? mergeSpans(lineSpan(headerLine), outcomes[outcomes.length - 1].span) : lineSpan(headerLine),
  };
}

function parseIntegerOption(
  context: ParserContext,
  raw: string,
  label: string,
  line: Parameters<typeof lineSpan>[0],
): number | undefined {
  if (!/^[+-]?\d+$/u.test(raw)) {
    context.report(`${label}必须是整数：${raw}`, lineSpan(line), "semantic");
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    context.report(`${label}超出安全整数范围：${raw}`, lineSpan(line), "semantic");
    return undefined;
  }
  return value;
}

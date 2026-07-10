import { StatementAst } from "../ast";
import { ParsedLine } from "./source-lines";

export type ParseStatements = (
  expectedIndent: number,
  shouldStop: (line: ParsedLine) => boolean,
) => StatementAst[];

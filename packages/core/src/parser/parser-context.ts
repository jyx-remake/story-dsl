import { DiagnosticItem, SourceSpan } from "../ast";
import { LineCursor } from "./source-lines";

export class ParserContext extends LineCursor {
  readonly diagnostics: DiagnosticItem[] = [];

  report(
    message: string,
    span: SourceSpan,
    code: DiagnosticItem["code"],
    severity: DiagnosticItem["severity"] = "error",
  ): void {
    this.diagnostics.push({
      message,
      span,
      code,
      severity,
    });
  }

  addDiagnostics(diagnostics: readonly DiagnosticItem[]): void {
    this.diagnostics.push(...diagnostics);
  }
}

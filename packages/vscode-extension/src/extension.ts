import * as path from "path";
import * as vscode from "vscode";
import { DiagnosticItem } from "./ast";
import { compileScript } from "./compiler/compiler";
import { parseStory } from "./parser/parser";

const LANGUAGE_ID = "storydsl";

interface AnalysisResult {
  diagnostics: DiagnosticItem[];
  jsonText: string | null;
}

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection("storydsl");
  const output = vscode.window.createOutputChannel("Story DSL");

  const refreshDocumentDiagnostics = async (document: vscode.TextDocument): Promise<AnalysisResult | null> => {
    if (document.languageId !== LANGUAGE_ID) {
      return null;
    }

    const analysis = analyzeDocument(document.getText());
    diagnostics.set(document.uri, analysis.diagnostics.map((item) => toVscodeDiagnostic(item)));
    return analysis;
  };

  const compileDocument = async (document: vscode.TextDocument, writeFile: boolean): Promise<void> => {
    const analysis = await refreshDocumentDiagnostics(document);
    if (!analysis) {
      return;
    }

    const errorCount = analysis.diagnostics.filter((item) => item.severity === "error").length;
    if (errorCount > 0 || !analysis.jsonText) {
      output.appendLine(`[skip] ${document.uri.fsPath} 存在 ${errorCount} 个错误，未输出 JSON IR`);
      return;
    }

    if (writeFile) {
      const targetUri = getOutputUri(document.uri);
      await vscode.workspace.fs.writeFile(targetUri, Buffer.from(analysis.jsonText, "utf8"));
      output.appendLine(`[ok] ${document.uri.fsPath} -> ${targetUri.fsPath}`);
    }
  };

  context.subscriptions.push(diagnostics, output);
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider({ language: LANGUAGE_ID }, {
      provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
        const parseResult = parseStory(document.getText());
        return parseResult.ast.segments.map((segment) => {
          const symbol = new vscode.DocumentSymbol(
            segment.name,
            `# ${segment.rawName.trim()}`,
            vscode.SymbolKind.Namespace,
            toVscodeRange(segment.span),
            toVscodeRange(segment.headerSpan),
          );
          return symbol;
        });
      },
    }),
  );
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      void refreshDocumentDiagnostics(document);
    }),
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      void refreshDocumentDiagnostics(event.document);
    }),
  );
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      void compileDocument(document, true);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("storydsl.validateCurrent", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== LANGUAGE_ID) {
        void vscode.window.showWarningMessage("当前没有打开 .story 文件");
        return;
      }

      const analysis = await refreshDocumentDiagnostics(editor.document);
      const errorCount = analysis?.diagnostics.filter((item) => item.severity === "error").length ?? 0;
      if (errorCount === 0) {
        void vscode.window.showInformationMessage("当前 Story DSL 文件校验通过");
      } else {
        void vscode.window.showErrorMessage(`当前 Story DSL 文件存在 ${errorCount} 个错误`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("storydsl.compileCurrent", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== LANGUAGE_ID) {
        void vscode.window.showWarningMessage("当前没有打开 .story 文件");
        return;
      }
      await compileDocument(editor.document, true);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("storydsl.compileAll", async () => {
      const files = await vscode.workspace.findFiles("**/*.story", "**/node_modules/**");
      if (files.length === 0) {
        void vscode.window.showWarningMessage("当前工作区没有找到 .story 文件");
        return;
      }

      for (const file of files) {
        const document = await vscode.workspace.openTextDocument(file);
        await compileDocument(document, true);
      }

      void vscode.window.showInformationMessage(`Story DSL 编译完成，共处理 ${files.length} 个文件`);
    }),
  );

  vscode.workspace.textDocuments.forEach((document) => {
    void refreshDocumentDiagnostics(document);
  });
}

export function deactivate(): void {}

function analyzeDocument(text: string): AnalysisResult {
  const parseResult = parseStory(text);
  const compileResult = compileScript(parseResult.ast);
  const diagnostics = [...parseResult.diagnostics, ...compileResult.diagnostics];
  const hasErrors = diagnostics.some((item) => item.severity === "error");

  return {
    diagnostics,
    jsonText: hasErrors ? null : `${JSON.stringify(compileResult.ir, null, 2)}\n`,
  };
}

function toVscodeDiagnostic(item: DiagnosticItem): vscode.Diagnostic {
  const range = toVscodeRange(item.span);
  const severity =
    item.severity === "warning" ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error;
  const diagnostic = new vscode.Diagnostic(range, item.message, severity);
  diagnostic.code = item.code;
  diagnostic.source = "storydsl";
  return diagnostic;
}

function toVscodeRange(span: DiagnosticItem["span"]): vscode.Range {
  return new vscode.Range(
    new vscode.Position(span.start.line - 1, span.start.column - 1),
    new vscode.Position(span.end.line - 1, Math.max(span.end.column - 1, span.start.column)),
  );
}

function getOutputUri(source: vscode.Uri): vscode.Uri {
  const directory = path.dirname(source.fsPath);
  const baseName = path.basename(source.fsPath);
  return vscode.Uri.file(path.join(directory, `${baseName}.json`));
}

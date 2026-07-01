import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  BookOpen,
  CheckCircle2,
  Clipboard,
  Download,
  FileJson,
  FileUp,
  ListTree,
  Map,
  Play,
  RotateCcw,
  SquareDashed,
  TriangleAlert,
} from "lucide-react";
import type * as monaco from "monaco-editor";
import demoStory from "../../../examples/demo.story?raw";
import { analyzeStory } from "./storyAnalysis";
import { diagnosticToMarker, LANGUAGE_ID, registerStoryLanguage, THEME_ID } from "./storyLanguage";

const emptyJson = "{\n  \"version\": 1,\n  \"segments\": []\n}\n";
const minOutlineWidth = 180;
const maxOutlineWidth = 420;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function countSteps(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value.reduce((total, step) => {
    if (!step || typeof step !== "object") {
      return total;
    }

    const record = step as Record<string, unknown>;
    let nested = 0;
    if (Array.isArray(record.options)) {
      nested += record.options.reduce((optionTotal, option) => {
        const optionRecord = option as Record<string, unknown>;
        return optionTotal + countSteps(optionRecord.steps);
      }, 0);
    }
    if (record.outcomes && typeof record.outcomes === "object") {
      nested += Object.values(record.outcomes).reduce((outcomeTotal, steps) => outcomeTotal + countSteps(steps), 0);
    }
    if (Array.isArray(record.cases)) {
      nested += record.cases.reduce((caseTotal, branchCase) => {
        const caseRecord = branchCase as Record<string, unknown>;
        return caseTotal + countSteps(caseRecord.steps);
      }, 0);
    }
    nested += countSteps(record.fallback);

    return total + 1 + nested;
  }, 0);
}

export default function App(): JSX.Element {
  const [source, setSource] = useState(demoStory);
  const [activePanel, setActivePanel] = useState<"json" | "diagnostics">("json");
  const [activeLine, setActiveLine] = useState(1);
  const [copied, setCopied] = useState(false);
  const [outlineWidth, setOutlineWidth] = useState(260);
  const [showMinimap, setShowMinimap] = useState(true);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);

  const analysis = useMemo(() => analyzeStory(source), [source]);
  const errors = analysis.diagnostics.filter((item) => item.severity === "error");
  const warnings = analysis.diagnostics.filter((item) => item.severity === "warning");
  const jsonText = analysis.jsonText ?? emptyJson;
  const segmentCount = analysis.ast.segments.length;
  const stepCount = analysis.ir?.segments.reduce((total, segment) => total + countSteps(segment.steps), 0) ?? 0;
  const outlineItems = analysis.ast.segments.map((segment) => {
    const segmentDiagnostics = analysis.diagnostics.filter(
      (item) => item.span.start.line >= segment.span.start.line && item.span.start.line <= segment.span.end.line,
    );
    return {
      name: segment.name || "未命名剧情段",
      line: segment.headerSpan.start.line,
      startLine: segment.span.start.line,
      endLine: segment.span.end.line,
      statementCount: segment.statements.length,
      errors: segmentDiagnostics.filter((item) => item.severity === "error").length,
      warnings: segmentDiagnostics.filter((item) => item.severity === "warning").length,
    };
  });
  const activeSegmentLine =
    outlineItems.find((item) => activeLine >= item.startLine && activeLine <= item.endLine)?.line ?? null;

  const handleEditorMount: OnMount = (editor, monacoApi) => {
    editorRef.current = editor;
    monacoRef.current = monacoApi;
    registerStoryLanguage(monacoApi);
    const model = editor.getModel();
    if (model) {
      monacoApi.editor.setModelLanguage(model, LANGUAGE_ID);
    }
    monacoApi.editor.setTheme(THEME_ID);
    editor.onDidChangeCursorPosition((event) => {
      setActiveLine(event.position.lineNumber);
    });
  };

  const handleSourceChange = (value?: string) => {
    setSource(value ?? "");
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monacoApi = monacoRef.current;
    const model = editor?.getModel();
    if (!monacoApi || !model) {
      return;
    }

    monacoApi.editor.setModelMarkers(
      model,
      "storydsl",
      analysis.diagnostics.map((item) => diagnosticToMarker(monacoApi, item)),
    );
  }, [analysis.diagnostics]);

  const jumpToDiagnostic = (line: number, column: number) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.focus();
    editor.revealPositionInCenter({ lineNumber: line, column });
    editor.setPosition({ lineNumber: line, column });
  };

  const jumpToLine = (line: number) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.focus();
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    setActiveLine(line);
  };

  const handleOpenFile = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSource(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (!analysis.jsonText) {
      return;
    }

    const blob = new Blob([analysis.jsonText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "story.story.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!analysis.jsonText) {
      return;
    }
    await navigator.clipboard.writeText(analysis.jsonText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const startOutlineResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }

    event.preventDefault();
    const workspaceLeft = workspace.getBoundingClientRect().left;
    const resize = (pointerEvent: PointerEvent) => {
      const nextWidth = clamp(pointerEvent.clientX - workspaceLeft, minOutlineWidth, maxOutlineWidth);
      setOutlineWidth(nextWidth);
      window.requestAnimationFrame(() => editorRef.current?.layout());
    };
    const stopResize = () => {
      document.body.classList.remove("is-resizing-outline");
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      window.requestAnimationFrame(() => editorRef.current?.layout());
    };

    document.body.classList.add("is-resizing-outline");
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">S</div>
          <div>
            <h1>Story DSL Web</h1>
            <p>浏览器内编辑、校验并编译 JSON IR</p>
          </div>
        </div>

        <div className="toolbar" aria-label="Story DSL actions">
          <label className="tool-button" title="打开 .story 文件">
            <FileUp size={17} />
            <span>打开</span>
            <input
              type="file"
              accept=".story,text/plain"
              onChange={(event) => handleOpenFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button type="button" className="tool-button" onClick={() => setSource(demoStory)} title="载入示例">
            <RotateCcw size={17} />
            <span>示例</span>
          </button>
          <button
            type="button"
            className="tool-button"
            onClick={handleCopy}
            disabled={!analysis.jsonText}
            title="复制 JSON IR"
          >
            <Clipboard size={17} />
            <span>{copied ? "已复制" : "复制"}</span>
          </button>
          <button
            type="button"
            className="tool-button primary"
            onClick={handleDownload}
            disabled={!analysis.jsonText}
            title="下载 JSON IR"
          >
            <Download size={17} />
            <span>下载 JSON</span>
          </button>
        </div>
      </header>

      <section className="status-strip" aria-label="Story DSL status">
        <div className={errors.length > 0 ? "status-item danger" : "status-item ok"}>
          {errors.length > 0 ? <TriangleAlert size={18} /> : <CheckCircle2 size={18} />}
          <span>{errors.length > 0 ? `${errors.length} 个错误` : "校验通过"}</span>
        </div>
        <div className="status-item">
          <ListTree size={18} />
          <span>{segmentCount} 个剧情段</span>
        </div>
        <div className="status-item">
          <Play size={18} />
          <span>{stepCount} 个 IR 步骤</span>
        </div>
        <div className={warnings.length > 0 ? "status-item warn" : "status-item"}>
          <TriangleAlert size={18} />
          <span>{warnings.length} 个警告</span>
        </div>
      </section>

      <section
        className="workspace"
        ref={workspaceRef}
        style={{ "--outline-width": `${outlineWidth}px` } as React.CSSProperties}
      >
        <aside className="outline-pane">
          <div className="pane-header compact">
            <span>剧情大纲</span>
            <code>{outlineItems.length}</code>
          </div>
          <div className="outline-list">
            {outlineItems.length === 0 ? (
              <div className="outline-empty">
                <BookOpen size={22} />
                <span>暂无剧情段</span>
              </div>
            ) : (
              outlineItems.map((item) => (
                <button
                  type="button"
                  className={activeSegmentLine === item.line ? "outline-row active" : "outline-row"}
                  key={`${item.name}-${item.line}`}
                  onClick={() => jumpToLine(item.line)}
                  title={`跳转到第 ${item.line} 行`}
                >
                  <span className="outline-icon">#</span>
                  <span className="outline-main">
                    <span className="outline-name">{item.name}</span>
                    <span className="outline-meta">
                      第 {item.line} 行 · {item.statementCount} 条语句
                    </span>
                  </span>
                  {(item.errors > 0 || item.warnings > 0) && (
                    <span className={item.errors > 0 ? "outline-count error" : "outline-count warning"}>
                      {item.errors > 0 ? item.errors : item.warnings}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>
        <button
          type="button"
          className="outline-resizer"
          aria-label="调整剧情大纲宽度"
          title="拖动调整剧情大纲宽度"
          onPointerDown={startOutlineResize}
        />

        <div className="editor-pane">
          <div className="pane-header">
            <span>Story 源码</span>
            <div className="pane-actions">
              <code>{source.split(/\r?\n/u).length} 行</code>
              <button
                type="button"
                className={showMinimap ? "icon-toggle active" : "icon-toggle"}
                onClick={() => setShowMinimap((value) => !value)}
                title={showMinimap ? "隐藏代码小地图" : "显示代码小地图"}
                aria-pressed={showMinimap}
                aria-label={showMinimap ? "隐藏代码小地图" : "显示代码小地图"}
              >
                {showMinimap ? <Map size={15} /> : <SquareDashed size={15} />}
              </button>
            </div>
          </div>
          <Editor
            className="monaco-host"
            height="100%"
            language={LANGUAGE_ID}
            value={source}
            theme={THEME_ID}
            beforeMount={registerStoryLanguage}
            onMount={handleEditorMount}
            onChange={handleSourceChange}
            options={{
              minimap: {
                enabled: showMinimap,
                autohide: false,
                renderCharacters: false,
                maxColumn: 80,
                side: "right",
                showSlider: "mouseover",
                size: "proportional",
              },
              fontSize: 14,
              fontLigatures: false,
              lineNumbersMinChars: 3,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              insertSpaces: true,
              wordWrap: "on",
              padding: { top: 14, bottom: 14 },
              renderLineHighlight: "line",
            }}
          />
        </div>

        <aside className="result-pane">
          <div className="tabs" role="tablist" aria-label="输出视图">
            <button
              type="button"
              className={activePanel === "json" ? "tab active" : "tab"}
              onClick={() => setActivePanel("json")}
            >
              <FileJson size={16} />
              <span>JSON IR</span>
            </button>
            <button
              type="button"
              className={activePanel === "diagnostics" ? "tab active" : "tab"}
              onClick={() => setActivePanel("diagnostics")}
            >
              <TriangleAlert size={16} />
              <span>诊断</span>
            </button>
          </div>

          {activePanel === "json" ? (
            <div className="json-view">
              {!analysis.jsonText && (
                <div className="compile-blocked">
                  <TriangleAlert size={18} />
                  <span>存在错误，已暂停 JSON IR 输出</span>
                </div>
              )}
              <Editor
                height="100%"
                language="json"
                value={jsonText}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbersMinChars: 3,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: "on",
                  padding: { top: 14, bottom: 14 },
                }}
              />
            </div>
          ) : (
            <div className="diagnostics-view">
              {analysis.diagnostics.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 size={24} />
                  <span>没有诊断信息</span>
                </div>
              ) : (
                analysis.diagnostics.map((diagnostic, index) => (
                  <button
                    type="button"
                    className={`diagnostic-row ${diagnostic.severity}`}
                    key={`${diagnostic.code}-${diagnostic.span.start.line}-${index}`}
                    onClick={() => jumpToDiagnostic(diagnostic.span.start.line, diagnostic.span.start.column)}
                  >
                    <span className="diagnostic-badge">{diagnostic.severity === "error" ? "错误" : "警告"}</span>
                    <span className="diagnostic-message">{diagnostic.message}</span>
                    <code>
                      {diagnostic.span.start.line}:{diagnostic.span.start.column}
                    </code>
                  </button>
                ))
              )}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

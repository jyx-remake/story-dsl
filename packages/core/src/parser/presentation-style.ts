import { ParserContext } from "./parser-context";
import { lineSpan, ParsedLine } from "./source-lines";

export interface ParsedPresentationStyle {
  text: string;
  style: string | null;
}

const STYLE_ID_PATTERN = /^[\p{L}\p{N}_.-]+$/u;

export function parsePresentationStyle(
  context: ParserContext,
  line: ParsedLine,
  content: string,
  contentStartColumn: number,
): ParsedPresentationStyle {
  let remaining = content;
  let consumed = 0;
  let style: string | null = null;

  while (remaining.startsWith("[#")) {
    const closingIndex = remaining.indexOf("]");
    if (closingIndex < 0) {
      context.report(
        "展示样式标签缺少右方括号 ']'",
        lineSpan(line, contentStartColumn + consumed),
        "syntax",
      );
      return { text: "", style };
    }

    const tagText = remaining.slice(0, closingIndex + 1);
    const tagSpan = lineSpan(
      line,
      contentStartColumn + consumed,
      contentStartColumn + consumed + tagText.length,
    );
    const body = tagText.slice(2, -1).trim();
    const equalsIndex = body.indexOf("=");

    if (equalsIndex < 0) {
      context.report("展示标签必须使用 '[#key=value]' 格式", tagSpan, "syntax");
    } else {
      const key = body.slice(0, equalsIndex).trim();
      const value = body.slice(equalsIndex + 1).trim();

      if (key !== "style") {
        context.report(`暂不支持展示标签 '${key || "空"}'`, tagSpan, "semantic");
      } else if (!value) {
        context.report("style 标签必须提供样式 ID", tagSpan, "syntax");
      } else if (!STYLE_ID_PATTERN.test(value)) {
        context.report("样式 ID 只能包含中英文、数字、点、下划线和短横线，且不能包含空白", tagSpan, "syntax");
      } else if (style !== null) {
        context.report("同一条语句只能配置一个 style 标签", tagSpan, "semantic");
      } else {
        style = value;
      }
    }

    consumed += tagText.length;
    remaining = remaining.slice(tagText.length);
    const whitespaceLength = /^\s*/u.exec(remaining)?.[0].length ?? 0;
    consumed += whitespaceLength;
    remaining = remaining.slice(whitespaceLength);
  }

  const misplacedTagIndex = remaining.indexOf("[#");
  if (misplacedTagIndex >= 0) {
    const closingIndex = remaining.indexOf("]", misplacedTagIndex);
    const endOffset = closingIndex >= 0 ? closingIndex + 1 : remaining.length;
    context.report(
      "展示标签只能出现在对白正文开头",
      lineSpan(
        line,
        contentStartColumn + consumed + misplacedTagIndex,
        contentStartColumn + consumed + endOffset,
      ),
      "structure",
    );
  }

  return { text: remaining.trim(), style };
}

export function reportOptionPresentationStyle(
  context: ParserContext,
  line: ParsedLine,
  optionText: string,
): void {
  const tagIndex = optionText.indexOf("[#");
  if (tagIndex < 0) {
    return;
  }

  const sourceIndex = line.trimmed.indexOf("[#", 1);
  const startColumn = line.indentSpaces + Math.max(sourceIndex, 0) + 1;
  const closingIndex = line.trimmed.indexOf("]", Math.max(sourceIndex, 0));
  context.report(
    "选项暂不支持展示样式标签；style 只能配置在 choice 的提示对白上",
    lineSpan(line, startColumn, closingIndex >= 0 ? line.indentSpaces + closingIndex + 2 : undefined),
    "structure",
  );
}

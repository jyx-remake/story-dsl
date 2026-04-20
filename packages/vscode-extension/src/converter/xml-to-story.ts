type XmlNode = XmlElement | XmlText;

interface XmlElement {
  kind: "element";
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
}

interface XmlText {
  kind: "text";
  text: string;
}

interface StoryXml {
  name: string;
  entries: StoryEntry[];
}

type StoryEntry = ActionEntry | ResultEntry;

interface ActionEntry {
  kind: "action";
  type: string;
  value: string;
}

interface ResultEntry {
  kind: "result";
  type: string;
  ret: string;
  value: string;
  conditions: ConditionEntry[];
}

interface ConditionEntry {
  type: string;
  value: string;
}

interface EmitResultOptions {
  indentLevel: number;
}

const BATTLE_OUTCOMES = new Set(["win", "lose", "timeout"]);
const LEGACY_INLINE_COLOR_PATTERN = /\[\[([A-Za-z][\w-]*):([\s\S]*?)\]\]/gu;

export function convertXmlToStory(xmlText: string): string {
  const stories = parseStoryXml(xmlText);
  const lines: string[] = [];

  stories.forEach((story, index) => {
    if (index > 0) {
      lines.push("");
    }
    lines.push(`# ${story.name}`);
    lines.push(...emitStoryEntries(story.entries));
  });

  return `${lines.join("\n").trimEnd()}\n`;
}

function parseStoryXml(xmlText: string): StoryXml[] {
  const document = parseXml(xmlText);
  const root = elementChildren(document).find((child) => child.name === "root") ?? document;
  const storyElements = elementChildren(root).filter((child) => child.name === "story");

  return storyElements.map((storyElement) => ({
    name: requiredAttr(storyElement, "name"),
    entries: elementChildren(storyElement).flatMap(parseStoryEntry),
  }));
}

function parseStoryEntry(element: XmlElement): StoryEntry[] {
  if (element.name === "action") {
    return [{
      kind: "action",
      type: requiredAttr(element, "type"),
      value: optionalAttr(element, "value"),
    }];
  }

  if (element.name === "result") {
    return [{
      kind: "result",
      type: requiredAttr(element, "type"),
      ret: optionalAttr(element, "ret"),
      value: optionalAttr(element, "value"),
      conditions: elementChildren(element)
        .filter((child) => child.name === "condition")
        .map((condition) => ({
          type: requiredAttr(condition, "type"),
          value: optionalAttr(condition, "value"),
        })),
    }];
  }

  return [];
}

function emitStoryEntries(entries: StoryEntry[]): string[] {
  const actions = entries.filter((entry): entry is ActionEntry => entry.kind === "action");
  const results = entries.filter((entry): entry is ResultEntry => entry.kind === "result");
  const consumedResults = new Set<ResultEntry>();
  const lines: string[] = [];

  for (const action of actions) {
    if (action.type === "SELECT") {
      const selectResults = results.filter((result) => !consumedResults.has(result) && isSelectResult(result));
      selectResults.forEach((result) => consumedResults.add(result));
      lines.push(...emitSelect(action.value, selectResults));
      continue;
    }

    if (action.type === "BATTLE") {
      const battleResults = results.filter((result) => !consumedResults.has(result) && isBattleResult(result));
      battleResults.forEach((result) => consumedResults.add(result));
      lines.push(...emitBattle(action.value, battleResults));
      continue;
    }

    lines.push(...emitAction(action));
  }

  const remainingResults = results.filter((result) => !consumedResults.has(result));
  lines.push(...emitResultGroup(remainingResults, { indentLevel: 0 }));

  return lines;
}

function isSelectResult(result: ResultEntry): boolean {
  return result.ret.length > 0 && !BATTLE_OUTCOMES.has(result.ret);
}

function isBattleResult(result: ResultEntry): boolean {
  return battleOutcomeForRet(result.ret) !== null;
}

function emitAction(action: ActionEntry): string[] {
  if (action.type === "DIALOG") {
    const [speaker, text] = splitFirst(action.value, "#");
    return [`${speaker}：${convertLegacyInlineColorToBbCode(text)}`];
  }

  const command = actionTypeToCommandName(action.type);
  const args = actionValueToArgs(action.type, action.value);
  return [joinCommand(command, args)];
}

function emitSelect(value: string, results: ResultEntry[]): string[] {
  const [speaker, rest] = splitFirst(value, "#");
  const [prompt, ...options] = rest.split("#");
  const lines = [`${speaker}：${convertLegacyInlineColorToBbCode(prompt.trim())}`];
  const numericResultsByIndex = new Map<number, ResultEntry[]>();
  const extraResults: ResultEntry[] = [];

  for (const result of results) {
    const index = parseNonNegativeInteger(result.ret);
    if (index !== null && index < options.length) {
      const groupedResults = numericResultsByIndex.get(index) ?? [];
      groupedResults.push(result);
      numericResultsByIndex.set(index, groupedResults);
    } else {
      extraResults.push(result);
    }
  }

  options.forEach((option, index) => {
    lines.push(`- ${convertLegacyInlineColorToBbCode(option.trim())}`);
    lines.push(...emitResultGroup(numericResultsByIndex.get(index) ?? [], { indentLevel: 1 }));
  });

  for (const result of extraResults) {
    lines.push(`- ${convertLegacyInlineColorToBbCode(result.ret.trim())}`);
    lines.push(...emitResult(result, { indentLevel: 1 }));
  }

  return lines;
}

function emitBattle(value: string, results: ResultEntry[]): string[] {
  const lines = [`battle ${value.trim()}`];
  const resultsByOutcome = groupBy(results, (result) => battleOutcomeForRet(result.ret) ?? result.ret);

  for (const outcome of ["win", "lose", "timeout"]) {
    const outcomeResults = resultsByOutcome.get(outcome);
    if (!outcomeResults || outcomeResults.length === 0) {
      continue;
    }

    lines.push(`- ${outcome}`);
    lines.push(...emitResultGroup(outcomeResults, { indentLevel: 1 }));
  }

  return lines;
}

function emitResultGroup(results: ResultEntry[], options: EmitResultOptions): string[] {
  if (results.length === 0) {
    return [];
  }

  const activeResults = new Set<ResultEntry>();
  const conditionedResults = results.filter((result) => result.conditions.length > 0);
  const unconditionedResults = results.filter((result) => result.conditions.length === 0);

  conditionedResults.forEach((result) => activeResults.add(result));
  const fallback = chooseFallbackResult(unconditionedResults, conditionedResults.length > 0);
  if (fallback) {
    activeResults.add(fallback);
  }

  return results.flatMap((result) =>
    activeResults.has(result)
      ? emitResult(result, options)
      : emitCommentedResult(result, options),
  );
}

function chooseFallbackResult(results: ResultEntry[], hasConditionedResults: boolean): ResultEntry | null {
  if (results.length === 0) {
    return null;
  }

  if (hasConditionedResults) {
    return results[results.length - 1];
  }

  return results.find((result) => parseNonNegativeInteger(result.ret) !== null) ?? results[0];
}

function battleOutcomeForRet(ret: string): string | null {
  if (BATTLE_OUTCOMES.has(ret)) {
    return ret;
  }
  if (ret === "0") {
    return "win";
  }
  if (ret === "1") {
    return "lose";
  }
  if (ret === "2") {
    return "timeout";
  }

  return null;
}

function emitResult(result: ResultEntry, options: EmitResultOptions): string[] {
  const statement = resultToStatement(result);
  const condition = result.conditions.map(conditionToExpression).join(" and ");
  const indent = "  ".repeat(options.indentLevel);

  if (!condition) {
    return [`${indent}${statement}`];
  }

  return [
    `${indent}if ${condition}`,
    `${indent}  ${statement}`,
  ];
}

function emitCommentedResult(result: ResultEntry, options: EmitResultOptions): string[] {
  const indent = "  ".repeat(options.indentLevel);
  return emitResult(result, options).map((line) => {
    if (line.startsWith(indent)) {
      return `${indent}// ${line.slice(indent.length)}`;
    }

    return `// ${line}`;
  });
}

function resultToStatement(result: ResultEntry): string {
  if (result.type === "story") {
    return joinCommand("jump", [result.value]);
  }

  return joinCommand(actionTypeToCommand(result.type), result.value.trim() ? [result.value] : []);
}

function conditionToExpression(condition: ConditionEntry): string {
  return joinCommand(actionTypeToCommand(condition.type), splitHashArgs(condition.value));
}

function actionValueToArgs(type: string, value: string): string[] {
  if (!value.trim()) {
    return [];
  }

  const typeParts = type.split(".").filter((part) => part.length > 0);
  const valueParts = splitHashArgs(value);

  if (typeParts.length <= 1) {
    return valueParts;
  }

  const commandArg = actionTypeToCommand(typeParts.slice(1).join("."));
  if (valueParts.length === 0) {
    return [commandArg];
  }

  const [firstValue, ...restValues] = valueParts;
  return [firstValue, commandArg, ...restValues];
}

function actionTypeToCommand(type: string): string {
  return type.trim().toLowerCase();
}

function actionTypeToCommandName(type: string): string {
  return actionTypeToCommand(type.split(".").find((part) => part.length > 0) ?? type);
}

function splitHashArgs(value: string): string[] {
  return value.split("#").map((part) => part.trim()).filter((part) => part.length > 0);
}

function convertLegacyInlineColorToBbCode(text: string): string {
  return text.replace(LEGACY_INLINE_COLOR_PATTERN, (_match, color: string, content: string) => {
    return `[color=${color}]${content}[/color]`;
  });
}

function joinCommand(command: string, args: string[]): string {
  return [command, ...args.map((arg) => arg.trim()).filter((arg) => arg.length > 0)].join(" ");
}

function splitFirst(value: string, delimiter: string): [string, string] {
  const index = value.indexOf(delimiter);
  if (index < 0) {
    return ["", value.trim()];
  }

  return [value.slice(0, index).trim(), value.slice(index + delimiter.length).trim()];
}

function parseNonNegativeInteger(value: string): number | null {
  if (!/^\d+$/u.test(value)) {
    return null;
  }

  return Number(value);
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }

  return map;
}

function elementChildren(element: XmlElement): XmlElement[] {
  return element.children.filter((child): child is XmlElement => child.kind === "element");
}

function requiredAttr(element: XmlElement, name: string): string {
  const value = element.attributes[name];
  if (value === undefined) {
    throw new Error(`<${element.name}> 缺少 ${name} 属性`);
  }

  return value;
}

function optionalAttr(element: XmlElement, name: string): string {
  return element.attributes[name] ?? "";
}

function parseXml(xmlText: string): XmlElement {
  const document: XmlElement = {
    kind: "element",
    name: "#document",
    attributes: {},
    children: [],
  };
  const stack: XmlElement[] = [document];
  const tagPattern = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[A-Za-z_][\w:.-]*(?:\s+[^<>]*?)?\s*\/?>/gu;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(xmlText)) !== null) {
    appendTextNode(xmlText.slice(cursor, match.index), stack[stack.length - 1]);
    const token = match[0];
    cursor = match.index + token.length;

    if (token.startsWith("<!--") || token.startsWith("<?")) {
      continue;
    }

    if (token.startsWith("</")) {
      const closingName = token.slice(2, -1).trim();
      const current = stack.pop();
      if (!current || current.name !== closingName) {
        throw new Error(`XML 结束标签不匹配：${token}`);
      }
      continue;
    }

    const selfClosing = token.endsWith("/>");
    const content = token.slice(1, selfClosing ? -2 : -1).trim();
    const { name, attributes } = parseTagContent(content);
    const element: XmlElement = {
      kind: "element",
      name,
      attributes,
      children: [],
    };
    stack[stack.length - 1].children.push(element);

    if (!selfClosing) {
      stack.push(element);
    }
  }

  appendTextNode(xmlText.slice(cursor), stack[stack.length - 1]);

  if (stack.length !== 1) {
    const unclosed = stack.slice(1).map((element) => `<${element.name}>`).join(", ");
    throw new Error(`XML 标签未闭合：${unclosed}`);
  }

  return document;
}

function appendTextNode(text: string, parent: XmlElement): void {
  if (text.trim().length === 0) {
    return;
  }

  parent.children.push({
    kind: "text",
    text: decodeXmlEntities(text),
  });
}

function parseTagContent(content: string): { name: string; attributes: Record<string, string> } {
  const nameMatch = /^([A-Za-z_][\w:.-]*)/u.exec(content);
  if (!nameMatch) {
    throw new Error(`XML 标签格式错误：${content}`);
  }

  const name = nameMatch[1];
  const attributes: Record<string, string> = {};
  const rest = content.slice(name.length);
  const attrPattern = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/gu;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(rest)) !== null) {
    if (rest.slice(cursor, match.index).trim().length > 0) {
      throw new Error(`XML 属性格式错误：${content}`);
    }
    attributes[match[1]] = decodeXmlEntities(match[3] ?? match[4] ?? "");
    cursor = match.index + match[0].length;
  }

  if (rest.slice(cursor).trim().length > 0) {
    throw new Error(`XML 属性格式错误：${content}`);
  }

  return { name, attributes };
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/gu, (_, entity: string) => {
    switch (entity) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return "\"";
      case "apos":
        return "'";
      default:
        if (entity.startsWith("#x")) {
          return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
        }
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
  });
}

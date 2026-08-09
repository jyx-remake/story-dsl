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
const REMOVED_LEGACY_COMMANDS = new Set(["newbie", "touch"]);
const VALUELESS_COMMANDS = new Set([
  "game_complete",
  "game_over",
  "huashan",
  "main_menu",
  "next_round",
  "restart",
  "tower",
  "trial",
  "refine",
  "zhenlong",
]);

const COMMAND_NAMES: Record<string, string> = {
  animation: "set_model",
  cost_day: "advance_days",
  cost_item: "remove_item",
  daode: "change_morality",
  effect: "sound",
  game: "minigame",
  gamefin: "game_complete",
  gameover: "game_over",
  get_money: "change_silver",
  get_exp: "grant_exp",
  get_point: "grant_points",
  grant_point: "grant_points",
  growtemplate: "set_growth",
  haogan: "change_favorability",
  item: "change_item",
  leave_follow: "leave_follower",
  levelup: "level_up",
  log: "journal",
  mainmenu: "main_menu",
  menpai: "set_sect",
  nextzhoumu: "next_round",
  nick: "unlock_achievement",
  random_item: "add_random_item",
  random_join: "join_random",
  select_head: "select_portrait",
  select_menpai: "select_sect",
  set_game_mode: "set_difficulty",
  set_map: "map",
  tutorial: "map",
  movie: "video",
  xiangzi: "chest",
  xilian: "refine",
  yuanbao: "change_yuanbao",
  zhenlongqiju: "zhenlong",
};

const NUMERIC_ARGUMENTS: Record<string, Set<number>> = {
  advance_days: new Set([0]),
  arena: new Set(),
  change_favorability: new Set([1]),
  change_item: new Set([1]),
  change_morality: new Set([0]),
  change_silver: new Set([0]),
  change_stat: new Set([2]),
  change_yuanbao: new Set([0]),
  follow: new Set(),
  grant_exp: new Set([1]),
  grant_points: new Set([1]),
  input_name: new Set(),
  join: new Set(),
  learn_external: new Set([2]),
  learn_internal: new Set([2]),
  level_up: new Set([1]),
  maxlevel: new Set([1]),
  remove_item: new Set([1]),
  set_rank: new Set([0]),
  set_round: new Set([0]),
  set_time_key: new Set([1]),
  upgrade_external: new Set([2]),
  upgrade_internal: new Set([2]),
  shake: new Set([0, 1]),
  wait: new Set([0]),
  fade: new Set([1]),
  flash: new Set([1, 2]),
  filter: new Set([1, 2]),
  distort: new Set([1, 2]),
  tint: new Set([1, 2]),
  clear_filter: new Set([0]),
  clear_distort: new Set([0]),
  clear_tint: new Set([0]),
};

const CHARACTER_STATS = new Set([
  "拳掌", "剑法", "刀法", "奇门", "臂力", "身法", "悟性", "福缘", "根骨", "定力", "武学点",
  "quanzhang", "jianfa", "daofa", "qimen", "bili", "shenfa", "wuxing", "fuyuan", "gengu", "dingli", "wuxue",
  "maxhp", "max_hp", "maxmp", "max_mp", "attack", "defence", "evasion", "accuracy", "crit_chance",
  "crit_mult", "anti_crit_chance", "lifesteal", "anti_debuff", "speed", "movement",
]);

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
    const actionType = actionTypeToCommand(action.type);
    if (actionType === "select") {
      const selectResults = results.filter((result) => !consumedResults.has(result) && isSelectResult(result));
      selectResults.forEach((result) => consumedResults.add(result));
      lines.push(...emitSelect(action.value, selectResults));
      continue;
    }

    if (actionType === "battle") {
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
  if (actionTypeToCommand(action.type) === "dialog") {
    const [speaker, text] = splitFirst(action.value, "#");
    return [`${speaker}：${convertLegacyInlineColorToBbCode(text)}`];
  }

  const worldTriggerMode = tryGetWorldTriggerMode(action);
  if (worldTriggerMode !== null) {
    return [formatCall("world_triggers", [worldTriggerMode === "on" ? "true" : "false"])];
  }

  const statement = actionToStatement(action.type, action.value);
  return statement === null ? [] : [statement];
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
  results = results.filter((result) => !REMOVED_LEGACY_COMMANDS.has(actionTypeToCommandName(result.type)));
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
    return `jump ${result.value.trim()}`;
  }

  return actionToStatement(result.type, result.value) ?? "";
}

function conditionToExpression(condition: ConditionEntry): string {
  const type = actionTypeToCommand(condition.type);
  const args = splitHashArgs(condition.value);
  const stringAt = (index: number): string => quoteString(requiredLegacyArg(type, args, index));
  const numberAt = (index: number): string => formatNumber(requiredLegacyArg(type, args, index), type);
  const guardedCharacterQuery = (query: string): string => {
    const characterId = requiredLegacyArg(type, args, 0);
    const guard = characterId === "主角" ? "" : `in_team(${quoteString(characterId)}) and `;
    return `${guard}${query}`;
  };

  switch (type) {
    case "should_finish":
      return `story_completed(${stringAt(0)})`;
    case "should_not_finish":
      return `not story_completed(${stringAt(0)})`;
    case "follow_story":
      return `last_story_is(${stringAt(0)})`;
    case "have_item":
    case "has_item":
      return `item_count(${stringAt(0)}) >= ${args[1] ? numberAt(1) : "1"}`;
    case "not_have_item":
      return `item_count(${stringAt(0)}) == 0`;
    case "have_money":
      return `silver >= ${numberAt(0)}`;
    case "have_yuanbao":
      return `yuanbao >= ${numberAt(0)}`;
    case "in_round":
      return `round == ${numberAt(0)}`;
    case "game_mode":
      return `difficulty == ${stringAt(0)}`;
    case "exceed_day":
      return `elapsed_days > ${numberAt(0)}`;
    case "probability":
      return `chance(${formatProbability(requiredLegacyArg(type, args, 0))})`;
    case "in_team":
    case "key_in_team":
      return `in_team(${stringAt(0)})`;
    case "not_in_team":
    case "key_not_in_team":
      return `not in_team(${stringAt(0)})`;
    case "not_has_time_key":
      return `not has_time_key(${stringAt(0)})`;
    case "level_greater_than": {
      const characterId = requiredLegacyArg(type, args, 0);
      return guardedCharacterQuery(`character_level(${quoteString(characterId)}) >= ${numberAt(1)}`);
    }
    case "skill_less_than": {
      const characterId = requiredLegacyArg(type, args, 0);
      return guardedCharacterQuery(`skill_level(${quoteString(characterId)}, ${stringAt(1)}) < ${numberAt(2)}`);
    }
    case "daode_more_than":
      return `morality >= ${numberAt(0)}`;
    case "daode_less_than":
      return `morality < ${numberAt(0)}`;
    case "haogan_more_than":
      return args.length === 1
        ? `favorability('女主') >= ${numberAt(0)}`
        : `favorability(${stringAt(0)}) >= ${numberAt(1)}`;
    case "haogan_less_than":
      return args.length === 1
        ? `favorability('女主') < ${numberAt(0)}`
        : `favorability(${stringAt(0)}) < ${numberAt(1)}`;
    case "rank":
      return `rank != -1 and rank <= ${numberAt(0)}`;
    default:
      return statConditionToExpression(type, args) ?? formatCall(type, args.map(quoteString));
  }
}

function actionToStatement(type: string, value: string): string | null {
  const typeParts = type.split(/[.…]+/u).map(actionTypeToCommand).filter(Boolean);
  const legacyName = typeParts[0] ?? actionTypeToCommand(type);
  if (REMOVED_LEGACY_COMMANDS.has(legacyName)) return null;

  const values = splitHashArgs(value);
  const command = COMMAND_NAMES[legacyName] ?? legacyName;
  if (VALUELESS_COMMANDS.has(command)) return formatCall(command, []);

  switch (legacyName) {
    case "set_flag":
      return `${formatVariableName(requiredLegacyArg(legacyName, values, 0), legacyName)} = true`;
    case "clear_flag":
    case "remove_var":
      return `del ${formatVariableName(requiredLegacyArg(legacyName, values, 0), legacyName)}`;
    case "set_var":
      return `${formatVariableName(requiredLegacyArg(legacyName, values, 0), legacyName)} = ${quoteString(requiredLegacyArg(legacyName, values, 1))}`;
    case "change_var":
      return `${formatVariableName(requiredLegacyArg(legacyName, values, 0), legacyName)} += ${formatNumber(requiredLegacyArg(legacyName, values, 1), legacyName)}`;
    case "cost_money": {
      const amount = Number(requiredLegacyArg(legacyName, values, 0));
      if (!Number.isFinite(amount)) throw new Error(`cost_money 数量不是有效数字：${values[0] ?? ""}`);
      return formatCall("change_silver", [formatNumber(String(-amount), legacyName)]);
    }
    case "minus_maxpoints": {
      const characterId = requiredLegacyArg(legacyName, values, 0);
      const amount = formatNumber(requiredLegacyArg(legacyName, values, 1), legacyName);
      if (characterId !== "主角" || amount !== "5") {
        throw new Error(`minus_maxpoints 仅能无损迁移已知形式 主角#5，实际为：${value}`);
      }
      return formatCall("scale_stats", [quoteString(characterId), "0.5"]);
    }
    case "head": {
      const [first, second] = values;
      return formatCall("set_portrait", second
        ? [quoteString(first), quoteString(second)]
        : [quoteString("主角"), quoteString(requiredLegacyArg(legacyName, values, 0))]);
    }
    case "change_female_name":
      return formatCall("input_name", [quoteString("女主"), quoteString(requiredLegacyArg(legacyName, values, 0))]);
    case "select_head":
      return formatCall("select_portrait", [quoteString(values[0] || "主角")]);
    case "world_trigger":
      return formatCall("world_triggers", [formatLegacyBoolean(requiredLegacyArg(legacyName, values, 0), legacyName)]);
    case "toast":
    case "set_no_regret":
      return formatCall(command, [formatLegacyBoolean(requiredLegacyArg(legacyName, values, 0), legacyName)]);
    case "random_item": {
      const items = formatLegacyList(requiredLegacyArg(legacyName, values, 0));
      const args = values[1] ? [items, formatNumber(values[1], legacyName)] : [items];
      return formatCall("add_random_item", args);
    }
    case "random_join":
      return formatCall("join_random", [formatLegacyList(requiredLegacyArg(legacyName, values, 0))]);
    case "learn":
    case "remove":
      return skillMutationToCall(legacyName, typeParts.slice(1), values);
    case "upgrade":
      return upgradeToCall(typeParts.slice(1), values);
    default:
      return formatCall(command, formatCommandArguments(command, values));
  }
}

function skillMutationToCall(
  operation: "learn" | "remove",
  typeSuffix: string[],
  values: string[],
): string {
  const hasSuffix = typeSuffix.length > 0;
  const category = normalizeSkillCategory(hasSuffix
    ? typeSuffix.join("_")
    : requiredLegacyArg(operation, values, 0));
  const offset = hasSuffix ? 0 : 1;
  const characterId = requiredLegacyArg(operation, values, offset);
  const targetId = requiredLegacyArg(operation, values, offset + 1);
  const command = `${operation}_${category}`;
  const args = [quoteString(characterId), quoteString(targetId)];
  if (operation === "learn" && (category === "external" || category === "internal") && values[offset + 2]) {
    args.push(formatNumber(values[offset + 2], operation));
  }
  return formatCall(command, args);
}

function upgradeToCall(typeSuffix: string[], values: string[]): string {
  const hasSuffix = typeSuffix.length > 0;
  const targetType = actionTypeToCommand(hasSuffix
    ? typeSuffix.join("_")
    : requiredLegacyArg("upgrade", values, 0));
  const offset = hasSuffix ? 0 : 1;
  const characterId = requiredLegacyArg("upgrade", values, offset);

  if (CHARACTER_STATS.has(targetType)) {
    const delta = requiredLegacyArg("upgrade", values, offset + 1);
    return formatCall("change_stat", [quoteString(characterId), quoteString(targetType), formatNumber(delta, "upgrade")]);
  }

  const category = normalizeSkillCategory(targetType);
  if (category !== "external" && category !== "internal") {
    throw new Error(`upgrade 不支持 ${targetType} 分类，请改用对应的 v3 指令`);
  }
  const targetId = requiredLegacyArg("upgrade", values, offset + 1);
  const levels = values[offset + 2] ?? "1";
  return formatCall(`upgrade_${category}`, [quoteString(characterId), quoteString(targetId), formatNumber(levels, "upgrade")]);
}

function normalizeSkillCategory(value: string): "external" | "internal" | "special" | "talent" {
  switch (actionTypeToCommand(value)) {
    case "skill":
    case "skilll":
    case "external":
    case "externalskill":
    case "external_skill":
      return "external";
    case "internal":
    case "internalskill":
    case "internal_skill":
      return "internal";
    case "special":
    case "specialskill":
    case "special_skill":
      return "special";
    case "talent":
      return "talent";
    default:
      throw new Error(`未知的武学分类：${value}`);
  }
}

function statConditionToExpression(type: string, args: string[]): string | null {
  const match = /^(quanzhang|jianfa|daofa|qimen|bili|shenfa|wuxing|fuyuan|gengu|dingli)_(greater|more|less)_than$/u.exec(type);
  if (!match) return null;
  const characterId = requiredLegacyArg(type, args, 0);
  const operator = match[2] === "less" ? "<" : ">=";
  const query = `character_stat(${quoteString(characterId)}, ${quoteString(match[1])}) ${operator} ${formatNumber(requiredLegacyArg(type, args, 1), type)}`;
  return characterId === "主角" ? query : `in_team(${quoteString(characterId)}) and ${query}`;
}

function formatCommandArguments(command: string, values: string[]): string[] {
  const numericIndexes = NUMERIC_ARGUMENTS[command] ?? new Set<number>();
  return values.map((value, index) => numericIndexes.has(index)
    ? formatNumber(value, command)
    : quoteString(value));
}

function formatCall(command: string, args: string[]): string {
  return `${command}(${args.join(", ")})`;
}

function formatVariableName(value: string, context: string): string {
  const name = value.trim();
  if (!/^[a-z_][a-z0-9_]*$/u.test(name)) {
    throw new Error(`${context} 变量名必须是小写 snake_case：${value}`);
  }
  return name;
}

function quoteString(value: string): string {
  return `'${value
    .replace(/\\/gu, "\\\\")
    .replace(/'/gu, "\\'")
    .replace(/\r/gu, "\\r")
    .replace(/\n/gu, "\\n")
    .replace(/\t/gu, "\\t")}'`;
}

function formatNumber(value: string, context: string): string {
  const number = Number(value.trim());
  if (!Number.isFinite(number)) throw new Error(`${context} 参数不是有效数字：${value}`);
  return Object.is(number, -0) ? "0" : String(number);
}

function formatProbability(value: string): string {
  const percent = Number(value.trim());
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error(`probability 必须位于 0..100：${value}`);
  }
  return String(percent / 100);
}

function formatLegacyBoolean(value: string, context: string): string {
  switch (value.trim().toLowerCase()) {
    case "on":
    case "true":
    case "1":
      return "true";
    case "off":
    case "false":
    case "0":
      return "false";
    default:
      throw new Error(`${context} 参数不是 Boolean：${value}`);
  }
}

function formatLegacyList(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    throw new Error(`列表参数格式错误：${value}`);
  }
  const items = trimmed.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) throw new Error("列表参数不能为空");
  return `[${items.map(quoteString).join(", ")}]`;
}

function requiredLegacyArg(context: string, args: string[], index: number): string {
  const value = args[index];
  if (!value) throw new Error(`${context} 缺少第 ${index + 1} 个参数`);
  return value;
}

function actionTypeToCommand(type: string): string {
  return type.trim().toLowerCase();
}

function actionTypeToCommandName(type: string): string {
  return actionTypeToCommand(type.split(".").find((part) => part.length > 0) ?? type);
}

function tryGetWorldTriggerMode(action: ActionEntry): "on" | "off" | null {
  const normalizedType = action.type.trim().toUpperCase();
  const normalizedValue = action.value.trim();
  if (normalizedValue !== "NO_GLOBAL_EVENT") {
    return null;
  }

  switch (normalizedType) {
    case "SET_FLAG":
      return "off";
    case "CLEAR_FLAG":
      return "on";
    default:
      return null;
  }
}

function splitHashArgs(value: string): string[] {
  return value.split("#").map((part) => part.trim()).filter((part) => part.length > 0);
}

function convertLegacyInlineColorToBbCode(text: string): string {
  return text.replace(LEGACY_INLINE_COLOR_PATTERN, (_match, color: string, content: string) => {
    return `[color=${color}]${content}[/color]`;
  });
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

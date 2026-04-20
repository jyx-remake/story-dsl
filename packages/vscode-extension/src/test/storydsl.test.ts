import assert from "node:assert/strict";
import test from "node:test";
import { compileScript } from "../compiler/compiler";
import { convertXmlToStory } from "../converter/xml-to-story";
import { parseStory } from "../parser/parser";

test("parses choice, battle and condition then compiles to normalized IR", () => {
  const source = `# 游戏开始
胡斐：少侠来此所谓何事？
- 无事
  jump nothing
- 乞讨
  get_money 100
battle 新手战
- win
  南贤：少侠好身手
- lose
- timeout
  南贤：太墨迹了
if has_item 小刀 and $money>100
  南贤：不错
elif !has_item 小刀 || $money > 10
  南贤：也行
else
  南贤：穷鬼
`;

  const parsed = parseStory(source);
  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(parsed.ast.segments.length, 1);
  assert.equal(parsed.ast.segments[0].statements.length, 3);

  const compiled = compileScript(parsed.ast);
  assert.equal(compiled.diagnostics.length, 0);
  assert.equal(compiled.ir.segments[0].steps[0]?.kind, "choice");
  assert.equal(compiled.ir.segments[0].steps[1]?.kind, "battle");
  assert.equal(compiled.ir.segments[0].steps[2]?.kind, "branch");
  const choiceStep = compiled.ir.segments[0].steps[0];
  assert.equal(choiceStep.kind, "choice");
  assert.deepEqual(choiceStep.options[1].steps[0], {
    kind: "command",
    name: "get_money",
    args: [100],
  });

  const branchStep = compiled.ir.segments[0].steps[2];
  assert.equal(branchStep.kind, "branch");
  assert.equal(branchStep.cases.length, 2);
  assert.equal(branchStep.fallback?.length, 1);
  assert.deepEqual(branchStep.cases[0].when, [
    "and",
    ["pred", "has_item", "小刀"],
    [">", ["var", "money"], 100],
  ]);
  assert.deepEqual(branchStep.cases[1].when, [
    "or",
    ["not", ["pred", "has_item", "小刀"]],
    [">", ["var", "money"], 10],
  ]);
  assert.equal(branchStep.fallback?.[0]?.kind, "dialogue");
});

test("normalizes command arguments into value args", () => {
  const source = `# Start
set_reward $moneyCnt 小刀 2
`;

  const parsed = parseStory(source);
  assert.equal(parsed.diagnostics.length, 0);

  const compiled = compileScript(parsed.ast);
  assert.equal(compiled.diagnostics.length, 0);
  assert.deepEqual(compiled.ir.segments[0].steps[0], {
    kind: "command",
    name: "set_reward",
    args: [["var", "moneyCnt"], "小刀", 2],
  });
});

test("reports duplicate segments, reserved command names and invalid battle outcomes", () => {
  const source = `# A
and foo
battle Test
- draw
# A
南贤：重复段
`;

  const parsed = parseStory(source);
  assert.ok(parsed.diagnostics.some((item) => item.message.includes("保留字")));
  assert.ok(parsed.diagnostics.some((item) => item.message.includes("battle 分支只允许")));
  assert.ok(parsed.diagnostics.some((item) => item.message.includes("重复的剧情段名")));
});

test("skips unreachable steps in IR after jump", () => {
  const source = `# Start
jump End
南贤：这里不该到达
# End
南贤：结束
`;

  const parsed = parseStory(source);
  const compiled = compileScript(parsed.ast);
  assert.ok(compiled.diagnostics.some((item) => item.code === "unreachable"));
  assert.equal(compiled.ir.segments[0].steps.length, 1);
  assert.equal(compiled.ir.segments[0].steps[0]?.kind, "jump");
});

test("reports indentation and stray branch errors", () => {
  const source = "# Start\n   南贤：错缩进\n- stray\n";
  const parsed = parseStory(source);
  assert.ok(parsed.diagnostics.some((item) => item.code === "indentation"));
  assert.ok(parsed.diagnostics.some((item) => item.message.includes("只能作为 choice 或 battle")));
});

test("normalizes segment names by ignoring spaces after # and at line end", () => {
  const source = `#   游戏开始   
南贤：开始
# 游戏开始
南贤：重复
`;

  const parsed = parseStory(source);
  assert.equal(parsed.ast.segments[0].name, "游戏开始");
  assert.equal(parsed.ast.segments[1].name, "游戏开始");
  assert.ok(parsed.diagnostics.some((item) => item.message.includes("重复的剧情段名")));
});

test("converts story XML dialogue, commands, choice and standalone results to DSL", () => {
  const xml = `<root>
  <story name="新手村_南贤">
    <result type="story" ret="0" value="新手村_南贤_出村" />
    <result type="map" ret="1" value="南贤屋内" />
    <action type="MUSIC" value="音乐.室内_清新" />
    <action type="SELECT" value="南贤#有什么事吗？#出村#留下" />
  </story>
  <story name="新手村_武师7">
    <result type="story" ret="0" value="新手村_武师不能打木头人">
      <condition type="level_greater_than" value="主角#5" />
    </result>
    <action type="DIALOG" value="武师#好嘞，去练习一下！" />
  </story>
</root>`;

  const story = convertXmlToStory(xml);
  assert.equal(story, `# 新手村_南贤
music 音乐.室内_清新
南贤：有什么事吗？
- 出村
  jump 新手村_南贤_出村
- 留下
  map 南贤屋内

# 新手村_武师7
武师：好嘞，去练习一下！
if level_greater_than 主角 5
  jump 新手村_武师不能打木头人
`);

  assert.equal(parseStory(story).diagnostics.length, 0);
});

test("converts story XML battles, dotted action types and conditioned outcomes", () => {
  const xml = `<root>
  <story name="破庙_梅超风_迎战">
    <result type="story" ret="0" value="破庙_梅超风_胜利">
      <condition type="have_item" value="小刀" />
    </result>
    <result type="gameOver" ret="1" value="gameOver" />
    <action type="DIALOG" value="梅超风#找死 &amp; 接招！" />
    <action type="LEARN.SKILL" value="主角#伏虎掌#5" />
    <action type="UPGRADE..SKILL" value="小龙女#玉女素心剑#5" />
    <action type="BATTLE" value="新手村梅超风_战斗" />
  </story>
</root>`;

  const story = convertXmlToStory(xml);
  assert.equal(story, `# 破庙_梅超风_迎战
梅超风：找死 & 接招！
learn 主角 skill 伏虎掌 5
upgrade 小龙女 skill 玉女素心剑 5
battle 新手村梅超风_战斗
- win
  if have_item 小刀
    jump 破庙_梅超风_胜利
- lose
  gameover gameOver
`);

  assert.equal(parseStory(story).diagnostics.length, 0);
});

test("converts legacy inline color markup in XML dialogue and select text to BBCode", () => {
  const xml = `<root>
  <story name="新手提示">
    <action type="DIALOG" value="南贤#去[[red:洛阳]]找[[yellow:商店]]。" />
    <action type="SELECT" value="主角#选择[[magenta:难度]]#[[yellow:进阶]]#[[red:炼狱]]" />
    <result type="story" ret="0" value="进阶" />
    <result type="story" ret="1" value="炼狱" />
  </story>
</root>`;

  const story = convertXmlToStory(xml);
  assert.equal(story, `# 新手提示
南贤：去[color=red]洛阳[/color]找[color=yellow]商店[/color]。
主角：选择[color=magenta]难度[/color]
- [color=yellow]进阶[/color]
  jump 进阶
- [color=red]炼狱[/color]
  jump 炼狱
`);

  assert.equal(parseStory(story).diagnostics.length, 0);
});

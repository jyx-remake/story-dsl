import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { compileScript, convertXmlToStory, parseExpression, parseStory } from "@storydsl/core";

const start = { line: 1, column: 1, offset: 0 };

test("compiles v3 calls and string expressions", () => {
  const source = `# 开始
change_item('小还丹', 2)
掌柜：要买什么？
- 离开
  jump 结束
if item_count('小还丹') >= 1 and difficulty not in ['hard', 'crazy']
  - 使用
    remove_item('小还丹')
if in_team('郭襄') and character_level('郭襄') >= 20
  journal('郭襄已经成长。')
else
  journal('尚未达到条件。')
`;
  const parsed = parseStory(source);
  assert.deepEqual(parsed.diagnostics, []);
  const compiled = compileScript(parsed.ast);
  assert.deepEqual(compiled.diagnostics, []);
  assert.equal(compiled.ir.version, 3);
  assert.deepEqual(compiled.ir.segments[0].steps[0], {
    kind: "command",
    call: "change_item('小还丹', 2)",
  });
  const choice = compiled.ir.segments[0].steps[1];
  assert.equal(choice.kind, "choice");
  if (choice.kind === "choice") {
    assert.equal(choice.blocks[1].kind, "branch");
    if (choice.blocks[1].kind === "branch") {
      assert.equal(choice.blocks[1].cases[0].when, "item_count('小还丹') >= 1 and difficulty not in ['hard', 'crazy']");
    }
  }
  const branch = compiled.ir.segments[0].steps[2];
  assert.equal(branch.kind, "branch");
  assert.equal(branch.cases[0].when, "in_team('郭襄') and character_level('郭襄') >= 20");
});

test("compiles mixed choice blocks, branch chains and option tail conditions", () => {
  const source = `# Start
主角：请选择
- 离开
- 购买 if silver >= 100
if morality >= 50
  - 正道
  - 特殊正道 if rank <= 5
elif morality < 0
  - 邪道
else
  - 中立
- 尾部选项
if has_var('hidden_route')
  - 隐藏路线
`;
  const parsed = parseStory(source);
  assert.deepEqual(parsed.diagnostics, []);
  const compiled = compileScript(parsed.ast);
  assert.deepEqual(compiled.diagnostics, []);
  const choice = compiled.ir.segments[0].steps[0];
  assert.equal(choice.kind, "choice");
  if (choice.kind !== "choice") assert.fail("expected choice");
  assert.deepEqual(choice.blocks, [
    {
      kind: "options",
      options: [
        { text: "离开", steps: [] },
        { text: "购买", when: "silver >= 100", steps: [] },
      ],
    },
    {
      kind: "branch",
      cases: [
        {
          when: "morality >= 50",
          options: [
            { text: "正道", steps: [] },
            { text: "特殊正道", when: "rank <= 5", steps: [] },
          ],
        },
        { when: "morality < 0", options: [{ text: "邪道", steps: [] }] },
      ],
      fallback: [{ text: "中立", steps: [] }],
    },
    { kind: "options", options: [{ text: "尾部选项", steps: [] }] },
    {
      kind: "branch",
      cases: [{ when: "has_var('hidden_route')", options: [{ text: "隐藏路线", steps: [] }] }],
      fallback: null,
    },
  ]);
});

test("does not confuse option BBCode, quoted if text, or an ordinary branch with choice syntax", () => {
  const source = `# Start
主角：请选择
- [color=red]危险[/color]
- 引号 "what if this"
主角：对白结束
if true
  journal('ordinary branch')
`;
  const parsed = parseStory(source);
  assert.deepEqual(parsed.diagnostics, []);
  const steps = compileScript(parsed.ast).ir.segments[0].steps;
  assert.equal(steps[0].kind, "choice");
  if (steps[0].kind === "choice" && steps[0].blocks[0].kind === "options") {
    assert.deepEqual(steps[0].blocks[0].options.map((option) => option.text), [
      "[color=red]危险[/color]",
      '引号 "what if this"',
    ]);
  }
  assert.equal(steps[1].kind, "dialogue");
  assert.equal(steps[2].kind, "branch");
});

test("reports malformed choice chains, tail conditions, and removed when groups", () => {
  const source = `# Start
主角：条件错误
- 缺少条件 if
if true
  - 正常
  journal('分支内不是选项')
elif false
else false
  - 非法 else
elif true
  - else 后 elif
主角：旧语法
- 普通
when true
  - 旧条件
`;
  const messages = parseStory(source).diagnostics.map((item) => item.message);
  assert.ok(messages.some((message) => message.includes("表达式不能为空")));
  assert.ok(messages.some((message) => message.includes("else 后不能")));
  assert.ok(messages.some((message) => message.includes("else 必须是 choice")));
  assert.ok(messages.some((message) => message.includes("只能包含 '- 选项'")));
  assert.ok(messages.some((message) => message.includes("至少需要一个缩进")));
  assert.ok(messages.some((message) => message.includes("when 条件组已移除")));
});

test("parses the complete v3 expression precedence", () => {
  const result = parseExpression(
    "not false or 1 + 2 * -3 <= 4 and '辰' !in ['子', '丑'] and contains(['a'], 'a')",
    start,
  );
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.expr?.type, "binary");
  if (result.expr?.type === "binary") assert.equal(result.expr.operator, "or");
});

test("accepts booleans, exponent numbers, escaped strings, empty lists and nested calls", () => {
  const source = `# Start
enabled = true
ratio = -6.02e-3
text = 'it\\'s ok'
url = 'https://example.test/path'
items = []
nested = contains(['a', 'b'], 'a')
`;
  assert.deepEqual(parseStory(source).diagnostics, []);
});

test("compiles assignment sugar and variable deletion as v3 state steps", () => {
  const source = `# Start
quest_stage = 1
quest_stage += random(1)
quest_stage -= 2
del quest_stage
`;
  const parsed = parseStory(source);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(compileScript(parsed.ast).ir.segments[0].steps, [
    { kind: "set", target: "quest_stage", value: "1" },
    { kind: "set", target: "quest_stage", value: "quest_stage + (random(1))" },
    { kind: "set", target: "quest_stage", value: "quest_stage - (2)" },
    { kind: "delete", target: "quest_stage" },
  ]);
});

test("compiles Chinese variable identifiers in assignments, expressions and deletion", () => {
  const source = `# 中文变量
是否拜师 = true
门派声望_2 = 9
if 是否拜师 and 门派声望_2 >= 9
  完成入门任务 = '是'
del 门派声望_2
`;
  const parsed = parseStory(source);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(compileScript(parsed.ast).ir.segments[0].steps, [
    { kind: "set", target: "是否拜师", value: "true" },
    { kind: "set", target: "门派声望_2", value: "9" },
    {
      kind: "branch",
      cases: [{
        when: "是否拜师 and 门派声望_2 >= 9",
        steps: [{ kind: "set", target: "完成入门任务", value: "'是'" }],
      }],
      fallback: null,
    },
    { kind: "delete", target: "门派声望_2" },
  ]);
});

test("supports state steps in every nested statement container", () => {
  const source = `# Start
if true
  branch_value = 1
主角：选择
- 继续
  choice_value = 1
battle test
- win
  battle_value = 1
call Shared

# Shared
called_value = 1
return
`;
  const parsed = parseStory(source);
  assert.deepEqual(parsed.diagnostics, []);
  const compiled = compileScript(parsed.ast);
  assert.deepEqual(compiled.diagnostics, []);
  const serialized = JSON.stringify(compiled.ir);
  for (const target of ["branch_value", "choice_value", "battle_value", "called_value"]) {
    assert.ok(serialized.includes(`\"target\":\"${target}\"`), target);
  }
});

test("rejects malformed assignment and deletion statements", () => {
  const source = `# Start
missing =
del
del first second
if quest_stage = 1
  journal('invalid')
journal(quest_stage = 1)
`;
  const messages = parseStory(source).diagnostics.map((item) => item.message);
  assert.ok(messages.some((message) => message.includes("表达式不能为空")));
  assert.ok(messages.some((message) => message.includes("del 之后必须提供变量名")));
  assert.ok(messages.some((message) => message.includes("del 只能删除一个")));
  assert.ok(messages.some((message) => message.includes("尾随内容")));
  assert.ok(messages.length >= 5);
});

test("rejects old command syntax and non-call command roots", () => {
  const source = `# Start
change_item 小还丹 2
silver >= 10
$legacy
`;
  const messages = parseStory(source).diagnostics.map((item) => item.message);
  assert.ok(messages.some((message) => message.includes("尾随内容")));
  assert.ok(messages.some((message) => message.includes("命令必须是函数调用")));
  assert.ok(messages.some((message) => message.includes("标识符只能")));
});

test("reports malformed v3 expressions", () => {
  const source = `# Start
change_item('x',)
change_item('x'
if current_time_slot in ['子' '丑']
  jump End
if "unterminated
  jump End
`;
  const messages = parseStory(source).diagnostics.map((item) => item.message);
  assert.ok(messages.some((message) => message.includes("分隔符后缺少")));
  assert.ok(messages.some((message) => message.includes("缺少右括号")));
  assert.ok(messages.some((message) => message.includes("必须使用 ','")));
  assert.ok(messages.some((message) => message.includes("结束引号")));
});

test("preserves single and double quoted strings in v3 IR", () => {
  const parsed = parseStory(`# Start
journal('单引号')
journal("双引号")
`);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(compileScript(parsed.ast).ir.segments[0].steps, [
    { kind: "command", call: "journal('单引号')" },
    { kind: "command", call: 'journal("双引号")' },
  ]);
});

test("adds the maxlevel once key in every nested statement", () => {
  const source = `# 某剧情
maxlevel('独孤九剑', 1)
主角：选择
- 练习
  maxlevel('胡家刀法', 2)
if true
  maxlevel('斗转星移', 3)
battle 新手战
- win
  maxlevel('野球拳', 4)
# 自定义
maxlevel('独孤九剑', 1, 'custom_key')
# 动态
maxlevel(skill_id, 1)
`;
  const parsed = parseStory(source);
  assert.deepEqual(parsed.diagnostics, []);
  const compiled = compileScript(parsed.ast);
  assert.equal(compiled.diagnostics.length, 1);
  assert.match(compiled.diagnostics[0].message, /maxlevel/);
  assert.deepEqual(compiled.ir.segments[0].steps[0], {
    kind: "command",
    call: "maxlevel('独孤九剑', 1, '某剧情_独孤九剑')",
  });
  const choice = compiled.ir.segments[0].steps[1];
  assert.equal(choice.kind, "choice");
  assert.equal(choice.blocks[0].kind, "options");
  if (choice.blocks[0].kind !== "options") assert.fail("expected options block");
  assert.deepEqual(choice.blocks[0].options[0].steps[0], {
    kind: "command",
    call: "maxlevel('胡家刀法', 2, '某剧情_胡家刀法')",
  });
  assert.deepEqual(compiled.ir.segments[1].steps[0], {
    kind: "command",
    call: "maxlevel('独孤九剑', 1, 'custom_key')",
  });
});

test("keeps dialogue and choice presentation styles", () => {
  const parsed = parseStory(`# Start
胡斐：[#style=怒气.强调]你骗我！
掌柜：[#style=shop-cards]客官需要什么？
- 离开
  jump End
`);
  assert.deepEqual(parsed.diagnostics, []);
  const steps = compileScript(parsed.ast).ir.segments[0].steps;
  assert.deepEqual(steps[0], { kind: "dialogue", speaker: "胡斐", text: "你骗我！", style: "怒气.强调" });
  assert.equal(steps[1].kind, "choice");
  if (steps[1].kind === "choice") assert.equal(steps[1].style, "shop-cards");
});

test("keeps call/return and unreachable diagnostics", () => {
  const parsed = parseStory(`# Start
call Shared
return
journal('unreachable')
# Shared
return
`);
  assert.deepEqual(parsed.diagnostics, []);
  const compiled = compileScript(parsed.ast);
  assert.ok(compiled.diagnostics.some((item) => item.code === "unreachable"));
  assert.deepEqual(compiled.ir.segments[0].steps, [
    { kind: "call", target: "Shared" },
    { kind: "return" },
  ]);
});

test("reports structural and indentation errors", () => {
  const parsed = parseStory(`# A
   journal('bad indent')
- stray
when true
# A
return value
`);
  assert.ok(parsed.diagnostics.some((item) => item.code === "indentation"));
  assert.ok(parsed.diagnostics.some((item) => item.message.includes("只能作为 choice 或 battle")));
  assert.ok(parsed.diagnostics.some((item) => item.message.includes("when 条件组已移除")));
  assert.ok(parsed.diagnostics.some((item) => item.message.includes("重复的剧情段名")));
  assert.ok(parsed.diagnostics.some((item) => item.message.includes("return 后不能跟参数")));
});

test("converter emits canonical v3 statements and guarded conditions", () => {
  const xml = `<root><story name="测试">
    <action type="DIALOG" value="南贤#你好"/>
    <action type="ITEM" value="小还丹#2"/>
    <action type="COST_MONEY" value="100"/>
    <action type="NICK" value="初出茅庐"/>
    <action type="HEAD" value="头像.少林弟子"/>
    <action type="SET_FLAG" value="NO_GLOBAL_EVENT"/>
    <action type="CLEAR_FLAG" value="NO_GLOBAL_EVENT"/>
    <action type="SET_FLAG" value="quest_started"/>
    <action type="CLEAR_FLAG" value="quest_started"/>
    <action type="SET_FLAG" value="是否拜师"/>
    <action type="CLEAR_FLAG" value="是否拜师"/>
    <action type="SET_VAR" value="quest_note#ready"/>
    <action type="CHANGE_VAR" value="quest_stage#2"/>
    <action type="REMOVE_VAR" value="quest_note"/>
    <action type="LEARN.SKILL" value="主角#伏虎掌#5"/>
    <action type="LEARN.INTERNALSKILL" value="主角#基本内功#5"/>
    <action type="LEARN.SPECIALSKILL" value="主角#凌波微步"/>
    <action type="LEARN.TALENT" value="主角#妙手空空"/>
    <action type="UPGRADE" value="拳掌#主角#3"/>
    <action type="UPGRADE.SKILL" value="郭襄#峨眉剑法#2"/>
    <action type="UPGRADE.INTERNALSKILL" value="主角#基本内功#2"/>
    <action type="REMOVE.SKILL" value="主角#伏虎掌"/>
    <action type="REMOVE.TALENT" value="主角#妙手空空"/>
    <action type="RANDOM_ITEM" value="[小还丹, 大还丹]#2"/>
    <action type="RANDOM_JOIN" value="[郭襄, 程英]"/>
    <action type="MINUS_MAXPOINTS" value="主角#5"/>
    <action type="TOAST" value="off"/>
    <action type="NEWBIE" value="ignored"/>
    <action type="TOUCH" value="ignored"/>
    <result type="story" ret="0" value="结束">
      <condition type="level_greater_than" value="郭襄#20"/>
      <condition type="probability" value="25"/>
    </result>
  </story></root>`;
  const story = convertXmlToStory(xml);
  assert.equal(story, `# 测试
南贤：你好
change_item('小还丹', 2)
change_silver(-100)
unlock_achievement('初出茅庐')
set_portrait('主角', '头像.少林弟子')
world_triggers(false)
world_triggers(true)
quest_started = true
del quest_started
是否拜师 = true
del 是否拜师
quest_note = 'ready'
quest_stage += 2
del quest_note
learn_external('主角', '伏虎掌', 5)
learn_internal('主角', '基本内功', 5)
learn_special('主角', '凌波微步')
learn_talent('主角', '妙手空空')
change_stat('主角', '拳掌', 3)
upgrade_external('郭襄', '峨眉剑法', 2)
upgrade_internal('主角', '基本内功', 2)
remove_external('主角', '伏虎掌')
remove_talent('主角', '妙手空空')
add_random_item(['小还丹', '大还丹'], 2)
join_random(['郭襄', '程英'])
scale_stats('主角', 0.5)
toast(false)
if in_team('郭襄') and character_level('郭襄') >= 20 and chance(0.25)
  jump 结束
`);
  const parsed = parseStory(story);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(compileScript(parsed.ast).diagnostics, []);
});

test("converter emits v3 choices, battles, valueless commands and escaped strings", () => {
  const xml = `<root>
    <story name="选择"><action type="SELECT" value="主角#去&apos;哪？#出发#结束"/><result type="story" ret="0" value="下一段"/><result type="gameFin" ret="1" value="gameFin"/></story>
    <story name="战斗"><action type="BATTLE" value="测试战斗"/><result type="story" ret="win" value="胜利"/><result type="gameOver" ret="lose" value="gameOver"/></story>
  </root>`;
  const story = convertXmlToStory(xml);
  assert.equal(story, `# 选择
主角：去'哪？
- 出发
  jump 下一段
- 结束
  game_complete()

# 战斗
battle 测试战斗
- win
  jump 胜利
- lose
  game_over()
`);
  const parsed = parseStory(story);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(compileScript(parsed.ast).diagnostics, []);
});

test("converter canonicalizes legacy packed battle references", () => {
  const xml = `<root><story name="旧式战斗"><action type="BATTLE" value="测试战斗#1#3" /></story></root>`;
  const story = convertXmlToStory(xml);
  assert.equal(story, `# 旧式战斗\nbattle 测试战斗#1#3\n`);
  const parsed = parseStory(story);
  assert.deepEqual(parsed.diagnostics, []);
  const compiled = compileScript(parsed.ast);
  assert.deepEqual(compiled.diagnostics, []);
  const step = compiled.ir.segments[0].steps[0];
  assert.equal(step.kind, "battle");
  assert.equal(step.battleId, "测试战斗");
  assert.equal(step.totalBattles, 1);
  assert.equal(step.battleLevel, 3);
});

test("converter preserves known XML quirks and legacy defaults", () => {
  const xml = `<root><story name="兼容数据">
    <action type="DIALOg" value="主角#大小写异常仍是对白"/>
    <action type="CHANGE_FEMALE_NAME" value="铃兰"/>
    <action type="UPGRADE.SKILLL" value="达尔巴#火焰刀法#5"/>
    <action type="UPGRADE……SKILL" value="小龙女#玉女素心剑#5"/>
    <action type="MAXLEVEL" value="火焰刀法#2"/>
    <result type="story" value="好感结局"><condition type="haogan_more_than" value="100"/></result>
    <result type="story" value="排名结局"><condition type="rank" value="10"/></result>
  </story></root>`;
  const story = convertXmlToStory(xml);
  assert.equal(story, `# 兼容数据
主角：大小写异常仍是对白
input_name('女主', '铃兰')
upgrade_external('达尔巴', '火焰刀法', 5)
upgrade_external('小龙女', '玉女素心剑', 5)
maxlevel('火焰刀法', 2)
if favorability('女主') >= 100
  jump 好感结局
if rank != -1 and rank <= 10
  jump 排名结局
`);
  const parsed = parseStory(story);
  assert.deepEqual(parsed.diagnostics, []);
  const compiled = compileScript(parsed.ast);
  assert.deepEqual(compiled.diagnostics, []);
  assert.deepEqual(compiled.ir.segments[0].steps[4], {
    kind: "command",
    call: "maxlevel('火焰刀法', 2, '兼容数据_火焰刀法')",
  });
});

test("converter adapts XMJH character, clock, cloud and random-item actions", () => {
  const xml = `<root><story name="侠说动作">
    <action type="CHANGE_ROLE_NAME" value="孩子#大地图家"/>
    <action type="SPECIFIED_ROLE_NAME" value="主角# 郭靖|二代过长名字 "/>
    <action type="FEMALE" value="孩子#1"/>
    <action type="FEMALE" value="2"/>
    <action type="HEAD_V2" value="孩子#头像.女孩"/>
    <action type="COST_HOUR" value="2"/>
    <action type="TO_CHINESETIME" value="子"/>
    <action type="SHOW_CLOUD" value="0"/>
    <action type="SHOW_CLOUD" value="1"/>
    <action type="FADEOUT" value="1 --淡出背景"/>
    <action type="RANDOMITEM" value="龙泉剑#1#精钢拳套#1"/>
    <action type="RANDOMITEM" value="药丸甲|药丸乙#2"/>
    <action type="RANDOMITEM" value="甲#1#乙#2"/>
  </story></root>`;

  const story = convertXmlToStory(xml);
  assert.equal(story, `# 侠说动作
input_name('孩子')
set_character_name('主角', '郭靖二代过长名')
set_gender('孩子', 'female')
set_gender('主角', 'eunuch')
set_portrait('孩子', '头像.女孩')
advance_time_slots(2)
advance_to_time_slot('子')
show_cloud(false)
show_cloud(true)
fade('out', 1)
add_random_item(['龙泉剑', '精钢拳套'], 1)
add_random_item(['药丸甲', '药丸乙'], 2)
add_random_item_options(['甲#1', '乙#2'])
`);
  const parsed = parseStory(story);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(compileScript(parsed.ast).diagnostics, []);
});

test("converter adapts XMJH calendar, completion and character conditions", () => {
  const xml = `<root><story name="侠说条件">
    <result type="story" value="甲"><condition type="SHOULD_FINISH_MORE_THAN" value="循环剧情#3"/></result>
    <result type="story" value="乙"><condition type="STORY_EXCEED_DAY" value="旧事#7"/></result>
    <result type="story" value="丙"><condition type="IN_MENPAI" value="武当派"/></result>
    <result type="story" value="丁"><condition type="!IN_TIME" value="子#丑"/></result>
    <result type="story" value="戊"><condition type="IN_DAY|IN_DAY" value="20220909|20221001"/><condition type="SHOULD_NOT_FINISH" value="节日已领"/></result>
    <result type="story" value="己"><condition type="DATE_LESS_THAN" value="00010401"/></result>
    <result type="story" value="庚"><condition type="IS_VERSION" value="侠说"/></result>
    <result type="story" value="辛"><condition type="LEVEL_GREATER_THAN" value="20"/></result>
    <result type="story" value="壬"><condition type="SKILL_MORE_THAN" value="太极拳#10"/></result>
    <result type="story" value="癸"><condition type="MAXHP_GREATER_THAN" value="主角#1000"/></result>
    <result type="story" value="子"><condition type="KEY_IS_FEMALE" value="孩子#1"/></result>
    <result type="story" value="丑"><condition type="HAOGAN_EQUALS_THAN2" value="黄蓉#郭襄"/></result>
    <result type="story" value="寅"><condition type="CAIYAO" value="3"/></result>
    <result type="story" value="卯"><condition type="LSJZ" value="4"/></result>
    <result type="story" value="辰"><condition type="NICK_MORE_THAN" value="10"/></result>
    <result type="story" value="巳"><condition type="JISHA_MORE_THAN" value="100"/></result>
  </story></root>`;

  const story = convertXmlToStory(xml);
  assert.equal(story, `# 侠说条件
if story_completion_count('循环剧情') >= 3
  jump 甲
if story_completed('旧事') and story_elapsed_days('旧事') > 7
  jump 乙
if sect == '武当派'
  jump 丙
if not (current_time_slot == '子' or current_time_slot == '丑')
  jump 丁
if ((system_date == 20220909) or (system_date == 20221001)) and not story_completed('节日已领')
  jump 戊
if current_date < 10401
  jump 己
if true
  jump 庚
if character_level('主角') >= 20
  jump 辛
if skill_level('主角', '太极拳') >= 10
  jump 壬
if character_stat('主角', 'maxhp') >= 1000
  jump 癸
if character_gender('孩子') == 'female'
  jump 子
if favorability('黄蓉') == favorability('郭襄')
  jump 丑
if favorability('采药') == 3
  jump 寅
if favorability('卷宗') == 4
  jump 卯
if achievement_count >= 10
  jump 辰
if kill_count >= 100
  jump 巳
`);
  const parsed = parseStory(story);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(compileScript(parsed.ast).diagnostics, []);
});

test("converter rejects legacy values that cannot be migrated safely", () => {
  assert.throws(
    () => convertXmlToStory(`<root><story name="错误"><action type="MINUS_MAXPOINTS" value="郭襄#3"/></story></root>`),
    /minus_maxpoints/u,
  );
  assert.throws(
    () => convertXmlToStory(`<root><story name="错误"><result type="story" value="结束"><condition type="probability" value="120"/></result></story></root>`),
    /probability/u,
  );
  assert.throws(
    () => convertXmlToStory(`<root><story name="错误"><action type="SET_FLAG" value="非法标记!"/></story></root>`),
    /有效标识符/u,
  );
});

test("all tracked story examples parse and compile as v3", () => {
  const examplesDirectory = path.resolve(process.cwd(), "..", "..", "examples");
  const files = fs.readdirSync(examplesDirectory).filter((file) => file.endsWith(".story"));
  let maxlevelCount = 0;
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = fs.readFileSync(path.join(examplesDirectory, file), "utf8");
    assert.doesNotMatch(
      source,
      /^\s*(?:item|cost_item|random_item|random_join|get_money|cost_money|nick|head|world_trigger|newbie|touch|minus_maxpoints)\s+/mu,
      file,
    );
    assert.doesNotMatch(
      source,
      /\b(?:should_not_finish|not_in_team|have_money|game_mode|probability|level_greater_than|skill_less_than)\b/u,
      file,
    );
    for (const line of source.split(/\r?\n/u)) {
      for (const match of line.matchAll(/(?:character_level|character_stat|skill_level)\('([^']+)'/gu)) {
        if (match[1] !== "主角") {
          assert.ok(line.includes(`in_team('${match[1]}') and`), `${file}: unguarded character query: ${line}`);
        }
      }
    }
    const parsed = parseStory(source);
    assert.deepEqual(parsed.diagnostics.filter((item) => item.severity === "error"), [], file);
    const compiled = compileScript(parsed.ast);
    assert.deepEqual(compiled.diagnostics, [], file);
    assert.equal(compiled.ir.version, 3, file);
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (value === null || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      if (record.kind === "command" && typeof record.call === "string" && record.call.startsWith("maxlevel(")) {
        const expression = parseExpression(record.call, start);
        assert.deepEqual(expression.diagnostics, [], `${file}: ${record.call}`);
        assert.equal(expression.expr?.type, "callExpr", `${file}: ${record.call}`);
        if (expression.expr?.type === "callExpr") {
          assert.equal(expression.expr.args.length, 3, `${file}: ${record.call}`);
        }
        maxlevelCount += 1;
      }
      Object.values(record).forEach(visit);
    };
    visit(compiled.ir.segments);
  }
  assert.equal(maxlevelCount, 187);
});

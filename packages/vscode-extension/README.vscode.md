# Story DSL

Story DSL 是一个 VSCode 扩展，用于编辑剧情脚本 `.story` 文件并输出 JSON IR。

## Features

- `.story` 文件语言识别
- 基础语法高亮
- 段级大纲展示
- 实时语法诊断
- 保存时自动编译为同名 `.story.json`
- 从旧版 Story XML 转换为严格的 Story v3 `.story` 草稿

## Commands

- `Story DSL: Validate Current Story`
- `Story DSL: Compile Current Story`
- `Story DSL: Compile All Stories`
- `Story DSL: Convert XML To Story`

`Convert XML To Story` 输出 v3 canonical 语句并在写入前执行 parser/compiler 验证。通用变量动作会转换为裸赋值或 `del`，`NO_GLOBAL_EVENT` 特例仍转换为世界触发器开关。未指定输出时保存为不冲突的 `<原名>.converted.story`、`<原名>.converted-2.story` 等；显式指定输出路径时会覆盖已有生成文件，避免旧产物掩盖转换器修复。非主角角色查询自动添加 `in_team(id) and ...` 短路保护；XML 中的 `skill` 按 External skill 转换。
旧 XML 对话与选项文本里的 `[[red:文本]]` 这类颜色标记会在转换时统一改写为 BBCode，例如 `[color=red]文本[/color]`。
当旧 XML 的多个 result 无法无歧义落到当前 DSL 的单一跳转语义时，转换器会保留可编译的主路径，并把冲突结果输出为注释。

## Syntax Snapshot

### Segment

```text
# 游戏开始
南贤：游戏开始
```

### Dialogue And Choice

```text
南贤：你要做什么？
- 出门
  jump 出门后
- 休息
  change_silver(100)
```

Dialogue and the whole choice can select a host-defined presentation style:

```text
南贤：[#style=opening]游戏开始
掌柜：[#style=shop-cards]客官需要什么？
- 购买
- 离开
```

The style tag must appear at the start of the dialogue text. Whitespace is allowed around `#`, `style`, `=`, the style ID, and `]`, but not inside the style ID itself. Choice-option styles and other metadata tags are not supported yet.

### Battle

```text
battle 新手战
- win
  南贤：不错
- lose
  南贤：再练练
- timeout
  南贤：太慢了
```

### Condition

```text
if item_count('小刀') >= 1 and silver > 100
  南贤：不错
elif item_count('小刀') == 0 or silver > 10
  南贤：也行
else
  南贤：穷鬼
```

Choice options support both tail conditions and mutually exclusive condition blocks:

```text
掌柜：客官需要什么？
- 离开
  jump leave
if shop_open and silver > 0
  - 购买
    jump buy
  - 出售 if has_var('sell_license')
    jump sell
elif silver <= 0
  - 赊账
else
  - 询问行情
```

## Current Rules

- 段头必须是顶格 `# 段名`
- 仅允许空格缩进，且 2 空格一级
- 对白支持 `:` 和 `：`
- `battle` 当前只支持 `win / lose / timeout`，结果分支可以全部省略
- command 必须使用 `name(...)` 函数调用语法
- 字符串优先使用单引号；动态变量可使用小写 snake_case 或汉字标识符
- 剧情变量使用 `name = expr`、`name += expr`、`name -= expr` 写入，使用 `del name` 删除
- `jump` 是终止语句

## JSON IR Notes

- `if / elif / else` 会编译为 `branch { cases, fallback }`
- 无结果分支的 `battle` 会编译为空的 `outcomes: {}`
- choice 编译为有序 `blocks`；条件链使用 `branch { cases, fallback }`，单项条件写入 option 的 `when`
- `[#style=...]` 会编译为可选的 `dialogue.style` 或顶层 `choice.style`
- IR 版本为 3；command 使用 `{ kind: "command", call: "..." }`，变量状态使用 `set` / `delete` step
- branch、choice case 和 choice option 的 `when` 直接保存表达式字符串
- `maxlevel('技能名', 等级)` 会额外补第三个参数 `'当前剧情段名_技能名'`；已显式提供第三参时保留原值

## Limitations

- 不支持 `null`、成员访问、索引、赋值表达式或三元表达式
- `choice` 只能出现在对白之后
- 当前只做静态高亮，不做语义 token 和 LSP
- 富文本当前仅在 XML 转换阶段处理旧颜色标记；颜色、粗体、下划线、点击、图标、变量插值的正式模型仍待设计

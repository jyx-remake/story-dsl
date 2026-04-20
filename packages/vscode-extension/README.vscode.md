# Story DSL

Story DSL 是一个 VSCode 扩展，用于编辑剧情脚本 `.story` 文件并输出 JSON IR。

## Features

- `.story` 文件语言识别
- 基础语法高亮
- 段级大纲展示
- 实时语法诊断
- 保存时自动编译为同名 `.story.json`
- 从旧版 Story XML 转换为 `.story` 草稿

## Commands

- `Story DSL: Validate Current Story`
- `Story DSL: Compile Current Story`
- `Story DSL: Compile All Stories`
- `Story DSL: Convert XML To Story`

`Convert XML To Story` 会读取当前打开的 `.xml` 文件，或提示选择 XML 文件，并在同目录输出同名 `.story`。
转换会保留段名和取值中的原始 `_` / `.`，只把 XML 的 action/result 类型映射为小写 DSL 命令名。
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
  get_money 100
```

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
if has_item 小刀 and $money > 100
  南贤：不错
elif !has_item 小刀 || $money > 10
  南贤：也行
else
  南贤：穷鬼
```

## Current Rules

- 段头必须是顶格 `# 段名`
- 仅允许空格缩进，且 2 空格一级
- 对白支持 `:` 和 `：`
- `battle` 当前只支持 `win / lose / timeout`
- 变量必须带 `$`
- `jump` 是终止语句

## JSON IR Notes

- `if / elif / else` 会编译为 `branch { cases, fallback }`
- 表达式使用紧凑前缀数组，例如：
  - `["var", "money"]`
  - `["pred", "has_item", "小刀"]`
  - `["and", left, right]`
- 命令参数会归一化为值参数，例如 `100`、`"小刀"`、`["var", "money"]`

## Limitations

- 当前不支持引号字符串和转义
- `choice` 只能出现在对白之后
- 当前只做静态高亮，不做语义 token 和 LSP
- 富文本当前仅在 XML 转换阶段处理旧颜色标记；颜色、粗体、下划线、点击、图标、变量插值的正式模型仍待设计

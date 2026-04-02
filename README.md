# Story DSL Project

这是一个围绕剧情脚本 DSL 的工具链仓库，当前主体包括两部分：

- VSCode 插件：编辑 `.story` 文件、提供高亮与诊断、编译为 JSON IR
- C# 运行时原型：消费 JSON IR，位于 `packages/runtime-csharp/`

本文件面向仓库使用者与协作者。插件打包页使用单独的 `packages/vscode-extension/README.vscode.md`。

## Current Scope

当前已经实现：

- `.story` 文件语言识别
- TextMate 基础高亮
- DSL 解析为 AST
- AST 归一化编译为 JSON IR
- VSCode 问题面板诊断
- 保存时自动输出同名 `.story.json`
- 段级大纲展示

仓库仍以 VSCode 插件与 JSON IR 编译为主，`packages/runtime-csharp/` 是独立的消费端原型。

后续演进计划集中记录在 `TODO.md`，当前只作为设计稿，不代表已经实现。

## Quick Start

根目录的 `npm` 命令是工作区代理脚本，会转发到 `packages/vscode-extension/`。

```powershell
npm run install:vscode
npm run build
npm test
```

在 VSCode 中打开本目录后：

1. 按 `F5` 启动 Extension Development Host
2. 打开 `examples/demo.story`
3. 确认右下角语言模式为 `Story DSL`
4. 保存文件，插件会在同目录输出 `demo.story.json`

如果要导出插件包，使用：

```powershell
npm run package:vsix
```

## Commands

- `Story DSL: Validate Current Story`
- `Story DSL: Compile Current Story`
- `Story DSL: Compile All Stories`

## DSL Snapshot

### 剧情段

```text
# 游戏开始
南贤：游戏开始
```

- 段头必须顶格
- 段名全文件唯一
- 段名语义上等于 `#` 后整行去首尾空格后的结果
- `#` 后紧随的空格无效，行末空格也无效
- 因此 `# 游戏开始`、`#   游戏开始`、`# 游戏开始   ` 指向同一个段名

### 对白

```text
胡斐：飞天狐狸！
胡斐 : 飞天狐狸！
：只有文本
胡斐：
```

- 支持 `:` 和 `：`
- 冒号左右空格忽略
- 角色名和文本都允许为空

### 命令与跳转

```text
change_map 金陵
play_music 笑傲江湖曲
jump 游戏开始
```

- 参数按空格分词
- JSON IR 中命令参数会归一化为值参数：数字变数字，`$name` 变 `["var", "name"]`
- 第一版不支持带空格字符串参数
- `jump` 会终止当前段后续同级语句的 IR 输出

### 选择分支

```text
胡斐：少侠来此所谓何事？
- 无事
  jump nothing
- 乞讨
  get_money 100
```

- `choice` 不是独立头语法，而是“对白后紧跟若干 `- 选项`”
- 分支体允许多语句

### 战斗分支

```text
battle 新手战
- win
  南贤：少侠好身手
- lose
- timeout
  南贤：太墨迹了
```

- 当前只支持 `win / lose / timeout`
- IR 中使用 `battleId`

### 条件分支

```text
if has_item 小刀 and $money > 100
  南贤：不错
elif !has_item 小刀 || $money > 10
  南贤：也行
else
  南贤：穷鬼
```

- 支持 `and or not && || ! ()`
- IR 中统一为 `and / or / not`
- 变量必须带 `$`
- 裸词默认为常量或谓词参数
- JSON IR 中 `variable.name` 不保留前导 `$`
- `if / elif / else` 在 JSON IR 中统一编译为 `branch { cases, fallback }`

## JSON IR Shape

顶层结构：

```json
{
  "version": 1,
  "segments": []
}
```

典型节点字段：

- `dialogue`: `speaker`, `text`
- `command`: `name`, `args`
- `jump`: `target`
- `choice`: `prompt`, `options`
- `battle`: `battleId`, `outcomes`
- `branch`: `cases`, `fallback`

表达式使用紧凑前缀数组 IR：

- 变量：`["var", "money"]`
- 命令参数：`["var", "money"]`、`100`、`"小刀"`
- 谓词：`["pred", "has_item", "小刀"]`
- 取反：`["not", expr]`
- 逻辑与比较：`["and", left, right]`、`[">", left, right]`
- 字面量：直接输出 JSON 字符串或数字

完整示例可见：

- `examples/demo.story`
- `examples/demo.story.json`

## Project Structure

```text
examples/
  demo.story             示例 DSL
packages/
  vscode-extension/
    src/                 VSCode 插件源码
    dist/                VSCode 插件构建产物
    syntaxes/            TextMate 高亮
    README.vscode.md     插件打包页专用说明
  runtime-csharp/
    StoryDsl.Runtime.slnx  C# 执行器解决方案
TODO.md
  后续语法与架构演进计划
```

## Development Notes

- 插件代码在 `packages/vscode-extension/`
- C# 执行器在 `packages/runtime-csharp/`
- 根目录 `npm run build / test / package:vsix` 会转发到插件包
- `TODO.md` 只记录后续设计方向，不表示功能已实现
- `packages/vscode-extension/README.vscode.md` 专用于插件打包，不承担仓库总说明职责
- 修改解析或 IR 后，请同步更新测试与示例 JSON
- 高亮规则在 `packages/vscode-extension/syntaxes/story.tmLanguage.json`
- 若只改 TypeScript 代码，重新执行 `npm run build`

## Current Constraints

- 严格缩进：仅允许空格，2 空格一级，禁止 Tab
- `//` 会被当作注释起点
- 不支持引号字符串、转义、`%temp`、`@player.name`
- `choice` 只能出现在对白之后
- 当前只做静态高亮，不做语义 token 和 LSP

## Roadmap Snapshot

当前只确定方向，不代表已经落地：

1. `call / return`
2. `set`
3. 选项级条件与一次性选项
4. 局部变量
5. 标签 / 元数据
6. 输入语法与历史系统评估

详细计划见 `TODO.md`。

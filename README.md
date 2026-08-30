# Story DSL Project

这是一个围绕剧情脚本 DSL 的工具链仓库，当前主体包括三部分：

- TypeScript 核心库：解析 `.story`、生成 AST、编译 JSON IR，位于 `packages/core/`
- VSCode 插件：编辑 `.story` 文件、提供高亮与诊断、编译为 JSON IR
- Web 版：浏览器内编辑、诊断、查看和下载 JSON IR，位于 `packages/web/`

本文件面向仓库使用者与协作者。插件打包页使用单独的 `packages/vscode-extension/README.vscode.md`。

## Current Scope

当前已经实现：

- `.story` 文件语言识别
- TextMate 基础高亮
- DSL 解析为 AST
- AST 归一化编译为 JSON IR
- Web 编辑器、大纲、诊断、JSON IR 预览和下载
- VSCode 问题面板诊断
- 保存时自动输出同名 `.story.json`
- 段级大纲展示
- 从旧版 Story XML 转换为严格的 Story v3 `.story` 草稿
- `call / return` 剧情段调用与返回控制流

仓库以 `packages/core/` 的 DSL 核心为共享源，VSCode 插件与 Web 版复用同一套 parser/compiler。

后续演进计划集中记录在 `TODO.md`，当前只作为设计稿，不代表已经实现。

## Quick Start

仓库使用 npm workspaces 管理 TypeScript 包。在根目录统一安装依赖，再通过根脚本构建和测试：

```powershell
npm install
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

如果要启动 Web 版，使用：

```powershell
npm run dev:web
```

## Commands

- `Story DSL: Validate Current Story`
- `Story DSL: Compile Current Story`
- `Story DSL: Compile All Stories`
- `Story DSL: Convert XML To Story`

`Convert XML To Story` 输出 v3 canonical 语句，并在写入前通过同一套 parser/compiler 验证。通用 `SET_FLAG / CLEAR_FLAG / SET_VAR / CHANGE_VAR / REMOVE_VAR` 会转换为裸变量赋值或 `del`；`NO_GLOBAL_EVENT` 标记仍转换为世界触发器开关。未指定输出时使用 `<原名>.converted.story`，如已存在则追加 `-2`、`-3`；显式指定输出路径时会覆盖该生成文件，确保修复转换器或更新 XML 后不会继续使用旧产物。legacy 条件会转换为普通表达式，非主角的等级、属性和技能查询自动添加 `in_team(id) and ...` 短路保护。XML 中的 `skill` 按 External skill 转换；`maxlevel` 的 once key 仍由 compiler 补充。
旧 XML 对话与选项文本里的 `[[red:文本]]` 这类颜色标记会在转换时统一改写为 BBCode，例如 `[color=red]文本[/color]`。
当旧 XML 的多个 result 无法无歧义落到当前 DSL 的单一跳转语义时，转换器会保留可编译的主路径，并把冲突结果输出为注释。

也可以从命令行转换：

```powershell
npm run convert:xml -- path\to\storys.xml
npm run convert:xml -- path\to\storys.xml path\to\draft.story
```

未指定输出路径时自动选择不冲突的 `.converted.story` 文件；显式输出路径用于可重复构建，会覆盖已有的生成文件。

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

### 命令与控制流

```text
map('金陵')
music('笑傲江湖曲')
change_item('小还丹', 2)
jump 游戏开始
call 公共片段
return
```

- command 必须是函数调用；参数支持 Boolean、Number、String、List、标识符和嵌套调用
- 字符串支持单引号和双引号，仓库内容优先使用单引号
- 编译到 JSON IR 时，`maxlevel('技能名', 等级)` 会额外补第三个参数 `'当前剧情段名_技能名'`
- `jump` 是强跳转，会终止当前段后续同级语句的 IR 输出
- `call` 会进入目标段，目标段结束或执行 `return` 后回到调用点下一条语句
- `return` 会结束当前调用段；顶层 `return` 会结束当前 story flow
- `jump` 与 `return` 后续同级语句不可达，不会进入 IR

### 选择分支

```text
胡斐：少侠来此所谓何事？
- 无事
  jump nothing
- 乞讨
  change_silver(100)
```

- `choice` 不是独立头语法，而是“对白后紧跟若干 `- 选项`”
- 分支体允许多语句

对白和整个 choice 可以使用宿主定义的展示样式：

```text
南贤：[#style=opening]游戏开始

掌柜：[#style=shop-cards]客官需要什么？
- 购买
- 离开
```

- `[#style=样式ID]` 只能出现在对白正文开头，标签不会进入显示文本
- 普通对白的样式编译到 `dialogue.style`；对白形成 choice 时编译到 `choice.style`
- `#`、`style`、`=`、样式 ID 与 `]` 之间允许空白
- 样式 ID 允许中英文、数字、点、下划线和短横线，ID 自身不允许空白
- 当前不支持选项级样式或其他展示标签

选项可以使用尾缀条件，也可以使用互斥的条件分支块：

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

if has_var('secret_shop')
  - 查看隐藏商品
```

- `- 文本 if 表达式` 只控制单个选项，尾缀不进入显示文本
- 每个 `if` 开始一条独立链；紧随的 `elif / else` 互斥，后续新 `if` 可继续贡献选项
- 普通选项、单项条件和条件分支块可以按源码顺序混用
- 分支条件和访问到的单项条件各求值一次；未选中的 case 及其中的单项条件不求值
- 若运行时没有任何可用选项，剧情执行失败

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
- 为兼容旧版 XML，战斗名后可保留 `#次数#强化等级`（例如
  `battle 新手战#2#5`）；编译到 IR 后分别写入 `totalBattles` 和
  `battleLevel`，不会把带后缀的字符串当作战斗定义 ID。
- 结果分支可以全部省略；无分支时 IR 的 `outcomes` 为 `{}`
- IR 中使用 `battleId`，可选 `totalBattles`、`battleLevel`

### 条件分支

```text
if item_count('小刀') >= 1 and silver > 100
  南贤：不错
elif item_count('小刀') == 0 or silver > 10
  南贤：也行
else
  南贤：穷鬼
```

- 支持 Boolean、Number、单/双引号 String、同构 List、标识符和函数调用
- 支持一元 `not / ! / + / -`，算术 `* / % + -`，比较、`in / not in / !in` 以及 `and / or / && / ||`
- 标识符区分大小写；内建函数与指令使用小写 ASCII snake_case，动态变量还可使用汉字，例如 `是否拜师`、`门派声望_2`，不再使用 `$`
- `and/or` 按 v3 语义短路；查询非主角的等级、属性或技能前必须使用 `in_team(id) and ...` 保护
- branch、choice case 与 choice option 的 `when` 以原始表达式字符串进入 JSON IR
- `if / elif / else` 在 JSON IR 中统一编译为 `branch { cases, fallback }`

### 剧情变量

```text
quest_stage = 1
quest_stage += 2
quest_stage -= 1
del quest_stage
```

- 赋值与删除只能作为独立语句，不能出现在条件或函数参数中
- `=` 写入表达式结果；`+=` / `-=` 编译为读取原值后的数值加减
- `del` 删除变量；变量的可写范围、类型约束和缺失删除行为由运行时定义

## JSON IR Shape

顶层结构：

```json
{
  "version": 3,
  "segments": []
}
```

典型节点字段：

- `dialogue`: `speaker`, `text`，可选 `style`
- `command`: `call`
- `set`: `target`, `value`
- `delete`: `target`
- `jump`: `target`
- `call`: `target`
- `return`: 无额外字段
- `choice`: 可选 `style`、`prompt`、`blocks`；block 为 `options` 或带 `cases/fallback` 的 `branch`，单项条件写入 option 的可选 `when`
- `battle`: `battleId`, 可选 `totalBattles`、`battleLevel`、`outcomes`
- `branch`: `cases`, `fallback`

命令、赋值值和条件以 v3 表达式源字符串输出。复合赋值在编译时归一化，例如 `count += 2` 输出 `{ "kind": "set", "target": "count", "value": "count + (2)" }`。`maxlevel` 仍保留一次性奖励 key 的额外编译转换：

```json
{ "kind": "command", "call": "maxlevel('独孤九剑', 1, '某剧情_独孤九剑')" }
```

当 DSL 写作 `maxlevel('独孤九剑', 1)` 时，第三个参数由当前剧情段名和技能名拼接得到。若 DSL 已显式提供第三个参数，则保留原值。

例如条件 `in_team('郭襄') and character_level('郭襄') >= 20` 会原样进入 `branch.cases[].when`、`choice.blocks[].cases[].when` 或 `choice` option 的 `when`。

完整示例可见：

- `examples/demo.story`
- `examples/demo.story.json`

## Project Structure

```text
examples/
  demo.story             示例 DSL
packages/
  core/
    src/                  DSL AST、parser、compiler、XML converter
    dist/                 core 构建产物
  vscode-extension/
    src/                 VSCode 插件源码
    dist/                VSCode 插件构建产物
    syntaxes/            TextMate 高亮
    README.vscode.md     插件打包页专用说明
  web/
    src/                 Web 前端源码
    dist/                Web 构建产物
TODO.md
  后续语法与架构演进计划
```

## Development Notes

- DSL 核心代码在 `packages/core/`
- 插件外壳代码在 `packages/vscode-extension/`
- Web 前端代码在 `packages/web/`
- 根目录的 `package-lock.json` 是所有 npm workspaces 的唯一依赖锁文件
- 根目录 `npm run build / test / build:web / package:vsix` 会转发到对应工作区
- `TODO.md` 只记录后续设计方向，不表示功能已实现
- `packages/vscode-extension/README.vscode.md` 专用于插件打包，不承担仓库总说明职责
- 修改解析或 IR 后，请同步更新测试与示例 JSON
- 高亮规则在 `packages/vscode-extension/syntaxes/story.tmLanguage.json`
- 若改了 DSL 核心 TypeScript 代码，重新执行 `npm run build:core`，并按影响面执行 `npm test` / `npm run build:web`

## Current Constraints

- 严格缩进：仅允许空格，2 空格一级，禁止 Tab
- 字符串外的 `//` 会被当作注释起点；字符串内部的 `//` 保留
- 不支持 `null`、成员访问、索引、赋值表达式、三元表达式或字符串拼接
- `choice` 只能出现在对白之后
- 当前只做静态高亮，不做语义 token 和 LSP

## Rich Text Notes

- 当前仅在 XML 转 `.story` 时把旧颜色标记转换为 BBCode
- parser / validator / IR 仍把对白与选项文本视为普通字符串，不做富文本结构化解析
- 以下能力暂记为后续设计项，当前未实现：
  - 颜色的正式文本模型
  - 粗体
  - 下划线
  - 点击
  - 图标
  - 变量插值

## Roadmap Snapshot

当前只确定方向，不代表已经落地：

1. 一次性选项
2. 局部变量
3. 标签 / 元数据
4. 输入语法与历史系统评估

详细计划见 `TODO.md`。

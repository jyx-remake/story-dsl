# AGENTS.md

本文件给后续协作者和代理使用，说明这个仓库的工作方式与修改约束。

## Project Goal

这是一个剧情脚本 DSL 工具链仓库，当前包含 TypeScript 核心库、VSCode 插件、Web 版与 C# 运行时：

- 编辑 `.story` 文件
- 解析 DSL 为 AST
- 编译为引擎友好的 JSON IR
- 在 VSCode 中提供高亮、诊断、编译命令
- 在 Web 中提供独立编辑、诊断与 JSON IR 预览
- 提供独立的 C# JSON IR 执行器原型

仓库包含独立的 C# 执行器目录 `packages/runtime-csharp/`，用于消费 JSON IR。
后续语法与架构演进计划记录在 `TODO.md`。

## Source Of Truth

- TypeScript DSL 核心源码在 `packages/core/src/`
- VSCode 插件外壳在 `packages/vscode-extension/src/`
- Web 前端在 `packages/web/src/`
- TextMate 高亮在 `packages/vscode-extension/syntaxes/story.tmLanguage.json`
- `packages/core/dist/`、`packages/web/dist/`、`packages/vscode-extension/dist/` 是构建产物，不应手写修改
- 示例输入输出在 `examples/`
- C# 执行器在 `packages/runtime-csharp/`
- 路线图与设计待办在 `TODO.md`
- 根目录 `README.md` 是仓库总说明
- `packages/vscode-extension/README.vscode.md` 是插件打包页说明

根目录的 `npm run build:core / build / test / build:web / package:vsix` 是工作区代理脚本，会转发到对应包。
如果改了插件源码，请重新构建生成 `packages/vscode-extension/dist/`。

## Architecture

- `packages/core/src/ast.ts`
  - AST 节点、源位置信息、诊断类型
- `packages/core/src/parser/expression.ts`
  - 条件表达式词法与优先级解析
- `packages/core/src/parser/parser.ts`
  - 行预处理、缩进处理、段/语句解析
- `packages/core/src/compiler/ir.ts`
  - JSON IR 类型定义
- `packages/core/src/compiler/compiler.ts`
  - AST 归一化编译为 JSON IR
- `packages/core/src/converter/xml-to-story.ts`
  - 旧 Story XML 转 `.story`
- `packages/vscode-extension/src/extension.ts`
  - VSCode 命令、诊断、保存时编译
- `packages/web/src/`
  - Web 编辑器、大纲、诊断与 JSON IR 预览
- `packages/runtime-csharp/`
  - C# 运行时、CLI 与测试
- `TODO.md`
  - 未来语法与架构演进计划
- `packages/vscode-extension/README.vscode.md`
  - 插件发布与打包专用说明

## DSL Rules To Preserve

- 段头必须是顶格 `# 段名`
- 段名必须唯一
- 段名的规范化规则是：取 `#` 后整行，再做首尾空格裁剪
- 因此 `#` 后紧随空格无效，行末空格无效；重复段名判断基于规范化后的名字
- 仅允许空格缩进，且 2 空格一级
- 对白支持 `:` 与 `：`
- `- xxx` 不是独立顶级语法，只能依附：
  - 对白后的 choice 选项
  - `when` 条件组中的 choice 选项
  - battle 的结果分支
- `when expr` 只能出现在 choice 中，与 prompt 同级；其下缩进的一个或多个选项共享条件，并且每组只求值一次
- `battle` 当前只支持：
  - `win`
  - `lose`
  - `timeout`
- `if / elif / else` 的表达式支持：
  - Boolean、Number、单/双引号 String、同构 List、标识符与函数调用
  - `and or not` 与 `&& || !`
  - 一元正负号、算术、括号、`in / not in / !in`
  - 比较运算 `== != > >= < <=`
- command 必须使用 `name(...)` 函数调用语法
- 动态变量直接使用小写 snake_case 标识符，不使用 `$`
- `jump` 是终止语句；其后同级语句不会进入 IR

## Naming Conventions

- JSON IR 层统一使用 `kind` 作为判别字段
- JSON IR 当前版本为 3；command 使用字符串 `call`，条件使用字符串 `when`
- choice 使用 `groups`，无条件组省略 `when`
- battle 的标识字段用 `battleId`
- AST 目前仍使用 `type` 作为节点区分字段；如果要统一改为 `kind`，请全量同步测试与编译层

## When Editing

- 如果是设计性改动但暂不实现，先更新 `TODO.md`
- 如果改动会影响插件打包页或面向插件使用者的说明，同步更新 `packages/vscode-extension/README.vscode.md`
- 修改语法时，至少同步这些层：
  - parser
  - compiler
  - tests
  - README 中的 DSL 说明
  - 若影响关键字或文本形态，也同步 grammar
- 修改 IR 字段名时：
  - 更新 `packages/core/src/compiler/ir.ts`
  - 更新 `packages/core/src/compiler/compiler.ts`
  - 更新示例 JSON
  - 更新 README
- 修改高亮时，优先使用 VSCode TextMate 可兼容的正则，避免使用不稳定的 Unicode 属性写法

## Roadmap Discipline

- 以 `TODO.md` 作为后续演进路线图入口
- `TODO.md` 中的项目在未实现前，不应写成 README 的既有能力
- 推进新语法时，优先解决结构问题，不做补丁式扩充
- 优先级顺序当前为：
  1. `call / return`
  2. `set`
  3. 选项级条件与一次性选项
  4. 局部变量
  5. 标签 / 元数据
  6. 输入语法与历史系统评估

## Validation Checklist

提交前至少执行：

```powershell
npm run build
npm test
```

如果改了发布产物，再执行：

```powershell
npm run package:vsix
```

## Output Expectations

- 成功解析且无错误时，保存 `.story` 文件会输出同名 `.story.json`
- 有错误时，不应覆盖旧的 JSON 产物
- 示例文件应保持可解析、可编译

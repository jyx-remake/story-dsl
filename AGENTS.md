# AGENTS.md

本文件给后续协作者和代理使用，说明这个仓库的工作方式与修改约束。

## Project Goal

这是一个剧情脚本 DSL 工具链仓库，当前包含 VSCode 插件与 C# 运行时：

- 编辑 `.story` 文件
- 解析 DSL 为 AST
- 编译为引擎友好的 JSON IR
- 在 VSCode 中提供高亮、诊断、编译命令
- 提供独立的 C# JSON IR 执行器原型

仓库包含独立的 C# 执行器目录 `packages/runtime-csharp/`，用于消费 JSON IR。
后续语法与架构演进计划记录在 `TODO.md`。

## Source Of Truth

- TypeScript 源码在 `packages/vscode-extension/src/`
- TextMate 高亮在 `packages/vscode-extension/syntaxes/story.tmLanguage.json`
- `packages/vscode-extension/dist/` 是构建产物，不应手写修改
- 示例输入输出在 `examples/`
- C# 执行器在 `packages/runtime-csharp/`
- 路线图与设计待办在 `TODO.md`
- 根目录 `README.md` 是仓库总说明
- `packages/vscode-extension/README.vscode.md` 是插件打包页说明

根目录的 `npm run build / test / package:vsix` 是工作区代理脚本，会转发到 `packages/vscode-extension/`。
如果改了插件源码，请重新构建生成 `packages/vscode-extension/dist/`。

## Architecture

- `packages/vscode-extension/src/ast.ts`
  - AST 节点、源位置信息、诊断类型
- `packages/vscode-extension/src/parser/expression.ts`
  - 条件表达式词法与优先级解析
- `packages/vscode-extension/src/parser/parser.ts`
  - 行预处理、缩进处理、段/语句解析
- `packages/vscode-extension/src/compiler/ir.ts`
  - JSON IR 类型定义
- `packages/vscode-extension/src/compiler/compiler.ts`
  - AST 归一化编译为 JSON IR
- `packages/vscode-extension/src/extension.ts`
  - VSCode 命令、诊断、保存时编译
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
  - battle 的结果分支
- `battle` 当前只支持：
  - `win`
  - `lose`
  - `timeout`
- `if / elif / else` 的表达式支持：
  - `and or not`
  - `&& || !`
  - 括号
  - 比较运算 `== != > >= < <=`
- 变量必须带 `$`
- `jump` 是终止语句；其后同级语句不会进入 IR

## Naming Conventions

- JSON IR 层统一使用 `kind` 作为判别字段
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
  - 更新 `packages/vscode-extension/src/compiler/ir.ts`
  - 更新 `packages/vscode-extension/src/compiler/compiler.ts`
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

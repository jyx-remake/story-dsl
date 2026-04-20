# TODO

本文件用于记录后续演进方向，当前只整理计划，不直接落实代码。

## Repository Layout

- VSCode 插件位于 `packages/vscode-extension/`
- C# 执行器位于 `packages/runtime-csharp/`
- `examples/` 作为两边共享的 DSL / JSON IR 示例目录，保持在仓库根级

## Guiding Principles

- 坚持第一性原理，先定义语义边界，再决定语法和结构。
- 不做补丁式扩充，不为了兼容旧形状保留多套并行模型。
- AST 可以贴近源码，但 IR 只表达语义，不保留语法糖。
- 语句层保持对象化，表达式层保持紧凑化，不混用表示方式。
- `command` 只表示宿主副作用，DSL 内建语义应尽量独立建模。

## Phase 1: Control Flow Closure

目标：补齐“可复用片段”的控制流能力，避免内容只能依赖平铺分支和终止跳转。

- 设计 `call`
- 设计 `return`
- 定义调用栈语义
- 明确 `jump` 与 `call` 的职责边界
- 设计对应 AST / IR 形态
- 设计运行期错误规则

验收标准：

- 可以从一个段调用另一个段并在返回后继续执行
- `jump` 仍保持终止式跳转语义
- IR 不泄漏源码层语法糖

## Phase 2: State Mutation Model

目标：把剧情状态修改从宿主命令里剥离出来，形成 DSL 内建的状态语义。

- 设计 `set $x = expr`
- 设计 `set $x += expr`
- 评估是否需要 `-=`
- 定义赋值表达式支持边界
- 明确变量读写语义与错误规则
- 设计对应 AST / IR 形态

验收标准：

- 常见状态写入不再依赖 `command`
- `command` 和状态变更职责清晰分离
- 表达式复用现有紧凑 IR，不再引入第二套表示

## Phase 3: Interaction Semantics

目标：让 `choice` / `battle` 这类交互结构自身具备更强表达力，而不是总靠外围 `if` 包裹。

- 设计选项级条件显示
- 设计一次性选项或失效语义
- 评估 battle outcome 是否需要条件限制
- 统一“条件附着在交互结构上”的模型
- 设计对应 AST / IR 形态

验收标准：

- 交互结构可以直接表达常见条件显示逻辑
- 不引入零散特判字段
- 条件模型与现有表达式体系一致

## Phase 4: Scope And Metadata

目标：提升大型脚本的可维护性和组织能力。

- 设计局部变量或临时变量
- 设计标签或元数据
- 评估输入语法
- 评估访问次数 / 历史判断
- 扩展段名，支持“文件级组织”和“入口段声明”这种能力

说明：

- 这一阶段优先级低于控制流和状态模型
- 在前 3 个阶段未收稳前，不提前实现

## Pending: Rich Text Model

目标：把对白与选项文本中的展示语义从纯字符串内嵌标记提升为可验证、可编译的正式模型。

- 当前仅在 XML 转 `.story` 时把旧颜色标记转换为 BBCode
- parser / validator / IR / runtime 仍未把富文本建模为结构化语义
- 后续统一评估以下能力，不提前做补丁式扩充：
  - 颜色
  - 粗体
  - 下划线
  - 点击
  - 图标
  - 变量插值

## Delivery Order

真正开始实现时，按以下顺序推进：

1. `call / return`
2. `set`
3. 选项级条件与一次性选项
4. 局部变量
5. 标签 / 元数据
6. 输入语法与历史系统评估

## Execution Checklist

每一项真正落地前，先完成以下设计与验证：

- 语义说明
- DSL 写法
- AST 设计
- IR 设计
- 诊断规则
- 示例脚本
- README 更新
- `npm run build`
- `npm test`

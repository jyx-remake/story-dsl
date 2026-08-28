# TODO

本文件用于记录后续演进方向，当前只整理计划，不直接落实代码。

## Repository Layout

- TypeScript 核心库位于 `packages/core/`
- VSCode 插件位于 `packages/vscode-extension/`
- Web 前端位于 `packages/web/`
- `examples/` 作为共享的 DSL / JSON IR 示例目录，保持在仓库根级

## Guiding Principles

- 坚持第一性原理，先定义语义边界，再决定语法和结构。
- 不做补丁式扩充，不为了兼容旧形状保留多套并行模型。
- AST 可以贴近源码，但 IR 只表达语义，不保留语法糖。
- 语句层保持对象化，表达式层保持紧凑化，不混用表示方式。
- `command` 只表示宿主副作用，DSL 内建语义应尽量独立建模。

## Completed: Control Flow Closure

已落地“可复用片段”的控制流能力，避免内容只能依赖平铺分支和终止跳转。

- `call` 进入目标段，目标段自然结束或执行 `return` 后回到调用点下一条语句
- `return` 结束当前调用段；无调用栈时结束当前 story flow
- `jump` 保持强跳转语义，触发后不返回调用点

## Completed: State Mutation Model

目标：把剧情状态修改从宿主命令里剥离出来，形成 DSL 内建的状态语义。

- 已实现独立语句 `x = expr`、`x += expr`、`x -= expr`
- 已实现 `del x` 删除语句
- 赋值不会进入表达式语法；AST 保留操作符，IR 统一输出 `set` / `delete` step
- 动态变量直接使用小写 snake_case 或汉字标识符，不使用 `$`
- 变量可写范围、严格类型与缺失删除规则由消费 IR 的运行时定义

验收标准：

- 常见状态写入不再依赖 `command`
- `command` 和状态变更职责清晰分离
- 表达式复用现有紧凑 IR，不再引入第二套表示

## Completed: Choice Interaction Semantics

目标：让 `choice` / `battle` 这类交互结构自身具备更强表达力，而不是总靠外围 `if` 包裹。

- 已实现选项尾缀 `if`，直接控制单个选项是否显示
- 已实现 choice 内 `if / elif / else` 分支块，并支持多个独立条件链与普通选项混用
- choice IR 已收敛为有序 `options/branch` blocks，条件只在访问到的位置求值一次
- 设计一次性选项或失效语义
- 评估 battle outcome 是否需要条件限制
- 统一“条件附着在交互结构上”的模型
- 设计对应 AST / IR 形态

验收标准：

- 交互结构可以直接表达常见条件显示逻辑
- 不引入零散特判字段
- 条件模型与现有表达式体系一致

## Phase 3: Scope And Metadata

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

- 已实现语句级 `[#style=样式ID]`，用于对白或整个 choice 的宿主展示预设；它不是文本区间富文本
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

1. 一次性选项
2. 局部变量
3. 标签 / 元数据
4. 输入语法与历史系统评估

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

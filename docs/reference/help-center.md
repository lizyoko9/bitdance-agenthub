# 帮助中心

产品内帮助中心把常用页面说明做成结构化记录，而不是散落在页面里的长说明。

## Records

- `help_center_surfaces` 记录需要帮助入口的页面或功能区。
- `help_center_items` 存储页面级 `?` 按钮、悬停提示、示例值和错误说明链接。
- `help_onboarding_flows` 存储首次上手这类引导流程。

## 默认功能区

默认种子会注册这些当前产品功能区。部分 `surfaceKey` 仍保留旧内部名称用于兼容，但用户看到的是中文新名称：

- 工作台
- 对话
- 智能体
- 编排画布
- 技能管理
- 模型管理
- 工具连接
- 员工大脑
- 权限确认
- 任务进度
- 工作流计划

每个默认功能区有四类帮助项：

- `question_button`：默认 `?` 帮助按钮。
- `tooltip`：悬停提示。
- `example_value`：字段示例值。
- `error_doc_link`：指向 `docs/troubleshooting/common-issues.md` 的错误说明链接。

## 首次上手

内置 `first_agent_success_path` 会引导新用户完成：

1. 创建第一个智能体。
2. 运行第一个任务。
3. 查看第一次交付物。

这些步骤映射到兼容用的 `surfaceKey`，界面可以高亮当前页面、展示对应帮助内容，并允许用户继续上手流程。

## API

- `POST /api/help-center/seed`
- `GET /api/help-center/surfaces`
- `POST /api/help-center/surfaces`
- `GET /api/help-center/items`
- `POST /api/help-center/items`
- `GET /api/help-center/onboarding-flows`
- `POST /api/help-center/onboarding-flows`

The frontend helpers in `src/lib/api.ts` wrap these endpoints as `seedHelpCenter`, `fetchHelpCenterSurfaces`, `createHelpCenterSurface`, `fetchHelpCenterItems`, `createHelpCenterItem`, `fetchHelpOnboardingFlows`, and `createHelpOnboardingFlow`.

## UI Contract

每个页面按 `surfaceKey` 读取自己的 `help_center_surface`，渲染 `questionButtonLabel`，把 `tooltip` 绑定到对应元素，把 `example_value` 放在字段旁边，并在校验失败时追加 `error_doc_link`。

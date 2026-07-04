# AgentHub 功能模块化说明

AgentHub 的主功能入口现在由 `src/modules/app-modules.tsx` 统一管理。

一个功能模块包含：

- `id`：模块唯一标识。
- `label`：侧边栏显示名称。
- `description`：模块用途说明。
- `icon`：侧边栏图标。
- `group`：模块分组，`primary` 显示在主导航，`advanced` 显示在更多功能，`hidden` 作为兼容或内部模块。
- `frame`：页面外壳，默认使用统一工作区外壳；`bare` 表示模块自己已经带完整页面外壳。
- `normalizeTo`：旧入口或别名可以映射到新模块。
- `render`：模块真正渲染的页面组件。

以后新增模块时，优先只做三件事：

1. 新建自己的页面组件。
2. 在 `src/modules/app-modules.tsx` 里注册一个模块。
3. 如果需要后端能力，再单独增加 API 和服务。

侧边栏和右侧工作区都会自动读取模块注册表，不再分别维护两份入口配置。

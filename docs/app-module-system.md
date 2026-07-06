# AgentHub 功能模块系统

AgentHub 的主功能入口由三层组成，新增功能时不要直接往侧边栏里塞页面：

1. `src/lib/agenthub-module-catalog.ts` 定义产品模块目录、默认启用状态、依赖关系和免费策略。
2. `src/lib/agenthub-module-manager.ts` 把模块目录转换成“已启用模块 / 可加入模块 / 阻塞原因”的管理视图。
3. `src/modules/app-modules.tsx` 只负责把已启用模块映射到真实页面组件。
4. `/api/app-modules` 把同一份模块管理视图提供给前端和未来的模块设置页。

## 模块字段

每个模块至少需要这些信息：

- `id`：模块唯一标识。
- `label`：用户看到的中文名称。
- `layer`：模块所属层级，例如工作台、员工、编排、能力、交付、分析。
- `access`：必须是 `free`。AgentHub 不做付费模块、会员模块或订阅门槛。
- `defaultEnabled`：是否默认出现在主导航。
- `dependencyIds`：启用这个模块前必须一起启用的模块。

## 默认导航

默认只展示基础核心模块：

- 工作台
- 对话
- 智能体
- 编排画布
- 技能管理
- 模型管理
- 工具连接

`交付物`、`记忆管理`、`数据分析` 等模块先作为可加入模块保留，不默认挤进侧边栏。

## 旧入口归一

旧的编排入口统一归一到 `agent-canvas`：

- `workflows`
- `agent-orchestration`
- `langflow-native`
- `infinite-canvas`

旧的智能体相关入口统一归一到 `agents`：

- `employee-factory`
- `context`
- `capabilities`
- `collaboration`
- `governance`

## 新增模块规则

新增模块时按这个顺序做：

1. 在 `agenthub-module-catalog.ts` 注册模块块，声明是否默认启用和依赖。
2. 在 `app-modules.tsx` 注册真实页面组件。
3. 如果模块不默认启用，先让它出现在模块管理视图的“可加入模块”里。
4. 需要后端能力时，再单独增加 API 和服务。

不要新增重复导航入口；如果旧入口仍然需要兼容，把它归一到现有模块。

## API

`GET /api/app-modules` 返回默认模块管理视图：

- `activeModules`：当前启用的模块。
- `availableModules`：可以加入但默认不显示的模块。
- `blockers`：模块配置问题，例如未知模块或依赖缺失。

也可以用 `enabled` 查询参数预览某组模块启用后的结果：

```txt
GET /api/app-modules?enabled=memory
```

这个接口只做本地模块组合预览，不存储用户配置，也不引入付费门槛。

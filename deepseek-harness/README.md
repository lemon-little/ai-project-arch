# deepseek-harness 架构图集

本目录是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness.git) 在提交 `cd5ef81481`（dsh-v0.1.2-alpha.1）上的 Archify 架构快照。内容通过读取真实源码入口、Cordis Profile 配置、生成式架构文档和 package 元数据整理，再由本地 Archify 校验并输出为自包含 HTML。

## 查看方式

直接在浏览器打开 [index.html](index.html)，再从索引进入任意图。每个 `diagrams/*.html` 都不依赖服务器，也可以单独复制或离线查看；页面内支持缩放、搜索、主题切换、关系追踪和导出。

命令行打开示例（macOS）：

```sh
open index.html
```

## 图集

| # | 图 | 类型 | 覆盖范围 |
|---:|---|---|---|
| 01 | [DeepSeek Harness 系统全景](diagrams/01-system-landscape.html) | `architecture` | 从用户入口、Profile 组合、Cordis 容器到 Agent、工具、执行环境与持久化的端到端全景。 |
| 02 | [Monorepo 模块全景](diagrams/02-module-atlas.html) | `architecture` | 把 packages 目录下 254 个包按职责归入 12 个架构域，覆盖所有一级包组。 |
| 03 | [Profile 启动与热重载流程](diagrams/03-profile-boot.html) | `workflow` | dsh 入口如何解析 Profile、叠加 bundle/user/CLI patch，并启动可热重载的 Cordis 插件树。 |
| 04 | [Agent Turn 与 Step 时序](diagrams/04-agent-turn.html) | `sequence` | 用户输入进入队列后，Agent 如何组装 prompt、流式调用 LLM、执行工具并写入可回放会话事件。 |
| 05 | [工具执行与策略管线](diagrams/05-tool-execution.html) | `sequence` | 工具调用从持久化、权限审批、单调 guard、沙箱执行到结果冻结和 UI 呈现的完整数据流。 |
| 06 | [Web 控制面启动与请求链路](diagrams/06-web-control-plane.html) | `sequence` | 浏览器插件图、Connection、WebServer、Typert Gateway 与业务 Controller 之间的请求和事件路径。 |
| 07 | [会话事件、投影与查询数据流](diagrams/07-session-persistence.html) | `dataflow` | 会话事件如何成为 append-only 事实，经 JSONL/SQLite 持久化、投影缓存、查询和遥测供不同消费者使用。 |
| 08 | [子代理委派与续接流程](diagrams/08-subagent-orchestration.html) | `workflow` | 父 Agent 如何选择模型和 provider，spawn/fork 子 Agent，并通过报告、控制与 continuation 回收结果。 |
| 09 | [执行、文件系统与沙箱架构](diagrams/09-execution-sandbox.html) | `architecture` | 文件、Shell、Terminal 如何通过稳定 seam 选择本地或 E2B provider，并由跨平台沙箱策略约束副作用。 |
| 10 | [Typert Remote API 调用时序](diagrams/10-remote-api.html) | `sequence` | 从 @Remote 声明和生成契约到浏览器调用、Host lookup、业务执行、响应校验与取消的严格链路。 |
| 11 | [构建、契约生成与发布流水线](diagrams/11-build-and-release.html) | `dataflow` | Host/Client 分阶段构建、Typert 代码生成、Web 打包、质量门禁与多语言/多运行时发布产物。 |
| 12 | [Agent 运行状态生命周期](diagrams/12-agent-state-lifecycle.html) | `lifecycle` | Agent 从 idle、排队、Turn/Step 执行到工具等待、重试、停止或失败的状态转换。 |

## 目录

```text
deepseek-harness/
├── index.html              # 浏览入口
├── manifest.json           # 机器可读图集清单
├── diagrams/               # Archify JSON、HTML、交付与视觉检查收据
├── figures/                # Mermaid 辅助源、Markdown 与 PNG
├── source-version/         # 源码分支、提交、标签、状态和包组/架构域映射
├── VISUAL_REVIEW.md        # 自动检查与人工截图审核结论
├── generate.mjs            # 可复现的图源与索引生成脚本
└── build.mjs               # Archify 交付与视觉检查脚本
```

## 生成与更新

默认假设 `ai-project-arch`、`archify` 和 `deepseek-harness` 是同一父目录下的兄弟仓库：

```sh
node deepseek-harness/generate.mjs
node deepseek-harness/build.mjs
```

也可以显式指定源码和生成器：

```sh
DSH_SOURCE_ROOT=/path/to/deepseek-harness \
ARCHIFY_ROOT=/path/to/archify \
node deepseek-harness/generate.mjs

DSH_SOURCE_ROOT=/path/to/deepseek-harness \
ARCHIFY_ROOT=/path/to/archify \
ARCHIFY_CHROME=/path/to/chrome \
node deepseek-harness/build.mjs --visual-check
```

脚本刷新 JSON、Mermaid、索引和版本快照。HTML 必须再用 Archify 的 `deliver` 生成，并用 `visual-check` 做多视口检查；本次生成的命令与结果保存在每张图旁边的收据文件中。

## 证据边界

“全部架构流程图”按架构层级理解：图集覆盖仓库所有一级 package group、产品入口、核心运行链、主要扩展能力和持久化/执行/发布边界；不会为 packages 目录下 254 个包机械生成同数量的低信息密度图。`02-module-atlas` 负责全量一级域覆盖，其余图深入关键链路。

### DeepSeek Harness 系统全景

- `AGENTS.md`
- `docs/architecture.md`
- `packages/bundle/base/cordis.patch.yml`
- `apps/cli/src/profile-boot.ts`

### Monorepo 模块全景

- `AGENTS.md`
- `packages/README.md`
- `docs/module-graph.md`
- `pnpm-workspace.yaml`

### Profile 启动与热重载流程

- `apps/cli/src/bin.ts`
- `apps/cli/src/args.ts`
- `apps/cli/src/profile-boot.ts`
- `packages/boot/app-boot/src/index.ts`

### Agent Turn 与 Step 时序

- `docs/agent-lifecycle.md`
- `packages/core/agent/src/index.ts`
- `packages/core/agent-loop/src/index.ts`
- `packages/core/session/src/index.ts`

### 工具执行与策略管线

- `docs/tool-execution-pipeline.md`
- `packages/core/tools/src/index.ts`
- `packages/interaction/user-approval/src/index.ts`
- `packages/guard/timeout-policy/src/index.ts`

### Web 控制面启动与请求链路

- `packages/bundle/web-app/cordis.patch.yml`
- `packages/client/modules/src/index.ts`
- `packages/client/connection/src/index.ts`
- `packages/api/gateway/src/index.ts`

### 会话事件、投影与查询数据流

- `docs/persistence-catalog.md`
- `packages/core/session/src/index.ts`
- `packages/session/session-persistence/src/index.ts`
- `packages/session/session-projection/src/index.ts`

### 子代理委派与续接流程

- `packages/subagent/subagent/src/index.ts`
- `packages/subagent/tool-subagent/src/index.ts`
- `packages/subagent/subagent-spawn-in-process/src/index.ts`
- `packages/subagent/subagent-fork-in-process/src/index.ts`

### 执行、文件系统与沙箱架构

- `packages/sandbox/sandbox-local/src/index.ts`
- `packages/sandbox/sandbox-local/src/profiles.ts`
- `packages/fs/fs-sandbox/src/index.ts`
- `packages/e2b/e2b/README.md`

### Typert Remote API 调用时序

- `docs/api-gateway.md`
- `packages/typert/generator/src/index.ts`
- `packages/api/gateway/src/index.ts`
- `packages/client/connection/src/index.ts`

### 构建、契约生成与发布流水线

- `package.json`
- `tsdown.config.ts`
- `docs/api-gateway.md`
- `scripts/build.ts`

### Agent 运行状态生命周期

- `docs/agent-lifecycle.md`
- `packages/core/agent/src/index.ts`
- `packages/core/agent-loop/src/index.ts`
- `packages/compaction/compaction-basic/src/index.ts`

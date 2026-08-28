# AI Project Arch

这个仓库集中保存不同 AI 项目经源码分析与 [Archify](https://github.com/tt-a1i/archify) 校验、渲染后生成的架构图集。每个项目使用一个同名子目录，保留可浏览 HTML、可复现图源、验证收据和对应源码版本快照。

- 在线入口：<https://lemon-little.github.io/ai-project-arch/>
- GitHub 仓库：<https://github.com/lemon-little/ai-project-arch>

## 当前图集

| 项目 | 内容 | 在线查看 | 源码版本 |
|---|---|---|---|
| DeepSeek Harness | 12 张系统架构、模块、启动、Agent、工具、Web、数据、子代理、沙箱、API、构建与生命周期图 | [打开图集](https://lemon-little.github.io/ai-project-arch/deepseek-harness/) | [版本快照](deepseek-harness/source-version/source.json) |
| VERL | 8 张训练架构、启动编排、单轮时序、数据流、Worker 后端、生命周期与 Trainer 模式图 | [打开图集](https://lemon-little.github.io/ai-project-arch/verl/) | [版本快照](verl/source-version/source.json) |

## 用一个仓库和 Archify 生成图集

Archify 不会只靠一条 CLI 命令推测整个仓库的架构。完整过程分成两个阶段：先由开发者或代码 Agent 阅读真实源码并编写带证据的 Typed JSON 图源，再由 Archify 确定性校验、渲染和做视觉检查。这样最终页面能追溯到具体 revision 和源码文件，而不是只根据目录名猜测。

### 1. 准备仓库

要求 Git、Node.js 18 或更高版本；执行视觉检查还需要本机 Chromium 或 Chrome。推荐把三个仓库放在同一父目录：

```text
workspace/
├── archify/             # Archify 渲染器
├── target-repository/   # 要分析的源码仓库
└── ai-project-arch/     # 本仓库，接收最终产物
```

```bash
git clone https://github.com/tt-a1i/archify.git /path/to/workspace/archify
git clone <source-repository-url> /path/to/workspace/target-repository
git clone https://github.com/lemon-little/ai-project-arch.git /path/to/workspace/ai-project-arch

node /path/to/workspace/archify/archify/bin/archify.mjs doctor
```

### 2. 让代码 Agent 分析并编图

在能够读取三个目录的代码 Agent 会话中，可以直接使用下面的任务模板。把尖括号内容替换为实际路径和项目名：

```text
分析 <source-repository> 的真实源码，并使用 <archify-repository> 生成完整架构图集。
产物放到 <ai-project-arch>/<project-name>/，至少包含：
1. index.html 图集入口；
2. 按需选择 architecture、workflow、sequence、dataflow、lifecycle 图；
3. 每张图的 Archify JSON 图源、自包含 HTML、delivery 和 visual-check 收据；
4. manifest.json，记录图类型、文件路径、源码证据和哈希；
5. source-version/source.json，记录远端、分支、commit、tag、dirty 状态和 Archify 版本；
6. README.md，说明覆盖范围、证据边界、生成与查看方式。

先识别产品入口、运行时主干、控制流、数据流、扩展点、持久化、外部依赖、
安全边界和生命周期，再按读者问题拆图。所有源码引用必须在记录的 Git revision 上存在。
使用 showcase 质量门禁；每张图交付后执行 visual-check，并人工查看桌面与移动端截图。
```

选图原则：

| Archify 类型 | 适合表达 |
|---|---|
| `architecture` | 模块、服务、存储、外部系统和边界 |
| `workflow` | 启动、审批、调度、构建和异常分支 |
| `sequence` | 一次请求、训练迭代或工具调用的严格时序 |
| `dataflow` | 数据来源、转换、存储、血缘和消费方 |
| `lifecycle` | 状态转换、等待、重试、取消和终态 |

不要为每个文件机械生成一张图。先用一张高层图保证仓库范围全覆盖，再为关键运行链路拆出低噪声专题图；在 `manifest.json` 和项目 README 中写明覆盖范围与未覆盖边界。

### 3. 校验和生成单张图

假设已经编写 `specs/runtime.architecture.json`：

```bash
ARCHIFY_CLI=/path/to/workspace/archify/archify/bin/archify.mjs
SOURCE_REPO=/path/to/workspace/target-repository
PROJECT_OUTPUT=/path/to/workspace/ai-project-arch/target-repository

node "$ARCHIFY_CLI" validate architecture \
  "$PROJECT_OUTPUT/specs/runtime.architecture.json" \
  --repo-root "$SOURCE_REPO" --quality showcase --json \
  > "$PROJECT_OUTPUT/diagrams/runtime.validation.json"

node "$ARCHIFY_CLI" deliver architecture \
  "$PROJECT_OUTPUT/specs/runtime.architecture.json" \
  "$PROJECT_OUTPUT/diagrams/runtime.html" \
  --repo-root "$SOURCE_REPO" --quality showcase --json \
  > "$PROJECT_OUTPUT/diagrams/runtime.delivery.json"

node "$ARCHIFY_CLI" visual-check \
  "$PROJECT_OUTPUT/diagrams/runtime.html" --json
```

`architecture` 需要 `--repo-root` 来校验源码引用；其余图类型也建议传入，保持命令一致。`deliver` 只有在 Schema、布局和 HTML/SVG 门禁通过后才会替换目标文件。`visual-check` 会自动在 HTML 旁生成 `runtime.visual-check.json`、多视口截图和联系表，`--json` 还会把同一份收据打印到终端；最终仍应人工确认标题、关系、文字和重点路径是否正确。

已有项目可提供更完整的自动化参考：

```bash
cd /path/to/workspace/ai-project-arch

# 刷新 DeepSeek Harness 的 JSON、索引、版本快照、HTML 和视觉收据
DSH_SOURCE_ROOT=/path/to/workspace/deepseek-harness \
ARCHIFY_ROOT=/path/to/workspace/archify \
node deepseek-harness/generate.mjs

DSH_SOURCE_ROOT=/path/to/workspace/deepseek-harness \
ARCHIFY_ROOT=/path/to/workspace/archify \
node deepseek-harness/build.mjs --visual-check
```

### 4. 产物目录约定

```text
<project-name>/
├── index.html                 # 项目图集入口
├── README.md                  # 范围、证据、生成和查看说明
├── manifest.json              # 机器可读清单、源码证据与哈希
├── diagrams/                  # Archify HTML、交付/视觉收据与截图
├── specs/                     # Typed JSON 图源；也可与 HTML 同目录
├── source-version/
│   └── source.json            # 源码与 Archify 的版本快照
└── tests/                     # 可选的索引页或清单回归测试
```

新增图集后，还要把项目加入根目录的 `index.html` 和本 README 的“当前图集”表格。

## 查看结果

推荐从仓库根目录启动静态服务器，这能正确加载 VERL 索引使用的 ES modules，也最接近 GitHub Pages 的运行方式：

```bash
cd /path/to/workspace/ai-project-arch
python3 -m http.server 8766 --bind 127.0.0.1
```

然后访问：

- 总入口：<http://127.0.0.1:8766/>
- DeepSeek Harness：<http://127.0.0.1:8766/deepseek-harness/>
- VERL：<http://127.0.0.1:8766/verl/>

Archify 生成的单图 HTML 是自包含文件，也可以直接用浏览器打开，例如 `deepseek-harness/diagrams/01-system-landscape.html`。汇总页统一建议通过 HTTP 查看。

## GitHub Pages 发布

根目录 [Pages 工作流](.github/workflows/pages.yml) 会在 `main` 分支每次 push 后，把整个静态仓库发布到：

<https://lemon-little.github.io/ai-project-arch/>

工作流使用 GitHub 官方的 `configure-pages`、`upload-pages-artifact` 和 `deploy-pages` Actions，不需要构建步骤。仓库 Pages 的发布源必须设为 **GitHub Actions**；首次配置可在 `Settings → Pages → Build and deployment → Source` 查看。部署结果在仓库的 **Actions** 页面和 `github-pages` environment 中可查。

参考：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) · [配置发布源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = dirname(projectRoot)
const sourceRoot = resolve(process.env.DSH_SOURCE_ROOT ?? join(workspaceRoot, '..', 'deepseek-harness'))
const archifyRoot = resolve(process.env.ARCHIFY_ROOT ?? join(workspaceRoot, '..', 'archify'))
const archifyCli = join(archifyRoot, 'archify', 'bin', 'archify.mjs')
const diagramsDir = join(projectRoot, 'diagrams')
const figuresDir = join(projectRoot, 'figures')
const versionDir = join(projectRoot, 'source-version')

for (const directory of [diagramsDir, figuresDir, versionDir]) mkdirSync(directory, { recursive: true })

function git(...args) {
  return execFileSync('git', ['-C', sourceRoot, ...args], { encoding: 'utf8' }).trim()
}

function walkPackageFiles(root, found = []) {
  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'lib' || entry === 'dist') continue
    const absolute = join(root, entry)
    const stat = statSync(absolute)
    if (stat.isDirectory()) walkPackageFiles(absolute, found)
    else if (entry === 'package.json') found.push(absolute)
  }
  return found
}

const revision = git('rev-parse', 'HEAD')
const shortRevision = git('rev-parse', '--short=10', 'HEAD')
const branch = git('branch', '--show-current') || '(detached)'
const tags = git('tag', '--points-at', 'HEAD').split('\n').filter(Boolean)
const describe = git('describe', '--tags', '--always', '--dirty')
const remote = git('remote', 'get-url', 'origin')
const status = git('status', '--porcelain=v1')
const commit = git('log', '-1', '--format=%H%n%an%n%ae%n%aI%n%cI%n%s').split('\n')
const packageFiles = walkPackageFiles(join(sourceRoot, 'packages'))
const packageGroups = Object.fromEntries(Object.entries(packageFiles.reduce((groups, file) => {
  const relative = file.slice(join(sourceRoot, 'packages').length + 1)
  const group = relative.split('/')[0]
  groups[group] = (groups[group] ?? 0) + 1
  return groups
}, {})).sort(([a], [b]) => a.localeCompare(b)))

const packageDomainGroups = {
  surfaces: ['client', 'host'],
  composition: ['boot', 'bundle', 'extensions', 'preset', 'settings'],
  core: ['compaction', 'context', 'core', 'llm'],
  providers: ['e2b', 'mcp', 'web'],
  interfaces: ['acp', 'api', 'hooks', 'sdk', 'typert', 'webhook'],
  capabilities: ['fs', 'lsp', 'shell', 'skill', 'terminal'],
  execution: ['code-runtime', 'sandbox', 'subprocess'],
  orchestration: ['goal', 'jobs', 'plan', 'schedule', 'subagent', 'todo', 'workflow'],
  state: ['session', 'session-query', 'spill', 'storage'],
  policy: ['credentials', 'feedback', 'guard', 'interaction'],
  platform: ['attachment', 'identity', 'util', 'workspace'],
  delivery: ['examples', 'experimental', 'runtime-diagnostics', 'test-support'],
}
const mappedGroups = Object.values(packageDomainGroups).flat()
const duplicateGroups = mappedGroups.filter((group, index) => mappedGroups.indexOf(group) !== index)
const missingGroups = Object.keys(packageGroups).filter(group => !mappedGroups.includes(group))
const unknownGroups = mappedGroups.filter(group => !(group in packageGroups))
if (duplicateGroups.length > 0 || missingGroups.length > 0 || unknownGroups.length > 0) {
  throw new Error(`package-domain mapping mismatch: duplicate=${duplicateGroups.join(',')}; missing=${missingGroups.join(',')}; unknown=${unknownGroups.join(',')}`)
}
const packageDomainMap = Object.fromEntries(Object.entries(packageDomainGroups).map(([domain, groups]) => [domain, {
  groups,
  package_count: groups.reduce((count, group) => count + packageGroups[group], 0),
}]))

const repository = {
  url: 'https://github.com/deepseek-ai/deepseek-harness',
  revision,
}

const cards = (...entries) => entries.map(([dot, title, ...items]) => ({ dot, title, items }))
const views = (...entries) => entries.map(([id, label, focus, note]) => ({ id, label, focus, note }))
const meta = (title, slug, selectedViews, extra = {}) => ({
  title,
  locale: 'zh-CN',
  output: `diagrams/${slug}.html`,
  quality_profile: 'showcase',
  views: selectedViews,
  ...extra,
})

const diagrams = [
  {
    slug: '01-system-landscape',
    type: 'architecture',
    title: 'DeepSeek Harness 系统全景',
    description: '从用户入口、Profile 组合、Cordis 容器到 Agent、工具、执行环境与持久化的端到端全景。',
    evidence: ['AGENTS.md', 'docs/architecture.md', 'packages/bundle/base/cordis.patch.yml', 'apps/cli/src/profile-boot.ts'],
    spec: {
      schema_version: 1,
      diagram_type: 'architecture',
      meta: meta('DeepSeek Harness 系统全景', '01-system-landscape', views(
        ['request-path', '一次请求', ['entrypoints', 'profiles', 'cordis', 'agent', 'tools', 'providers'], '沿主路径查看任务如何进入插件运行时并调用能力提供者。'],
        ['control-plane', '控制面', ['surfaces', 'api', 'cordis', 'agent'], 'Web、SDK 与 ACP 通过显式协议接入同一个 Agent 核心。'],
        ['state-and-extension', '状态与扩展', ['agent', 'state', 'tools', 'extensions'], '会话事件持久化，工具和扩展保持可插拔。'],
      ), { viewBox: [1360, 760], repository }),
      components: [
        { id: 'entrypoints', type: 'external', label: '用户与自动化', sublabel: 'CLI / Browser / SDK / ACP', pos: [30, 310], size: [150, 68], sources: [{ path: 'apps/cli/src/bin.ts' }] },
        { id: 'profiles', type: 'cloud', label: 'dsh Profiles', sublabel: 'bundle + patch layers', pos: [220, 310], size: [150, 68], sources: [{ path: 'apps/cli/src/profile-boot.ts' }, { path: 'packages/bundle/base/cordis.patch.yml' }] },
        { id: 'cordis', type: 'backend', label: 'Cordis 插件容器', sublabel: 'Context / Loader / Fiber', pos: [410, 310], size: [150, 68], sources: [{ path: 'packages/boot/app-boot/src/index.ts' }, { path: 'vendor/cordis/src/context.ts' }] },
        { id: 'agent', type: 'backend', label: 'Agent 核心', sublabel: 'registry + loop + prompt', pos: [600, 310], size: [150, 68], sources: [{ path: 'packages/core/agent/src/index.ts' }, { path: 'packages/core/agent-loop/src/index.ts' }] },
        { id: 'tools', type: 'messagebus', label: '工具执行管线', sublabel: 'policy / guard / hooks', pos: [790, 310], size: [150, 68], sources: [{ path: 'packages/core/tools/src/index.ts' }, { path: 'docs/tool-execution-pipeline.md' }] },
        { id: 'providers', type: 'cloud', label: '能力提供者', sublabel: 'LLM / FS / Shell / Web', pos: [980, 310], size: [150, 68], sources: [{ path: 'docs/capability-seams.md' }, { path: 'packages/llm/llm/src/index.ts' }] },
        { id: 'execution', type: 'security', label: '执行环境', sublabel: 'Local sandbox / E2B', pos: [1170, 310], size: [150, 68], sources: [{ path: 'packages/sandbox/sandbox-local/src/index.ts' }, { path: 'packages/e2b/e2b/src/index.ts' }] },
        { id: 'surfaces', type: 'frontend', label: '交互表面', sublabel: 'Web UI / headless', pos: [220, 105], size: [150, 68], sources: [{ path: 'packages/bundle/web-app/cordis.patch.yml' }, { path: 'packages/bundle/headless/src/index.ts' }] },
        { id: 'api', type: 'security', label: 'Typert API / SDK', sublabel: 'Remote + JSON-RPC', pos: [505, 105], size: [150, 68], sources: [{ path: 'packages/api/gateway/src/index.ts' }, { path: 'packages/sdk/protocol/src/index.ts' }] },
        { id: 'state', type: 'database', label: '会话与应用状态', sublabel: 'JSONL / SQLite / projections', pos: [600, 515], size: [170, 68], sources: [{ path: 'packages/session/session-persistence/src/index.ts' }, { path: 'packages/session/session-persistence-jsonl/src/index.ts' }, { path: 'packages/session/session-persistence-sqlite/src/index.ts' }] },
        { id: 'extensions', type: 'external', label: '扩展与编排', sublabel: 'subagent / workflow / hooks', pos: [980, 105], size: [170, 68], sources: [{ path: 'packages/subagent/subagent/src/index.ts' }, { path: 'packages/workflow/workflow/src/index.ts' }, { path: 'packages/hooks/hook-protocol/src/index.ts' }] },
      ],
      connections: [
        { id: 'enter', from: 'entrypoints', to: 'profiles', label: '选择运行表面', variant: 'emphasis', labelAt: [200, 392] },
        { id: 'compose', from: 'profiles', to: 'cordis', label: '组合 patch 层', labelAt: [390, 306] },
        { id: 'mount', from: 'cordis', to: 'agent', label: '挂载服务', labelAt: [580, 392] },
        { id: 'dispatch', from: 'agent', to: 'tools', label: 'tool calls', variant: 'emphasis', labelAt: [770, 306] },
        { id: 'resolve-provider', from: 'tools', to: 'providers', label: '按 seam 分派', labelAt: [960, 392] },
        { id: 'enforce', from: 'providers', to: 'execution', label: '受策略约束', variant: 'security', labelAt: [1150, 306] },
        { id: 'surface-profile', from: 'surfaces', to: 'profiles', label: 'Profile 配置', fromSide: 'bottom', toSide: 'top', labelAt: [295, 210] },
        { id: 'surface-api', from: 'surfaces', to: 'api', label: 'RPC / events' },
        { id: 'api-agent', from: 'api', to: 'agent', label: '控制与观察', fromSide: 'bottom', toSide: 'top', variant: 'dashed' },
        { id: 'persist', from: 'agent', to: 'state', label: 'session/event', fromSide: 'bottom', toSide: 'top', variant: 'emphasis' },
        { id: 'extend-agent', from: 'extensions', to: 'agent', label: '组合能力', fromSide: 'left', toSide: 'top', variant: 'dashed' },
        { id: 'extend-tools', from: 'extensions', to: 'tools', label: '注册工具', fromSide: 'bottom', toSide: 'top', variant: 'dashed' },
      ],
      cards: cards(
        ['cyan', '架构原则', '所有应用由 dsh Profile 启动', 'Cordis 服务定义与提供者解耦', '运行能力由插件树组合而非硬编码'],
        ['emerald', '状态原则', 'session/event 是可回放事实', '实时 agent/* 事件负责协调', 'JSONL 与 SQLite 是可替换持久化实现'],
        ['rose', '执行边界', '工具先经过权限、guard 与 hook', '本地和 E2B 共用抽象 seam', '外部接口不绕过核心 Agent 服务'],
      ),
    },
  },
  {
    slug: '02-module-atlas',
    type: 'architecture',
    title: 'Monorepo 模块全景',
    description: `把 packages 目录下 ${packageFiles.length} 个包按职责归入 12 个架构域，覆盖所有一级包组。`,
    evidence: ['AGENTS.md', 'packages/README.md', 'docs/module-graph.md', 'pnpm-workspace.yaml'],
    spec: {
      schema_version: 1,
      diagram_type: 'architecture',
      meta: meta('DeepSeek Harness Monorepo 模块全景', '02-module-atlas', views(
        ['runtime-spine', '运行时主干', ['surfaces', 'composition', 'core', 'providers'], '从产品入口到插件组合、Agent 主干与能力实现。'],
        ['extension-plane', '扩展平面', ['interfaces', 'capabilities', 'execution', 'orchestration'], '接口、工具能力、执行后端与多 Agent 编排彼此解耦。'],
        ['foundation-plane', '基础平面', ['state', 'policy', 'platform', 'delivery'], '状态、策略、跨平台基础与工程交付支撑上层运行时。'],
      ), { viewBox: [1260, 760], repository }),
      components: [
        { id: 'surfaces', type: 'frontend', label: '产品表面', sublabel: 'apps / client / host', pos: [35, 120], size: [190, 72], sources: [{ path: 'apps/cli/package.json' }, { path: 'packages/client/connection/package.json' }, { path: 'packages/host/webserver/package.json' }] },
        { id: 'composition', type: 'cloud', label: '组合与启动', sublabel: 'boot / bundle / preset / extensions', pos: [355, 120], size: [210, 72], sources: [{ path: 'packages/boot/app-boot/package.json' }, { path: 'packages/bundle/base/package.json' }, { path: 'packages/preset/agent-presets/package.json' }] },
        { id: 'core', type: 'backend', label: 'Agent 核心', sublabel: 'core / llm / context / compaction', pos: [675, 120], size: [210, 72], sources: [{ path: 'packages/core/agent/package.json' }, { path: 'packages/llm/llm/package.json' }, { path: 'packages/compaction/compaction/package.json' }] },
        { id: 'providers', type: 'external', label: '外部能力提供者', sublabel: 'web / llm / mcp / e2b', pos: [1010, 120], size: [205, 72], sources: [{ path: 'packages/web/web/package.json' }, { path: 'packages/mcp/mcp-client/package.json' }, { path: 'packages/e2b/e2b/package.json' }] },
        { id: 'interfaces', type: 'security', label: '协议与接口', sublabel: 'api / typert / sdk / acp / hooks', pos: [35, 320], size: [205, 72], sources: [{ path: 'packages/api/gateway/package.json' }, { path: 'packages/typert/protocol/package.json' }, { path: 'packages/sdk/protocol/package.json' }] },
        { id: 'capabilities', type: 'messagebus', label: '工具能力', sublabel: 'fs / shell / terminal / lsp / skill', pos: [355, 320], size: [210, 72], sources: [{ path: 'packages/fs/fs/package.json' }, { path: 'packages/shell/shell/package.json' }, { path: 'packages/skill/skill/package.json' }] },
        { id: 'execution', type: 'security', label: '执行与隔离', sublabel: 'sandbox / subprocess / code-runtime', pos: [675, 320], size: [210, 72], sources: [{ path: 'packages/sandbox/sandbox/package.json' }, { path: 'packages/subprocess/subprocess/package.json' }, { path: 'packages/code-runtime/code-runtime/package.json' }] },
        { id: 'orchestration', type: 'cloud', label: '编排与后台任务', sublabel: 'subagent / workflow / jobs / schedule', pos: [1010, 320], size: [205, 72], sources: [{ path: 'packages/subagent/subagent/package.json' }, { path: 'packages/workflow/workflow/package.json' }, { path: 'packages/jobs/jobs/package.json' }] },
        { id: 'state', type: 'database', label: '状态与数据', sublabel: 'session / query / storage / spill', pos: [35, 520], size: [205, 72], sources: [{ path: 'packages/session/session-persistence/package.json' }, { path: 'packages/session-query/session-query/package.json' }, { path: 'packages/storage/storage/package.json' }] },
        { id: 'policy', type: 'security', label: '策略与交互', sublabel: 'interaction / guard / credentials', pos: [355, 520], size: [210, 72], sources: [{ path: 'packages/interaction/user-approval/package.json' }, { path: 'packages/guard/timeout-policy/package.json' }, { path: 'packages/credentials/credentials/package.json' }] },
        { id: 'platform', type: 'backend', label: '平台基础', sublabel: 'util / identity / attachment / workspace', pos: [675, 520], size: [210, 72], sources: [{ path: 'packages/util/atomic-write/package.json' }, { path: 'packages/identity/anonymous-user-id/package.json' }, { path: 'packages/workspace/workspace/package.json' }] },
        { id: 'delivery', type: 'external', label: '工程与发布', sublabel: 'scripts / test-support / python / native', pos: [1010, 520], size: [205, 72], sources: [{ path: 'scripts/build.ts' }, { path: 'packages/test-support/agent-loop-testkit/package.json' }, { path: 'python/sdk/pyproject.toml' }] },
      ],
      connections: [
        { id: 'surface-compose', from: 'surfaces', to: 'composition', label: '选择 Profile' },
        { id: 'compose-core', from: 'composition', to: 'core', label: '挂载插件树', variant: 'emphasis' },
        { id: 'core-provider', from: 'core', to: 'providers', label: '调用 provider' },
        { id: 'interface-capability', from: 'interfaces', to: 'capabilities', label: '暴露能力' },
        { id: 'capability-execution', from: 'capabilities', to: 'execution', label: '委托执行', variant: 'security' },
        { id: 'execution-orchestration', from: 'execution', to: 'orchestration', label: '支撑 worker' },
        { id: 'state-policy', from: 'state', to: 'policy', label: '持久化决策' },
        { id: 'policy-platform', from: 'policy', to: 'platform', label: '约束实现', variant: 'security' },
        { id: 'platform-delivery', from: 'platform', to: 'delivery', label: '构建验证' },
        { id: 'surfaces-interfaces', from: 'surfaces', to: 'interfaces', fromSide: 'bottom', toSide: 'top' },
        { id: 'composition-capabilities', from: 'composition', to: 'capabilities', fromSide: 'bottom', toSide: 'top' },
        { id: 'core-execution', from: 'core', to: 'execution', fromSide: 'bottom', toSide: 'top' },
        { id: 'providers-orchestration', from: 'providers', to: 'orchestration', fromSide: 'bottom', toSide: 'top' },
        { id: 'interfaces-state', from: 'interfaces', to: 'state', fromSide: 'bottom', toSide: 'top', variant: 'dashed' },
        { id: 'capabilities-policy', from: 'capabilities', to: 'policy', fromSide: 'bottom', toSide: 'top', variant: 'dashed' },
        { id: 'execution-platform', from: 'execution', to: 'platform', fromSide: 'bottom', toSide: 'top', variant: 'dashed' },
        { id: 'orchestration-delivery', from: 'orchestration', to: 'delivery', fromSide: 'bottom', toSide: 'top', variant: 'dashed' },
      ],
      cards: cards(
        ['cyan', '覆盖范围', '12 个架构域覆盖 packages 下全部一级分组', 'apps、python、native、scripts 与 vendor 单独纳入', '叶子包详情保留在仓库生成目录与图集索引中'],
        ['amber', '阅读方法', '横向看每层内部责任链', '纵向看表面、能力和基础设施依赖', '用 HTML 搜索定位具体域或包名'],
      ),
    },
  },
  {
    slug: '03-profile-boot',
    type: 'workflow',
    title: 'Profile 启动与热重载流程',
    description: 'dsh 入口如何解析 Profile、叠加 bundle/user/CLI patch，并启动可热重载的 Cordis 插件树。',
    evidence: ['apps/cli/src/bin.ts', 'apps/cli/src/args.ts', 'apps/cli/src/profile-boot.ts', 'packages/boot/app-boot/src/index.ts'],
    spec: {
      schema_version: 1,
      diagram_type: 'workflow',
      meta: meta('Profile 启动与热重载流程', '03-profile-boot', views(
        ['cold-start', '冷启动主链', ['argv', 'profile', 'patches', 'context', 'mount', 'ready'], '从 dsh 参数到全部 Cordis entry 激活。'],
        ['overrides', '配置优先级', ['profile', 'patches', 'dump'], 'bundle、profile、home、--patch 和 telemetry switch 按顺序组合。'],
        ['lifetime', '运行期生命周期', ['mount', 'ready', 'hmr', 'shutdown'], 'Loader 稳定后进入运行态，配置变化重组，信号统一释放根 Fiber。'],
      ), { viewBox: [1180, 760] }),
      lanes: [
        { id: 'launcher', label: 'CLI Launcher' },
        { id: 'composition', label: 'Profile Composition' },
        { id: 'cordis', label: 'Cordis Runtime' },
        { id: 'runtime', label: 'Application Lifetime' },
      ],
      phases: [
        { id: 'resolve', label: '解析', fromCol: 0, toCol: 1 },
        { id: 'compose-phase', label: '组合', fromCol: 2, toCol: 3, variant: 'emphasis' },
        { id: 'activate', label: '激活与运行', fromCol: 4, toCol: 5 },
      ],
      mainPath: ['argv', 'profile', 'patches', 'context', 'mount', 'ready'],
      nodes: [
        { id: 'argv', lane: 'launcher', col: 0, type: 'external', label: '解析 dsh argv', sublabel: '--profile / --patch / app args' },
        { id: 'profile', lane: 'composition', col: 1, type: 'cloud', label: '解析 Profile', sublabel: '$DSH_HOME/profiles/<name>' },
        { id: 'patches', lane: 'composition', col: 2, width: 98, type: 'messagebus', label: '叠加 Patch', sublabel: 'bundle -> profile -> home -> CLI' },
        { id: 'context', lane: 'cordis', col: 3, type: 'backend', label: '创建 Context', sublabel: '环境与命令行快照' },
        { id: 'mount', lane: 'cordis', col: 4, width: 92, type: 'backend', label: 'Loader 挂载', sublabel: 'include + plugin tree' },
        { id: 'ready', lane: 'runtime', col: 5, type: 'cloud', label: '应用就绪', sublabel: 'entries activated' },
        { id: 'dump', lane: 'launcher', col: 2, type: 'frontend', label: '配置诊断', sublabel: '--dump-config' },
        { id: 'hmr', lane: 'runtime', col: 3, type: 'messagebus', label: 'Patch 热重载', sublabel: '重新读取用户层' },
        { id: 'shutdown', lane: 'runtime', col: 1, type: 'security', label: '统一关闭', sublabel: 'SIGTERM / SIGINT / appExit' },
      ],
      edges: [
        { id: 'parse-profile', from: 'argv', to: 'profile', role: 'main', variant: 'emphasis' },
        { id: 'load-layers', from: 'profile', to: 'patches', role: 'main', label: '加载 layers' },
        { id: 'create-context', from: 'patches', to: 'context', role: 'main', label: '冻结组合' },
        { id: 'mount-tree', from: 'context', to: 'mount', role: 'main', label: 'boot()' },
        { id: 'settle-tree', from: 'mount', to: 'ready', role: 'main', variant: 'emphasis' },
        { id: 'dump-branch', from: 'profile', to: 'dump', role: 'branch', label: '只打印，不启动' },
        { id: 'watch-layer', from: 'ready', to: 'hmr', role: 'async', variant: 'dashed', route: 'return-left' },
        { id: 'reload-tree', from: 'hmr', to: 'mount', role: 'return', label: '重组用户层' },
        { id: 'dispose-tree', from: 'ready', to: 'shutdown', role: 'error', label: '退出请求', variant: 'security', route: 'return-left' },
      ],
      cards: cards(
        ['cyan', 'Patch 优先级', 'bundle 默认层最先应用', 'profile 与 home 用户层覆盖默认值', '--patch 与 telemetry switch 最后应用'],
        ['rose', '失败语义', 'host preparation 与 plugin tree 失败分开报告', '部分启动失败先释放根 Fiber', '所有 entry 激活后才宣告 ready'],
      ),
    },
  },
  {
    slug: '04-agent-turn',
    type: 'sequence',
    title: 'Agent Turn 与 Step 时序',
    description: '用户输入进入队列后，Agent 如何组装 prompt、流式调用 LLM、执行工具并写入可回放会话事件。',
    evidence: ['docs/agent-lifecycle.md', 'packages/core/agent/src/index.ts', 'packages/core/agent-loop/src/index.ts', 'packages/core/session/src/index.ts'],
    spec: {
      schema_version: 1,
      diagram_type: 'sequence',
      meta: meta('Agent Turn 与 Step 时序', '04-agent-turn', views(
        ['claim-and-request', '认领输入并请求模型', ['user', 'agent', 'driver', 'prompt', 'llm'], '输入批次经 pre-step 和系统提示组装后形成一次模型请求。'],
        ['tool-round', '工具回合', ['driver', 'tools', 'session'], '模型工具调用按屏障与有界并发执行，结果仍按模型顺序记录。'],
        ['durable-observation', '持久化与观察', ['session', 'sdk'], 'session/event 是可回放事实，agent/* 只承载实时协调状态。'],
      ), { viewBox: [1220, 1030], column_fit: 'spread' }),
      participants: [
        { id: 'user', type: 'external', label: '用户' },
        { id: 'agent', type: 'backend', label: 'Agent Registry' },
        { id: 'driver', type: 'backend', label: 'Agent Loop' },
        { id: 'hooks', type: 'security', label: 'Hooks' },
        { id: 'prompt', type: 'messagebus', label: 'System Prompt' },
        { id: 'llm', type: 'cloud', label: 'LLM Provider' },
        { id: 'tools', type: 'security', label: 'Tools' },
        { id: 'session', type: 'database', label: 'Session' },
        { id: 'sdk', type: 'frontend', label: 'UI / SDK' },
      ],
      segments: [
        { from: 160, to: 375, label: 'Turn 启动' },
        { from: 395, to: 650, label: '模型请求' },
        { from: 670, to: 875, label: '工具批次' },
        { from: 895, to: 980, label: 'Turn 收束' },
      ],
      messages: [
        { id: 'followup', from: 'user', to: 'agent', y: 185, label: 'followup(content)', variant: 'emphasis' },
        { id: 'inbox-event', from: 'agent', to: 'sdk', y: 225, label: 'agent/inbox/inserted', variant: 'dashed' },
        { id: 'wake-driver', from: 'agent', to: 'driver', y: 270, label: 'queued work wakes driver' },
        { id: 'turn-start', from: 'driver', to: 'session', y: 315, label: 'turn/start', variant: 'emphasis' },
        { id: 'pre-step', from: 'driver', to: 'hooks', y: 360, label: 'agent/pre-step waterfall', variant: 'security' },
        { id: 'step-start', from: 'driver', to: 'session', y: 420, label: 'step/start + user/message' },
        { id: 'assemble', from: 'driver', to: 'prompt', y: 470, label: 'system-prompt/assemble' },
        { id: 'request', from: 'driver', to: 'llm', y: 520, label: 'agent/request -> llm/stream', variant: 'emphasis' },
        { id: 'chunks', from: 'llm', to: 'driver', y: 570, label: 'StreamChunk*', variant: 'return' },
        { id: 'chunk-events', from: 'driver', to: 'session', y: 620, label: 'assistant/chunk*', variant: 'dashed' },
        { id: 'assistant-message', from: 'driver', to: 'session', y: 685, label: 'assistant/message' },
        { id: 'tool-call', from: 'driver', to: 'tools', y: 735, label: 'ordered pre + concurrent execute', variant: 'security' },
        { id: 'tool-events', from: 'tools', to: 'session', y: 785, label: 'tool/call + tool/result', variant: 'return' },
        { id: 'session-events', from: 'session', to: 'sdk', y: 835, label: 'session/event stream', variant: 'dashed' },
        { id: 'step-end', from: 'driver', to: 'session', y: 900, label: 'step/end' },
        { id: 'turn-end', from: 'driver', to: 'session', y: 945, label: 'turn/end', variant: 'emphasis' },
        { id: 'idle', from: 'driver', to: 'sdk', y: 980, label: 'agent/status = idle', variant: 'return' },
      ],
      activations: [
        { participant: 'agent', from: 180, to: 285, type: 'backend' },
        { participant: 'driver', from: 265, to: 985, type: 'backend' },
        { participant: 'llm', from: 510, to: 580, type: 'cloud' },
        { participant: 'tools', from: 725, to: 800, type: 'security' },
        { participant: 'session', from: 305, to: 960, type: 'database' },
      ],
      cards: cards(
        ['emerald', '持久事实', 'turn/step/message/tool 事件全部写入 Session', 'assistant/message 保留 provider、usage 与 chunk 来源', 'SDK 重放读取 session/event'],
        ['amber', '实时控制', 'agent/* 负责 inbox、status、steering 与错误协调', 'pre-step 返回值是权威进入决策', '工具批次并发执行但按模型顺序提交结果'],
      ),
    },
  },
  {
    slug: '05-tool-execution',
    type: 'dataflow',
    title: '工具执行与策略管线',
    description: '工具调用从持久化、权限审批、单调 guard、沙箱执行到结果冻结和 UI 呈现的完整数据流。',
    evidence: ['docs/tool-execution-pipeline.md', 'packages/core/tools/src/index.ts', 'packages/interaction/user-approval/src/index.ts', 'packages/guard/timeout-policy/src/index.ts'],
    spec: {
      schema_version: 1,
      diagram_type: 'dataflow',
      meta: meta('工具执行与策略管线', '05-tool-execution', views(
        ['policy-path', '权限与 Guard', ['call', 'pre', 'approval', 'guards'], '所有工具调用先进入可扩展 pre waterfall，再由审批和单调 guard 决定是否执行。'],
        ['execution-path', '执行与资源策略', ['guards', 'around', 'body', 'fsGate'], 'timeout 等 around concern 包裹真实工具体，文件写入再经过专属 intent gate。'],
        ['result-path', '权威结果', ['post', 'normalize', 'result', 'ui', 'context'], '结果归一化、finalize 并冻结后才记录、展示和注入后续上下文。'],
      ), { viewBox: [1220, 850] }),
      stages: [
        { label: '模型与日志' },
        { label: '策略判定' },
        { label: '受控执行' },
        { label: '结果收束' },
        { label: '消费与后续' },
      ],
      nodes: [
        { id: 'call', type: 'messagebus', label: 'tool/call', sublabel: '执行前先写 Session', stage: 0, row: 1, tag: 'durable' },
        { id: 'pre', type: 'security', label: 'pre-execute', sublabel: 'hooks / permission / sandbox', stage: 1, row: 0 },
        { id: 'approval', type: 'external', label: '用户审批', sublabel: 'one-shot prompt', stage: 1, row: 2, tag: 'fail closed' },
        { id: 'guards', type: 'security', label: '单调 Guards', sublabel: 'deny or abstain', stage: 1, row: 4 },
        { id: 'around', type: 'cloud', label: 'execute waterfall', sublabel: 'timeout / retry / metrics', stage: 2, row: 0 },
        { id: 'body', type: 'backend', label: 'Tool execute()', sublabel: '注册工具实现', stage: 2, row: 2 },
        { id: 'fsGate', type: 'security', label: 'FS Intent Gate', sublabel: 'write/edit 专属检查', stage: 2, row: 4 },
        { id: 'post', type: 'security', label: 'post-execute', sublabel: 'accept / block / replace', stage: 3, row: 0 },
        { id: 'normalize', type: 'backend', label: 'Normalize + Finalize', sublabel: 'lossless snapshot', stage: 3, row: 3 },
        { id: 'result', type: 'database', label: 'tool/result', sublabel: '冻结的权威结果', stage: 4, row: 1, tag: 'durable' },
        { id: 'ui', type: 'frontend', label: 'UI Tool Card', sublabel: 'pending -> completed', stage: 4, row: 3 },
        { id: 'context', type: 'messagebus', label: 'Additional Context', sublabel: '批次完成后 FIFO 注入', stage: 4, row: 5 },
      ],
      flows: [
        { id: 'call-pre', from: 'call', to: 'pre', label: '候选调用', classification: 'typed args', variant: 'emphasis' },
        { id: 'pre-approval', from: 'pre', to: 'approval', label: 'ask', classification: 'approval request', variant: 'security' },
        { id: 'pre-guards', from: 'pre', to: 'guards', label: 'allow', classification: 'policy decision' },
        { id: 'approval-guards', from: 'approval', to: 'guards', label: 'allowed-once', classification: 'ephemeral grant', variant: 'security' },
        { id: 'guards-around', from: 'guards', to: 'around', label: '允许执行', classification: 'identity protected', variant: 'emphasis' },
        { id: 'around-body', from: 'around', to: 'body', label: 'dispatch', classification: 'bounded execution' },
        { id: 'body-fs', from: 'body', to: 'fsGate', label: '写入意图', classification: 'fs only', variant: 'security' },
        { id: 'around-post', from: 'around', to: 'post', label: '候选结果', classification: 'tool result' },
        { id: 'fs-post', from: 'fsGate', to: 'post', label: '受控结果', classification: 'observed mutation' },
        { id: 'post-normalize', from: 'post', to: 'normalize', label: '最终候选', classification: 'lossless JSON' },
        { id: 'normalize-result', from: 'normalize', to: 'result', label: 'finalizeContent', classification: 'immutable outcome', variant: 'emphasis' },
        { id: 'result-ui', from: 'result', to: 'ui', label: 'presentResult', classification: 'display' },
        { id: 'result-context', from: 'result', to: 'context', label: '批次完成', classification: 'next step', variant: 'dashed' },
      ],
      cards: cards(
        ['rose', '拒绝仍是结果', '拒绝或审批失败跳过工具体', '异常被归一化为 isError 结果', '每次调用只产生一个模型可见 tool/result'],
        ['cyan', '扩展点顺序', 'pre -> guards -> execute -> post', 'finalizeContent 在 waterfall 之后执行', 'tools/result 观察冻结结果而不再改写'],
      ),
    },
  },
  {
    slug: '06-web-control-plane',
    type: 'sequence',
    title: 'Web 控制面启动与请求链路',
    description: '浏览器插件图、Connection、WebServer、Typert Gateway 与业务 Controller 之间的请求和事件路径。',
    evidence: ['packages/bundle/web-app/cordis.patch.yml', 'packages/client/modules/src/index.ts', 'packages/client/connection/src/index.ts', 'packages/api/gateway/src/index.ts'],
    spec: {
      schema_version: 1,
      diagram_type: 'sequence',
      meta: meta('Web 控制面启动与请求链路', '06-web-control-plane', views(
        ['browser-boot', '浏览器启动', ['browser', 'modules', 'connection'], 'Host 扫描 dsh.client 插件并将启动清单交给浏览器内核。'],
        ['remote-call', 'Remote 调用', ['ui', 'connection', 'webserver', 'gateway', 'controller'], '统一信任检查之后，Gateway 校验描述符并调用实时业务服务。'],
        ['live-events', '实时事件', ['agent', 'gateway', 'connection', 'ui'], 'Session 和 Remote 事件通过 Connection 的流式通道回到界面。'],
      ), { viewBox: [1180, 940], column_fit: 'spread' }),
      participants: [
        { id: 'browser', type: 'external', label: 'Browser' },
        { id: 'modules', type: 'frontend', label: 'Client Modules' },
        { id: 'ui', type: 'frontend', label: 'UI Plugin' },
        { id: 'connection', type: 'security', label: 'Connection' },
        { id: 'webserver', type: 'cloud', label: 'WebServer' },
        { id: 'gateway', type: 'security', label: 'Typert Gateway' },
        { id: 'controller', type: 'backend', label: 'API Controller' },
        { id: 'agent', type: 'database', label: 'Agent / Session' },
      ],
      segments: [
        { from: 160, to: 350, label: 'Client 插件启动' },
        { from: 370, to: 680, label: 'Unary Remote' },
        { from: 700, to: 880, label: '实时事件' },
      ],
      messages: [
        { id: 'open', from: 'browser', to: 'modules', y: 185, label: 'GET /', variant: 'emphasis' },
        { id: 'boot-manifest', from: 'modules', to: 'browser', y: 230, label: 'window.__DSH_BOOT__', variant: 'return' },
        { id: 'load-client', from: 'browser', to: 'modules', y: 275, label: 'GET /plugins/<id>/client.js' },
        { id: 'adopt-ui', from: 'modules', to: 'ui', y: 325, label: '构造 Client Cordis 图' },
        { id: 'invoke', from: 'ui', to: 'connection', y: 400, label: 'ctx.remote.<ns>.<method>()', variant: 'emphasis' },
        { id: 'post-api', from: 'connection', to: 'webserver', y: 450, label: 'POST /api/<ns>/<method>', variant: 'security' },
        { id: 'route', from: 'webserver', to: 'gateway', y: 500, label: 'FetchHandler dispatch' },
        { id: 'resolve', from: 'gateway', to: 'controller', y: 550, label: 'validate + lookup + invoke', variant: 'security' },
        { id: 'business', from: 'controller', to: 'agent', y: 600, label: '控制 Agent / Session' },
        { id: 'result', from: 'agent', to: 'ui', y: 655, label: 'typed result envelope', variant: 'return' },
        { id: 'event-source', from: 'agent', to: 'gateway', y: 730, label: 'session / Remote events', variant: 'dashed' },
        { id: 'sse', from: 'gateway', to: 'connection', y: 780, label: 'event stream frames', variant: 'dashed' },
        { id: 'render-event', from: 'connection', to: 'ui', y: 830, label: 'projection + render', variant: 'return' },
        { id: 'cancel', from: 'ui', to: 'gateway', y: 875, label: 'AbortSignal / cancellation', variant: 'security' },
      ],
      activations: [
        { participant: 'modules', from: 175, to: 335, type: 'frontend' },
        { participant: 'connection', from: 390, to: 845, type: 'security' },
        { participant: 'gateway', from: 490, to: 885, type: 'security' },
        { participant: 'controller', from: 540, to: 665, type: 'backend' },
      ],
      cards: cards(
        ['cyan', '双面插件', 'Node half 扫描并托管 browser bundle', 'Browser half 在 Client Cordis 中运行', 'dsh.client roster 决定界面能力'],
        ['rose', '信任边界', 'Connection 统一执行 /api 信任检查', 'Gateway 只接受生成描述符或活动 SRC marker', '请求、返回与取消均受运行时校验'],
      ),
    },
  },
  {
    slug: '07-session-persistence',
    type: 'dataflow',
    title: '会话事件、投影与查询数据流',
    description: '会话事件如何成为 append-only 事实，经 JSONL/SQLite 持久化、投影缓存、查询和遥测供不同消费者使用。',
    evidence: ['docs/persistence-catalog.md', 'packages/core/session/src/index.ts', 'packages/session/session-persistence/src/index.ts', 'packages/session/session-projection/src/index.ts'],
    spec: {
      schema_version: 1,
      diagram_type: 'dataflow',
      meta: meta('会话事件、投影与查询数据流', '07-session-persistence', views(
        ['write-path', '事件写入', ['agentEvents', 'ownedEvents', 'session', 'persistence'], '核心事件和功能包自有事件进入同一个 append-only Session。'],
        ['storage-path', '持久化实现', ['persistence', 'jsonl', 'sqlite'], 'Service Definition 隔离内存模型与可替换存储后端。'],
        ['read-path', '投影与读取', ['session', 'projection', 'cache', 'query', 'consumers'], '界面与 SDK 读取投影或查询结果，不直接重写日志事实。'],
      ), { viewBox: [1180, 820] }),
      stages: [
        { label: '事件生产者' },
        { label: '内存事实' },
        { label: '持久化' },
        { label: '派生读取' },
        { label: '消费者' },
      ],
      nodes: [
        { id: 'agentEvents', type: 'backend', label: 'Agent Loop 事件', sublabel: 'turn / step / message / tool', stage: 0, row: 0 },
        { id: 'ownedEvents', type: 'messagebus', label: '功能包事件', sublabel: 'goal / approval / sandbox / workflow', stage: 0, row: 3 },
        { id: 'session', type: 'database', label: 'Session Event Log', sublabel: 'monotonic seq + append-only', stage: 1, row: 1, tag: 'source of truth' },
        { id: 'persistence', type: 'security', label: 'Persistence Seam', sublabel: 'load / append / flush', stage: 2, row: 1 },
        { id: 'jsonl', type: 'database', label: 'JSONL Backend', sublabel: '默认持久化', stage: 2, row: 3 },
        { id: 'sqlite', type: 'database', label: 'SQLite Backend', sublabel: '替代实现', stage: 2, row: 5 },
        { id: 'projection', type: 'backend', label: 'Projection Registry', sublabel: '从事件折叠视图', stage: 3, row: 0 },
        { id: 'cache', type: 'database', label: 'Projection Cache', sublabel: '可重建派生状态', stage: 3, row: 2 },
        { id: 'query', type: 'backend', label: 'Session Query', sublabel: 'reads / traces / search', stage: 3, row: 4 },
        { id: 'telemetry', type: 'cloud', label: 'OTel Telemetry', sublabel: '会话观测', stage: 3, row: 6 },
        { id: 'consumers', type: 'frontend', label: 'Web / SDK / Export', sublabel: '重放、列表、检索与下载', stage: 4, row: 2 },
      ],
      flows: [
        { id: 'agent-session', from: 'agentEvents', to: 'session', label: 'append', classification: 'durable event', variant: 'emphasis' },
        { id: 'owned-session', from: 'ownedEvents', to: 'session', label: 'append', classification: 'package-owned event' },
        { id: 'session-persistence', from: 'session', to: 'persistence', label: 'flush batches', classification: 'ordered events', variant: 'emphasis' },
        { id: 'persist-jsonl', from: 'persistence', to: 'jsonl', label: 'provider', classification: 'JSON Lines' },
        { id: 'persist-sqlite', from: 'persistence', to: 'sqlite', label: 'provider', classification: 'schema versioned', variant: 'dashed' },
        { id: 'session-projection', from: 'session', to: 'projection', label: 'fold events', classification: 'deterministic view' },
        { id: 'projection-cache', from: 'projection', to: 'cache', label: 'cache snapshot', classification: 'rebuildable' },
        { id: 'session-query', from: 'session', to: 'query', label: 'cold reads', classification: 'filters + traces' },
        { id: 'query-consumers', from: 'query', to: 'consumers', label: 'query result', classification: 'typed read' },
        { id: 'cache-consumers', from: 'cache', to: 'consumers', label: 'projection', classification: 'UI state', variant: 'emphasis' },
        { id: 'session-telemetry', from: 'session', to: 'telemetry', label: 'observe', classification: 'OTLP', variant: 'dashed' },
      ],
      cards: cards(
        ['emerald', '事实与派生分离', 'Session 日志是唯一可回放事实', 'Projection 和 cache 可从事件重建', '查询与 UI 不回写派生状态到历史'],
        ['amber', '后端边界', 'JSONL 是默认 profile 选择', 'SQLite 以单调 SCHEMA_VERSION 演进', '同一 Persistence seam 保持上层不依赖存储格式'],
      ),
    },
  },
  {
    slug: '08-subagent-orchestration',
    type: 'workflow',
    title: '子代理委派与续接流程',
    description: '父 Agent 如何选择模型和 provider，spawn/fork 子 Agent，并通过报告、控制与 continuation 回收结果。',
    evidence: ['packages/subagent/subagent/src/index.ts', 'packages/subagent/tool-subagent/src/index.ts', 'packages/subagent/subagent-spawn-in-process/src/index.ts', 'packages/subagent/subagent-fork-in-process/src/index.ts'],
    spec: {
      schema_version: 1,
      diagram_type: 'workflow',
      meta: meta('子代理委派与续接流程', '08-subagent-orchestration', views(
        ['delegate', '创建子代理', ['delegate', 'model', 'route', 'create'], '父 Agent 提交任务，服务解析模型偏好与 provider 能力。'],
        ['child-run', '子 Agent 执行', ['create', 'child', 'run', 'control'], 'spawn 或 fork 建立隔离上下文，控制工具可列举、跟进或中断。'],
        ['return', '结果回收', ['run', 'report', 'continue'], '结构化报告返回父上下文，continuation 可在同一子代理上继续。'],
      ), { viewBox: [1180, 780] }),
      lanes: [
        { id: 'parent', label: 'Parent Agent' },
        { id: 'service', label: 'Subagent Service' },
        { id: 'provider', label: 'Provider / Driver' },
        { id: 'childlane', label: 'Child Agent' },
        { id: 'results', label: 'Results + Control' },
      ],
      phases: [
        { id: 'request-phase', label: '请求', fromCol: 0, toCol: 1 },
        { id: 'create-phase', label: '路由与创建', fromCol: 2, toCol: 3, variant: 'emphasis' },
        { id: 'return-phase', label: '执行与回收', fromCol: 4, toCol: 5 },
      ],
      mainPath: ['delegate', 'model', 'route', 'create', 'run', 'report', 'continue'],
      nodes: [
        { id: 'delegate', lane: 'parent', col: 0, type: 'external', label: '委派任务', sublabel: 'spawn_agent / fork' },
        { id: 'model', lane: 'service', col: 1, type: 'backend', label: '解析模型偏好', sublabel: 'session setting + request' },
        { id: 'route', lane: 'provider', col: 2, type: 'messagebus', label: '选择 Provider', sublabel: 'in-process / SDK / ACP / Codex' },
        { id: 'create', lane: 'provider', col: 3, type: 'cloud', label: 'Spawn 或 Fork', sublabel: '新上下文或继承历史' },
        { id: 'child', lane: 'childlane', col: 3, type: 'backend', label: 'Child Context', sublabel: '独立 Agent + Session' },
        { id: 'run', lane: 'childlane', col: 4, type: 'backend', label: '执行子任务', sublabel: '标准 Agent Loop' },
        { id: 'report', lane: 'results', col: 5, type: 'database', label: '结构化报告', sublabel: 'tool-subagent-report' },
        { id: 'continue', lane: 'parent', col: 5, type: 'messagebus', label: '回到父 Agent', sublabel: '结果或 continuation' },
        { id: 'control', lane: 'service', col: 4, type: 'security', label: '运行期控制', sublabel: 'list / followup / interrupt' },
      ],
      edges: [
        { id: 'delegate-model', from: 'delegate', to: 'model', role: 'main', variant: 'emphasis' },
        { id: 'model-route', from: 'model', to: 'route', role: 'main', label: '规范化请求' },
        { id: 'route-create', from: 'route', to: 'create', role: 'main', label: 'provider capability' },
        { id: 'create-child', from: 'create', to: 'child', role: 'main', variant: 'emphasis', route: 'drop', fromSide: 'bottom', toSide: 'top' },
        { id: 'child-run', from: 'child', to: 'run', role: 'main' },
        { id: 'run-report', from: 'run', to: 'report', role: 'main', label: 'final output' },
        { id: 'report-parent', from: 'report', to: 'continue', role: 'main', variant: 'emphasis', route: 'drop', fromSide: 'top', toSide: 'bottom' },
        { id: 'control-child', from: 'control', to: 'run', role: 'branch', label: 'steer / stop', variant: 'security' },
        { id: 'continue-child', from: 'continue', to: 'control', role: 'return', label: 'followup', variant: 'dashed' },
      ],
      cards: cards(
        ['cyan', 'Provider 可替换', '同一 ctx.subagents seam 支持进程内与外部 Agent', 'spawn 新建上下文，fork 继承受控历史', '模型选择由独立设置服务管理'],
        ['rose', '生命周期约束', '父子 Session 身份由路由边界隔离', '控制操作只作用于已登记子代理', '报告通过专用工具形成稳定回传契约'],
      ),
    },
  },
  {
    slug: '09-execution-sandbox',
    type: 'architecture',
    title: '执行、文件系统与沙箱架构',
    description: '文件、Shell、Terminal 如何通过稳定 seam 选择本地或 E2B provider，并由跨平台沙箱策略约束副作用。',
    evidence: ['packages/sandbox/sandbox-local/src/index.ts', 'packages/sandbox/sandbox-local/src/profiles.ts', 'packages/fs/fs-sandbox/src/index.ts', 'packages/e2b/e2b/README.md'],
    spec: {
      schema_version: 1,
      diagram_type: 'architecture',
      meta: meta('执行、文件系统与沙箱架构', '09-execution-sandbox', views(
        ['tool-surface', '模型可见工具', ['registry', 'fsTools', 'shellTools', 'terminalTools'], '所有副作用从工具注册表进入对应能力家族。'],
        ['policy-seams', '策略与抽象', ['policy', 'fsSeam', 'processSeam', 'terminalSeam'], 'Session 级 sandbox mode 同时约束文件和命令执行。'],
        ['provider-worlds', '执行世界', ['local', 'e2b', 'host', 'remote'], '本地 provider 使用 OS 隔离器，E2B provider 共享一次性远程 Linux 世界。'],
      ), { viewBox: [1260, 760], repository }),
      components: [
        { id: 'registry', type: 'messagebus', label: 'Tool Registry', sublabel: '统一调用管线', pos: [25, 305], size: [145, 66], sources: [{ path: 'packages/core/tools/src/index.ts' }] },
        { id: 'fsTools', type: 'backend', label: 'FS Tools', sublabel: 'read / write / edit / search', pos: [210, 100], size: [160, 66], sources: [{ path: 'packages/fs/tool-fs/src/index.ts' }, { path: 'packages/fs/tool-fs-search/src/index.ts' }] },
        { id: 'shellTools', type: 'backend', label: 'Shell Tools', sublabel: 'bash / pwsh / persistent', pos: [210, 305], size: [160, 66], sources: [{ path: 'packages/shell/tool-bash/src/index.ts' }, { path: 'packages/shell/tool-bash-persistent/src/index.ts' }] },
        { id: 'terminalTools', type: 'backend', label: 'Terminal Tools', sublabel: 'PTY sessions', pos: [210, 510], size: [160, 66], sources: [{ path: 'packages/terminal/tool-terminal/src/index.ts' }] },
        { id: 'policy', type: 'security', label: 'Sandbox Policy', sublabel: 'read-only / workspace-write', pos: [420, 305], size: [165, 66], sources: [{ path: 'packages/sandbox/sandbox-policy/src/index.ts' }, { path: 'packages/sandbox/sandbox-policy/src/session-mode.ts' }] },
        { id: 'fsSeam', type: 'cloud', label: 'ctx.fs', sublabel: 'filesystem seam', pos: [630, 100], size: [145, 66], sources: [{ path: 'packages/fs/fs/src/index.ts' }] },
        { id: 'processSeam', type: 'cloud', label: 'ctx.subprocess', sublabel: 'spawn seam', pos: [630, 305], size: [145, 66], sources: [{ path: 'packages/subprocess/subprocess/src/index.ts' }] },
        { id: 'terminalSeam', type: 'cloud', label: 'ctx.terminals', sublabel: 'persistent PTY seam', pos: [630, 510], size: [145, 66], sources: [{ path: 'packages/terminal/terminal/src/index.ts' }] },
        { id: 'local', type: 'security', label: 'Local Providers', sublabel: 'FS + subprocess + PTY', pos: [835, 210], size: [160, 66], sources: [{ path: 'packages/fs/fs-local/src/index.ts' }, { path: 'packages/subprocess/subprocess-local/src/index.ts' }, { path: 'packages/terminal/terminal-bash/src/index.ts' }] },
        { id: 'e2b', type: 'external', label: 'E2B Providers', sublabel: 'shared remote sandbox', pos: [835, 410], size: [160, 66], sources: [{ path: 'packages/e2b/e2b/src/index.ts' }, { path: 'packages/e2b/fs-e2b/src/index.ts' }, { path: 'packages/e2b/subprocess-e2b/src/index.ts' }] },
        { id: 'host', type: 'external', label: 'Host OS Isolation', sublabel: 'Landlock / bwrap / Seatbelt / ACL', pos: [1050, 210], size: [180, 66], sources: [{ path: 'packages/sandbox/sandbox-local/src/profiles.ts' }, { path: 'native/landlock-run' }] },
        { id: 'remote', type: 'external', label: 'Remote Linux World', sublabel: 'ephemeral cwd + processes', pos: [1050, 410], size: [180, 66], sources: [{ path: 'packages/e2b/e2b/README.md' }] },
      ],
      connections: [
        { id: 'registry-fs', from: 'registry', to: 'fsTools', label: '文件调用' },
        { id: 'registry-shell', from: 'registry', to: 'shellTools', label: '命令调用', variant: 'emphasis' },
        { id: 'registry-terminal', from: 'registry', to: 'terminalTools', label: '会话调用' },
        { id: 'fs-policy', from: 'fsTools', to: 'policy', label: 'write/edit intent', variant: 'security' },
        { id: 'shell-policy', from: 'shellTools', to: 'policy', label: 'process policy', variant: 'security' },
        { id: 'policy-fs', from: 'policy', to: 'fsSeam', label: '受控访问' },
        { id: 'policy-process', from: 'policy', to: 'processSeam', label: '受控 spawn' },
        { id: 'terminal-seam', from: 'terminalTools', to: 'terminalSeam' },
        { id: 'fs-local', from: 'fsSeam', to: 'local', label: '本地 provider' },
        { id: 'process-local', from: 'processSeam', to: 'local', label: '本地 provider' },
        { id: 'terminal-local', from: 'terminalSeam', to: 'local', label: 'PTY backend' },
        { id: 'fs-e2b', from: 'fsSeam', to: 'e2b', label: '远程 provider', variant: 'dashed' },
        { id: 'process-e2b', from: 'processSeam', to: 'e2b', label: '远程 provider', variant: 'dashed' },
        { id: 'local-host', from: 'local', to: 'host', label: '平台执行器', variant: 'security' },
        { id: 'e2b-remote', from: 'e2b', to: 'remote', label: 'SDK sandbox handle', variant: 'emphasis' },
      ],
      cards: cards(
        ['rose', '统一策略', '每个 Session 的 sandbox/mode 是持久事件', '文件与 Shell 解析同一 SandboxPolicy', '平台实现失败时 fail closed'],
        ['emerald', '可移植 Provider', '消费者只依赖 ctx.fs / ctx.subprocess / ctx.terminals', 'E2B 文件与进程共享同一远程世界', '本地实现按 Linux、macOS、Windows 选择隔离器'],
      ),
    },
  },
  {
    slug: '10-remote-api',
    type: 'sequence',
    title: 'Typert Remote API 调用时序',
    description: '从 @Remote 声明和生成契约到浏览器调用、Host lookup、业务执行、响应校验与取消的严格链路。',
    evidence: ['docs/api-gateway.md', 'packages/typert/generator/src/index.ts', 'packages/api/gateway/src/index.ts', 'packages/client/connection/src/index.ts'],
    spec: {
      schema_version: 1,
      diagram_type: 'sequence',
      meta: meta('Typert Remote API 调用时序', '10-remote-api', views(
        ['generated-contract', '生成契约', ['business', 'generator', 'remoteClient'], '@Remote 声明在 Host 构建阶段生成双端描述符、codec 和类型。'],
        ['runtime-call', '运行时调用', ['ui', 'remoteClient', 'connection', 'gateway', 'registry', 'business'], 'Client 发送命名 args，Host 严格校验、解析对象并调用当前服务。'],
        ['failure-boundary', '失败与取消', ['ui', 'connection', 'gateway', 'business'], '缺失 provider、schema 错误、卸载和 AbortSignal 都有显式失败语义。'],
      ), { viewBox: [1220, 980], column_fit: 'spread' }),
      participants: [
        { id: 'business', type: 'backend', label: 'Business Service' },
        { id: 'generator', type: 'cloud', label: 'Typert Generator' },
        { id: 'remoteClient', type: 'frontend', label: 'Client Remote' },
        { id: 'ui', type: 'external', label: 'UI / SDK Caller' },
        { id: 'connection', type: 'security', label: 'Connection' },
        { id: 'gateway', type: 'security', label: 'Host Gateway' },
        { id: 'registry', type: 'database', label: 'Typert Registry' },
      ],
      segments: [
        { from: 160, to: 355, label: 'Host 构建生成' },
        { from: 375, to: 775, label: '严格运行时调用' },
        { from: 795, to: 915, label: '取消与卸载' },
      ],
      messages: [
        { id: 'decorators', from: 'business', to: 'generator', y: 185, label: '@Remote / @RemoteScope', variant: 'emphasis' },
        { id: 'host-artifact', from: 'generator', to: 'registry', y: 235, label: 'typert.host.js + codecs' },
        { id: 'client-artifact', from: 'generator', to: 'remoteClient', y: 285, label: 'remote-client.js + d.ts', variant: 'return' },
        { id: 'mount-contract', from: 'remoteClient', to: 'ui', y: 335, label: 'ctx.remote.<namespace>', variant: 'return' },
        { id: 'call', from: 'ui', to: 'remoteClient', y: 405, label: 'concrete method(args, signal)', variant: 'emphasis' },
        { id: 'rpc', from: 'remoteClient', to: 'connection', y: 455, label: "rpc.call('/api', endpoint, { args })", variant: 'security' },
        { id: 'dispatch', from: 'connection', to: 'gateway', y: 505, label: 'POST /api/<namespace>/<method>' },
        { id: 'descriptor', from: 'gateway', to: 'registry', y: 555, label: 'resolve descriptor + live binding', variant: 'security' },
        { id: 'lookup', from: 'registry', to: 'gateway', y: 605, label: 'codec + lookup/context provider', variant: 'return' },
        { id: 'invoke-business', from: 'gateway', to: 'business', y: 655, label: 'invoke current Cordis service', variant: 'emphasis' },
        { id: 'business-result', from: 'business', to: 'gateway', y: 705, label: 'typed result', variant: 'return' },
        { id: 'validated-result', from: 'gateway', to: 'ui', y: 755, label: 'validated response envelope', variant: 'return' },
        { id: 'abort', from: 'ui', to: 'connection', y: 825, label: 'AbortSignal', variant: 'security' },
        { id: 'cancel-host', from: 'connection', to: 'gateway', y: 865, label: 'cancel in-flight invocation', variant: 'dashed' },
        { id: 'unmount', from: 'registry', to: 'remoteClient', y: 910, label: 'withdraw descriptor + stale handles', variant: 'dashed' },
      ],
      activations: [
        { participant: 'generator', from: 175, to: 300, type: 'cloud' },
        { participant: 'remoteClient', from: 275, to: 775, type: 'frontend' },
        { participant: 'connection', from: 445, to: 875, type: 'security' },
        { participant: 'gateway', from: 495, to: 920, type: 'security' },
      ],
      cards: cards(
        ['cyan', '双端生成', 'Host 描述符与 Client contribution 来自同一声明', '业务包显式导出 ./typert 与 ./remote', 'Client 不扫描运行中 Host 的 decorators'],
        ['rose', '严格边界', 'args 字段必须与描述符完全一致', 'lookup 和 Context provider 解析 wire identity', '返回值再次通过 codec 校验后才出站'],
      ),
    },
  },
  {
    slug: '11-build-and-release',
    type: 'dataflow',
    title: '构建、契约生成与发布流水线',
    description: 'Host/Client 分阶段构建、Typert 代码生成、Web 打包、质量门禁与多语言/多运行时发布产物。',
    evidence: ['package.json', 'tsdown.config.ts', 'docs/api-gateway.md', 'scripts/build.ts'],
    spec: {
      schema_version: 1,
      diagram_type: 'dataflow',
      meta: meta('构建、契约生成与发布流水线', '11-build-and-release', views(
        ['host-phase', 'Host 阶段', ['source', 'hostTsc', 'hostBundle', 'contracts'], 'Host Project References 先编译，tsdown 同步生成 Typert 双端契约。'],
        ['client-phase', 'Client 阶段', ['contracts', 'clientTsc', 'clientBundle', 'web'], 'Client 类型检查消费刚生成的 Remote 声明，然后产出 Node loader 与 browser bundle。'],
        ['release-gates', '发布门禁', ['web', 'gates', 'artifacts'], '测试、类型、lint、hygiene、文档与包级不变量共同约束发布。'],
      ), { viewBox: [1180, 780] }),
      stages: [
        { label: '源码' },
        { label: 'Host 构建' },
        { label: '生成契约' },
        { label: 'Client 与 Web' },
        { label: '验证与发布' },
      ],
      nodes: [
        { id: 'source', type: 'external', label: 'TS / TSX / YAML 源码', sublabel: 'workspace + bundle configs', stage: 0, row: 1 },
        { id: 'hostTsc', type: 'backend', label: 'tsc Host', sublabel: 'tsconfig.host.json', stage: 1, row: 0 },
        { id: 'hostBundle', type: 'cloud', label: 'tsdown Host', sublabel: 'DSH_BUILD_FACE=host', stage: 1, row: 3 },
        { id: 'contracts', type: 'messagebus', label: 'Typert Artifacts', sublabel: 'host + remote-client JS/DTS', stage: 2, row: 1, tag: 'generated' },
        { id: 'clientTsc', type: 'frontend', label: 'tsc Client', sublabel: 'tsconfig.client.json', stage: 3, row: 0 },
        { id: 'clientBundle', type: 'frontend', label: 'tsdown Client', sublabel: 'Node loader + client.js', stage: 3, row: 2 },
        { id: 'web', type: 'cloud', label: 'Vite Web Build', sublabel: 'browser application', stage: 3, row: 4 },
        { id: 'gates', type: 'security', label: 'Repository Gates', sublabel: 'test / typecheck / lint / hygiene / docs', stage: 4, row: 1 },
        { id: 'artifacts', type: 'database', label: '发布产物', sublabel: 'npm packages / dsh / Python wheel', stage: 4, row: 4 },
      ],
      flows: [
        { id: 'source-host-tsc', from: 'source', to: 'hostTsc', label: 'Project References', classification: 'host face', variant: 'emphasis' },
        { id: 'source-host-bundle', from: 'source', to: 'hostBundle', label: 'package entries', classification: 'host JS' },
        { id: 'host-contracts', from: 'hostBundle', to: 'contracts', label: 'Typert generator', classification: 'strict descriptors', variant: 'emphasis' },
        { id: 'contracts-client-tsc', from: 'contracts', to: 'clientTsc', label: 'remote-client.d.ts', classification: 'client-safe types' },
        { id: 'client-tsc-bundle', from: 'clientTsc', to: 'clientBundle', label: 'checked emit', classification: 'client face' },
        { id: 'client-bundle-web', from: 'clientBundle', to: 'web', label: 'plugin bundles', classification: 'browser modules', variant: 'emphasis' },
        { id: 'host-gates', from: 'hostTsc', to: 'gates', label: 'types + package graph', classification: 'quality evidence' },
        { id: 'web-gates', from: 'web', to: 'gates', label: 'build + dead links', classification: 'site evidence' },
        { id: 'gates-artifacts', from: 'gates', to: 'artifacts', label: 'all required checks pass', classification: 'release payload', variant: 'security' },
      ],
      cards: cards(
        ['cyan', '严格顺序', 'Host lib 必须先于 Client lib', 'Typert 生成发生在 Host tsdown 阶段', 'Client 编译消费本次生成的契约'],
        ['rose', '发布边界', '包 exports 与 files 清单接受自动校验', 'Python wheel 携带受支持的 dsh runtime', '源码开发 fallback 不替代发布契约生成'],
      ),
    },
  },
  {
    slug: '12-agent-state-lifecycle',
    type: 'lifecycle',
    title: 'Agent 运行状态生命周期',
    description: 'Agent 从 idle、排队、Turn/Step 执行到工具等待、重试、停止或失败的状态转换。',
    evidence: ['docs/agent-lifecycle.md', 'packages/core/agent/src/index.ts', 'packages/core/agent-loop/src/index.ts', 'packages/compaction/compaction-basic/src/index.ts'],
    spec: {
      schema_version: 1,
      diagram_type: 'lifecycle',
      meta: meta('Agent 运行状态生命周期', '12-agent-state-lifecycle', views(
        ['normal-run', '正常运行', ['idle', 'queued', 'turn', 'step', 'stopping', 'complete'], '从 followup 唤醒到 step 完成和 turn 收束。'],
        ['wait-and-tools', '等待与工具', ['queued', 'waiting', 'step', 'tools'], '队列、人工交互和工具批次都是显式可观察状态。'],
        ['recovery', '恢复与终止', ['step', 'retry', 'turn', 'failed', 'cancelled'], '上下文溢出只有在 pruning 或 summary 推进后才重试，否则保持原始错误。'],
      ), { viewBox: [1100, 760] }),
      lanes: [
        { id: 'main', label: 'Turn 主状态' },
        { id: 'waitingLane', label: '等待与外部输入' },
        { id: 'recovery', label: '恢复路径' },
        { id: 'terminal', label: '终止状态' },
      ],
      states: [
        { id: 'idle', type: 'start', label: 'Idle', sublabel: '无待处理工作', lane: 'main', col: 0, step: '01' },
        { id: 'queued', type: 'active', label: 'Queued', sublabel: 'inbox 已插入', lane: 'main', col: 1, step: '02' },
        { id: 'turn', type: 'active', label: 'Turn Running', sublabel: 'turn/start 已记录', lane: 'main', col: 2, step: '03' },
        { id: 'step', type: 'active', label: 'Step Running', sublabel: 'prompt + LLM request', lane: 'main', col: 3, step: '04' },
        { id: 'stopping', type: 'decision', label: 'Turn Stopping', sublabel: '检查 next-step inbox', lane: 'main', col: 4, step: '05' },
        { id: 'waiting', type: 'waiting', label: 'Await Input', sublabel: 'approval / question / followup', lane: 'waitingLane', col: 1, tag: 'observable' },
        { id: 'tools', type: 'waiting', label: 'Tool Batch', sublabel: 'barrier + bounded pool', lane: 'waitingLane', col: 3, tag: 'ordered results' },
        { id: 'retry', type: 'failure', label: 'Recover Context', sublabel: 'prune or summarize', lane: 'recovery', col: 2, tag: 'recoverable' },
        { id: 'complete', type: 'success', label: 'Idle Again', sublabel: 'turn/end + status idle', lane: 'terminal', col: 4, tag: 'success' },
        { id: 'failed', type: 'failure', label: 'Request Failed', sublabel: 'original error preserved', lane: 'terminal', col: 2, tag: 'terminal' },
        { id: 'cancelled', type: 'neutral', label: 'Cancelled', sublabel: 'abort / shutdown', lane: 'terminal', col: 0, tag: 'terminal' },
      ],
      transitions: [
        { id: 'idle-queued', from: 'idle', to: 'queued', label: 'followup', variant: 'emphasis' },
        { id: 'queued-turn', from: 'queued', to: 'turn', label: 'claim inbox' },
        { id: 'turn-step', from: 'turn', to: 'step', label: 'pre-step enter', variant: 'emphasis' },
        { id: 'step-stopping', from: 'step', to: 'stopping', label: 'natural stop' },
        { id: 'stopping-complete', from: 'stopping', to: 'complete', label: 'no pending input', variant: 'emphasis', route: 'drop', fromSide: 'bottom', toSide: 'top' },
        { id: 'queued-waiting', from: 'queued', to: 'waiting', label: '等待外部回答', variant: 'dashed', route: 'drop', fromSide: 'bottom', toSide: 'top' },
        { id: 'waiting-turn', from: 'waiting', to: 'turn', label: '回答到达', route: 'right-channel', fromSide: 'right', toSide: 'bottom' },
        { id: 'step-tools', from: 'step', to: 'tools', label: 'tool calls', route: 'drop', fromSide: 'bottom', toSide: 'top' },
        { id: 'tools-step', from: 'tools', to: 'step', label: 'ordered results', variant: 'dashed', route: 'right-channel', fromSide: 'right', toSide: 'right' },
        { id: 'step-retry', from: 'step', to: 'retry', label: 'context overflow', variant: 'security', route: 'left-channel', fromSide: 'left', toSide: 'right' },
        { id: 'retry-turn', from: 'retry', to: 'turn', label: 'surface generation advanced', variant: 'emphasis', route: 'straight', fromSide: 'top', toSide: 'bottom' },
        { id: 'retry-failed', from: 'retry', to: 'failed', label: 'no progress', variant: 'security', route: 'drop', fromSide: 'bottom', toSide: 'top' },
        { id: 'idle-cancel', from: 'idle', to: 'cancelled', label: 'shutdown', variant: 'dashed', route: 'drop', fromSide: 'bottom', toSide: 'top' },
      ],
      cards: cards(
        ['cyan', '状态事实', 'turn/start 与 turn/end 包围一次 Turn', 'step/start 与 step/end 包围一次模型尝试', 'inbox claim 决定下一 Step 的输入批次'],
        ['rose', '恢复规则', 'context overflow 先结束失败 Step 和 Turn', '只有 compacted surface 推进才新开 retry Turn', '否则原始请求错误保持权威'],
      ),
    },
  },
]

function replaceDiagram(slug, type, spec) {
  const diagram = diagrams.find(entry => entry.slug === slug)
  if (diagram === undefined) throw new Error(`unknown diagram ${slug}`)
  diagram.type = type
  diagram.spec = spec
}

replaceDiagram('03-profile-boot', 'workflow', {
  schema_version: 1,
  diagram_type: 'workflow',
  meta: meta('Profile 启动与热重载流程', '03-profile-boot', views(
    ['cold-start', '冷启动主链', ['argv', 'profile', 'patches', 'context', 'mount', 'ready'], '从 dsh 参数到全部 Cordis entry 激活。'],
    ['overrides', '配置优先级', ['profile', 'patches', 'dump'], 'bundle、profile、home、--patch 和 telemetry switch 按顺序组合。'],
    ['hot-reload', '热重载', ['ready', 'hmr', 'mount'], '配置变化重新读取用户层，并由 Loader 事务性更新插件树。'],
  ), { viewBox: [1000, 760] }),
  lanes: [
    { id: 'launcher', label: 'CLI Launcher' },
    { id: 'composition', label: 'Profile Composition' },
    { id: 'cordis', label: 'Cordis Runtime' },
    { id: 'runtime', label: 'Application Lifetime' },
  ],
  phases: [
    { id: 'resolve', label: '解析', fromCol: 0, toCol: 1 },
    { id: 'compose-phase', label: '组合', fromCol: 2, toCol: 3, variant: 'emphasis' },
    { id: 'activate', label: '激活与运行', fromCol: 4, toCol: 5 },
  ],
  mainPath: ['argv', 'profile', 'patches', 'context', 'mount', 'ready'],
  nodes: [
    { id: 'argv', lane: 'launcher', col: 0, width: 82, type: 'external', label: '解析 argv', sublabel: 'profile + app args' },
    { id: 'profile', lane: 'composition', col: 1, width: 88, type: 'cloud', label: '解析 Profile', sublabel: '$DSH_HOME profile' },
    { id: 'patches', lane: 'cordis', col: 2, width: 92, type: 'messagebus', label: '叠加 Patch', sublabel: 'bundle / user / CLI' },
    { id: 'context', lane: 'launcher', col: 3, width: 88, type: 'backend', label: '创建 Context', sublabel: '冻结启动快照' },
    { id: 'mount', lane: 'composition', col: 4, width: 88, type: 'backend', label: 'Loader 挂载', sublabel: 'include plugin tree' },
    { id: 'ready', lane: 'cordis', col: 5, width: 82, type: 'cloud', label: '应用就绪', sublabel: 'entries active' },
    { id: 'dump', lane: 'runtime', col: 2, width: 82, type: 'frontend', label: '配置诊断', sublabel: 'dump only' },
    { id: 'hmr', lane: 'runtime', col: 4, width: 82, type: 'messagebus', label: 'Patch HMR', sublabel: '重读用户层' },
  ],
  edges: [
    { id: 'parse-profile', from: 'argv', to: 'profile', role: 'main', variant: 'emphasis' },
    { id: 'load-layers', from: 'profile', to: 'patches', role: 'main' },
    { id: 'create-context', from: 'patches', to: 'context', role: 'main' },
    { id: 'mount-tree', from: 'context', to: 'mount', role: 'main' },
    { id: 'settle-tree', from: 'mount', to: 'ready', role: 'main', variant: 'emphasis' },
    { id: 'dump-branch', from: 'profile', to: 'dump', role: 'branch' },
    { id: 'watch-layer', from: 'ready', to: 'hmr', role: 'async', variant: 'dashed', route: 'drop', fromSide: 'bottom', toSide: 'top' },
    { id: 'reload-tree', from: 'hmr', to: 'mount', role: 'return', label: '事务性重组', route: 'straight', fromSide: 'top', toSide: 'bottom', labelDx: 64 },
  ],
  cards: cards(
    ['cyan', 'Patch 优先级', 'bundle 默认层最先应用', 'profile 与 home 用户层覆盖默认值', '--patch 与 telemetry switch 最后应用'],
    ['rose', '生命周期', 'host preparation 与 plugin tree 失败分开报告', '部分启动失败先释放根 Fiber', 'SIGTERM、SIGINT 与 appExit 统一收束'],
  ),
})

replaceDiagram('05-tool-execution', 'sequence', {
  schema_version: 1,
  diagram_type: 'sequence',
  meta: meta('工具执行与策略管线', '05-tool-execution', views(
    ['policy', '策略判定', ['model', 'session', 'registry', 'policy', 'approval', 'guards'], '调用先记录，再经 pre waterfall、审批和单调 guard 判定。'],
    ['execution', '受控执行', ['registry', 'guards', 'tool', 'fs'], 'timeout 等 around concern 包裹工具体，文件修改再经过 intent gate。'],
    ['result', '权威结果', ['tool', 'registry', 'session', 'ui'], 'post、归一化和 finalize 完成后，冻结结果才进入日志与 UI。'],
  ), { viewBox: [1220, 980], column_fit: 'spread' }),
  participants: [
    { id: 'model', type: 'cloud', label: 'LLM' },
    { id: 'session', type: 'database', label: 'Session' },
    { id: 'registry', type: 'backend', label: 'Tool Registry' },
    { id: 'policy', type: 'security', label: 'Pre/Post Hooks' },
    { id: 'approval', type: 'external', label: 'User Approval' },
    { id: 'guards', type: 'security', label: 'Guards' },
    { id: 'tool', type: 'backend', label: 'Tool Body' },
    { id: 'fs', type: 'security', label: 'FS Intent Gate' },
    { id: 'ui', type: 'frontend', label: 'UI' },
  ],
  segments: [
    { from: 160, to: 330, label: '记录调用' },
    { from: 350, to: 590, label: '策略判定' },
    { from: 610, to: 770, label: '执行与收束' },
    { from: 790, to: 910, label: '记录结果' },
  ],
  messages: [
    { id: 'model-call', from: 'model', to: 'registry', y: 185, label: 'assistant tool-call block', variant: 'emphasis' },
    { id: 'record-call', from: 'registry', to: 'session', y: 235, label: 'append tool/call' },
    { id: 'pending-card', from: 'session', to: 'ui', y: 285, label: 'presentCall(args)', variant: 'dashed' },
    { id: 'pre-hooks', from: 'registry', to: 'policy', y: 375, label: 'tools/pre-execute waterfall', variant: 'security' },
    { id: 'ask', from: 'policy', to: 'approval', y: 425, label: 'ask when required', variant: 'security' },
    { id: 'grant', from: 'approval', to: 'guards', y: 475, label: 'allowed-once or deny', variant: 'return' },
    { id: 'guard-check', from: 'policy', to: 'guards', y: 525, label: 'allow -> monotonic guards', variant: 'security' },
    { id: 'dispatch-tool', from: 'guards', to: 'tool', y: 625, label: 'tools/execute wrapper', variant: 'emphasis' },
    { id: 'fs-intent', from: 'tool', to: 'fs', y: 675, label: 'fs write/edit intent', variant: 'security' },
    { id: 'post-result', from: 'tool', to: 'policy', y: 725, label: 'tools/post-execute', variant: 'return' },
    { id: 'finalize', from: 'policy', to: 'registry', y: 765, label: 'normalize + finalizeContent', variant: 'return' },
    { id: 'record-result', from: 'registry', to: 'session', y: 815, label: 'append frozen tool/result', variant: 'emphasis' },
    { id: 'completed-card', from: 'session', to: 'ui', y: 860, label: 'presentResult(args, result)', variant: 'return' },
    { id: 'next-context', from: 'session', to: 'model', y: 900, label: 'batch contexts enter next step', variant: 'dashed' },
  ],
  activations: [
    { participant: 'registry', from: 175, to: 825, type: 'backend' },
    { participant: 'policy', from: 365, to: 775, type: 'security' },
    { participant: 'tool', from: 615, to: 740, type: 'backend' },
  ],
  cards: cards(
    ['rose', '拒绝与异常', '拒绝时工具体不执行，但仍生成模型可见结果', 'wrapper 或 snapshot 异常统一归一化为 isError', '审批不可用时 fail closed'],
    ['cyan', '不可变结果', 'finalizeContent 是最后一个内容约束点', 'tools/result 只观察冻结结果', 'PTC 子调用也走同一执行管线'],
  ),
})

replaceDiagram('07-session-persistence', 'dataflow', {
  schema_version: 1,
  diagram_type: 'dataflow',
  meta: meta('会话事件、投影与查询数据流', '07-session-persistence', views(
    ['write-path', '事件写入', ['agentEvents', 'ownedEvents', 'session'], '核心事件和功能包自有事件进入同一个 append-only Session。'],
    ['durability', '持久化路径', ['session', 'persistence', 'query'], 'Persistence seam 将顺序事件交给 JSONL 或 SQLite provider。'],
    ['derived-reads', '派生读取', ['session', 'projection', 'cache', 'query', 'consumers'], 'Projection 和 Query 提供可重建读模型，消费者不改写历史。'],
  ), { viewBox: [1080, 800] }),
  stages: [
    { label: '事件生产者' },
    { label: '内存事实' },
    { label: '写入或折叠' },
    { label: '存储与读取' },
    { label: '消费者' },
  ],
  nodes: [
    { id: 'agentEvents', type: 'backend', label: 'Agent Loop 事件', sublabel: 'turn / step / tool', stage: 0, row: 0 },
    { id: 'ownedEvents', type: 'messagebus', label: '功能包事件', sublabel: 'goal / approval / workflow', stage: 0, row: 3, width: 128 },
    { id: 'session', type: 'database', label: 'Session Event Log', sublabel: 'monotonic seq + append-only', stage: 1, row: 1, tag: 'source of truth', width: 132 },
    { id: 'persistence', type: 'security', label: 'Persistence Providers', sublabel: 'JSONL / SQLite', stage: 2, row: 0, width: 132 },
    { id: 'projection', type: 'backend', label: 'Projection Registry', sublabel: 'deterministic fold', stage: 2, row: 3, width: 122 },
    { id: 'query', type: 'backend', label: 'Session Query', sublabel: 'reads / traces / search', stage: 3, row: 0, width: 118 },
    { id: 'cache', type: 'database', label: 'Projection Cache', sublabel: 'rebuildable', stage: 3, row: 3, width: 112 },
    { id: 'consumers', type: 'frontend', label: 'Web / SDK / Export', sublabel: 'replay / list / search', stage: 4, row: 1, width: 128 },
  ],
  flows: [
    { id: 'agent-session', from: 'agentEvents', to: 'session', label: 'append', classification: 'durable event', variant: 'emphasis' },
    { id: 'owned-session', from: 'ownedEvents', to: 'session', label: 'append', classification: 'package event' },
    { id: 'session-persistence', from: 'session', to: 'persistence', label: 'ordered batch', classification: 'event records', variant: 'emphasis' },
    { id: 'session-projection', from: 'session', to: 'projection', label: 'fold', classification: 'event records' },
    { id: 'persist-query', from: 'persistence', to: 'query', label: 'cold reads', classification: 'versioned storage', labelAt: [641, 200] },
    { id: 'projection-cache', from: 'projection', to: 'cache', label: 'cache snapshot', classification: 'derived state' },
    { id: 'query-consumers', from: 'query', to: 'consumers', label: 'query result', classification: 'typed read', variant: 'emphasis' },
    { id: 'cache-consumers', from: 'cache', to: 'consumers', label: 'projection', classification: 'UI read model' },
  ],
  cards: cards(
    ['emerald', '事实与派生', 'Session 日志是唯一可回放事实', 'Projection 与 cache 均可从事件重建', 'JSONL 和 SQLite 通过同一 seam 替换'],
    ['amber', '消费边界', 'Web、SDK 与 Export 读取投影或查询', '遥测旁路观察 session/event', '派生视图不会反写历史事件'],
  ),
})

replaceDiagram('08-subagent-orchestration', 'workflow', {
  schema_version: 1,
  diagram_type: 'workflow',
  meta: meta('子代理委派与续接流程', '08-subagent-orchestration', views(
    ['delegate', '委派与路由', ['delegate', 'model', 'route'], '父 Agent 提交任务，服务解析模型偏好与 provider 能力。'],
    ['execute', '创建与执行', ['route', 'create', 'run'], 'spawn 新建上下文，fork 继承受控历史，随后进入标准 Agent Loop。'],
    ['return', '结果与续接', ['run', 'report', 'continue'], '结构化报告回到父上下文，后续可用同一子代理标识继续或中断。'],
  ), { viewBox: [1000, 720] }),
  lanes: [
    { id: 'parent', label: 'Parent Agent' },
    { id: 'service', label: 'Subagent Service' },
    { id: 'provider', label: 'Provider / Driver' },
    { id: 'childlane', label: 'Child Agent' },
    { id: 'results', label: 'Result Contract' },
  ],
  phases: [
    { id: 'request-phase', label: '请求', fromCol: 0, toCol: 1 },
    { id: 'create-phase', label: '路由与创建', fromCol: 2, toCol: 3, variant: 'emphasis' },
    { id: 'return-phase', label: '执行与回收', fromCol: 4, toCol: 5 },
  ],
  mainPath: ['delegate', 'model', 'route', 'create', 'run', 'report'],
  nodes: [
    { id: 'delegate', lane: 'parent', col: 0, width: 84, type: 'external', label: '委派任务', sublabel: 'spawn / fork' },
    { id: 'model', lane: 'service', col: 1, width: 88, type: 'backend', label: '解析模型', sublabel: 'setting + request' },
    { id: 'route', lane: 'provider', col: 2, width: 92, type: 'messagebus', label: '选择 Provider', sublabel: 'local / SDK / ACP' },
    { id: 'create', lane: 'service', col: 3, width: 92, type: 'cloud', label: '创建 Child', sublabel: 'new or forked context' },
    { id: 'run', lane: 'childlane', col: 4, width: 86, type: 'backend', label: '执行子任务', sublabel: 'standard Agent Loop' },
    { id: 'report', lane: 'results', col: 5, width: 88, type: 'database', label: '结构化报告', sublabel: 'final output' },
    { id: 'continue', lane: 'parent', col: 5, width: 88, type: 'messagebus', label: '父 Agent 接收', sublabel: 'result + agent id' },
  ],
  edges: [
    { id: 'delegate-model', from: 'delegate', to: 'model', role: 'main', variant: 'emphasis' },
    { id: 'model-route', from: 'model', to: 'route', role: 'main' },
    { id: 'route-create', from: 'route', to: 'create', role: 'main' },
    { id: 'create-run', from: 'create', to: 'run', role: 'main', variant: 'emphasis' },
    { id: 'run-report', from: 'run', to: 'report', role: 'main' },
    { id: 'report-parent', from: 'report', to: 'continue', role: 'branch', label: 'report', route: 'drop', fromSide: 'top', toSide: 'bottom' },
  ],
  cards: cards(
    ['cyan', 'Provider 可替换', 'ctx.subagents 支持进程内、SDK、ACP、Codex 和 Claude Code provider', 'spawn 与 fork 共享服务契约', '模型选择由独立设置服务管理'],
    ['rose', '生命周期控制', 'list、followup、interrupt 面向已登记 agent id', '父子 Session 身份由路由边界隔离', '报告通过专用工具形成稳定回传契约'],
  ),
})

replaceDiagram('09-execution-sandbox', 'architecture', {
  schema_version: 1,
  diagram_type: 'architecture',
  meta: meta('执行、文件系统与沙箱架构', '09-execution-sandbox', views(
    ['tool-surface', '工具入口', ['tools', 'registry', 'policy'], 'FS、Shell 与 Terminal 工具共用调用管线和 Session 级策略。'],
    ['seams', '能力抽象', ['policy', 'seams', 'providers'], '消费者依赖稳定的 fs、subprocess、terminal seam，再选择 provider。'],
    ['worlds', '执行世界', ['providers', 'local', 'host', 'e2b', 'remote'], '本地路径落入跨平台 OS 隔离，E2B 路径落入一次性远程 Linux 世界。'],
  ), { viewBox: [1380, 700], repository }),
  components: [
    { id: 'tools', type: 'backend', label: '模型可见工具', sublabel: 'FS / Shell / PTY', pos: [30, 300], size: [150, 66], sources: [{ path: 'packages/fs/tool-fs/src/index.ts' }, { path: 'packages/shell/tool-bash/src/index.ts' }, { path: 'packages/terminal/tool-terminal/src/index.ts' }] },
    { id: 'registry', type: 'messagebus', label: 'Tool Registry', sublabel: 'pre / execute / post', pos: [220, 300], size: [150, 66], sources: [{ path: 'packages/core/tools/src/index.ts' }] },
    { id: 'policy', type: 'security', label: 'Sandbox Policy', sublabel: 'session mode + approval', pos: [410, 300], size: [150, 66], sources: [{ path: 'packages/sandbox/sandbox-policy/src/index.ts' }, { path: 'packages/sandbox/sandbox-policy/src/session-mode.ts' }] },
    { id: 'seams', type: 'cloud', label: '能力 Seams', sublabel: 'fs / subprocess / terminals', pos: [600, 300], size: [160, 66], sources: [{ path: 'packages/fs/fs/src/index.ts' }, { path: 'packages/subprocess/subprocess/src/index.ts' }, { path: 'packages/terminal/terminal/src/index.ts' }] },
    { id: 'providers', type: 'cloud', label: 'Provider 选择', sublabel: 'composition-time binding', pos: [800, 300], size: [155, 66], sources: [{ path: 'packages/bundle/base/cordis.patch.yml' }] },
    { id: 'local', type: 'security', label: 'Local Providers', sublabel: 'FS + process + PTY', pos: [990, 160], size: [155, 66], sources: [{ path: 'packages/fs/fs-local/src/index.ts' }, { path: 'packages/subprocess/subprocess-local/src/index.ts' }, { path: 'packages/terminal/terminal-bash/src/index.ts' }] },
    { id: 'e2b', type: 'external', label: 'E2B Providers', sublabel: 'shared sandbox', pos: [990, 440], size: [155, 66], sources: [{ path: 'packages/e2b/e2b/src/index.ts' }, { path: 'packages/e2b/fs-e2b/src/index.ts' }, { path: 'packages/e2b/subprocess-e2b/src/index.ts' }] },
    { id: 'host', type: 'external', label: 'Host OS Isolation', sublabel: 'native isolation', pos: [1180, 160], size: [165, 66], sources: [{ path: 'packages/sandbox/sandbox-local/src/profiles.ts' }, { path: 'native/landlock-run/package.json' }] },
    { id: 'remote', type: 'external', label: 'Remote Linux World', sublabel: 'ephemeral runtime', pos: [1180, 440], size: [165, 66], sources: [{ path: 'packages/e2b/e2b/README.md' }] },
  ],
  connections: [
    { id: 'tools-registry', from: 'tools', to: 'registry', variant: 'emphasis' },
    { id: 'registry-policy', from: 'registry', to: 'policy', variant: 'security' },
    { id: 'policy-seams', from: 'policy', to: 'seams', variant: 'security' },
    { id: 'seams-providers', from: 'seams', to: 'providers', variant: 'emphasis' },
    { id: 'providers-local', from: 'providers', to: 'local' },
    { id: 'providers-e2b', from: 'providers', to: 'e2b', variant: 'dashed' },
    { id: 'local-host', from: 'local', to: 'host', variant: 'security' },
    { id: 'e2b-remote', from: 'e2b', to: 'remote', variant: 'emphasis' },
  ],
  cards: cards(
    ['rose', '统一策略', 'sandbox/mode 作为 Session 事件持久化', '文件与命令执行解析同一 SandboxPolicy', '平台实现无法建立隔离时 fail closed'],
    ['emerald', '可移植 Provider', '消费者不依赖具体 OS 或远程 SDK', '本地支持 Landlock、bwrap、Seatbelt 与 Windows ACL', 'E2B 文件和进程共享一个临时远程世界'],
  ),
})

replaceDiagram('11-build-and-release', 'dataflow', {
  schema_version: 1,
  diagram_type: 'dataflow',
  meta: meta('构建、契约生成与发布流水线', '11-build-and-release', views(
    ['host-phase', 'Host 阶段', ['source', 'hostTsc', 'contracts'], 'Host Project References 先编译，tsdown 同步生成 Typert 双端契约。'],
    ['client-phase', 'Client 阶段', ['contracts', 'clientTsc'], 'Client 类型检查消费刚生成的 Remote 声明，然后产出浏览器插件。'],
    ['release', '门禁与发布', ['clientTsc', 'artifacts'], '仓库门禁通过后形成 npm、dsh 与 Python SDK 交付。'],
  ), { viewBox: [1080, 660] }),
  stages: [
    { label: '源码' }, { label: 'Host 构建' }, { label: '生成契约' },
    { label: 'Client + Web' }, { label: '门禁与发布' },
  ],
  nodes: [
    { id: 'source', type: 'external', label: 'Workspace 源码', sublabel: 'TS / TSX / YAML', stage: 0, row: 1, width: 116 },
    { id: 'hostTsc', type: 'backend', label: 'Host Build', sublabel: 'tsc + tsdown', stage: 1, row: 1, width: 110 },
    { id: 'contracts', type: 'messagebus', label: 'Typert Artifacts', sublabel: 'host + remote-client', stage: 2, row: 1, width: 116 },
    { id: 'clientTsc', type: 'frontend', label: 'Client + Web Build', sublabel: 'tsc + tsdown + Vite', stage: 3, row: 1, width: 132 },
    { id: 'artifacts', type: 'database', label: '验证后发布', sublabel: 'npm / dsh / Python', stage: 4, row: 1, width: 116 },
  ],
  flows: [
    { id: 'source-host-tsc', from: 'source', to: 'hostTsc', label: 'project refs', classification: 'host face', variant: 'emphasis' },
    { id: 'host-contracts', from: 'hostTsc', to: 'contracts', label: 'Typert generator', classification: 'strict codecs', variant: 'emphasis' },
    { id: 'contracts-client-tsc', from: 'contracts', to: 'clientTsc', label: 'generated DTS', classification: 'client types' },
    { id: 'client-release', from: 'clientTsc', to: 'artifacts', label: 'repository gates', classification: 'test + types + lint + docs', variant: 'security', labelAt: [857, 314] },
  ],
  cards: cards(
    ['cyan', '严格顺序', 'Host lib 必须先于 Client lib', 'Typert 生成发生在 Host tsdown 阶段', 'Client 编译消费本次生成的契约'],
    ['rose', '发布边界', '测试、类型、lint、hygiene 与文档门禁共同生效', '包 exports 与 files 清单自动校验', '源码 fallback 不替代发布契约生成'],
  ),
})

replaceDiagram('12-agent-state-lifecycle', 'lifecycle', {
  schema_version: 1,
  diagram_type: 'lifecycle',
  meta: meta('Agent 运行状态生命周期', '12-agent-state-lifecycle', views(
    ['normal-run', '正常运行', ['idle', 'queued', 'turn', 'step', 'stopping', 'complete'], '从 followup 唤醒到 Step 完成和 Turn 收束。'],
    ['tool-wait', '工具等待', ['step', 'tools', 'stopping'], '工具批次通过屏障和有界并发完成，再回到停止判定。'],
    ['recovery', '恢复与失败', ['step', 'retry', 'turn', 'failed'], '只有 pruning 或 summary 推进 surface generation 后才进入新的 Turn。'],
  ), { viewBox: [1080, 740] }),
  lanes: [
    { id: 'main', label: 'Turn 主状态' },
    { id: 'waitingLane', label: '等待与恢复' },
    { id: 'terminal', label: '终止状态' },
  ],
  states: [
    { id: 'idle', type: 'start', label: 'Idle', sublabel: '等待任务', lane: 'main', col: 0, step: '01' },
    { id: 'queued', type: 'active', label: 'Queued', sublabel: 'inbox 已插入', lane: 'main', col: 1, step: '02' },
    { id: 'turn', type: 'active', label: 'Turn Running', sublabel: 'turn/start', lane: 'main', col: 2, step: '03' },
    { id: 'step', type: 'active', label: 'Step Running', sublabel: 'prompt + LLM', lane: 'main', col: 3, step: '04' },
    { id: 'stopping', type: 'decision', label: 'Turn Stopping', sublabel: '检查 next-step input', lane: 'main', col: 4, step: '05' },
    { id: 'retry', type: 'failure', label: 'Recover Context', sublabel: 'prune or summarize', lane: 'waitingLane', col: 0, tag: 'recoverable' },
    { id: 'tools', type: 'waiting', label: 'Tool Batch', sublabel: 'ordered results', lane: 'waitingLane', col: 1 },
    { id: 'failed', type: 'failure', label: 'Request Failed', sublabel: 'original error', lane: 'terminal', col: 0, tag: 'terminal' },
    { id: 'complete', type: 'success', label: 'Idle Again', sublabel: 'turn/end + idle', lane: 'terminal', col: 2, tag: 'success' },
  ],
  transitions: [
    { id: 'idle-queued', from: 'idle', to: 'queued', variant: 'emphasis' },
    { id: 'queued-turn', from: 'queued', to: 'turn' },
    { id: 'turn-step', from: 'turn', to: 'step', variant: 'emphasis', route: 'straight', fromSide: 'right', toSide: 'left' },
    { id: 'step-stopping', from: 'step', to: 'stopping', route: 'straight', fromSide: 'right', toSide: 'left' },
    { id: 'stopping-complete', from: 'stopping', to: 'complete', label: 'no pending input', variant: 'emphasis', route: 'drop', fromSide: 'bottom', toSide: 'top' },
    { id: 'step-tools', from: 'step', to: 'tools', label: 'tool calls', route: 'drop', fromSide: 'bottom', toSide: 'top' },
    { id: 'tools-stopping', from: 'tools', to: 'stopping', label: 'batch settled', variant: 'dashed' },
    { id: 'step-retry', from: 'step', to: 'retry', label: 'context overflow', variant: 'security' },
    { id: 'retry-turn', from: 'retry', to: 'turn', label: 'surface advanced', variant: 'emphasis', route: 'straight', fromSide: 'top', toSide: 'bottom' },
    { id: 'retry-failed', from: 'retry', to: 'failed', label: 'no progress', variant: 'security', route: 'drop', fromSide: 'bottom', toSide: 'top' },
  ],
  cards: cards(
    ['cyan', '状态事实', 'turn/start 与 turn/end 包围一次 Turn', 'step/start 与 step/end 包围一次模型尝试', '工具结果按模型顺序提交'],
    ['rose', '恢复规则', 'context overflow 先结束失败 Step 和 Turn', '只有 surface generation 推进才重试', '否则原始请求错误保持权威'],
  ),
})

const agentTurn = diagrams.find(entry => entry.slug === '04-agent-turn').spec
agentTurn.segments.find(segment => segment.label === 'Turn 收束').from = 885
agentTurn.segments.find(segment => segment.label === 'Turn 收束').to = 975
agentTurn.messages.find(message => message.id === 'step-end').y = 895
agentTurn.messages.find(message => message.id === 'turn-end').y = 925
agentTurn.messages.find(message => message.id === 'idle').y = 960
agentTurn.meta.viewBox = [1220, 1060]
const webControlPlane = diagrams.find(entry => entry.slug === '06-web-control-plane').spec
webControlPlane.messages.find(message => message.id === 'render-event').y = 810
webControlPlane.messages.find(message => message.id === 'cancel').y = 850
const remoteApi = diagrams.find(entry => entry.slug === '10-remote-api').spec
remoteApi.messages.find(message => message.id === 'abort').y = 805
remoteApi.messages.find(message => message.id === 'cancel-host').y = 845
remoteApi.messages.find(message => message.id === 'unmount').y = 890

const toolExecution = diagrams.find(entry => entry.slug === '05-tool-execution').spec
toolExecution.meta.viewBox = [1220, 1020]

const executionSandbox = diagrams.find(entry => entry.slug === '09-execution-sandbox').spec
executionSandbox.components.find(component => component.id === 'host').sources[1].path = 'native/landlock-run/package.json'

function compactSequence(slug, height) {
  const spec = diagrams.find(entry => entry.slug === slug).spec
  spec.messages.forEach((message, index) => {
    message.y = 160 + index * 28
  })
  spec.meta.viewBox = [spec.meta.viewBox[0], height]
  delete spec.segments
  delete spec.activations
  delete spec.cards
}

compactSequence('04-agent-turn', 696)
compactSequence('05-tool-execution', 620)
compactSequence('06-web-control-plane', 620)
compactSequence('10-remote-api', 642)

const profileBoot = diagrams.find(entry => entry.slug === '03-profile-boot').spec
profileBoot.meta.viewBox = [1000, 528]
profileBoot.lanes = [
  { id: 'launcher', label: 'CLI Launcher' },
  { id: 'composition', label: 'Profile Composition' },
  { id: 'runtime', label: 'Cordis Runtime' },
]
profileBoot.nodes.find(node => node.id === 'patches').lane = 'runtime'
profileBoot.nodes.find(node => node.id === 'ready').lane = 'runtime'
profileBoot.nodes = profileBoot.nodes.filter(node => node.id !== 'dump')
profileBoot.edges = profileBoot.edges.filter(edge => edge.id !== 'dump-branch')
for (const view of profileBoot.meta.views) {
  view.focus = view.focus.filter(id => id !== 'dump')
}
profileBoot.nodes.find(node => node.id === 'hmr').lane = 'runtime'
Object.assign(profileBoot.edges.find(edge => edge.id === 'watch-layer'), {
  route: 'straight',
  fromSide: 'left',
  toSide: 'right',
})
delete profileBoot.cards

const sessionPersistence = diagrams.find(entry => entry.slug === '07-session-persistence').spec
sessionPersistence.meta.viewBox = [1080, 540]
for (const node of sessionPersistence.nodes) {
  if (node.row === 3) node.row = 2
}
delete sessionPersistence.cards

const subagentOrchestration = diagrams.find(entry => entry.slug === '08-subagent-orchestration').spec
subagentOrchestration.meta.viewBox = [1000, 528]
subagentOrchestration.lanes = [
  { id: 'parent', label: 'Parent Agent' },
  { id: 'service', label: 'Subagent Service' },
  { id: 'execution', label: 'Provider + Child + Result' },
]
for (const node of subagentOrchestration.nodes) {
  if (node.lane === 'provider' || node.lane === 'childlane' || node.lane === 'results') node.lane = 'execution'
}
Object.assign(subagentOrchestration.edges.find(edge => edge.id === 'report-parent'), {
  fromSide: 'top',
  toSide: 'bottom',
})
delete subagentOrchestration.cards

const agentLifecycle = diagrams.find(entry => entry.slug === '12-agent-state-lifecycle').spec
agentLifecycle.meta.viewBox = [1080, 640]
delete agentLifecycle.cards

const generatedSlugs = new Set(diagrams.map(diagram => diagram.slug))
for (const file of readdirSync(diagramsDir)) {
  const match = /^(\d\d-[^.]+)\.(architecture|workflow|sequence|dataflow|lifecycle)\.json$/.exec(file)
  if (match !== null && generatedSlugs.has(match[1])) unlinkSync(join(diagramsDir, file))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function mermaidLabel(node) {
  const detail = node.sublabel ? `<br/>${node.sublabel}` : ''
  return `${node.label}${detail}`.replaceAll('"', "'")
}

function mermaidFor(diagram) {
  const { spec, type } = diagram
  if (type === 'sequence') {
    const lines = ['sequenceDiagram']
    for (const participant of spec.participants) lines.push(`  participant ${participant.id} as ${participant.label}`)
    for (const message of spec.messages) {
      const arrow = message.variant === 'return' || message.variant === 'dashed' ? '-->>' : '->>'
      lines.push(`  ${message.from}${arrow}${message.to}: ${message.label}`)
    }
    return `${lines.join('\n')}\n`
  }
  if (type === 'lifecycle') {
    const lines = ['stateDiagram-v2']
    for (const state of spec.states) lines.push(`  state "${mermaidLabel(state)}" as ${state.id}`)
    for (const transition of spec.transitions) lines.push(`  ${transition.from} --> ${transition.to}${transition.label ? `: ${transition.label}` : ''}`)
    return `${lines.join('\n')}\n`
  }
  const collection = type === 'architecture' ? spec.components : spec.nodes
  const relations = type === 'architecture' ? spec.connections : type === 'workflow' ? spec.edges : spec.flows
  const lines = ['flowchart LR']
  for (const node of collection) lines.push(`  ${node.id}["${mermaidLabel(node)}"]`)
  for (const relation of relations) {
    const arrow = relation.variant === 'dashed' || relation.role === 'async' ? '-.->' : '-->'
    lines.push(`  ${relation.from} ${arrow}${relation.label ? `|${relation.label}|` : ''} ${relation.to}`)
  }
  return `${lines.join('\n')}\n`
}

for (const diagram of diagrams) {
  const specPath = join(diagramsDir, `${diagram.slug}.${diagram.type}.json`)
  writeJson(specPath, diagram.spec)
  const mermaid = mermaidFor(diagram)
  writeFileSync(join(figuresDir, `${diagram.slug}.mmd`), mermaid)
  writeFileSync(join(figuresDir, `${diagram.slug}.md`), `# ${diagram.title}\n\n${diagram.description}\n\n\`\`\`mermaid\n${mermaid}\`\`\`\n`)
}

const sourceVersion = {
  project: 'deepseek-harness',
  source_path: sourceRoot,
  remote,
  branch,
  revision,
  short_revision: shortRevision,
  tags,
  describe,
  dirty: status !== '',
  status_porcelain: status.split('\n').filter(Boolean),
  commit: {
    hash: commit[0],
    author_name: commit[1],
    author_email: commit[2],
    authored_at: commit[3],
    committed_at: commit[4],
    subject: commit.slice(5).join('\n'),
  },
  packages_package_json_count: packageFiles.length,
  package_group_count: Object.keys(packageGroups).length,
  architecture_domain_count: Object.keys(packageDomainMap).length,
  package_groups: packageGroups,
  generated_at: new Date().toISOString(),
  generator: {
    project: 'archify',
    path: archifyRoot,
    revision: execFileSync('git', ['-C', archifyRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  },
}

writeJson(join(versionDir, 'source.json'), sourceVersion)
writeJson(join(versionDir, 'package-groups.json'), packageGroups)
writeJson(join(versionDir, 'package-domain-map.json'), packageDomainMap)
writeFileSync(join(versionDir, 'git-status.txt'), status === '' ? 'clean\n' : `${status}\n`)
writeFileSync(join(versionDir, 'git-remote.txt'), `${git('remote', '-v')}\n`)
writeFileSync(join(versionDir, 'README.md'), `# DeepSeek Harness 源码版本快照

本目录记录本次 Archify 图集对应的源码版本，确保图与代码可以互相追溯。

- 分支：\`${branch}\`
- 提交：\`${revision}\`
- 标签：${tags.length > 0 ? tags.map(tag => `\`${tag}\``).join('、') : '无'}
- 描述：\`${describe}\`
- 源码远端：\`${remote}\`
- 源码状态：${status === '' ? 'clean' : 'dirty（详见 `git-status.txt`）'}
- \`packages/**/package.json\` 数：${packageFiles.length}
- Archify 提交：\`${sourceVersion.generator.revision}\`
- 生成时间：\`${sourceVersion.generated_at}\`

机器可读详情见 [source.json](source.json)，一级包组统计见 [package-groups.json](package-groups.json)，完整的 12 域映射见 [package-domain-map.json](package-domain-map.json)。
`)

const manifest = {
  project: 'deepseek-harness',
  source: { remote, branch, revision, tags, describe },
  diagrams: diagrams.map(({ slug, type, title, description, evidence }) => ({
    id: slug,
    type,
    title,
    description,
    html: `diagrams/${slug}.html`,
    specification: `diagrams/${slug}.${type}.json`,
    mermaid: `figures/${slug}.mmd`,
    png: `figures/${slug}.png`,
    evidence,
  })),
}
writeJson(join(projectRoot, 'manifest.json'), manifest)

function htmlEscape(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

const rows = diagrams.map((diagram, index) => `
      <a class="diagram-row" href="diagrams/${diagram.slug}.html">
        <span class="number">${String(index + 1).padStart(2, '0')}</span>
        <span class="diagram-copy"><strong>${htmlEscape(diagram.title)}</strong><small>${htmlEscape(diagram.description)}</small></span>
        <span class="type">${diagram.type}</span>
        <span class="arrow" aria-hidden="true">&#8594;</span>
      </a>`).join('')

writeFileSync(join(projectRoot, 'index.html'), `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>deepseek-harness 架构图集</title>
  <style>
    :root { color-scheme: light dark; --bg:#f5f7f9; --panel:#ffffff; --ink:#15202b; --muted:#66717d; --line:#d8dee5; --accent:#087e8b; --warm:#d05a3b; }
    @media (prefers-color-scheme: dark) { :root { --bg:#101417; --panel:#171d21; --ink:#eef3f5; --muted:#9aa7af; --line:#334047; --accent:#4dc4cf; --warm:#f08a6e; } }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
    main { width:min(1120px,calc(100% - 32px)); margin:0 auto; padding:48px 0 64px; }
    header { display:grid; grid-template-columns:1fr auto; gap:24px; align-items:end; padding-bottom:28px; border-bottom:1px solid var(--line); }
    h1 { margin:0; font-size:clamp(32px,5vw,58px); line-height:1.02; letter-spacing:0; }
    header p { max-width:720px; margin:14px 0 0; color:var(--muted); line-height:1.65; }
    .version { text-align:right; font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--muted); }
    .version strong { color:var(--accent); font-weight:700; }
    .section-title { display:flex; align-items:baseline; justify-content:space-between; gap:16px; margin:34px 0 12px; }
    h2 { margin:0; font-size:18px; letter-spacing:0; }
    .section-title span { color:var(--muted); font-size:13px; }
    .diagram-list { border-top:1px solid var(--line); }
    .diagram-row { display:grid; grid-template-columns:48px minmax(0,1fr) 92px 28px; gap:16px; align-items:center; min-height:88px; color:inherit; text-decoration:none; border-bottom:1px solid var(--line); }
    .diagram-row:hover { background:color-mix(in srgb,var(--accent) 7%,transparent); }
    .number { color:var(--warm); font:700 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace; }
    .diagram-copy { min-width:0; display:grid; gap:7px; }
    .diagram-copy strong { font-size:17px; letter-spacing:0; }
    .diagram-copy small { color:var(--muted); font-size:13px; line-height:1.45; }
    .type { color:var(--accent); font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase; }
    .arrow { font-size:22px; color:var(--muted); }
    footer { display:flex; justify-content:space-between; gap:24px; margin-top:30px; color:var(--muted); font-size:12px; line-height:1.6; }
    footer a { color:var(--accent); }
    @media (max-width:700px) { main { padding-top:28px; } header { grid-template-columns:1fr; } .version { text-align:left; } .diagram-row { grid-template-columns:36px minmax(0,1fr) 24px; padding:14px 0; } .type { display:none; } footer { display:block; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div><h1>deepseek-harness</h1><p>基于真实源码、生成文档与 Profile 配置整理的交互式架构图集。图集覆盖运行时主干、全部一级包组、关键请求链路、状态与执行边界。</p></div>
      <div class="version"><strong>${htmlEscape(describe)}</strong><br>${htmlEscape(branch)} @ ${htmlEscape(shortRevision)}<br>${packageFiles.length} package manifests</div>
    </header>
    <div class="section-title"><h2>架构与流程图</h2><span>${diagrams.length} 个可独立查看的 HTML</span></div>
    <nav class="diagram-list" aria-label="架构图列表">${rows}
    </nav>
    <footer><span>每个 HTML 均为 Archify 生成的自包含文件，可直接双击打开。</span><span><a href="README.md">项目说明</a> · <a href="source-version/source.json">源码版本</a> · <a href="manifest.json">图集清单</a></span></footer>
  </main>
</body>
</html>
`)

const diagramTable = diagrams.map((diagram, index) => `| ${String(index + 1).padStart(2, '0')} | [${diagram.title}](diagrams/${diagram.slug}.html) | \`${diagram.type}\` | ${diagram.description} |`).join('\n')
const evidenceList = diagrams.map(diagram => `### ${diagram.title}\n\n${diagram.evidence.map(path => `- \`${path}\``).join('\n')}`).join('\n\n')

writeFileSync(join(projectRoot, 'README.md'), `# deepseek-harness 架构图集

本目录是 [DeepSeek Harness](${remote}) 在提交 \`${shortRevision}\`（${tags[0] ?? branch}）上的 Archify 架构快照。内容通过读取真实源码入口、Cordis Profile 配置、生成式架构文档和 package 元数据整理，再由本地 Archify 校验并输出为自包含 HTML。

## 查看方式

直接在浏览器打开 [index.html](index.html)，再从索引进入任意图。每个 \`diagrams/*.html\` 都不依赖服务器，也可以单独复制或离线查看；页面内支持缩放、搜索、主题切换、关系追踪和导出。

命令行打开示例（macOS）：

\`\`\`sh
open index.html
\`\`\`

## 图集

| # | 图 | 类型 | 覆盖范围 |
|---:|---|---|---|
${diagramTable}

## 目录

\`\`\`text
deepseek-harness/
├── index.html              # 浏览入口
├── manifest.json           # 机器可读图集清单
├── diagrams/               # Archify JSON、HTML、交付与视觉检查收据
├── figures/                # Mermaid 辅助源、Markdown 与 PNG
├── source-version/         # 源码分支、提交、标签、状态和包组/架构域映射
├── VISUAL_REVIEW.md        # 自动检查与人工截图审核结论
├── generate.mjs            # 可复现的图源与索引生成脚本
└── build.mjs               # Archify 交付与视觉检查脚本
\`\`\`

## 生成与更新

默认假设 \`ai-project-arch\`、\`archify\` 和 \`deepseek-harness\` 是同一父目录下的兄弟仓库：

\`\`\`sh
node deepseek-harness/generate.mjs
node deepseek-harness/build.mjs
\`\`\`

也可以显式指定源码和生成器：

\`\`\`sh
DSH_SOURCE_ROOT=/path/to/deepseek-harness \\
ARCHIFY_ROOT=/path/to/archify \\
node deepseek-harness/generate.mjs

DSH_SOURCE_ROOT=/path/to/deepseek-harness \\
ARCHIFY_ROOT=/path/to/archify \\
ARCHIFY_CHROME=/path/to/chrome \\
node deepseek-harness/build.mjs --visual-check
\`\`\`

脚本刷新 JSON、Mermaid、索引和版本快照。HTML 必须再用 Archify 的 \`deliver\` 生成，并用 \`visual-check\` 做多视口检查；本次生成的命令与结果保存在每张图旁边的收据文件中。

## 证据边界

“全部架构流程图”按架构层级理解：图集覆盖仓库所有一级 package group、产品入口、核心运行链、主要扩展能力和持久化/执行/发布边界；不会为 packages 目录下 ${packageFiles.length} 个包机械生成同数量的低信息密度图。\`02-module-atlas\` 负责全量一级域覆盖，其余图深入关键链路。

${evidenceList}
`)

const rootReadme = `# AI Project Arch

这个仓库集中存放不同 AI 项目经 Archify 生成的架构与流程图产物。每个被分析项目使用一个同名子目录，目录内应包含可直接查看的 HTML 索引、可复现图源、验证收据和对应源码版本快照。

## 当前项目

- [deepseek-harness](deepseek-harness/README.md)：DeepSeek Harness 的系统架构、运行流程、数据流、时序与生命周期图集；浏览入口为 [deepseek-harness/index.html](deepseek-harness/index.html)。

## 产物约定

- \`<project>/index.html\`：项目图集入口。
- \`<project>/diagrams/\`：Archify JSON 与自包含 HTML。
- \`<project>/figures/\`：辅助 Mermaid 源、Markdown 和 PNG。
- \`<project>/source-version/\`：源码远端、分支、commit、tag、dirty 状态和规模统计。
- \`<project>/manifest.json\`：机器可读图集清单及证据映射。

HTML 文件无需启动服务，直接用浏览器打开即可。
`
writeFileSync(join(workspaceRoot, 'README.md'), rootReadme)

console.log(`Generated ${diagrams.length} diagram specifications for ${describe}.`)

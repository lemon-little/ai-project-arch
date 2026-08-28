export const DEFAULT_DIAGRAM_ID = "overview";

export const diagrams = Object.freeze([
  {
    id: "overview",
    order: "01",
    type: "Architecture",
    title: "系统总览",
    summary: "训练入口、Ray 编排、推理生成、奖励与参数更新闭环。",
    keywords: ["总览", "runtime", "architecture", "Ray"],
    href: "diagrams/01-overview.html",
    status: "ready",
  },
  {
    id: "startup",
    order: "02",
    type: "Workflow",
    title: "启动与资源编排",
    summary: "Hydra 配置、TaskRunner、ResourcePool 与 WorkerGroup 初始化。",
    keywords: ["启动", "资源", "GPU", "TaskRunner", "WorkerGroup"],
    href: "diagrams/02-startup-orchestration.html",
    status: "ready",
  },
  {
    id: "training-iteration",
    order: "03",
    type: "Sequence",
    title: "单轮训练时序",
    summary: "从 Prompt 生成到奖励、优势计算、策略更新与权重同步。",
    keywords: ["PPO", "GRPO", "sequence", "优势", "更新"],
    href: "diagrams/03-training-iteration.html",
    status: "ready",
  },
  {
    id: "training-dataflow",
    order: "04",
    type: "Data Flow",
    title: "训练数据流",
    summary: "Prompt、trajectory、reward、ReplayBuffer 与模型参数的流向。",
    keywords: ["dataflow", "rollout", "reward", "ReplayBuffer", "DataProto"],
    href: "diagrams/04-training-dataflow.html",
    status: "ready",
  },
  {
    id: "worker-backends",
    order: "05",
    type: "Architecture",
    title: "Worker 与后端扩展",
    summary: "Single Controller 如何连接训练引擎、推理后端和 GPU 放置策略。",
    keywords: ["FSDP", "Megatron", "SGLang", "vLLM", "rollout", "backend"],
    href: "diagrams/05-worker-backends.html",
    status: "ready",
  },
  {
    id: "training-lifecycle",
    order: "06",
    type: "Lifecycle",
    title: "训练任务生命周期",
    summary: "初始化、恢复、训练、验证、保存、失败与正常结束。",
    keywords: ["lifecycle", "checkpoint", "恢复", "验证", "失败"],
    href: "diagrams/06-training-lifecycle.html",
    status: "ready",
  },
  {
    id: "trainer-modes",
    order: "07",
    type: "Architecture",
    title: "三种 Trainer 模式",
    summary: "sync、colocate_async 与 separate_async 的部署和同步差异。",
    keywords: ["sync", "colocate_async", "separate_async", "trainer mode"],
    href: "diagrams/07-trainer-modes.html",
    status: "ready",
  },
  {
    id: "other-entrypoints",
    order: "08",
    type: "Architecture",
    title: "其他训练与工具入口",
    summary: "SFT、评估、批量生成、实验性异步策略与扩展能力。",
    keywords: ["SFT", "evaluation", "generation", "experimental", "entrypoint"],
    href: "diagrams/08-other-entrypoints.html",
    status: "ready",
  },
]);

export function findDiagram(id) {
  return diagrams.find((diagram) => diagram.id === id) ?? diagrams[0];
}

export function filterDiagrams(query) {
  const normalized = String(query ?? "").trim().toLocaleLowerCase("zh-CN");
  if (!normalized) return [...diagrams];

  return diagrams.filter((diagram) => {
    const searchable = [diagram.title, diagram.type, diagram.summary, ...diagram.keywords]
      .join(" ")
      .toLocaleLowerCase("zh-CN");
    return searchable.includes(normalized);
  });
}

export function buildDiagramUrl(diagram, theme, { embed = false, inspect = false } = {}) {
  const resolvedTheme = theme === "dark" ? "dark" : "light";
  const params = new URLSearchParams({ theme: resolvedTheme });
  if (embed) params.set("embed", "1");
  if (embed && inspect) params.set("inspect", "1");
  return `${diagram.href}?${params.toString()}`;
}

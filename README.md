# AI Project Arch

这个仓库集中存放不同 AI 项目经 Archify 生成的架构与流程图产物。每个被分析项目使用一个同名子目录，目录内应包含可直接查看的 HTML 索引、可复现图源、验证收据和对应源码版本快照。

## 当前项目

- [deepseek-harness](deepseek-harness/README.md)：DeepSeek Harness 的系统架构、运行流程、数据流、时序与生命周期图集；浏览入口为 [deepseek-harness/index.html](deepseek-harness/index.html)。
- [verl](verl/README.md)：VERL 的训练架构、启动编排、单轮时序、数据流、Worker 后端、生命周期与 Trainer 模式图集；浏览入口为 [verl/index.html](verl/index.html)。

## 产物约定

- `<project>/index.html`：项目图集入口。
- `<project>/diagrams/`：Archify JSON 与自包含 HTML。
- `<project>/figures/`：辅助 Mermaid 源、Markdown 和 PNG。
- `<project>/source-version/`：源码远端、分支、commit、tag、dirty 状态和规模统计。
- `<project>/manifest.json`：机器可读图集清单及证据映射。

自包含单图 HTML 可以直接用浏览器打开；使用 ES modules 的汇总导航页请按对应项目 README 启动本地静态 HTTP 服务。

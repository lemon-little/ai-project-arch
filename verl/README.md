# VERL Architecture Atlas

这是基于 VERL `0.10.0.dev`、commit `bd6f5645023a774e75b3ea1ed63f652feb922ace` 生成的完整 Archify 图集。

浏览入口：[index.html](index.html)

## 图集内容

1. 系统总览
2. 启动与资源编排
3. 单轮训练时序
4. 训练数据流
5. Worker 与后端扩展
6. 训练任务生命周期
7. 三种 Trainer 模式
8. 其他训练与工具入口

图中模块可以点击查看语义详情、上下游关系和经 Git revision 校验的源码链接。当前 8 张图共覆盖 80 个节点、108 条源码引用。

## 目录

- `index.html`：完整汇总导航入口。
- `diagrams/`：8 张自包含 Archify HTML，以及视觉验收收据和截图。
- `specs/`：8 份可复现的 Archify JSON 规格。
- `visual-evidence/`：汇总页桌面端、移动端和详情浮窗截图。
- `tests/`：汇总页自动化测试和 TDD 记录。
- `legacy/`：最初生成的单图版本及其验收产物。
- `source-version/source.json`：VERL 源码和 Archify 生成器的精确版本记录。
- `manifest.json`：图集清单、文件哈希和证据覆盖统计。

本目录使用 ES modules，建议通过静态 HTTP 服务打开，而不是直接双击 `index.html`：

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:8766/verl/index.html`。

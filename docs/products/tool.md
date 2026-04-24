# rubicktool — 可视化 App 生成工具

## 产品定位

`rubicktool` 是纯 vibe coding 的界面化工具。用户不一定理解代码结构（例如 `index.html`），只需要描述需求，系统通过 `qodercli` 生成 app。

## 核心能力

- 文本描述 -> 调用 `qodercli` 生成 app
- 调用命令格式：`qodercli --model "ultimate" --dangerously-skip-permissions -p "{prompt}"`
- 从 hub 拉取现有 skill / mcp 作为依赖
- 不满足时可本地创建新的 skill / mcp
- 支持预览、调试、重新生成、再次上传

## 预览与调试

- rubicktool 本身是 electrobun 开发的桌面应用
- 生成 app 后，直接在 rubicktool 内加载 `index.html` 预览
- 可以启动本地临时 session 目录进行测试，运行逻辑与 rubick 一致

## 上传与版本规则

- 启动首次填写开发者姓名、邮箱；后续上传自动带上
- 上传 app 前，先确保依赖 skill / mcp 已存在于 hub（不存在则先上传）
- 若修改已有 skill / mcp，必须发布新版本，不允许覆盖旧版本
- 防重名机制：采用"作者+名称"联合键

## App 包内容（V1）

一个 app 包包含：

- `index.html`（页面结构）
- `app.json`（版本、作者、依赖信息、元数据）
- `prompt.md`（提示词模板）

说明：虽然用户可能不知道这些文件，但 `rubicktool` 内部仍按该结构生成和管理。

## 体验要求

- UI 风格与 `rubicktool`、`rubick` 保持一致
- 面向非程序员，流程尽量"描述-生成-预览-上传"闭环化

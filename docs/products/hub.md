# rubickhub — 仓库与分发

## 目标

- 作为内部局域网仓库，统一存放 `app/skill/mcp` zip 包
- 为 `rubicktool` 和 `rubick` 提供 HTTP 接口（查询、下载、上传、统计）
- 提供简单网页用于查看 app 列表和开发者榜单

## 数据目录

`data/` 下固定结构：

```
data/
├── apps/           # app zip 包
├── skills/         # skill zip 包
├── mcps/           # mcp zip 包
├── clients/        # 客户端安装包
│   ├── rubick-{version}-{platform}.{ext}
│   └── rubicktool-{version}-{platform}.{ext}
├── apps.json       # app 元数据与统计
├── skills.json     # skill 元数据与统计
└── mcps.json       # mcp 元数据与统计
```

## 列表与统计

- app 列表支持：按使用次数、下载量排序；默认按使用次数
- 开发者列表支持：按其所有 app 的使用总量、下载总量排序；默认按使用总量
- 使用次数定义：`rubick` 每次启动某 app 的新 session，向 hub 上报 `+1`

## 接口要求

对外协议：HTTP，必须提供 API 文档。

必要接口：
- 列表查询（apps/skills/mcps）
- 包上传
- 包下载
- 统计上报
- 客户端版本查询（用于 `rubick` / `rubicktool` 更新）
- 客户端下载列表（返回 `clients/` 下可用安装包列表及下载链接）

## 为什么需要 hub（而不是直接用 Git）

- 适合局域网内部协作，不依赖公开平台
- 支持标准化 zip 分发与统一版本命名
- 原生支持下载量、使用量统计和榜单展示

## 安全约束（局域网测试级）

- 不做复杂账号体系，先以轻量方式管理上传者信息
- 允许测试级账号信息随 app 流转
- 明确这是内网测试体系，不面向公网直接开放

# 当前上下文

## 当前状态

**阶段：** rubickhub 已完成并 push

**已完成：**
- rubickhub 工程：基于 bun 的 HTTP 仓库服务
  - 上传/下载/列表/统计 API
  - 客户端版本查询和下载
  - 简单网页前端
- 测试验证通过：上传、列表、统计上报
- 代码已 push 到 origin/main

**进行中：**
- 等待下一步指示

**下一步：**
- 可能开始 rubicktool 或 rubick

## 已知问题/阻塞

无。

## 备注

用户偏好：
- 继续使用 electrobun
- 简单和可读性 > 安全、性能

rubickhub 代码结构：
```
rubickhub/
├── src/
│   ├── index.ts          # 入口，bun.serve
│   ├── routes/
│   │   ├── index.ts      # 路由处理
│   │   └── responses.ts  # 响应 helpers
│   ├── services/
│   │   └── data.ts       # 数据目录和 JSON 索引操作
│   └── types/
│       └── index.ts      # 类型定义
├── public/
│   └── index.html        # 网页前端
└── data/                 # 运行时创建（apps/skills/mcps/clients）
```

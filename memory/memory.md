# 长期记忆

## 用户偏好

- **桌面框架：** electrobun（用户明确要求继续使用）
- **优先级：** 简单和可读性 > 安全、性能
- **沟通风格：** 直接、简洁、不迎合

## 技术选型

- 语言：TypeScript（全栈）
- 运行时：bun
- 桌面框架：electrobun
- AI 执行引擎：qodercli
- 命令格式：`qodercli --model "ultimate" --dangerously-skip-permissions -p "{prompt}" -w {workdir}`

## 产品关键约束

- **定位：** 面向白领用户的 work 类桌面产品体系
- **架构：** 三工程分离（rubickhub 仓库 / rubicktool 生成 / rubick 运行）
- **安全级别：** 局域网测试级，不做复杂账号体系
- **范围：** 内部局域网协作，不面向公网

## 产品核心流程

开发者用 rubicktool 描述需求 → qodercli 生成 app → 预览调试 → 上传到 hub → 终端用户用 rubick 下载安装 → 执行 session 任务

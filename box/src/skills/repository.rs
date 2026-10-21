use std::{fs, io, path::PathBuf};

use crate::works::SkillMetadata;

use super::help;

// 读取外置 Skill 文件并提供元数据与完整正文。
#[derive(Clone)]
pub struct SkillRepository {
    directory: PathBuf,
    entry_skill: PathBuf,
}

impl SkillRepository {
    // 创建绑定配置目录与入口 Skill 文件的仓库。
    pub fn new(directory: PathBuf, entry_skill: PathBuf) -> Self {
        Self {
            directory,
            entry_skill,
        }
    }

    // 扫描有效 Skill 文件并读取注册所需的元数据。
    pub fn metadata(&self) -> Result<Vec<SkillMetadata>, io::Error> {
        // step.1 发现符合命名规则的 Skill 文件并提取其身份
        let mut skills = Vec::new();
        for entry in fs::read_dir(&self.directory)? {
            let entry = entry?;
            let path = entry.path();
            // 调用辅助函数过滤文件名并取得 Skill 本地 ID。
            let Some(id) = help::help_skill_id_from_path(&path) else {
                continue;
            };
            // 调用辅助函数解析文件 frontmatter 中的注册元数据。
            let source = fs::read_to_string(&path)?;
            let (name, description, _) = help::help_parse_frontmatter(&source)?;
            skills.push(SkillMetadata {
                id,
                name,
                description,
            });
        }
        // step.2 按稳定 ID 顺序返回技能清单
        skills.sort_by(|left, right| left.id.cmp(&right.id));
        Ok(skills)
    }

    // 读取 Box 外置入口 Skill；当前服务没有业务 API 需要追加说明。
    pub fn entry_skill(&self) -> Result<String, io::Error> {
        fs::read_to_string(&self.entry_skill)
    }

    // 返回指定 Skill 的完整说明，未找到时报告 NotFound。
    pub fn skill(&self, id: &str) -> Result<String, io::Error> {
        // 调用辅助函数拒绝可能逃逸技能目录的请求 ID。
        if !help::help_valid_skill_id(id) {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "无效 Skill ID"));
        }
        let path = self.directory.join(format!("SKILL_{id}.md"));
        let source = fs::read_to_string(path)?;
        // 调用辅助函数验证 frontmatter，同时保留返回给 Agent 的完整 Markdown。
        let _ = help::help_parse_frontmatter(&source)?;
        Ok(source)
    }
}

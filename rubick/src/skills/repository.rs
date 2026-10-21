use std::{fs, io, path::PathBuf};

use super::help;

// 管理外置 Rubick Skill 模板并生成含动态接口说明的正文。
#[derive(Clone)]
pub struct SkillRepository {
    path: PathBuf,
}

impl SkillRepository {
    // 创建指向配置所指定 Rubick Skill 文件的仓库。
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    // 读取外置 Skill 并追加由配置生成的地址和 API 说明。
    pub fn rubick_skill(&self, base_url: &str, service_id: &str) -> Result<String, io::Error> {
        let source = fs::read_to_string(&self.path)?;
        // 调用辅助函数将模板中的服务 ID 替换为当前配置 ID。
        let source = help::help_render_skill_id(&source, service_id);
        // 调用辅助函数生成应附加到外置入口 Skill 尾部的 API 说明。
        Ok(format!(
            "{}\n\n{}",
            source.trim_end(),
            help::help_dynamic_api(base_url, service_id)
        ))
    }
}

use std::{io, path::Path};

// 从 SKILL_{id}.md 文件名中提取合法的本地 Skill ID。
pub(super) fn help_skill_id_from_path(path: &Path) -> Option<String> {
    let filename = path.file_name()?.to_str()?;
    let id = filename.strip_prefix("SKILL_")?.strip_suffix(".md")?;
    if id.is_empty() || id.contains('/') || id.contains('\\') || id == "." || id == ".." {
        return None;
    }
    Some(id.to_string())
}

// 确认请求中的 Skill ID 可安全映射到单个文件名。
pub(super) fn help_valid_skill_id(id: &str) -> bool {
    !id.trim().is_empty()
        && id != "."
        && id != ".."
        && !id
            .chars()
            .any(|character| character.is_control() || matches!(character, '/' | '\\' | '?' | '#'))
}

// 解析简洁 YAML frontmatter 并返回名称、描述和正文。
pub(super) fn help_parse_frontmatter(source: &str) -> Result<(String, String, String), io::Error> {
    // step.1 解析并校验 YAML frontmatter 边界和元数据
    let mut lines = source.lines();
    if lines.next() != Some("---") {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Skill 文件缺少 frontmatter",
        ));
    }
    let mut name = None;
    let mut description = None;
    let mut body_start = None;
    for (index, line) in lines.enumerate() {
        if line.trim() == "---" {
            body_start = Some(index + 2);
            break;
        }
        if let Some((key, value)) = line.split_once(':') {
            let value = value
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string();
            match key.trim() {
                "name" => name = Some(value),
                "description" => description = Some(value),
                _ => {}
            }
        }
    }
    let body_start = body_start
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Skill frontmatter 未闭合"))?;
    let body = source
        .lines()
        .skip(body_start)
        .collect::<Vec<_>>()
        .join("\n");
    let name = name
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Skill frontmatter 缺少 name"))?;
    let description = description
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                "Skill frontmatter 缺少 description",
            )
        })?;
    // step.2 提取 frontmatter 后的稳定 Skill 正文
    Ok((name, description, body))
}

// 规范化 Rubick 服务地址并构造指定注册接口 URL。
pub(super) fn help_endpoint(domain: &str, path: &str) -> String {
    format!("{}{path}", domain.trim_end_matches('/'))
}

use std::{sync::Arc, time::Duration};

use axum::http::StatusCode;
use russh::{
    ChannelMsg, Disconnect, client,
    keys::{self, PrivateKeyWithHashAlg},
};
use serde::Deserialize;
use tokio::sync::{Mutex, mpsc, oneshot};

use crate::app::{OutputBuffer, Session};

// 保存单次 SSH 请求提供的连接参数和临时认证信息。
#[derive(Clone, Deserialize)]
pub struct SshTarget {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub private_key_passphrase: Option<String>,
}

// 接受服务器主机密钥，免除首次连接和重装后的交互确认。
struct ClientHandler;

impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

// 使用请求内的主机和临时凭据建立 SSH 连接。
async fn connect(target: SshTarget) -> Result<client::Handle<ClientHandler>, StatusCode> {
    // step.1 校验本次连接参数并建立 russh 客户端连接
    if target.host.trim().is_empty()
        || target.username.trim().is_empty()
        || target.port == 0
        || (target.password.is_none() && target.private_key.is_none())
        || (target.private_key_passphrase.is_some() && target.private_key.is_none())
    {
        return Err(StatusCode::BAD_REQUEST);
    }
    let client_config = client::Config {
        keepalive_interval: Some(Duration::from_secs(15)),
        ..Default::default()
    };
    let mut handle = tokio::time::timeout(
        Duration::from_secs(10),
        client::connect(
            Arc::new(client_config),
            (target.host.as_str(), target.port),
            ClientHandler,
        ),
    )
    .await
    .map_err(|_| StatusCode::GATEWAY_TIMEOUT)?
    .map_err(|_| StatusCode::BAD_GATEWAY)?;

    // step.2 尝试请求提供的私钥或密码认证
    let mut authenticated = false;
    if let Some(private_key) = &target.private_key {
        let key = keys::decode_secret_key(private_key, target.private_key_passphrase.as_deref())
            .map_err(|_| StatusCode::BAD_REQUEST)?;
        let hash = handle
            .best_supported_rsa_hash()
            .await
            .map_err(|_| StatusCode::BAD_GATEWAY)?
            .flatten();
        let auth = handle
            .authenticate_publickey(
                target.username.clone(),
                PrivateKeyWithHashAlg::new(Arc::new(key), hash),
            )
            .await
            .map_err(|_| StatusCode::BAD_GATEWAY)?;
        authenticated = auth.success();
    }
    if !authenticated {
        if let Some(password) = &target.password {
            let auth = handle
                .authenticate_password(target.username.clone(), password.clone())
                .await
                .map_err(|_| StatusCode::BAD_GATEWAY)?;
            authenticated = auth.success();
        }
    }
    if !authenticated {
        return Err(StatusCode::UNAUTHORIZED);
    }
    drop(target);
    Ok(handle)
}

// 执行短命令并汇总 SSH 通道输出与退出码。
pub async fn run_command(
    target: SshTarget,
    command_text: &str,
) -> Result<(Option<i32>, String), StatusCode> {
    // step.1 认证目标主机并打开非交互命令通道
    let handle = connect(target).await?;
    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    channel
        .exec(true, command_text)
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    // step.2 收集命令输出并在远端退出时关闭连接
    let mut output = Vec::new();
    let mut exit_code = None;
    while let Some(message) = channel.wait().await {
        match message {
            ChannelMsg::Data { data } | ChannelMsg::ExtendedData { data, .. } => {
                output.extend_from_slice(&data);
            }
            ChannelMsg::ExitStatus { exit_status } => {
                exit_code = Some(exit_status as i32);
                break;
            }
            ChannelMsg::Close => break,
            _ => {}
        }
    }
    let _ = handle
        .disconnect(Disconnect::ByApplication, "command complete", "en")
        .await;
    Ok((exit_code, String::from_utf8_lossy(&output).into_owned()))
}

// 建立 PTY 会话并启动输入转发、输出采集和远端退出监控。
pub async fn start_session(
    target: SshTarget,
    command_text: Option<&str>,
) -> Result<(String, Session), StatusCode> {
    // step.1 登录目标主机并创建标准 PTY shell 或命令
    let handle = connect(target).await?;
    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    channel
        .request_pty(true, "xterm-256color", 120, 40, 0, 0, &[])
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    if let Some(command) = command_text {
        channel
            .exec(true, command)
            .await
            .map_err(|_| StatusCode::BAD_GATEWAY)?;
    } else {
        channel
            .request_shell(true)
            .await
            .map_err(|_| StatusCode::BAD_GATEWAY)?;
    }

    // step.2 运行会话 I/O 任务并返回 Agent 使用的会话句柄
    let output = Arc::new(Mutex::new(OutputBuffer {
        bytes: Vec::new(),
        start_offset: 0,
        next_offset: 0,
    }));
    let exited = Arc::new(Mutex::new(None));
    let (input_sender, mut input_receiver) = mpsc::channel::<Vec<u8>>(32);
    let (kill_sender, mut kill_receiver) = oneshot::channel();
    let task_output = output.clone();
    let task_exited = exited.clone();
    tokio::spawn(async move {
        // step.1 转发 Agent 输入并采集远端输出
        let mut exit_code = None;
        loop {
            tokio::select! {
                _ = &mut kill_receiver => {
                    let _ = channel.close().await;
                    let _ = handle.disconnect(Disconnect::ByApplication, "session closed", "en").await;
                    break;
                }
                input = input_receiver.recv() => {
                    match input {
                        Some(data) => {
                            if channel.data_bytes(data).await.is_err() { break; }
                        }
                        None => {
                            let _ = channel.eof().await;
                            break;
                        }
                    }
                }
                message = channel.wait() => {
                    match message {
                        Some(ChannelMsg::Data { data })
                        | Some(ChannelMsg::ExtendedData { data, .. }) => {
                            task_output.lock().await.append(&data);
                        }
                        Some(ChannelMsg::ExitStatus { exit_status }) => {
                            exit_code = Some(exit_status as i32);
                            break;
                        }
                        Some(ChannelMsg::Close) | None => break,
                        _ => {}
                    }
                }
            }
        }
        // step.2 记录远端退出状态并释放 SSH 连接
        *task_exited.lock().await = exit_code;
        let _ = handle
            .disconnect(Disconnect::ByApplication, "session complete", "en")
            .await;
    });
    let session = Session {
        input: input_sender,
        output,
        exited,
        activity: Arc::new(Mutex::new(std::time::Instant::now())),
        kill: Some(kill_sender),
    };
    Ok((uuid::Uuid::new_v4().to_string(), session))
}

#[cfg(test)]
mod integration_tests {
    use std::{error::Error, time::Duration};

    use super::{SshTarget, run_command, start_session};

    // 用环境变量提供目标信息，验证真实 SSH 登录、命令和 sudo PTY。
    #[tokio::test]
    #[ignore = "Requires reachable SSH_TEST_HOST and SSH_TEST_USER/PASSWORD environment variables"]
    async fn live_target_runs_commands_and_sudo_login_shell() -> Result<(), Box<dyn Error>> {
        // step.1 从本地测试环境读取单次连接参数和认证信息
        let host = std::env::var("SSH_TEST_HOST")?;
        let username = std::env::var("SSH_TEST_USER")?;
        let port = std::env::var("SSH_TEST_PORT")
            .unwrap_or_else(|_| "22".to_string())
            .parse::<u16>()?;
        let password = std::env::var("SSH_TEST_PASSWORD")?;
        let target = SshTarget {
            host,
            port,
            username: username.clone(),
            password: Some(password.clone()),
            private_key: None,
            private_key_passphrase: None,
        };

        // step.2 验证短命令和 PTY 内的 sudo root 登录 shell
        let (_, output) = run_command(target.clone(), "whoami && date")
            .await
            .map_err(|status| format!("短命令 SSH 请求失败: {status}"))?;
        assert!(output.lines().any(|line| line.trim() == username));

        let (_, session) = start_session(target, Some("sudo -i"))
            .await
            .map_err(|status| format!("sudo PTY 会话创建失败: {status}"))?;
        let password_prompt = tokio::time::timeout(Duration::from_secs(10), async {
            loop {
                let found = {
                    let output = session.output.lock().await;
                    String::from_utf8_lossy(&output.bytes)
                        .to_ascii_lowercase()
                        .contains("password")
                };
                if found {
                    break true;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        })
        .await
        .unwrap_or(false);
        if password_prompt {
            session
                .input
                .send(format!("{password}\n").into_bytes())
                .await?;
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
        session.input.send(b"whoami\ndate\nexit\n".to_vec()).await?;
        tokio::time::timeout(Duration::from_secs(10), async {
            loop {
                let is_root = {
                    let output = session.output.lock().await;
                    String::from_utf8_lossy(&output.bytes)
                        .lines()
                        .any(|line| line.trim() == "root")
                };
                if is_root {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        })
        .await?;
        if let Some(kill) = session.kill {
            let _ = kill.send(());
        }
        Ok(())
    }
}

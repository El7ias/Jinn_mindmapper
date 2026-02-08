// MindMapper — Tauri backend commands for Claude Code integration

use std::sync::Mutex;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_store::StoreExt;

/// Holds an optional child process ID for cancellation.
struct ClaudeProcess(Mutex<Option<u32>>);

/// Detect if `claude` CLI is installed and return its version.
#[tauri::command]
async fn detect_claude_cli() -> Result<serde_json::Value, String> {
    let output = Command::new("claude")
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            if out.status.success() {
                Ok(serde_json::json!({
                    "installed": true,
                    "version": stdout,
                    "path": "claude"
                }))
            } else {
                Ok(serde_json::json!({
                    "installed": false,
                    "error": if stderr.is_empty() { stdout } else { stderr }
                }))
            }
        }
        Err(e) => Ok(serde_json::json!({
            "installed": false,
            "error": format!("Claude CLI not found: {}", e)
        })),
    }
}

/// Spawn Claude Code with a prompt and stream output via Tauri events.
///
/// Events emitted to the frontend:
///   - "claude:progress" — each line of stdout (parsed JSON or raw text)
///   - "claude:error"    — each line of stderr
///   - "claude:complete" — when the process exits, includes exit code
#[tauri::command]
async fn spawn_claude(
    app: AppHandle,
    state: State<'_, ClaudeProcess>,
    prompt: String,
    output_dir: String,
    model: Option<String>,
    hands_off: Option<bool>,
) -> Result<serde_json::Value, String> {
    // Build the claude command arguments
    let mut args: Vec<String> = vec![
        "-p".to_string(),
        prompt.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
    ];

    // Add model override if specified
    if let Some(ref m) = model {
        args.push("--model".to_string());
        args.push(m.clone());
    }

    // Add allowed tools for hands-off mode
    if hands_off.unwrap_or(false) {
        args.push("--allowedTools".to_string());
        args.push("Bash,Read,Write,Edit,MultiEdit,Glob,Grep,LS,TodoRead,TodoWrite".to_string());
    }

    log::info!(
        "Spawning Claude Code — prompt: {} chars, dir: {}, model: {:?}",
        prompt.len(),
        output_dir,
        model
    );

    // Spawn the child process
    let mut child = Command::new("claude")
        .args(&args)
        .current_dir(&output_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn Claude CLI: {}", e))?;

    let pid = child.id();

    // Store the PID for cancellation
    {
        let mut proc = state.0.lock().map_err(|e| e.to_string())?;
        *proc = Some(pid);
    }

    let session_id = format!("session_{}", pid);

    // Emit session started event
    let _ = app.emit("claude:started", serde_json::json!({
        "sessionId": session_id,
        "pid": pid,
    }));

    // Take ownership of stdout and stderr
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_stdout = app.clone();
    let app_stderr = app.clone();
    let session_stdout = session_id.clone();
    let session_stderr = session_id.clone();

    // Stream stdout in a background thread
    let stdout_handle = std::thread::spawn(move || {
        if let Some(out) = stdout {
            let reader = BufReader::new(out);
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        // Try to parse as JSON, fall back to raw text
                        let payload = match serde_json::from_str::<serde_json::Value>(&text) {
                            Ok(json) => serde_json::json!({
                                "sessionId": session_stdout,
                                "type": "json",
                                "data": json,
                            }),
                            Err(_) => serde_json::json!({
                                "sessionId": session_stdout,
                                "type": "text",
                                "data": text,
                            }),
                        };
                        let _ = app_stdout.emit("claude:progress", payload);
                    }
                    Err(e) => {
                        log::error!("stdout read error: {}", e);
                        break;
                    }
                }
            }
        }
    });

    // Stream stderr in a background thread
    let stderr_handle = std::thread::spawn(move || {
        if let Some(err) = stderr {
            let reader = BufReader::new(err);
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        let _ = app_stderr.emit("claude:error", serde_json::json!({
                            "sessionId": session_stderr,
                            "message": text,
                        }));
                    }
                    Err(e) => {
                        log::error!("stderr read error: {}", e);
                        break;
                    }
                }
            }
        }
    });

    // Wait for completion in a background thread
    let app_complete = app.clone();
    let session_complete = session_id.clone();
    let state_clone = std::sync::Arc::new(Mutex::new(()));

    std::thread::spawn(move || {
        // Wait for stdout/stderr threads to finish
        let _ = stdout_handle.join();
        let _ = stderr_handle.join();

        // Wait for the child process
        let exit_code = match child.wait() {
            Ok(status) => status.code().unwrap_or(-1),
            Err(e) => {
                log::error!("Failed to wait for Claude process: {}", e);
                -1
            }
        };

        let _ = app_complete.emit("claude:complete", serde_json::json!({
            "sessionId": session_complete,
            "exitCode": exit_code,
            "success": exit_code == 0,
        }));

        log::info!("Claude Code session {} completed with exit code {}", session_complete, exit_code);
        drop(state_clone);
    });

    Ok(serde_json::json!({
        "sessionId": session_id,
        "pid": pid,
        "status": "started"
    }))
}

/// Cancel a running Claude Code subprocess.
#[tauri::command]
async fn cancel_claude(state: State<'_, ClaudeProcess>) -> Result<serde_json::Value, String> {
    let mut proc = state.0.lock().map_err(|e| e.to_string())?;

    if let Some(pid) = proc.take() {
        log::info!("Cancelling Claude Code process (PID: {})", pid);

        // On Windows, use taskkill to terminate the process tree
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .output();
        }

        // On Unix, send SIGTERM
        #[cfg(not(target_os = "windows"))]
        {
            unsafe {
                libc::kill(pid as i32, libc::SIGTERM);
            }
        }

        Ok(serde_json::json!({
            "cancelled": true,
            "pid": pid
        }))
    } else {
        Ok(serde_json::json!({
            "cancelled": false,
            "reason": "No active Claude Code process"
        }))
    }
}

/// Read API key from secure store.
#[tauri::command]
async fn get_api_key(
    app: AppHandle,
    provider: Option<String>,
) -> Result<serde_json::Value, String> {
    let store = app
        .store("mindmapper-settings.json")
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let key_name = format!("apiKey_{}", provider.unwrap_or_else(|| "anthropic".to_string()));
    let value = store.get(&key_name);

    Ok(serde_json::json!({
        "key": value,
        "provider": key_name,
    }))
}

/// Save API key to secure store.
#[tauri::command]
async fn set_api_key(
    app: AppHandle,
    provider: Option<String>,
    key: String,
) -> Result<serde_json::Value, String> {
    let store = app
        .store("mindmapper-settings.json")
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let key_name = format!("apiKey_{}", provider.unwrap_or_else(|| "anthropic".to_string()));
    store.set(&key_name, serde_json::json!(key));

    Ok(serde_json::json!({
        "saved": true,
        "provider": key_name,
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ClaudeProcess(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_claude_cli,
            spawn_claude,
            cancel_claude,
            get_api_key,
            set_api_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

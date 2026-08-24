use serde_json::json;
use sm_core::models::AppConfig;
use sm_core::services::ConfigManager;

use crate::context::{acquire_init_lock, config_path};

#[derive(clap::Args)]
pub struct Args {
    /// Output machine-readable JSON
    #[arg(long)]
    pub json: bool,
}

fn detected_tool_ids(config: &AppConfig) -> Vec<String> {
    config
        .tools
        .iter()
        .filter(|(_, tool)| tool.detected)
        .map(|(id, _)| id.clone())
        .collect()
}

pub fn run(args: &Args) -> anyhow::Result<()> {
    let manager = ConfigManager::new();

    // Take the lock before deciding, so a concurrent init can't slip between
    // the check and the write. This is the one command allowed to create
    // config.json, hence the init-specific lock.
    let _guard = acquire_init_lock()?;

    // Re-running init must never rebuild the config: init_default() starts from
    // AppConfig::default(), which would drop custom tools, tags, favorites,
    // notes and project bindings. Bail out in BOTH output modes.
    if manager.is_initialized() {
        let config = manager.load().map_err(|e| anyhow::anyhow!(e))?;
        if args.json {
            println!(
                "{}",
                json!({
                    "already_initialized": true,
                    "skills_dir": config.skills_dir,
                    "detected_tools": detected_tool_ids(&config),
                })
            );
        } else {
            println!("Skills Manager is already initialized. Nothing to do.");
        }
        return Ok(());
    }

    // is_initialized() is also false when config.json exists but cannot be
    // parsed. Overwriting it would silently discard a recoverable config, so
    // refuse and let the user decide.
    let path = config_path();
    let has_content = std::fs::metadata(&path).map(|m| m.len() > 0).unwrap_or(false);
    if has_content && manager.load().is_err() {
        return Err(anyhow::anyhow!(
            "{} exists but could not be parsed.\nMove or fix it, then re-run 'skm init'.",
            path.display()
        ));
    }

    let mut config = manager.init_default().map_err(|e| anyhow::anyhow!(e))?;
    config.initialized = true;
    manager.save(&config).map_err(|e| anyhow::anyhow!(e))?;

    // Read back what was actually persisted: save() normalizes skills_dir, so
    // reporting the in-memory value could describe a directory that is not
    // the one in use.
    let config = manager.load().map_err(|e| anyhow::anyhow!(e))?;
    let detected = detected_tool_ids(&config);

    if args.json {
        println!(
            "{}",
            json!({
                "already_initialized": false,
                "skills_dir": config.skills_dir,
                "detected_tools": detected,
            })
        );
        return Ok(());
    }

    println!(
        "initialized. skills directory: {}",
        config.skills_dir.display()
    );
    if detected.is_empty() {
        println!("no AI tools detected — install one and run 'skm doctor'");
    } else {
        println!(
            "detected {} tool(s): {}",
            detected.len(),
            detected.join(", ")
        );
    }
    println!();
    println!("next steps:");
    println!("  skm adopt          # bring existing skills under management");
    println!("  skm list           # see what is managed");

    Ok(())
}

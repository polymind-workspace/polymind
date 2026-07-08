mod db;
mod parser;
mod rpc;

use std::str::FromStr;

use anyhow::Result;
use solana_sdk::pubkey::Pubkey;
use sqlx::PgPool;

#[derive(Clone)]
pub struct IndexerConfig {
    pub rpc_url: String,
    pub database_url: String,
    pub program_id: Pubkey,
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    env_logger::init();

    let config = IndexerConfig {
        rpc_url: std::env::var("SOLANA_RPC_URL")
            .unwrap_or_else(|_| "https://api.devnet.solana.com".into()),
        database_url: std::env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set (postgresql://...)"),
        program_id: Pubkey::from_str(
            &std::env::var("SOLANA_PROGRAM_ID").expect("SOLANA_PROGRAM_ID must be set"),
        )?,
    };

    log::info!("Connecting to database...");
    let pool = PgPool::connect(&config.database_url).await?;

    log::info!("Running migrations...");
    sqlx::migrate!("./migrations").run(&pool).await?;

    log::info!(
        "Subscribing to program logs: {} via {}",
        config.program_id,
        config.rpc_url
    );
    rpc::subscribe_logs(pool, config).await?;

    Ok(())
}

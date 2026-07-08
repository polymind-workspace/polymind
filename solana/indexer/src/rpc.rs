use std::time::Duration;

use anyhow::Result;
use crossbeam_channel::RecvTimeoutError;
use solana_client::pubsub_client::PubsubClient;
use solana_client::rpc_config::{RpcTransactionLogsConfig, RpcTransactionLogsFilter};
use solana_client::rpc_response::{Response, RpcLogsResponse};
use solana_sdk::commitment_config::CommitmentConfig;
use sqlx::PgPool;

use crate::{db, parser, IndexerConfig};

pub async fn subscribe_logs(pool: PgPool, config: IndexerConfig) -> Result<()> {
    let filter = RpcTransactionLogsFilter::Mentions(vec![config.program_id.to_string()]);
    let log_config = RpcTransactionLogsConfig {
        commitment: Some(CommitmentConfig::confirmed()),
    };

    let (_subscription, receiver) =
        tokio::task::spawn_blocking(move || {
            PubsubClient::logs_subscribe(&config.rpc_url, filter, log_config)
        })
        .await??;

    log::info!("Connected to Solana logs subscription");

    loop {
        let response: Result<Response<RpcLogsResponse>, RecvTimeoutError> =
            tokio::task::spawn_blocking({
                let receiver = receiver.clone();
                move || receiver.recv_timeout(Duration::from_secs(60))
            })
            .await?;

        match response {
            Ok(Response { context: _, value: log }) => {
                if log.err.is_some() {
                    continue;
                }

                let signature = log.signature.clone();
                // RpcLogsResponse in solana-client 2.3+ no longer includes slot.
                // We can backfill it from get_transaction later; for the skeleton use 0.
                let slot = 0_i64;

                if let Some(event) = parser::parse_test_event(&log.logs) {
                    log::info!(
                        "Parsed TestEvent: user={}, message={}, slot={}",
                        event.user,
                        event.message,
                        slot
                    );

                    db::insert_event(
                        &pool,
                        &config.program_id.to_string(),
                        &signature,
                        slot,
                        None,
                        "TestEvent",
                        &event.user.to_string(),
                        &serde_json::json!({
                            "user": event.user.to_string(),
                            "message": event.message,
                            "timestamp": event.timestamp,
                        }),
                    )
                    .await?;
                }
            }
            Err(RecvTimeoutError::Timeout) => {
                log::debug!("No logs in 60s, heartbeat");
            }
            Err(RecvTimeoutError::Disconnected) => {
                log::warn!("Log subscription disconnected");
                break;
            }
        }
    }

    Ok(())
}

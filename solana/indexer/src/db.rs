use anyhow::Result;
use serde::Serialize;
use sqlx::types::Json;
use sqlx::PgPool;

pub async fn insert_event<T: Serialize>(
    pool: &PgPool,
    program_id: &str,
    signature: &str,
    slot: i64,
    block_time: Option<i64>,
    kind: &str,
    actor: &str,
    payload: &T,
) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO chain_event_log (program_id, signature, slot, block_time, kind, actor, payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (signature, kind) DO NOTHING
        "#,
    )
    .bind(program_id)
    .bind(signature)
    .bind(slot)
    .bind(block_time)
    .bind(kind)
    .bind(actor)
    .bind(Json(payload))
    .execute(pool)
    .await?;

    Ok(())
}

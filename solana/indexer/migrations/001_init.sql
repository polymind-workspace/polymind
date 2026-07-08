CREATE TABLE IF NOT EXISTS chain_event_log (
    id BIGSERIAL PRIMARY KEY,
    program_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    slot BIGINT NOT NULL,
    block_time BIGINT,
    kind TEXT NOT NULL,
    actor TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (signature, kind)
);

CREATE INDEX IF NOT EXISTS idx_chain_event_log_program_kind ON chain_event_log(program_id, kind);
CREATE INDEX IF NOT EXISTS idx_chain_event_log_signature ON chain_event_log(signature);
CREATE INDEX IF NOT EXISTS idx_chain_event_log_slot ON chain_event_log(slot);

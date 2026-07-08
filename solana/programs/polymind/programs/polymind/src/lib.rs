use anchor_lang::prelude::*;

declare_id!("GRzZ7B6ZzgU2TuvmTFhtPHbc98CScGLw6h5McTM4SXT5");

/// PolyMind prediction market program (minimum skeleton).
#[program]
pub mod polymind {
    use super::*;

    /// Emit a test event. Used to verify the indexer <-> API pipeline.
    pub fn emit_test_event(ctx: Context<EmitTestEvent>, message: String) -> Result<()> {
        emit!(TestEvent {
            user: ctx.accounts.user.key(),
            message,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }
}

/// Accounts required by `emit_test_event`.
#[derive(Accounts)]
pub struct EmitTestEvent<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
}

/// A test event emitted to verify the entire data pipeline.
#[event]
pub struct TestEvent {
    pub user: Pubkey,
    pub message: String,
    pub timestamp: i64,
}

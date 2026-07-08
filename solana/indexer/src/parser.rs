use base64::Engine;

use anchor_lang::AnchorDeserialize;
use polymind::TestEvent;
use solana_sdk::hash::hash;

/// Compute the Anchor event discriminator for TestEvent.
///
/// Anchor uses the first 8 bytes of sha256("event:{EventName}").
fn test_event_discriminator() -> [u8; 8] {
    hash("event:TestEvent".as_bytes()).to_bytes()[..8]
        .try_into()
        .expect("slice with correct length")
}

/// Parse a `TestEvent` from program logs.
///
/// Anchor emits events as base64-encoded log entries prefixed with "Program data: ".
/// The first 8 bytes are the event discriminator, followed by the serialized event.
pub fn parse_test_event(logs: &[String]) -> Option<TestEvent> {
    let expected = test_event_discriminator();

    for log in logs {
        let encoded = log.strip_prefix("Program data: ")?;
        let data = base64::engine::general_purpose::STANDARD.decode(encoded).ok()?;
        if data.len() < 8 {
            continue;
        }
        if data[..8] != expected {
            continue;
        }
        if let Ok(event) = TestEvent::deserialize(&mut &data[8..]) {
            return Some(event);
        }
    }
    None
}

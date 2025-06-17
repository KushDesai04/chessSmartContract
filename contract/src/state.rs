use cosmwasm_std::{CanonicalAddr};
use schemars::JsonSchema;
use serde::{de::Error, Deserialize, Serialize};
use secret_toolkit::storage::{Item, Keymap};


#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct GameState {
    pub fen: String,          // e.g. "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    pub white: CanonicalAddr,
    pub black: Option<CanonicalAddr>,
    pub turn: u64,            // block height
    pub status: GameStatus,
}

#[derive(Clone, Copy, Debug, PartialEq, JsonSchema)]
pub enum GameStatus {
    Pending = 1,                  // Waiting for opponent
    Active,                   // Game in progress
    Check,                    // Current player in check
    Stalemate,                // Draw by stalemate
    DrawOffered,              // Draw proposal active
    DrawAccepted,             // Mutual draw agreement
    Checkmate,
}


pub const GAMES: Keymap<u64, GameState> = Keymap::new(b"games");
pub const NEXT_GAME_ID: Item<u64> = Item::new(b"next_game_id");

impl Serialize for GameStatus {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_i32(*self as i32)
    }
}
impl<'de> Deserialize<'de> for GameStatus {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = i32::deserialize(deserializer)?;
        match value {
            1 => Ok(GameStatus::Pending),
            2 => Ok(GameStatus::Active),
            3 => Ok(GameStatus::Check),
            4 => Ok(GameStatus::Stalemate),
            5 => Ok(GameStatus::DrawAccepted),
            6 => Ok(GameStatus::DrawOffered),
            7 => Ok(GameStatus::Checkmate),
            _ => Err(Error::custom("Invalid GameStatus value")),
        }
    }
}

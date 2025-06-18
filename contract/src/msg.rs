use serde::{Deserialize, Serialize};
use schemars::JsonSchema;

use crate::state::{GameState};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    CreateGame {},
    JoinGame   { game_id: u64 },
    MakeMove   { game_id: u64, move_from: String, move_to: String, promotion: Option<String> }, // e.g., "e2", "e4", "None"
    Resign     { game_id: u64 },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetGame { game_id: u64 },
    ListGames {}
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryAnswer {
    GameState(GameState),
    AllGames(Vec<GameState>)
}


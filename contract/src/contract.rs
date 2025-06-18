use cosmwasm_std::{
    entry_point, to_binary, Addr, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdError,
    StdResult,
};

use crate::chess::validate_move;
use crate::msg::{ExecuteMsg, InstantiateMsg, QueryAnswer, QueryMsg};
use crate::state::{GameState, GameStatus, GAMES, NEXT_GAME_ID};

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    _msg: InstantiateMsg,
) -> StdResult<Response> {
    NEXT_GAME_ID.save(deps.storage, &0)?;
    Ok(Response::default())
}

#[entry_point]
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response> {
    match msg {
        ExecuteMsg::CreateGame {} => create_game(deps, env, info.sender.clone()),
        ExecuteMsg::JoinGame { game_id } => join_game(deps, env, info.sender.clone(), game_id),
        ExecuteMsg::MakeMove {
            game_id,
            move_from,
            move_to,
            promotion,
        } => make_move(
            deps,
            env,
            info.sender.clone(),
            game_id,
            move_from,
            move_to,
            promotion,
        ),
        ExecuteMsg::Resign { game_id } => resign(deps, env, info.sender.clone(), game_id),
    }
}

fn create_game(deps: DepsMut, env: Env, sender: Addr) -> StdResult<Response> {
    let mut new_game_state: GameState = GameState {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".to_string(),
        white: None,
        black: None,
        turn: 0,
        status: GameStatus::Pending,
    };

    let bytes: Option<Binary> = env.block.random;
    if let Some(random_bytes) = bytes {
        // Use the first byte to decide color
        if !random_bytes.is_empty() && random_bytes.as_slice()[0] % 2 == 0 {
            new_game_state.white = Some(sender);
        } else {
            new_game_state.black = Some(sender);
        }
    } else {
        // Fallback: default to white if no randomness
        new_game_state.white = Some(sender);
    }

    let mut game_id = NEXT_GAME_ID.load(deps.storage)?;
    game_id += 1;
    GAMES.insert(deps.storage, &game_id, &new_game_state)?;
    NEXT_GAME_ID.save(deps.storage, &game_id)?;

    Ok(Response::new().add_attribute("game_id", game_id.to_string()))
}

fn join_game(deps: DepsMut, _env: Env, sender: Addr, game_id: u64) -> StdResult<Response> {
    let game_state = GAMES.get(deps.storage, &game_id);
    match game_state {
        Some(mut state) => {
            // User may just be reconnecting to the game - Not an error
            if state.white == Some(sender.clone()) || state.black == Some(sender.clone()) {
                return Ok(Response::default());
            }
            // Set the other player to colour
            if state.white.is_some() {
                state.black = Some(sender);
            } else {
                state.white = Some(sender);
            }
            state.status = GameStatus::Active;
            GAMES.insert(deps.storage, &game_id, &state)?;
            Ok(Response::default())
        }
        None => Err(StdError::GenericErr {
            msg: format!("No game found with id {game_id}"),
        }),
    }
}

fn make_move(
    deps: DepsMut,
    _env: Env,
    sender: Addr,
    game_id: u64,
    move_from: String,
    move_to: String,
    promotion: Option<String>,
) -> StdResult<Response> {
    let game_state = GAMES.get(deps.storage, &game_id);
    match game_state {
        Some(mut state) => {
            if Some(sender.clone()) == state.white && state.turn % 2 != 0 {
                // Not whites turn
                return Err(StdError::GenericErr {
                    msg: format!("It is blacks turn"),
                });
            } else if Some(sender.clone()) == state.black && state.turn % 2 == 0 {
                // Not blacks turn
                return Err(StdError::GenericErr {
                    msg: format!("It is whites turn"),
                });
            } else if Some(sender.clone()) != state.black && Some(sender.clone()) != state.white {
                // Not one of the players
                return Err(StdError::GenericErr {
                    msg: format!("Not a player"),
                });
            }
            let (new_fen, status) =
                validate_move(&state.fen, &move_from, &move_to, promotion.as_deref()).map_err(
                    |_| StdError::GenericErr {
                        msg: "Illegal Move".to_string(),
                    },
                )?;
            state.fen = new_fen;
            state.status = match status {
                chess::BoardStatus::Ongoing => GameStatus::Active,
                chess::BoardStatus::Stalemate => GameStatus::Stalemate,
                chess::BoardStatus::Checkmate => {
                    if state.turn % 2 == 0 {
                        GameStatus::WhiteWins
                    } else {
                        GameStatus::BlackWins
                    }
                }
            };
            state.turn += 1;
            GAMES.insert(deps.storage, &game_id, &state)?;
            Ok(Response::default())
        }
        None => Err(StdError::GenericErr {
            msg: format!("No game found with id {game_id}"),
        }),
    }
}

fn resign(deps: DepsMut, _env: Env, sender: Addr, game_id: u64) -> StdResult<Response> {
    let game_state = GAMES.get(deps.storage, &game_id);
    match game_state {
        Some(mut state) => {
            if state.status == GameStatus::Active {
                if state.white == Some(sender.clone()) {
                    state.status = GameStatus::WhiteResigned;
                } else if state.black == Some(sender.clone()) {
                    state.status = GameStatus::BlackResigned;
                }
                GAMES.insert(deps.storage, &game_id, &state)?;
                return Ok(Response::default());
            }
            return Err(StdError::GenericErr {
                msg: "Game is not active".to_string(),
            });
        }
        None => Err(StdError::GenericErr {
            msg: format!("No game found with id {game_id}"),
        }),
    }
}

#[entry_point]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetGame { game_id } => {
            return get_game_state(deps, env, game_id);
        }
        QueryMsg::ListGames {} => {
            return all_games(deps, env);
        }
    }
}

fn get_game_state(deps: Deps, _env: Env, game_id: u64) -> StdResult<Binary> {
    let game_state = GAMES.get(deps.storage, &game_id);

    match game_state {
        Some(state) => Ok(to_binary(&QueryAnswer::GameState(state))?),
        None => Err(StdError::GenericErr {
            msg: format!("No game found with id {game_id}"),
        }),
    }
}

fn all_games(deps: Deps, _env: Env) -> StdResult<Binary> {
    let games: Vec<GameState> = GAMES
        .iter(deps.storage)?
        .map(|game| {
            let (_game_id, game_state) = game?;
            Ok(game_state)
        })
        .collect::<StdResult<Vec<GameState>>>()?;

    Ok(to_binary(&QueryAnswer::AllGames(games))?)
}

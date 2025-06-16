use cosmwasm_std::{
    entry_point, to_binary, Binary, CanonicalAddr, Deps, DepsMut, Env, MessageInfo, Response,
    StdError, StdResult,
};

use crate::msg::{ExecuteMsg, InstantiateMsg, QueryMsg, QueryAnswer};
use crate::state::{GameStatus, GameState, GAMES, NEXT_GAME_ID};

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
    let sender_canonical = deps.api.addr_canonicalize(info.sender.as_str())?;
    match msg {
        ExecuteMsg::CreateGame{} => create_game(deps,env,sender_canonical),
        ExecuteMsg::JoinGame{game_id} => join_game(deps,env,sender_canonical,game_id),
        ExecuteMsg::MakeMove { game_id, move_str } => make_move(deps,env,sender_canonical,game_id,move_str),
        ExecuteMsg::Resign { game_id } => resign(deps,env,sender_canonical,game_id),
    }
}

fn create_game(deps: DepsMut, _env: Env, sender: CanonicalAddr) -> StdResult<Response> {
    let new_game_state: GameState = GameState {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".to_string(),
        white: sender,
        black: None,
        turn: 0,
        status: GameStatus::Pending,
    };


    let mut game_id = NEXT_GAME_ID.load(deps.storage)?;
    game_id += 1;
    GAMES.insert(deps.storage, &game_id, &new_game_state)?;
    NEXT_GAME_ID.save(deps.storage, &game_id)?;

    Ok(Response::new().add_attribute("game_id", game_id.to_string()))
}

fn join_game(deps: DepsMut, _env: Env, sender: CanonicalAddr, game_id: u64) -> StdResult<Response> {
    let game_state = GAMES.get(deps.storage, &game_id);
    match game_state {
        Some(mut state) => {
            state.black = Some(sender);
            state.status = GameStatus::Active;
            GAMES.insert(deps.storage, &game_id, &state)?;
            Ok(Response::default())
        },
        None => Err(StdError::GenericErr { msg: (format!("No game found with id {game_id}")) })
    }
}

fn make_move(deps: DepsMut, _env: Env, _sender: CanonicalAddr, game_id: u64, move_str: String) -> StdResult<Response> {
    let game_state = GAMES.get(deps.storage, &game_id);
    match game_state {
        Some(mut state) => {
            state.fen = move_str;
            state.turn += 1;
            // TODO: Check game status after this turn (i.e. maybe check/checkmate/stalemate)
            Ok(Response::default())
        },
        None => Err(StdError::GenericErr { msg: (format!("No game found with id {game_id}")) })
    }
}

fn resign(deps: DepsMut, _env: Env, _sender: CanonicalAddr, game_id: u64) -> StdResult<Response> {
    let game_state = GAMES.get(deps.storage, &game_id);
    match game_state {
        Some(mut state) => {
            if state.status == GameStatus::Active {
                state.status = GameStatus::Check;
                return Ok(Response::default())
            }
            return Err(StdError::GenericErr { msg: ("Game is not active").to_string() })
        },
        None => Err(StdError::GenericErr { msg: (format!("No game found with id {game_id}")) })
    }
}


#[entry_point]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetGame { game_id } => {
            return game_status(deps, env, game_id)
        },
        QueryMsg::ListGames {  } => {
            return all_games(deps, env)
        }
    }
}

fn game_status(deps: Deps, _env: Env, game_id: u64) -> StdResult<Binary> {
    let game_state = GAMES.get(deps.storage, &game_id);
    match game_state {
        Some(state) => {
            Ok(to_binary(&QueryAnswer::GameState(state))?)
        },
        None => Err(StdError::GenericErr { msg: (format!("No game found with id {game_id}")) })
    }
}

fn all_games(deps: Deps, _env: Env) -> StdResult<Binary> {
    let games: Vec<GameState> = GAMES.iter(deps.storage)?
    .map(|game| {
        let (_game_id, game_state) = game?;
        Ok(game_state)
    })
    .collect::<StdResult<Vec<GameState>>>()?;

    Ok(to_binary(&QueryAnswer::AllGames(games))?)
}

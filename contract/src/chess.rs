use std::str::FromStr;
use chess::{Board, BoardStatus, ChessMove, MoveGen, Piece, Square};

pub fn validate_move(
    fen: &str,
    move_from: &str,
    move_to: &str,
    promotion: Option<&str>,
) -> Result<(String, BoardStatus), &'static str> {
    let board = Board::from_str(fen).map_err(|_| "Invalid FEN")?; // Should never happen because of this validation

    let from = Square::from_str(move_from).map_err(|_| "Invalid from-square")?;
    let to = Square::from_str(move_to).map_err(|_| "Invalid to-square")?;

    let promo = match promotion {
        Some("q") | Some("Q") => Some(Piece::Queen),
        Some("r") | Some("R") => Some(Piece::Rook),
        Some("b") | Some("B") => Some(Piece::Bishop),
        Some("n") | Some("N") => Some(Piece::Knight),
        Some("") | None => None,
        Some(_) => return Err("Invalid promotion piece"),
    };

    let candidate_move = ChessMove::new(from, to, promo);

    let mut legal_moves = MoveGen::new_legal(&board);

    if legal_moves.any(|m| m == candidate_move) {
        // Apply the move and return new FEN
        let new_board = board.make_move_new(candidate_move);
        let board_status = new_board.status();
        Ok((new_board.to_string(), board_status))
    } else {
        Err("Illegal move")
    }
}

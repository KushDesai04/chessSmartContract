import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";
import "./ChessBoard.css";
import { useEffect, useState } from "react";

// Unicode symbols for pieces
const PIECE_UNICODE: Record<PieceSymbol | Uppercase<PieceSymbol>, string> = {
    p: "♟",
    r: "♜",
    n: "♞",
    b: "♝",
    q: "♛",
    k: "♚",
    P: "♙",
    R: "♖",
    N: "♘",
    B: "♗",
    Q: "♕",
    K: "♔",
};

type ChessBoardProps = {
    createdGameId: number; // Optional prop for created game ID
    getGameStatus: (gameId: number) => Promise<any>; // Optional prop for getting game status
    makeMove: (from: Square, to: Square, promotion: string | null) => void; // Function to make a move
};

interface MappedSquare {
    squareName: string; // e.g. 'e4'
    type: PieceSymbol | null;
    color: Color | null;
    highlight: boolean;
}

const ChessBoard = ({ createdGameId, getGameStatus, makeMove }: ChessBoardProps) => {

    const [board, setBoard] = useState<MappedSquare[][]>([]);
    const [chess, setChess] = useState<Chess>(new Chess());
    const [selectedSquare, setSelectedSquare] = useState<String | null>(null);
    const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"); // Initial FEN string
    const [promotionPiece, setPromotionPiece] = useState<PieceSymbol | null>(null);
    const [gameStatus, setGameStatus] = useState<number>(1); // 1: Pending, 2: Active, 3: Check, 4: Checkmate, 5: Stalemate
    const [message, setMessage] = useState<string>("");

    useEffect(() => {
        const fetchStatus = async () => {
            const gameState = await getStatus();
            console.warn("Fetched game status:", gameState.game_state.game_state);
            if (!gameState) {
                console.error("Error fetching game status:", gameState.rawLog);
                return;
            } else {
                const f = gameState.game_state.fen;
                setFen(f);
                const status = gameState.game_state.status;
                setGameStatus(status);
            }
        };
        fetchStatus();
        setInterval(() => {
            fetchStatus();
        }, 10000); // Fetch status every 10 seconds
    }, []);

    useEffect(() => {
        const newChess = new Chess(fen);
        setChess(newChess);
    }, [fen]);

    useEffect(() => {
        console.log("Chess instance updated, mapping board");
        mapBoard();
    }, [chess]);

    useEffect(() => {
        if (gameStatus === 1) { // Pending state
            setMessage("Game is still pending. Please wait for the opponent to join.");
            return;
        } else if (gameStatus === 2) { // Active state
            setMessage("");
        } else if (gameStatus === 3) { // Check state
            setMessage("Your king is in check! Please make a valid move to get out of check.");
            return;
        } else if (gameStatus === 4) { // Checkmate state
            setMessage("Checkmate! The game is over.");
            return;
        } else if (gameStatus === 5) { // Stalemate state
            setMessage("Stalemate! The game is over.");
            return;
        }
    }, [gameStatus]);

    const getStatus = async () => {
        if (getGameStatus && createdGameId) {
            const status = await getGameStatus(createdGameId);
            console.log("Game status fetched:", status);
            return status
        }
    };

    const mapBoard = () => {
        const newBoard: MappedSquare[][] = [];
        const chessBoard = chess.board();
        console.log("Mapping chess board:", chessBoard);
        // chess.board() returns rows from 8th rank to 1st rank
        chessBoard.forEach((row: any[], rowIndex: number) => {
            const rank = 8 - rowIndex;
            const boardRow: MappedSquare[] = [];

            row.forEach((piece: { type: any; color: any; }, colIndex: number) => {
                const file = String.fromCharCode(97 + colIndex); // a-h
                const squareName = `${file}${rank}` as Square;

                boardRow.push({
                    squareName,
                    type: piece?.type || null,
                    color: piece?.color || null,
                    highlight: false,
                });
            });

            newBoard.push(boardRow);
        });

        setBoard(newBoard);
        // console.log("Mapped board:", newBoard);
    };

    const highlightMoves = (square: String) => {
        const targetSquares = chess
            .moves({
                square: square as Square,
                verbose: true,
            })
            .map((move: { to: any; }) => move.to);

        // Create new board with highlights
        const newBoard = board.map((row) =>
            row.map((piece) => ({
                ...piece,
                highlight: targetSquares.includes(piece.squareName as Square),
            }))
        );

        if (square === selectedSquare) { // Deselect if the same square is clicked
            setSelectedSquare(null);
            newBoard.forEach((row) =>
                row.forEach((piece) => (piece.highlight = false))
            );
        } else if (board.some(row => row.some(piece => piece.squareName === square && piece.type))) { // Select if the square has a piece
            setSelectedSquare(square);
        } else { // If the square is empty, deselect
            setSelectedSquare(null);
        }

        setBoard(newBoard);
        console.log(`Highlighting moves from ${square}:`, targetSquares);
    }

    const handleSquareClick = (square: String) => {
        if (gameStatus !== 2) {return} // Game is not active, do nothing

        // Handle selection logic
        if (chess.moves({ square: selectedSquare as Square, verbose: true }).map((move: { to: any; }) => move.to).includes(square as Square)) {
            console.log(`Moving piece from ${selectedSquare} to ${square}`);
            makeMove(selectedSquare as Square, square as Square, promotionPiece);
            setSelectedSquare(null);
        } else {
            // Highlight Things
            highlightMoves(square);
        }
    };

    return (
        <>
        <h3>{message}</h3>
        <input type="button" value="Get Game Status" onClick={getStatus} />
        <div className="chessboard">
            {board?.map((row, rowIdx) =>
                row.map((piece, colIdx) => {
                    const square = String.fromCharCode(97 + colIdx) + (8 - rowIdx);
                    const isLight = (rowIdx + colIdx) % 2 === 1;
                    return (
                        <div
                            key={square}
                            className={`square ${isLight ? "light" : "dark"}${piece.highlight ? " highlight" : ""
                                }`}
                            onClick={() => handleSquareClick(square)}
                        >
                            {piece.type
                                ? PIECE_UNICODE[
                                piece.color === "w"
                                    ? (piece.type.toUpperCase() as Uppercase<PieceSymbol>)
                                    : piece.type
                                ]
                                : ""}
                        </div>
                    );
                })
            )}
        </div>
        </>
    );
};

export default ChessBoard;

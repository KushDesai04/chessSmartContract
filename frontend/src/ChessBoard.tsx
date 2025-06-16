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
};

interface MappedSquare {
    squareName: string; // e.g. 'e4'
    type: PieceSymbol | null;
    color: Color | null;
    highlight: boolean;
}

const ChessBoard = ({ createdGameId, getGameStatus }: ChessBoardProps) => {
    let chess = new Chess();

    const [board, setBoard] = useState<MappedSquare[][]>([]);
    const [selectedSquare, setSelectedSquare] = useState<String | null>(null);
    const [gameStatus, setGameStatus] = useState<string>("Pending");

    useEffect(() => {
        const fetchStatus = async () => {
            mapBoard();
            if (getGameStatus && createdGameId) {
                const status = await getGameStatus(createdGameId);
                console.log("Game status from prop:", status);
                if (typeof status === "string") {
                    setGameStatus(status);
                    console.log("Initial game status set:", status);
                } else {
                    console.log(typeof status)
                }
            }
        };
        fetchStatus();
    }, [gameStatus]);

    const getStatus = () => {
        if (getGameStatus && createdGameId) {
            const status = getGameStatus(createdGameId);
            console.log("Game status from prop:", status);
            if (typeof status === "string") {
                setGameStatus(status);
            }
        }
    };

    const mapBoard = () => {
        const newBoard: MappedSquare[][] = [];
        const chessBoard = chess.board();

        // chess.board() returns rows from 8th rank to 1st rank
        chessBoard.forEach((row, rowIndex) => {
            const rank = 8 - rowIndex;
            const boardRow: MappedSquare[] = [];

            row.forEach((piece, colIndex) => {
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
        console.log("Mapped board:", newBoard);
    };

    const highlightMoves = (square: String) => {
        const targetSquares = chess
            .moves({
                square: square as Square,
                verbose: true,
            })
            .map((move) => move.to);

        // Create new board with highlights
        const newBoard = board.map((row) =>
            row.map((piece) => ({
                ...piece,
                highlight: targetSquares.includes(piece.squareName as Square),
            }))
        );

        if (square === selectedSquare) { // Deselect if the same square is clicked
            console.log(`Deselecting: ${square}`);
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
        // Handle selection logic
        if (chess.moves({ square: selectedSquare as Square, verbose: true }).map((move) => move.to).includes(square as Square)) {
            console.log(`Moving piece from ${selectedSquare} to ${square}`);
        } else {
            // Highlight Things
            highlightMoves(square);
        }
    };

    return (
        <>
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

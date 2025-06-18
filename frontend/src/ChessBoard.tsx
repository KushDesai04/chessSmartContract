import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";
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
    createdGameId: number;
    getGameStatus: (gameId: number) => Promise<any>;
    makeMove: (from: Square, to: Square, promotion: string | null) => void;
    playerColor?: Color | null;
    resignFromGame: () => void;
};

// Type for the mapped chess square
interface MappedSquare {
    squareName: string;
    type: PieceSymbol | null;
    color: Color | null;
    highlight: boolean;
}


const ChessBoard = ({ createdGameId, getGameStatus, makeMove, playerColor, resignFromGame }: ChessBoardProps) => {
    const [board, setBoard] = useState<MappedSquare[][]>([]);
    const [chess, setChess] = useState<Chess>(new Chess());
    const [selectedSquare, setSelectedSquare] = useState<String | null>(null);
    const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    const [gameStatus, setGameStatus] = useState<number>(1);
    const [message, setMessage] = useState<string>("");
    const [promotionModalOpen, setPromotionModalOpen] = useState<boolean>(false);
    const [pendingMove, setPendingMove] = useState<{ from: Square; to: Square } | null>(null);

    // Fetch game status
    // Polls game state every second
    useEffect(() => {
        const fetchStatus = async () => {
            const gameState = await getStatus();
            console.warn("Fetched game status:", gameState);
            if (!gameState) {
                console.error("Error fetching game status:", gameState.rawLog);
                return;
            } else {
                const f = gameState.fen;
                setFen(f);
                const status = gameState.status;
                setGameStatus(status);
            }
        };
        fetchStatus();
        const interval = setInterval(() => {
            fetchStatus();
        }, 1000);

        return () => clearInterval(interval); // On component unmount, clear the interval
    }, []);

    // Update the board when the FEN changes (i.e. player makes a move and it is updated in the chain)
    useEffect(() => {
        const newChess = new Chess(fen);
        setChess(newChess);
    }, [fen]);

    // Update the board when the chess instance changes
    useEffect(() => {
        console.log("Chess instance updated, mapping board");
        mapBoard();
    }, [chess]);

    // Update the message based on game status
    useEffect(() => {
        console.log("Game status updated:", gameStatus);
        switch (gameStatus) {
            case 1:
                setMessage("Game is still pending. Please wait for the opponent to join.");
                break;
            case 2:
                setMessage("");
                break;
            case 3:
                setMessage("Stalemate! The game is over.");
                break;
            case 4:
                setMessage("Checkmate! White wins the game.");
                break;
            case 5:
                setMessage("Checkmate! Black wins the game.");
                break;
            case 6:
                setMessage("White has resigned. Black wins the game.");
                break;
            case 7:
                setMessage("Black has resigned. White wins the game.");
                break;
            default:
                setMessage("Unknown game status.");
        }
    }, [gameStatus]);

    /**
     * Fetches the current status of the game.
     * @returns The current game status.
     */
    const getStatus = async () => {
        if (getGameStatus && createdGameId) {
            const status = await getGameStatus(createdGameId);
            console.log("Game status fetched:", status);
            return status;
        }
    };

    /**
     *  Maps the chess board to a 2D array of MappedSquare objects.
     *  Each square contains its name, piece type, color, and highlight status.
     */
    const mapBoard = () => {
        const newBoard: MappedSquare[][] = [];
        const chessBoard = chess.board();
        console.log("Mapping chess board:", chessBoard);

        chessBoard.forEach((row: any[], rowIndex: number) => {
            const rank = 8 - rowIndex;
            const boardRow: MappedSquare[] = [];

            row.forEach((piece: { type: any; color: any; }, colIndex: number) => {
                const file = String.fromCharCode(97 + colIndex);
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
    };

    /**
     * Handles highlighting available moves for a selected piece.
     */
    const highlightMoves = (square: String) => {
        const targetSquares = chess
            .moves({
                square: square as Square,
                verbose: true,
            })
            .map((move: { to: any; }) => move.to);

        const newBoard = board.map((row) =>
            row.map((piece) => ({
                ...piece,
                highlight: targetSquares.includes(piece.squareName as Square),
            }))
        );

        if (square === selectedSquare) {
            setSelectedSquare(null);
            newBoard.forEach((row) =>
                row.forEach((piece) => (piece.highlight = false))
            );
        } else if (board.some(row => row.some(piece => piece.squareName === square && piece.type))) {
            setSelectedSquare(square);
        } else {
            setSelectedSquare(null);
        }

        setBoard(newBoard);
        console.log(`Highlighting moves from ${square}:`, targetSquares);
    }

    /**
     * Checks if a move is a promotion move.
     * @param from The starting position of the piece.
     * @param to The ending position of the piece.
     * @returns True if the move is a promotion move, false otherwise.
     */
    function isPromotionMove(from: String, to: String) {
        return chess.moves({ verbose: true })
            .some(move => move.from === from as Square &&
                move.to === to as Square &&
                move.isPromotion());
    }

    /**
     * Handles the logic for when a square is clicked.
     * @param square  The square that was clicked.
     */
    const handleSquareClick = (square: String) => {
        if (gameStatus !== 2) { return }

        const turn = chess.turn();
        if (playerColor && playerColor !== turn) { return }

        if (selectedSquare && chess.moves({ square: selectedSquare as Square, verbose: true }).map((move: { to: any; }) => move.to).includes(square as Square)) {
            console.log(`Moving piece from ${selectedSquare} to ${square}`);
            if (isPromotionMove(selectedSquare as String, square as String)) {
                // Store the pending move and open promotion modal
                setPendingMove({ from: selectedSquare as Square, to: square as Square });
                setPromotionModalOpen(true);
            } else {
                // Make regular move
                makeMove(selectedSquare as Square, square as Square, null);
                setSelectedSquare(null);
                // Clear highlights
                const newBoard = board.map((row) =>
                    row.map((piece) => ({ ...piece, highlight: false }))
                );
                setBoard(newBoard);
            }
        } else {
            highlightMoves(square);
        }
    };

    // Which colour to display the message in
    const getMessageColor = () => {
        switch (gameStatus) {
            case 1: return "text-yellow-300";
            case 2: return "text-green-300";
            case 3: return "text-red-300";
            case 4: return "text-orange-300";
            case 5: return "text-green-400";
            case 6: return "text-red-400";
            case 7: return "text-red-500";
            case 8: return "text-red-500";
            default: return "text-gray-300";
        }
    };

    // Get the status icon based on the game status
    const getStatusIcon = () => {
        switch (gameStatus) {
            case 1: return "⏳";
            case 2: return "♟️";
            case 3: return "⚠️";
            case 4: return "🤝";
            case 5: return "👑";
            case 6: return "👑";
            case 7: return "🏳️";
            case 8: return "🏳️";
            default: return "❓";
        }
    };

    // Logic for promoting a pawn
    const PromotionModal = () => {
        // Options to promote to
        const promotionPieces = [
            { piece: 'q', symbol: '♕', name: 'Queen' },
            { piece: 'r', symbol: '♖', name: 'Rook' },
            { piece: 'b', symbol: '♗', name: 'Bishop' },
            { piece: 'n', symbol: '♘', name: 'Knight' }
        ];

        // Handle promotion selection
        const handlePromotionSelect = (piece: string) => {
            if (pendingMove) {
                makeMove(pendingMove.from, pendingMove.to, piece);
                setPromotionModalOpen(false);
                setPendingMove(null);
                setSelectedSquare(null);
                // Clear highlights
                const newBoard = board.map((row) =>
                    row.map((square) => ({ ...square, highlight: false }))
                );
                setBoard(newBoard);
            }
        };

        // Handle canceling the promotion modal
        const handleCancel = () => {
            setPromotionModalOpen(false);
            setPendingMove(null);
            setSelectedSquare(null);
            // Clear highlights
            const newBoard = board.map((row) =>
                row.map((square) => ({ ...square, highlight: false }))
            );
            setBoard(newBoard);
        };

        if (!promotionModalOpen) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 shadow-2xl">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">
                        Choose Promotion Piece
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        {promotionPieces.map(({ piece, symbol, name }) => (
                            <button
                                key={piece}
                                onClick={() => handlePromotionSelect(piece)}
                                className="flex flex-col items-center p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
                            >
                                <span className="text-4xl mb-2 text-gray-800">
                                    {playerColor === 'w' ? symbol : symbol.toLowerCase()}
                                </span>
                                <span className="text-sm font-medium text-gray-700">
                                    {name}
                                </span>
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleCancel}
                        className="w-full mt-4 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors duration-200"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            <PromotionModal />
            <div className="w-full max-w-6xl mx-auto">
                {/* Game Status Message (Full Width) */}
                {message && (
                    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 mb-6">
                        <div className="flex items-center justify-center">
                            <span className="text-2xl mr-3">{getStatusIcon()}</span>
                            <p className={`text-center font-medium ${getMessageColor()}`}>
                                {message}
                            </p>
                        </div>
                    </div>
                )}

                {/* Main Game Layout */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    {/* Chess Board */}
                    <div className="flex-shrink-0">
                        <div className="relative">
                            {/* Board Container */}
                            <div className="bg-gradient-to-br from-amber-800 to-amber-900 p-6 rounded-2xl shadow-2xl border-4 border-amber-700">
                                {/* Rank Labels (Left) */}
                                <div className="absolute left-2 top-6 flex flex-col justify-between h-[calc(100%-3rem)] text-amber-200 text-lg font-bold">
                                    {[8, 7, 6, 5, 4, 3, 2, 1].map(rank => (
                                        <div key={rank} className="flex items-center h-16 md:h-20">
                                            {rank}
                                        </div>
                                    ))}
                                </div>

                                {/* File Labels (Bottom) */}
                                <div className="absolute bottom-2 left-6 flex justify-between w-[calc(100%-3rem)] text-amber-200 text-lg font-bold">
                                    {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(file => (
                                        <div key={file} className="flex justify-center w-16 md:w-20">
                                            {file}
                                        </div>
                                    ))}
                                </div>

                                {/* Board Grid */}
                                <div className="grid grid-cols-8 gap-1 bg-amber-900 p-3 rounded-lg">
                                    {board?.map((row, rowIdx) =>
                                        row.map((piece, colIdx) => {
                                            const square = String.fromCharCode(97 + colIdx) + (8 - rowIdx);
                                            const isLight = (rowIdx + colIdx) % 2 === 1;
                                            const isSelected = selectedSquare === square;
                                            return (
                                                <div
                                                    key={square}
                                                    className={`
                                                    w-12 h-12 md:w-16 md:h-16
                                                    flex items-center justify-center
                                                    cursor-pointer
                                                    transition-all duration-200
                                                    relative
                                                    ${isLight
                                                            ? 'bg-amber-100 hover:bg-amber-200'
                                                            : 'bg-amber-600 hover:bg-amber-700'
                                                        }
                                                    ${isSelected
                                                            ? 'ring-4 ring-blue-400 ring-opacity-70'
                                                            : ''
                                                        }
                                                    ${piece.highlight
                                                            ? 'ring-2 ring-green-400 ring-opacity-50 bg-green-200'
                                                            : ''
                                                        }
                                                    ${chess.isCheck() && chess.turn() === piece.color && piece.type == "k"
                                                            ? 'bg-red-200 ring-2 ring-red-400 ring-opacity-50'
                                                            : ''
                                                        }
                                                `}
                                                    onClick={() => handleSquareClick(square)}
                                                >
                                                    {/* Piece */}
                                                    {piece.type && (
                                                        <span className={`
                                                        text-4xl md:text-5xl
                                                        leading-none
                                                        flex items-center justify-center
                                                        ${piece.color === 'w'
                                                                ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]'
                                                                : 'text-gray-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]'
                                                            }
                                                        hover:scale-110 transition-transform duration-150
                                                        select-none
                                                    `}>
                                                            {PIECE_UNICODE[
                                                                piece.color === "w"
                                                                    ? (piece.type.toUpperCase() as Uppercase<PieceSymbol>)
                                                                    : piece.type
                                                            ]}
                                                        </span>
                                                    )}

                                                    {/* Highlight Dot for Valid Moves */}
                                                    {piece.highlight && !piece.type && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="w-4 h-4 bg-green-500 rounded-full opacity-70"></div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Game Information Panel */}
                    <div className="flex-1 lg:max-w-sm space-y-4">
                        {gameStatus === 2 && (<>
                            {/* Current Turn */}
                            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4">
                                <h3 className="text-white font-semibold text-lg mb-3 flex items-center">
                                    <span className="text-2xl mr-2">⏰</span>
                                    Current Turn
                                </h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-white/80">Playing:</span>
                                    <div className="flex items-center">
                                        <div className={`w-4 h-4 rounded-full mr-2 ${chess.turn() === 'w' ? 'bg-white' : 'bg-gray-800'}`}></div>
                                        <span className="text-white font-semibold text-lg">
                                            {chess.turn() === 'w' ? 'White' : 'Black'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>)}


                        {/* Your Color */}
                        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4">
                            <h3 className="text-white font-semibold text-lg mb-3 flex items-center">
                                <span className="text-2xl mr-2">👤</span>
                                Your Color
                            </h3>
                            <div className="flex items-center justify-between">
                                <span className="text-white/80">You are:</span>
                                <div className="flex items-center">
                                    {playerColor && (
                                        <div className={`w-4 h-4 rounded-full mr-2 ${playerColor === 'w' ? 'bg-white' : 'bg-gray-800'}`}></div>
                                    )}
                                    <span className="text-white font-semibold text-lg">
                                        {playerColor === 'w' ? 'White' : playerColor === 'b' ? 'Black' : 'Observer'}
                                    </span>
                                </div>
                            </div>
                            {playerColor && chess.turn() === playerColor && gameStatus === 2 && (
                                <div className="mt-2 text-green-300 text-sm font-medium">
                                    ✨ It's your turn!
                                </div>
                            )}
                        </div>

                        {/* Game Status */}
                        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4">
                            <h3 className="text-white font-semibold text-lg mb-3 flex items-center">
                                <span className="text-2xl mr-2">📊</span>
                                Game Status
                            </h3>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-white/80">Status:</span>
                                    <div className="flex items-center">
                                        <span className="mr-2">{getStatusIcon()}</span>
                                        <span className={`font-medium ${getMessageColor()}`}>
                                            {gameStatus === 1 ? 'Pending' :
                                                gameStatus === 2 ? 'Active' :
                                                    gameStatus === 3 ? 'Stalemate' :
                                                        gameStatus === 4 ? 'White Wins' :
                                                            gameStatus === 5 ? 'Black Wins' :
                                                                gameStatus === 6 ? 'White Resigned' :
                                                                    gameStatus === 7 ? 'Black Resigned' : "Unknown"}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-white/80">Game ID:</span>
                                    <span className="text-white font-mono text-sm bg-white/10 px-2 py-1 rounded">
                                        {createdGameId}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {gameStatus == 2 && (
                            <>
                                {/* Game Controls */}
                                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4">
                                    <h3 className="text-white font-semibold text-lg mb-3 flex items-center">
                                        <span className="text-2xl mr-2">🎮</span>
                                        Game Controls
                                    </h3>
                                    <div className="space-y-3">
                                        <button
                                            className="w-full bg-red-500/20 hover:bg-red-600 text-red-200 border border-red-400/30 px-4 py-2 rounded-lg transition-all duration-200"
                                            onClick={resignFromGame}
                                        >
                                            🏳️ Resign
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                    </div>
                </div>
            </div>
        </>
    );
};

export default ChessBoard;
import { useContext, useState, useEffect } from "react";
import ChessBoard from "./ChessBoard";
import { type Color } from "chess.js";
import { SecretJsFunctions, type GameState } from "./secretjs/SecretJsFunctions";
import { SecretJsContext } from "./secretjs/SecretJsContext";
import { getStatusHuman } from "./ChessBoard"

const ChessGame = () => {
  const [game, setGame] = useState<GameState | null>(null);
  const [joinGameId, setJoinGameId] = useState<string>("");
  const [createdGameId, setCreatedGameId] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<Color | null>(null);
  const [allGames, setAllGames] = useState<GameState[]>([]);
  const [wager, setWager] = useState<bigint>(0n);
  const [confirmJoinModalOpen, setConfirmJoinModalOpen] = useState<boolean>(false);
  const [pendingGameJoin, setPendingGameJoin] = useState<{ gameId: number, color: string } | null>(null);
  const { connectWallet, secretAddress } = useContext(SecretJsContext)!;
  const { createGame, joinGame, getGame, listGames, makeMove, resignGame } = SecretJsFunctions();

  /**
   *  Handles wallet connection and initializes the game state.
   *  If the wallet is not connected, it prompts the user to connect.
   */
  const handleCreateGame = async () => {
    setError(null);
    const txResponse = await createGame(wager);
    console.log("Game created:", txResponse);
    // Get the last element in the arrayLog array (if it exists)
    const gameId = txResponse.arrayLog?.find(log => log.key === "game_id")?.value as unknown as number;
    if (gameId) {
      setCreatedGameId(gameId);
    }
    console.log("Game ID:", gameId);
  };

  /**
   * Handles joining an existing game with confirmation for new players.
   */
  const handleJoinGame = async (gameId: number, isNewPlayer: boolean = false, isNewPlayerConfirmed?: boolean, color?: string) => {
    setError(null);
    let gameWager = 0n; // Default wager for spectators and rejoining players

    // If this is a new player join (not spectate or rejoin), show confirmation
    if (isNewPlayer && !isNewPlayerConfirmed) {
      setPendingGameJoin({ gameId, color: color || 'unknown' });
      // Get the wager amount from the game for new players
      const gameData = await getGame(gameId);
      gameWager = gameData.wager;
      setWager(gameWager);
      setConfirmJoinModalOpen(true);
      return;
    } else if (isNewPlayer && isNewPlayerConfirmed) {
      // If this is a confirmed new player join, use the game's wager
      const gameData = await getGame(gameId);
      gameWager = gameData.wager;
    }

    // Proceed with joining the game using the correct wager amount
    console.log("Joining game with ID:", gameId, "with wager:", gameWager.toString());
    const txResponse = await joinGame(gameId, gameWager);
    if (txResponse.code !== 0) {
      console.error("Error joining game:", txResponse.rawLog);
      if (txResponse.rawLog.includes("No game found")) {
        setError(`No game found with ID ${gameId}. Please check the ID and try again.`);
      }
      return;
    }
    setCreatedGameId(gameId);
  };

  /**
   * Confirms the pending game join
   */
  const confirmJoinGame = async () => {
    setConfirmJoinModalOpen(false);
    if (pendingGameJoin) {
      await handleJoinGame(pendingGameJoin.gameId, true, true);
      setPendingGameJoin(null);
    }
  };

  /**
   * Cancels the pending game join
   */
  const cancelJoinGame = () => {
    setPendingGameJoin(null);
    setConfirmJoinModalOpen(false);
  };

  /**
   * Fetches the current status of a game.
   * @param gameId The ID of the game to fetch.
   * @returns The current game status.
   */
  const getGameStatus = async (gameId: number) => {
    try {
      setError(null);
      const response = await getGame(gameId);
      console.log("Game status:", response);
      return response;
    } catch (error) {
      setError("Error fetching game status: " + error);
    }
  };

  /**
   * Lists all games available.
   *  @returns {Promise<GameState[]>} A promise that resolves to an array of game states.
   */
  const listAllGames = async () => {
    try {
      const games = await listGames();
      console.log("All games:", games);
      setAllGames(games);
      console.log("updates: " + allGames);
    } catch (error) {
      setError("Error fetching all games: " + error);
    }
  }

  const allGamesList = () => {
    const getButtonConfig = (game: GameState) => {
      // If user is already in the game
      if (game.white === secretAddress) {
        return { text: "Rejoin as White", show: true, color: "white", isNewPlayer: false };
      }
      if (game.black === secretAddress) {
        return { text: "Rejoin as Black", show: true, color: "black", isNewPlayer: false };
      }

      // If game is active and user is not in it
      if (game.status === 2) {
        return { text: "Spectate", show: true, isNewPlayer: false };
      }

      // If game is waiting for players
      if (game.status === 1) {
        if (game.white !== null) {
          return { text: "Join as Black", show: true, color: "black", isNewPlayer: true };
        } else {
          return { text: "Join as White", show: true, color: "white", isNewPlayer: true };
        }
      }

      // No button should be shown
      return { show: false };
    };

    return allGames.map((game) => {
      const buttonConfig = getButtonConfig(game);

      return (
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-2xl p-4 mb-4" key={game.id}>
          <p className="text-sm text-gray-400">Status: {getStatusHuman(game.status)}</p>
          <p className="text-sm text-gray-400">Game ID: {game.id}</p>

          {buttonConfig.show && (
            <button
              className={`mt-2 px-4 py-2 rounded-lg ${buttonConfig.color ? `bg-${buttonConfig.color}` : "bg-blue-500"} ${buttonConfig.color === "white" ? "text-black" : "text-white"}`}
              onClick={() => {
                handleJoinGame(game.id, buttonConfig.isNewPlayer, false, buttonConfig.color);
              }}
            >
              {buttonConfig.text}
            </button>
          )}
        </div>
      );
    });
  };


  /**
   *  Sets the player's color based on the game state.
   *  It checks the game state to determine if the player is black or white.
   */
  const setPlayerColorFromState = async () => {
    const gameState = await getGame(createdGameId);
    if (gameState) {
      console.log("Game state from main:", gameState);
      console.log("Secret address:", secretAddress);
      if (gameState.black === secretAddress) {
        setPlayerColor("b");
        console.log("Player is black");
      } else if (gameState.white === secretAddress) {
        setPlayerColor("w");
        console.log("Player is white");
      }
    } else {
      console.error("Game state is null or undefined");
      setError("Failed to retrieve game state. Please try again later.");
    }
    setGame(gameState);
  }

  /**
   * Makes a chess move.
   * @param from The starting position of the piece.
   * @param to The ending position of the piece.
   * @param promotion The promotion piece (if any).
   * @returns The transaction response.
   */
  const makeChessMove = async (from: string, to: string, promotion: string | null) => {
    try {
      setError(null);
      console.log("Making move from main:", from, "to:", to, "promotion:", promotion);
      const txResponse = await makeMove(createdGameId, from, to, promotion);
      console.log("Move made:", txResponse);
      return txResponse;
    } catch (error) {
      setError("Error making move: " + error);
    }
  };

  /**
   * Resigns from the current game.
   * @returns The transaction response.
   */
  const resignFromGame = async () => {
    try {
      setError(null);
      const response = await resignGame(createdGameId);
      console.log(`${playerColor} has resigned`)
      return response
    } catch (error) {
      setError("Error resigning: " + error);
    }
  }

  useEffect(() => {
    if (createdGameId !== -1) {
      setPlayerColorFromState();
    }
  }, [createdGameId]);

  useEffect(() => {
    if (secretAddress) {
      listAllGames();
    }
    const interval = setInterval(() => {
      if (secretAddress) {
        listAllGames();
      }
    }, 5000); // Fetch all games every 5 seconds

    return () => clearInterval(interval);
  }, [secretAddress]);

  return (


    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-2xl p-8 w-full max-w-6xl">
        {/* Confirmation Modal */}
        {confirmJoinModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-2xl p-6 max-w-md mx-4">
              <h3 className="text-xl font-bold text-white mb-4">Confirm Join Game</h3>
              <p className="text-white/80 mb-6">
                Are you sure you want to join this game as {pendingGameJoin?.color}?
                {wager > 0n && (
                  <span className="block mt-2 text-yellow-300">
                    Wager: {wager.toString()} uSCRT
                  </span>
                )}
              </p>
              <div className="flex space-x-4">
                <button
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-all duration-200"
                  onClick={confirmJoinGame}
                >
                  Yes, Join Game
                </button>
                <button
                  className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold px-4 py-2 rounded-lg transition-all duration-200"
                  onClick={cancelJoinGame}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">♟️ Chess Game</h1>
          <div className="w-16 h-1 bg-gradient-to-r from-purple-400 to-pink-400 mx-auto rounded-full"></div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-400/50 text-red-200 px-4 py-3 rounded-lg mb-6 backdrop-blur-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* Game View */}
        {game ? (
          <>
          {/* Back Button */}
          <div className="text-center mb-4">
            <button
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
              onClick={() => {
                setGame(null);
                setCreatedGameId(-1);
                setPlayerColor(null);
              }}
            >
              Back to Game List
            </button>
          </div>
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                <span className="text-white/80 text-sm">Game ID:</span>
                <span className="text-white font-mono font-semibold ml-2">{createdGameId}</span>
              </div>
            </div>
            <ChessBoard
              createdGameId={createdGameId}
              getGameStatus={getGameStatus}
              makeMove={makeChessMove}
              playerColor={playerColor}
              resignFromGame={resignFromGame}
            />
          </div>
          </>
        ) : (
          <div className="space-y-6">
            {/* Wallet Connection Status */}
            <div className="text-center">
              {secretAddress ? (
                <div className="bg-green-500/20 border border-green-400/50 rounded-lg p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-center">
                    <div className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-green-200 font-medium">Wallet   Connected</span>
                  </div>
                  <p className="text-green-300/80 text-sm mt-1 font-mono truncate">{secretAddress}</p>
                </div>
              ) : (
                <div className="bg-white/10 border border-white/20 rounded-lg p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-3 h-3 bg-orange-400 rounded-full mr-2"></div>
                    <span className="text-white/80">Wallet Not Connected</span>
                  </div>
                  <p className="text-white/60 text-sm mb-4">Connect your wallet to create a game</p>
                  <button
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                    onClick={connectWallet}
                  >
                    Connect Wallet
                  </button>
                </div>
              )}
            </div>

            {secretAddress && (
              <>
                {/* Game Actions */}
                <div className="space-y-4">
                  {/* Create Game */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
                    <h3 className="text-white font-semibold mb-3 flex items-center">
                      <span className="text-2xl mr-2">🎮</span>
                      Create New Game
                    </h3>
                    <input
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm my-2"
                      type="number"
                      placeholder="Wager (uSCRT)"
                      onChange={(e) => setWager(BigInt(e.target.value))}
                    />
                    <button
                      className={`w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg ${wager <= 0n ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={handleCreateGame}
                      disabled={wager <= 0n}
                    >
                      Create Game
                    </button>
                  </div>

                  {/* Join Game */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
                    <h3 className="text-white font-semibold mb-3 flex items-center">
                      <span className="text-2xl mr-2">🔗</span>
                      Join Existing Game
                    </h3>
                    <div className="space-y-3">
                      <input
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm"
                        type="text"
                        placeholder="Enter Game ID"
                        value={joinGameId}
                        onChange={(e) => setJoinGameId(e.target.value)}
                      />
                      <button
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                        onClick={() => handleJoinGame(parseInt(joinGameId, 10))}
                      >
                        Join Game
                      </button>
                    </div>
                  </div>
                  {/* All Games List */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
                    <h3 className="text-white font-semibold mb-3 flex items-center">
                      <span className="text-2xl mr-2">📂</span>
                      All Games
                    </h3>
                    {allGames.length > 0 ? (
                      <div className="space-y-4">
                        {allGamesList()}
                      </div>
                    ) : (
                      <p className="text-white/60 text-sm">No games available.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChessGame;

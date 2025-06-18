import { useContext, useState, useEffect } from "react";
import ChessBoard from "./ChessBoard";
import { type Color } from "chess.js";
import { SecretJsFunctions, type GameState } from "./secretjs/SecretJsFunctions";
import { SecretJsContext } from "./secretjs/SecretJsContext";

const ChessGame = () => {
  const [game, setGame] = useState<GameState | null>(null);
  const [joinGameId, setJoinGameId] = useState<string>("");
  const [createdGameId, setCreatedGameId] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<Color | null>(null);
  const { connectWallet, secretAddress } = useContext(SecretJsContext)!;
  const { createGame, joinGame, getGame, listGames, makeMove, resignGame } = SecretJsFunctions();



  const handleCreateGame = async () => {
    setError(null);
    const txResponse = await createGame();
    console.log("Game created:", txResponse);
    let gameId = txResponse.arrayLog?.[6].value as unknown as number; // Assuming the game ID is in the 7th log entry
    if (gameId) {
      setCreatedGameId(gameId);
    }
    console.log("Game ID:", gameId);
  };

  const handleJoinGame = async () => {
    setError(null);
    const gameId = parseInt(joinGameId, 10);
    const txResponse = await joinGame(gameId);
    if (txResponse.code !== 0) {
      console.error("Error joining game:", txResponse.rawLog);
      if (txResponse.rawLog.includes("No game found")) {
        setError(`No game found with ID ${gameId}. Please check the ID and try again.`);
      }
      return;
    }
    setCreatedGameId(parseInt(joinGameId, 10));
  };

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

  const listAllGames = async () => {
    try {
      const games = await listGames();
      console.log("All games:", games);
      return games;
    } catch (error) {
      setError("Error fetching all games: " + error);
      return [];
    }
  }

  useEffect(() => {
    if (createdGameId !== -1) {
      setPlayerColorFromState();
    }
  }, [createdGameId]);

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

  const resignFromGame = async () => {
    try {
      setError(null);
      const response = await resignGame(createdGameId);
      console.log(`${playerColor} has resigned`)
      return response
    } catch (error) {
      setError("Error resiging: " + error);
    }

  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-2xl p-8 w-full max-w-6xl">
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
        ) : (
          <div className="space-y-6">
            {/* Wallet Connection Status */}
            <div className="text-center">
              {secretAddress ? (
                <div className="bg-green-500/20 border border-green-400/50 rounded-lg p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-center">
                    <div className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-green-200 font-medium">Connected</span>
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

            {secretAddress && (<>
              {/* Game Actions */}
              <div className="space-y-4">
                {/* Create Game */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <h3 className="text-white font-semibold mb-3 flex items-center">
                    <span className="text-2xl mr-2">🎮</span>
                    Create New Game
                  </h3>
                  <button
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                    onClick={handleCreateGame}
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
                      onClick={handleJoinGame}
                    >
                      Join Game
                    </button>
                  </div>
                </div>

                {/* Browse Games */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm">
                  <h3 className="text-white font-semibold mb-3 flex items-center">
                    <span className="text-2xl mr-2">📋</span>
                    Browse Games
                  </h3>
                  <button
                    className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                    onClick={listAllGames}
                  >
                    View All Games
                  </button>
                </div>
              </div>

              {/* Game Status */}
              <div className="text-center">
                <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                  <span className="text-white/80 text-sm">
                    Status: {game ? "Game Created" : "Ready to play"}
                  </span>
                </div>
              </div>
            </>)}

          </div>
        )}
      </div>
    </div>
  );
};

export default ChessGame;

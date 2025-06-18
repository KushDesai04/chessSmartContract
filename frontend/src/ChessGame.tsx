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
  const { createGame, joinGame, getGame, listGames, makeMove } = SecretJsFunctions();



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

  return (
    <>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {game ? (
                <div>
                  <h2> Game ID: {createdGameId} </h2>
                  <ChessBoard createdGameId={createdGameId} getGameStatus={getGameStatus} makeMove={makeChessMove} playerColor={playerColor} />
                </div>
              ) : (
                <div>
                  {secretAddress ? <p>Connected as: {secretAddress}</p> :
                    <>
                      <p>Connect your wallet to create a game.</p>
                      <button onClick={connectWallet}>Connect Wallet</button>
                    </>
                  }

          <button onClick={handleCreateGame}>Create Game</button>
          <p>Game Status: {game ? "Game Created" : "No game created yet"}</p>

          <input
            type="text"
            placeholder="Enter Game ID to join"
            value={joinGameId}
            onChange={(e) => setJoinGameId(e.target.value)} />
          <button onClick={handleJoinGame}>Join Game</button>
          <button onClick={() => listAllGames()}>See games</button>
        </div>

      )}
    </>
  );
};

export default ChessGame;

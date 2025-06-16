import { useContext, useState } from "react";
import ChessBoard from "./ChessBoard";
import { SecretJsFunctions } from "./secretjs/SecretJsFunctions";
import { SecretJsContext } from "./secretjs/SecretJsContext";
import type { TxResponse } from "secretjs";

const ChessGame = () => {
  const [game, setGame] = useState<TxResponse | null>(null);
  const [joinGameId, setJoinGameId] = useState<string>("");
  const [createdGameId, setCreatedGameId] = useState<number>(-1);
  const { connectWallet, secretAddress } = useContext(SecretJsContext)!;
  const { createGame, joinGame, getGame, listGames } = SecretJsFunctions();



  const handleCreateGame = async () => {
    const txResponse = await createGame();
    setGame(txResponse);
    console.log("Game created:", txResponse);
    let gameId = txResponse.arrayLog?.[6].value as unknown as number; // Assuming the game ID is in the 7th log entry
    if (gameId) {
      setCreatedGameId(gameId);
    }
    console.log("Game ID:", gameId);
  };

  const handleJoinGame = async () => {
    const gameId = parseInt(joinGameId, 10);
    const txResponse = await joinGame(gameId);
    console.log("Game joined:", txResponse);
  };

  const getGameStatus = async (gameId: number) => {
    try {
      const response = await getGame(gameId);
      console.log("Game status:", response);
      return response;
    } catch (error) {
      console.error("Error fetching game status:", error);
    }
  };

  const listAllGames = async () => {
    try {
      const games = await listGames();
      console.log("All games:", games);
      return games;
    } catch (error) {
      console.error("Error fetching all games:", error);
      return [];
    }
  }

  return (
    <>
      {game ? (
        <div>
          <ChessBoard createdGameId={createdGameId} getGameStatus={getGameStatus} />
        </div>
      ) : (
        <div>
          <p>Connect your wallet to create a game.</p>
          <button onClick={connectWallet}>Connect Wallet</button>
          {secretAddress && <p>Connected as: {secretAddress}</p>}

          <button onClick={handleCreateGame}>Create Game</button>
          <p>Game Status: {game ? "Game Created" : "No game created yet"}</p>

          <input
            type="text"
            placeholder="Enter Game ID to join"
            value={joinGameId}
            onChange={(e) => setJoinGameId(e.target.value)}/>
          <button onClick={handleJoinGame}>Join Game</button>
          <button onClick={() => listAllGames()}>See games</button>
        </div>

      )}
    </>
  );
};

export default ChessGame;

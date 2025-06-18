import { useContext } from "react";
import { SecretJsContext } from "./SecretJsContext";
import { QueryError, WalletError } from "./SecretJsError";
import type { TxResponse } from "secretjs";

const contractCodeHash = import.meta.env.VITE_CONTRACT_CODE_HASH;
const contractAddress = import.meta.env.VITE_CONTRACT_ADDR;

type GameState = {
    fen: string;
    turn: number;
    white?: string;
    black?: string;
    status: number;
};

const SecretJsFunctions = () => {
    const context = useContext(SecretJsContext);

    if (!context) {
        throw new Error("SecretJsFunctions must be used within a SecretJsContextProvider");
    }

    const { secretJs, secretAddress } = context;

    const createGame = async (): Promise<TxResponse> => {
        if (!secretJs || !secretAddress) throw new WalletError("no wallet connected");

        const msg = {
            sender: secretAddress,
            contract_address: contractAddress,
            code_hash: contractCodeHash,
            msg: {
                create_game: {}
            }
        };

        const tx = await secretJs.tx.compute.executeContract(msg, { gasLimit: 50_000 });
        console.log(tx);
        return tx;
    };

    const joinGame = async (gameId: number): Promise<TxResponse> => {
        if (!secretJs || !secretAddress) throw new WalletError("no wallet connected");

        const msg = {
            sender: secretAddress,
            contract_address: contractAddress,
            code_hash: contractCodeHash,
            msg: {
                join_game: { game_id: gameId }
            }
        };

        const tx = await secretJs.tx.compute.executeContract(msg, { gasLimit: 50_000 });
        console.log(tx);
        return tx;
    };

    const makeMove = async (gameId: number, from: string, to: string, promotion: string | null): Promise<TxResponse> => {
        if (!secretJs || !secretAddress) throw new WalletError("no wallet connected");
        const game_id = parseInt(gameId.toString(), 10);
        const msg = {
            sender: secretAddress,
            contract_address: contractAddress,
            code_hash: contractCodeHash,
            msg: {
                make_move: { game_id: game_id, move_from: from, move_to: to, promotion: promotion }
            }
        };

        const tx = await secretJs.tx.compute.executeContract(msg, { gasLimit: 50_000 });
        console.log(tx);
        return tx;
    }


    const getGame = async (gameId: number): Promise<GameState> => {
        if (!secretJs || !secretAddress) throw new WalletError("no wallet connected");
        const game_id = parseInt(gameId.toString(), 10);
        const msg = {
            contract_address: contractAddress,
            code_hash: contractCodeHash,
            query: {
                get_game: { game_id: game_id }
            }
        };

        try {
            const response = await secretJs.query.compute.queryContract(msg);
            console.log(response);
            // @ts-ignore
            return response.game_state as GameState;
        } catch (error) {
            throw new QueryError("Failed to fetch game status: " + error);
        }
    }

    const listGames = async (): Promise<GameState[]> => {
        if (!secretJs || !secretAddress) throw new WalletError("no wallet connected");
        const msg = {
            contract_address: contractAddress,
            code_hash: contractCodeHash,
            query: {
                list_games: {}
            }
        };

        try {
            const response = await secretJs.query.compute.queryContract(msg);
            console.log(response);
            return response as GameState[];
        } catch (error) {
            throw new QueryError("Failed to fetch game list: " + error);
        }
    }

    const resignGame = async (gameId: number): Promise<TxResponse> => {
        if (!secretJs || !secretAddress) throw new WalletError("no wallet connected");
        const game_id = parseInt(gameId.toString(), 10);
        const msg = {
            sender: secretAddress,
            contract_address: contractAddress,
            code_hash: contractCodeHash,
            msg: {
                resign: { game_id: game_id }
            }
        };
        const tx = await secretJs.tx.compute.executeContract(msg, { gasLimit: 50_000 });
        console.log(tx);
        return tx;
    };

    return {
        createGame,
        joinGame,
        getGame,
        listGames,
        makeMove,
        resignGame,
    };
};

export { SecretJsFunctions };
export type { GameState };

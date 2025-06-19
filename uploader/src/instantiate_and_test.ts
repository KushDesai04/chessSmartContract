import { SecretNetworkClient, Wallet, } from "secretjs";
import * as dotenv from "dotenv";

dotenv.config();  // Load environment variables from .env file 
const mnemonic = process.env.MNEMONIC;  // Retrieve the mnemonic

const wallet = new Wallet(mnemonic);
const CHAIN_ID = "pulsar-3";
const DENOM = "uscrt";

// create a new client for the Pulsar testnet
const admin = new SecretNetworkClient({
  chainId: CHAIN_ID,
  url: "https://pulsar.lcd.secretnodes.com",
  wallet,
  walletAddress: wallet.address,
});

const instantiateContract = async (codeId: string, contractCodeHash: string): Promise<string> => {
    // Chess contract instantiate message is empty
    const initMsg = {};
    let tx = await admin.tx.compute.instantiateContract(
        {
            code_id: codeId,
            sender: wallet.address,
            code_hash: contractCodeHash,
            init_msg: initMsg,
            label: "chess contract" + Math.ceil(Math.random() * 10000000),
        },
        {
            gasLimit: 400_000,
        }
    );
    
    //Find the contract_address in the logs
    //@ts-ignore
    const contractAddress = tx.arrayLog!.find((log) => log.type === "message" && log.key === "contract_address").value;
    
    return contractAddress;
};


export const main = async (): Promise<void> => {
    if (process.argv.length !== 4) {
        console.error('Expected two arguments!');
        process.exit(1);
    }

    let code_id = process.argv[2];
    let code_hash = process.argv[3];

    const contract_address = await instantiateContract(code_id, code_hash);
    
    console.log("Contract address: ", contract_address);

    console.log("Querying initial games list (should be empty)");
    let games_result = await admin.query.compute.queryContract({
        contract_address,
        code_hash,
        query: {
            list_games: { }
        }
    });
    console.log("Initial games:", games_result);

    // Create 2 player wallets for testing
    const player1 = new Wallet();
    const player2 = new Wallet();
    const spectator = new Wallet();

    // Create secret client objects for each player
    const player1Client = new SecretNetworkClient({
        chainId: CHAIN_ID,
        url: "https://pulsar.lcd.secretnodes.com",
        wallet: player1,
        walletAddress: player1.address,
    });

    const player2Client = new SecretNetworkClient({
        chainId: CHAIN_ID,
        url: "https://pulsar.lcd.secretnodes.com",
        wallet: player2,
        walletAddress: player2.address,
    });

    const spectatorClient = new SecretNetworkClient({
        chainId: CHAIN_ID,
        url: "https://pulsar.lcd.secretnodes.com",
        wallet: spectator,
        walletAddress: spectator.address,
    });

    // Send SCRT to player accounts
    const recipients = [player1.address, player2.address, spectator.address];
    const gasPerPlayer = 1_000_000; // 1 SCRT each
    const totalAmount = (gasPerPlayer * recipients.length).toString();

    const input = {
        address: wallet.address,
        coins: [{ denom: "uscrt", amount: totalAmount }],
    };
    const outputs = recipients.map((address) => ({
        address,
        coins: [{ denom: "uscrt", amount: gasPerPlayer.toString() }],
    }));

    const bankTx = await admin.tx.bank.multiSend(
        {
            inputs: [input],
            outputs,
        },
        {
            gasLimit: 80_000,
        }
    );
    
    if (bankTx.code === 0) {
        console.log("✅ Batch send successful!");
        recipients.forEach((addr, i) => {
          console.log(`→ Sent 1 SCRT to ${addr} (${i === 0 ? 'Player 1' : i === 1 ? 'Player 2' : 'Spectator'})`);
        });
    } else {
        console.error("❌ Batch send failed:", bankTx.rawLog);
    }

    // Test 1: Player 1 creates a game with 100,000 uscrt wager (0.1 SCRT)
    console.log("\n=== Test 1: Creating a game ===");
    const wagerAmount = "100000"; // 0.1 SCRT
    const createGameTx = await player1Client.tx.compute.executeContract(
        {
            sender: player1.address,
            contract_address,
            code_hash,
            msg: { create_game: {} },
            sent_funds: [{
                denom: "uscrt",
                amount: wagerAmount,
            }], 
        },
        {
            gasLimit: 100_000,
        },
    );

    if (createGameTx.code === 0) {
        console.log("✅ Game created successfully!");
        //@ts-ignore
        const gameId = createGameTx.arrayLog?.find(log => log.key === "game_id")?.value;
        console.log("Game ID:", gameId);

        // Query the created game
        const gameQuery = await admin.query.compute.queryContract({
            contract_address,
            code_hash,
            query: {
                get_game: { game_id: parseInt(gameId) }
            }
        });
        console.log("Created game state:", gameQuery);
    } else {
        console.error("❌ Game creation failed:", createGameTx.rawLog);
    }

    // Test 2: Player 2 joins the game
    console.log("\n=== Test 2: Player 2 joins the game ===");
    const joinGameTx = await player2Client.tx.compute.executeContract(
        {
            sender: player2.address,
            contract_address,
            code_hash,
            msg: { join_game: { game_id: 1 } },
            sent_funds: [{
                denom: "uscrt",
                amount: wagerAmount, // Must match the original wager
            }],
        },
        {
            gasLimit: 100_000,
        },
    );

    if (joinGameTx.code === 0) {
        console.log("✅ Player 2 joined successfully!");
    } else {
        console.error("❌ Join game failed:", joinGameTx.rawLog);
    }

    // Query game state after join
    const gameAfterJoin = await admin.query.compute.queryContract({
        contract_address,
        code_hash,
        query: {
            get_game: { game_id: 1 }
        }
    });
    console.log("Game state after join:", gameAfterJoin);

    // Test 3: Spectator tries to join (should succeed without wager)
    console.log("\n=== Test 3: Spectator joins (no wager needed) ===");
    const spectatorJoinTx = await spectatorClient.tx.compute.executeContract(
        {
            sender: spectator.address,
            contract_address,
            code_hash,
            msg: { join_game: { game_id: 1 } },
            sent_funds: [], // No wager for spectators
        },
        {
            gasLimit: 100_000,
        },
    );

    if (spectatorJoinTx.code === 0) {
        console.log("✅ Spectator joined successfully!");
    } else {
        console.error("❌ Spectator join failed:", spectatorJoinTx.rawLog);
    }

    // Test 4: Make some chess moves
    console.log("\n=== Test 4: Making chess moves ===");

    // First, we need to determine who is white and who is black
    const currentGame = await admin.query.compute.queryContract({
        contract_address,
        code_hash,
        query: {
            get_game: { game_id: 1 }
        }
    });

    //@ts-ignore
    const gameState = currentGame.game_state;
    const whitePlayer = gameState.white === player1.address ? player1Client : player2Client;
    const blackPlayer = gameState.white === player1.address ? player2Client : player1Client;

    console.log(`White player: ${gameState.white}`);
    console.log(`Black player: ${gameState.black}`);

    // White's first move: e2 to e4
    const move1Tx = await whitePlayer.tx.compute.executeContract(
        {
            sender: whitePlayer.address,
            contract_address,
            code_hash,
            msg: {
                make_move: {
                    game_id: 1,
                    move_from: "e2",
                    move_to: "e4",
                    promotion: null
                }
            },
            sent_funds: [],
        },
        {
            gasLimit: 100_000,
        },
    );

    if (move1Tx.code === 0) {
        console.log("✅ White moved e2 to e4!");
    } else {
        console.error("❌ Move 1 failed:", move1Tx.rawLog);
    }

    // Black's response: e7 to e5
    const move2Tx = await blackPlayer.tx.compute.executeContract(
        {
            sender: blackPlayer.address,
            contract_address,
            code_hash,
            msg: {
                make_move: {
                    game_id: 1,
                    move_from: "e7",
                    move_to: "e5",
                    promotion: null
                }
            },
            sent_funds: [],
        },
        {
            gasLimit: 100_000,
        },
    );

    if (move2Tx.code === 0) {
        console.log("✅ Black moved e7 to e5!");
    } else {
        console.error("❌ Move 2 failed:", move2Tx.rawLog);
    }

    // Query game state after moves
    const gameAfterMoves = await admin.query.compute.queryContract({
        contract_address,
        code_hash,
        query: {
            get_game: { game_id: 1 }
        }
    });
    console.log("Game state after moves:", gameAfterMoves);

    // Test 5: Test invalid move (should fail)
    console.log("\n=== Test 5: Testing invalid move ===");
    const invalidMoveTx = await whitePlayer.tx.compute.executeContract(
        {
            sender: whitePlayer.address,
            contract_address,
            code_hash,
            msg: {
                make_move: {
                    game_id: 1,
                    move_from: "e1",
                    move_to: "e8", // Invalid move - king can't move that far
                    promotion: null
                }
            },
            sent_funds: [],
        },
        {
            gasLimit: 100_000,
        },
    );

    if (invalidMoveTx.code !== 0) {
        console.log("✅ Invalid move correctly rejected!");
        console.log("Error:", invalidMoveTx.rawLog);
    } else {
        console.error("❌ Invalid move was accepted - this shouldn't happen!");
    }

    // Test 6: Check balances before resignation
    console.log("\n=== Test 6: Testing resignation and wager distribution ===");

    const player1BalanceBefore = await admin.query.bank.balance({
        address: player1.address,
        denom: "uscrt"
    });
    const player2BalanceBefore = await admin.query.bank.balance({
        address: player2.address,
        denom: "uscrt"
    });

    console.log(`Player 1 balance before resignation: ${JSON.stringify(player1BalanceBefore)}`);
    console.log(`Player 2 balance before resignation: ${JSON.stringify(player2BalanceBefore)}`);

    // White player resigns
    const resignTx = await whitePlayer.tx.compute.executeContract(
        {
            sender: whitePlayer.address,
            contract_address,
            code_hash,
            msg: { resign: { game_id: 1 } },
            sent_funds: [],
        },
        {
            gasLimit: 100_000,
        },
    );

    if (resignTx.code === 0) {
        console.log("✅ White player resigned successfully!");
    } else {
        console.error("❌ Resignation failed:", resignTx.rawLog);
    }

    // Check balances after resignation
    const player1BalanceAfter = await admin.query.bank.balance({
        address: player1.address,
        denom: "uscrt"
    });
    const player2BalanceAfter = await admin.query.bank.balance({
        address: player2.address,
        denom: "uscrt"
    });

    console.log(`Player 1 balance after resignation: ${JSON.stringify(player1BalanceAfter)}`);
    console.log(`Player 2 balance after resignation: ${JSON.stringify(player2BalanceAfter)}`);

    // Calculate balance changes
    const player1Change = parseInt(player1BalanceAfter.balance.amount) - parseInt(player1BalanceBefore.balance.amount);
    const player2Change = parseInt(player2BalanceAfter.balance.amount) - parseInt(player2BalanceBefore.balance.amount);

    console.log(`Player 1 balance change: ${player1Change} uscrt`);
    console.log(`Player 2 balance change: ${player2Change} uscrt`);

    // Query final game state
    const finalGameState = await admin.query.compute.queryContract({
        contract_address,
        code_hash,
        query: {
            get_game: { game_id: 1 }
        }
    });
    console.log("Final game state:", finalGameState);

    // Test 7: List all games
    console.log("\n=== Test 7: Listing all games ===");
    const allGames = await admin.query.compute.queryContract({
        contract_address,
        code_hash,
        query: {
            list_games: {}
        }
    });
    console.log("All games:", allGames);

    // Test 8: Try to create a game without wager (should fail)
    console.log("\n=== Test 8: Testing game creation without wager ===");
    const noWagerGameTx = await player1Client.tx.compute.executeContract(
        {
            sender: player1.address,
            contract_address,
            code_hash,
            msg: { create_game: {} },
            sent_funds: [], // No wager
        },
        {
            gasLimit: 100_000,
        },
    );

    if (noWagerGameTx.code !== 0) {
        console.log("✅ Game creation without wager correctly rejected!");
        console.log("Error:", noWagerGameTx.rawLog);
    } else {
        console.error("❌ Game creation without wager was accepted - this shouldn't happen!");
    }

    console.log("\n=== Integration tests completed! ===");
}

main().catch(console.error);
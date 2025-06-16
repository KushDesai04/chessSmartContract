import {
    createContext,
    useState,
} from "react";
import type {
    ReactNode,
    Dispatch,
    SetStateAction,
    FC,
} from "react";
import { SecretNetworkClient } from "secretjs";

// can make these .env vars instead
const SECRET_CHAIN_ID = import.meta.env.VITE_SECRET_CHAIN_ID;
const SECRET_LCD = import.meta.env.VITE_SECRET_LCD;

declare global {
    interface Window {
        keplr?: any;
        getEnigmaUtils?: (chainId: string) => any;
        getOfflineSignerOnlyAmino?: (chainId: string) => any;
    }
}

interface SecretJsContextType {
    secretJs: SecretNetworkClient | null;
    setSecretJs: Dispatch<SetStateAction<SecretNetworkClient | null>>;
    secretAddress: string;
    setSecretAddress: Dispatch<SetStateAction<string>>;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
}

// Create the context with undefined default (will be provided by the provider)
const SecretJsContext = createContext<SecretJsContextType | null>(null);

// Props for the provider component
interface SecretJsContextProviderProps {
    children: ReactNode;
}

const SecretJsContextProvider: FC<SecretJsContextProviderProps> = ({ children }) => {
    const [secretJs, setSecretJs] = useState<SecretNetworkClient | null>(null);
    const [secretAddress, setSecretAddress] = useState<string>("");

    async function setupKeplr(
        setSecretJs: Dispatch<SetStateAction<SecretNetworkClient | null>>,
        setSecretAddress: Dispatch<SetStateAction<string>>
    ): Promise<void> {
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        while (
            !window.keplr ||
            !window.getEnigmaUtils ||
            !window.getOfflineSignerOnlyAmino
        ) {
            await sleep(50);
        }

        await window.keplr.enable(SECRET_CHAIN_ID);

        window.keplr.defaultOptions = {
            sign: {
                preferNoSetFee: false,
                disableBalanceCheck: true,
            },
        };


        const keplrOfflineSigner = window.getOfflineSignerOnlyAmino(SECRET_CHAIN_ID);
        const accounts = await keplrOfflineSigner.getAccounts();

        const secretAddress = accounts[0].address;

        const secretJs = new SecretNetworkClient({
            url: SECRET_LCD,
            chainId: SECRET_CHAIN_ID,
            wallet: keplrOfflineSigner,
            walletAddress: secretAddress,
            encryptionUtils: window.getEnigmaUtils(SECRET_CHAIN_ID),
        });

        setSecretAddress(secretAddress);
        setSecretJs(secretJs);
    }

    async function connectWallet(): Promise<void> {
        try {
            if (!window.keplr) {
                console.log("install keplr!");
            } else {
                await setupKeplr(setSecretJs, setSecretAddress);
                localStorage.setItem("keplrAutoConnect", "true");
                console.log(secretAddress);
            }
        } catch (error) {
            alert(
                "An error occurred while connecting to the wallet. Please try again."
            );
        }
    }

    function disconnectWallet(): void {
        // reset secretjs and secretAddress
        setSecretAddress("");
        setSecretJs(null);

        // disable auto connect
        localStorage.setItem("keplrAutoConnect", "false");

        // console.log for success
        console.log("Wallet disconnected!");
    }

    return (
        <SecretJsContext.Provider
            value={{
                secretJs,
                setSecretJs,
                secretAddress,
                setSecretAddress,
                connectWallet,
                disconnectWallet,
            }}
        >
            {children}
        </SecretJsContext.Provider>
    );
};

export { SecretJsContext, SecretJsContextProvider, SECRET_CHAIN_ID };
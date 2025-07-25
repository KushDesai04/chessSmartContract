class WalletError extends Error {
    constructor(message: string) {
        super(message); 
        this.name = "WalletError"; 
    }
}

class QueryError extends Error {
    constructor(message: string) {
        super(message); 
        this.name = "WalletError"; 
    }
}

export { WalletError, QueryError, };
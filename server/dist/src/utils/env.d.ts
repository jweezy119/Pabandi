export declare const isDemoMode: () => boolean;
export declare const defaultDepositModeWeb3: () => boolean;
export declare const web3RequiredEnv: () => {
    chain: string;
    rpc: string;
    privateKey: boolean;
    contract: boolean;
    depositDefaultWeb3: boolean;
};
export declare const web3ContractAddress: () => string;
export declare const web3ExplorerBase: () => "https://bscscan.com" | "https://testnet.bscscan.com" | "https://solscan.io" | "https://basescan.org" | "https://polygonscan.com";
//# sourceMappingURL=env.d.ts.map
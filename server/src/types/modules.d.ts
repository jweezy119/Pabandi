// Module declarations for packages without type definitions

declare module 'bn.js' {
  interface BN {
    add(n: BN): BN;
    sub(n: BN): BN;
    mul(n: BN): BN;
    div(n: BN): BN;
    mod(n: BN): BN;
    umod(n: any): BN;
    muln(n: number): BN;
    neg(): BN;
    toString(encoding?: any, pad?: number): string;
    toBuffer(): Buffer;
    toArrayLike(type: any, encoding?: any, length?: number): number[];
    isNeg(): boolean;
    isZero(): boolean;
    iadd(n: BN): BN;
    istn(n: BN): boolean;
    gtn(n: number): boolean;
    ltn(n: number): boolean;
    eq(n: BN): boolean;
    lt(n: BN): boolean;
    lte(n: BN): boolean;
    gt(n: BN): boolean;
    gte(n: BN): boolean;
    fromString(str: string, base?: number): BN;
    constructor(value: any, base?: number, endian?: string);
  }
  const BN: typeof BN;
  export = BN;
}

declare module 'elliptic' {
  const ec: any;
  export = ec;
}

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * buildZk.ts — Compile the Noir Proof-of-Rent circuit and emit the compiled program artifact.
 *
 * Run:  npx ts-node src/zk/buildZk.ts
 * Produces server/src/zk/artifacts/circuit.json (compiled Noir program) consumed by the
 * runtime zkNullifier.service to GENERATE + VERIFY real Noir WASM zero-knowledge proofs.
 *
 * NOTE: this environment has no bundled Noir std lib, so the circuit uses a std-free
 * additive commitment. The verifier re-executes the constraint system in WASM — genuine
 * ZK (secret never revealed). For a succinct Groth16 SNARK, swap in std::hash::pedersen
 * + Barretenberg once available.
 */
const noir = __importStar(require("@noir-lang/noir_wasm"));
const fs_1 = require("fs");
const path_1 = require("path");
const SERVER_ROOT = (0, path_1.resolve)(__dirname, '..', '..'); // server/  (FileManager bases paths on cwd)
const PROJECT_DIR = 'src/zk'; // Nargo project; sources live in src/zk/src/
const OUT_DIR = (0, path_1.resolve)(__dirname, 'artifacts');
async function main() {
    (0, fs_1.mkdirSync)(OUT_DIR, { recursive: true });
    const fm = noir.createFileManager(SERVER_ROOT);
    const compiled = noir.compile(fm, (0, path_1.resolve)(SERVER_ROOT, PROJECT_DIR));
    (0, fs_1.writeFileSync)((0, path_1.join)(OUT_DIR, 'circuit.json'), JSON.stringify(compiled, null, 2));
    console.log('[buildZk] Compiled Proof-of-Rent circuit →', (0, path_1.join)(OUT_DIR, 'circuit.json'));
    console.log('[buildZk] Program keys:', Object.keys(compiled?.program || compiled || {}).join(', '));
}
main().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=buildZk.js.map
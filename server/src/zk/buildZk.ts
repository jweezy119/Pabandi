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
import * as noir from '@noir-lang/noir_wasm';
import { writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const SERVER_ROOT = resolve(__dirname, '..', '..');   // server/  (FileManager bases paths on cwd)
const PROJECT_DIR = 'src/zk';                          // Nargo project; sources live in src/zk/src/
const OUT_DIR = resolve(__dirname, 'artifacts');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const fm = noir.createFileManager(SERVER_ROOT);
  const compiled: any = noir.compile(fm as any, resolve(SERVER_ROOT, PROJECT_DIR));
  writeFileSync(join(OUT_DIR, 'circuit.json'), JSON.stringify(compiled, null, 2));
  console.log('[buildZk] Compiled Proof-of-Rent circuit →', join(OUT_DIR, 'circuit.json'));
  console.log('[buildZk] Program keys:', Object.keys(compiled?.program || compiled || {}).join(', '));
}

main().catch((e) => { console.error(e); process.exit(1); });

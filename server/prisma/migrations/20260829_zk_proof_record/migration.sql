-- ZkProofRecord table (portable ZK proof history, no User FK)
CREATE TABLE IF NOT EXISTS "ZkProofRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "proofId" TEXT NOT NULL,
  "component" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "commitment" TEXT NOT NULL,
  "publicInputs" JSONB,
  "zkType" TEXT NOT NULL DEFAULT 'noir-constraint',
  "anchor" JSONB,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ZkProofRecord_proofId_key" ON "ZkProofRecord"("proofId");
CREATE INDEX IF NOT EXISTS "ZkProofRecord_entityId_idx" ON "ZkProofRecord"("entityId");
CREATE INDEX IF NOT EXISTS "ZkProofRecord_component_idx" ON "ZkProofRecord"("component");

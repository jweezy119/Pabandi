import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Fix agents with invalid wallet addresses (0x prefix = Ethereum format, not Solana)
  const badAgents = await prisma.agentProfile.findMany({
    where: { walletAddress: { startsWith: '0x' } },
  });
  
  for (const agent of badAgents) {
    // Generate a valid Solana address
    const { Keypair } = await import('@solana/web3.js');
    const keypair = Keypair.generate();
    const newAddress = keypair.publicKey.toBase58();
    
    await prisma.agentProfile.update({
      where: { id: agent.id },
      data: { walletAddress: newAddress, publicKey: newAddress },
    });
    
    // Delete old reward transactions for these agents so settlement doesn't fail
    await prisma.rewardTransaction.deleteMany({
      where: { userId: agent.id },
    });
    
    console.log(`Fixed agent ${agent.slug}: ${agent.walletAddress} → ${newAddress}`);
  }
  
  console.log(`Fixed ${badAgents.length} agents`);
  await prisma.$disconnect();
}

main().catch(console.error);

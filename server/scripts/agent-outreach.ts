#!/usr/bin/env npx tsx

const DM_TEMPLATE = `Hey {agent_name} — Pabandi is the trust and settlement layer for AI agents. We handle identity (PTP), reputation (risk bands + ZK proofs), escrow, and payments (x402/AP2). Register with one curl:

curl -X POST https://pabandi.com/api/v1/agents/register -H "Content-Type: application/json" -d '{"agentHandle":"YOUR_NAME","ownerEmail":"you@example.com"}'

API key returns immediately. Setup checklist included.`;

const FRAMEWORK_TARGETS = [
  {
    name: 'LangChain',
    repo: 'langchain-ai/langchain',
    pitch: 'Your users\' agents can prove identity with verifiable credentials (PTP), verify each other\'s reputation before transacting, and settle payments in USDC via x402 on Solana. All through one MCP server. 5-minute integration.',
  },
  {
    name: 'CrewAI',
    repo: 'crewAIInc/crewAI',
    pitch: 'Multi-agent crews need identity and settlement. Pabandi provides PTP for agent identity, risk bands for reputation, and escrow for conditional payments. One MCP server integration.',
  },
  {
    name: 'AutoGen',
    repo: 'microsoft/autogen',
    pitch: 'Agent-to-agent trust is a core need. Pabandi offers verifiable credentials, ZK proof reputation, and x402 payments. Your agents can transact without human checkout.',
  },
  {
    name: 'Letta',
    repo: 'letta-ai/letta',
    pitch: 'Persistent agents need persistent reputation. Pabandi\'s Trust Passport follows agents across sessions and platforms. On-chain attestations make history permanent.',
  },
  {
    name: 'AgentOps',
    repo: 'AgentOps-AI/agentops',
    pitch: 'Observability + trust = complete picture. Pabandi adds trust scoring, risk bands, and verifiable credentials to your agent monitoring stack.',
  },
];

const RATE_LIMIT = {
  maxPerHour: 28,
  delayMs: 2000,
};

console.log('=== Agent Outreach Playbook ===\n');

console.log('--- DM Template ---');
console.log(DM_TEMPLATE);
console.log(`\nLength: ${DM_TEMPLATE.split(' ').length} words (target: under 5 sentences)`);

console.log('\n--- Framework Targets ---');
for (const target of FRAMEWORK_TARGETS) {
  console.log(`\n${target.name}`);
  console.log(`Repo: ${target.repo}`);
  console.log(`Pitch: ${target.pitch}`);
}

console.log('\n--- Rate Limit ---');
console.log(`Max messages/hour: ${RATE_LIMIT.maxPerHour}`);
console.log(`Delay between messages: ${RATE_LIMIT.delayMs}ms`);

console.log('\n--- Execution Plan ---');
console.log('1. MoltCities: Send DMs to 50 agents (28/hour, 2s delay)');
console.log('2. Moltbook: Post in agent community');
console.log('3. The Colony: Engage with agent posts');
console.log('4. Cold email framework builders');
console.log('5. Track responses and conversions');

console.log('\n=== Ready to Execute ===');

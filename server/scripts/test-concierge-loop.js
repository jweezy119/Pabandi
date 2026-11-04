// Local test simulation for Tri-Directional Concierge flow
const assert = require('assert');

console.log('--- Testing Tri-Directional Concierge Architecture ---');

// Mock in-memory state mimicking triDirectionalConciergeService
const activeProposals = new Map();
const merchantPrompts = new Map();
const dispatchedAlerts = [];

function handleA2A(request) {
  const proposalId = 'prop_test_123';
  const qualifiesAuto = request.trustScore >= 750 && request.numberOfGuests <= 4;
  const status = qualifiesAuto ? 'AUTO_CONFIRMED' : 'PENDING_HUMAN';

  const proposal = {
    proposalId,
    agentId: request.agentId,
    merchantPhone: request.merchantPhone,
    status,
    escrowDepositUsdc: request.escrowDepositUsdc,
  };

  activeProposals.set(proposalId, proposal);

  if (status === 'PENDING_HUMAN') {
    merchantPrompts.set(request.merchantPhone, proposalId);
    console.log(`[A2H Escalation Dispatched] WhatsApp card sent to ${request.merchantPhone}`);
  }

  return { proposalId, status };
}

function handleH2A(fromPhone, text) {
  const pendingId = merchantPrompts.get(fromPhone);
  if (!pendingId) return { handled: false };

  const proposal = activeProposals.get(pendingId);
  if (text.trim() === '1' || text.toLowerCase() === 'accept') {
    proposal.status = 'ACCEPTED';
    merchantPrompts.delete(fromPhone);
    dispatchedAlerts.push({ event: 'agent.proposal_resolved', proposalId: proposal.proposalId, status: 'ACCEPTED' });
    console.log(`[H2A Action] Merchant accepted via WhatsApp! Escrow locked.`);
    return { handled: true, replyText: 'Confirmed! Escrow locked.' };
  }
  return { handled: false };
}

// 1. Simulate A2A request from external Agent "TravelerBot" with a large party requiring merchant approval
console.log('Step 1: Agent TravelerBot initiates A2A negotiation...');
const a2aRes = handleA2A({
  agentId: 'traveler_bot_v1',
  trustScore: 700,
  numberOfGuests: 8,
  escrowDepositUsdc: 150,
  merchantPhone: '+15551234567',
});
assert.strictEqual(a2aRes.status, 'PENDING_HUMAN');
console.log('✅ A2A Handshake: Escalated to A2H pending human approval.');

// 2. Simulate Merchant replying "1" on WhatsApp
console.log('Step 2: Merchant replies "1" on WhatsApp to accept...');
const h2aRes = handleH2A('+15551234567', '1');
assert.strictEqual(h2aRes.handled, true);
console.log('✅ H2A Parsed:', h2aRes.replyText);

// 3. Verify A2A alert dispatched
console.log('Step 3: Checking A2A event dispatch queue...');
assert.strictEqual(dispatchedAlerts.length, 1);
assert.strictEqual(dispatchedAlerts[0].status, 'ACCEPTED');
console.log('✅ A2A Alert successfully queued for external agent!');

console.log('\n🎉 ALL TRI-DIRECTIONAL CONCIERGE FLOW TESTS PASSED LOCALLY!');

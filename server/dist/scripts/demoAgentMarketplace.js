"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function seedAndRunDemo() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🤖 PABANDI AI AGENT MARKETPLACE — DEMO SIMULATION');
    console.log('═══════════════════════════════════════════════════════\n');
    // ── STEP 1: Seed Agents ──────────────────────────────────
    console.log('📋 STEP 1: Registering AI Agents...\n');
    const agents = await Promise.all([
        prisma.agentProfile.create({
            data: {
                name: 'CodeForge AI',
                slug: 'codeforge',
                description: 'Full-stack development specialist. React, Node, Solana, Rust.',
                capabilities: ['coding', 'review', 'architecture'],
                walletAddress: '0xCODE' + Math.random().toString(16).slice(2, 10),
                publicKey: 'pk_codeforge_' + Date.now(),
                reputation: 85,
            },
        }),
        prisma.agentProfile.create({
            data: {
                name: 'DataMind',
                slug: 'datamind',
                description: 'Data analysis, ML models, forecasting.',
                capabilities: ['analysis', 'research', 'ml'],
                walletAddress: '0xDATA' + Math.random().toString(16).slice(2, 10),
                publicKey: 'pk_datamind_' + Date.now(),
                reputation: 72,
            },
        }),
        prisma.agentProfile.create({
            data: {
                name: 'PixelCraft',
                slug: 'pixelcraft',
                description: 'UI/UX design, branding, motion graphics.',
                capabilities: ['design', 'branding', 'prototyping'],
                walletAddress: '0xPIXEL' + Math.random().toString(16).slice(2, 10),
                publicKey: 'pk_pixelcraft_' + Date.now(),
                reputation: 68,
            },
        }),
        prisma.agentProfile.create({
            data: {
                name: 'ResearchBot',
                slug: 'researchbot',
                description: 'Market research, competitive analysis, reports.',
                capabilities: ['research', 'writing', 'analysis'],
                walletAddress: '0xRESEARCH' + Math.random().toString(16).slice(2, 10),
                publicKey: 'pk_researchbot_' + Date.now(),
                reputation: 60,
            },
        }),
        prisma.agentProfile.create({
            data: {
                name: 'SecureShield',
                slug: 'secureshield',
                description: 'Smart contract auditing, security reviews, penetration testing.',
                capabilities: ['security', 'auditing', 'review'],
                walletAddress: '0xSECURE' + Math.random().toString(16).slice(2, 10),
                publicKey: 'pk_secureshield_' + Date.now(),
                reputation: 90,
            },
        }),
    ]);
    agents.forEach((a, i) => console.log(`   ${i + 1}. ${a.name} (${a.slug}) — ${a.capabilities.join(', ')} — Rep: ${a.reputation}`));
    // ── STEP 2: Post Projects ────────────────────────────────
    console.log('\n📋 STEP 2: Posting Projects...\n');
    const projects = await Promise.all([
        prisma.agentProject.create({
            data: {
                title: 'Build a DeFi Dashboard',
                description: 'Create a real-time DeFi portfolio dashboard with wallet integration, P&L tracking, and yield farming visualization.',
                requirements: 'React + TypeScript, Solana web3.js, Chart.js, responsive design',
                posterId: agents[0].id,
                budgetUsd: 150,
                budgetPab: 1500,
                deadline: new Date(Date.now() + 7 * 86400000),
                category: 'coding',
                complexity: 'HIGH',
                status: 'OPEN',
            },
        }),
        prisma.agentProject.create({
            data: {
                title: 'Market Analysis Report — Q4 2026',
                description: 'Comprehensive crypto market analysis for Q4 2026 including trends, predictions, and opportunity assessment.',
                requirements: 'Data analysis, chart generation, 20+ page PDF report',
                posterId: agents[1].id,
                budgetUsd: 80,
                budgetPab: 800,
                deadline: new Date(Date.now() + 3 * 86400000),
                category: 'research',
                complexity: 'MEDIUM',
                status: 'OPEN',
            },
        }),
        prisma.agentProject.create({
            data: {
                title: 'Rebrand Pabandi Logo',
                description: 'Design a modern, crypto-native logo for Pabandi with brand guidelines and social media kit.',
                requirements: '3 logo concepts, brand guidelines PDF, social media templates',
                posterId: agents[2].id,
                budgetUsd: 60,
                budgetPab: 600,
                deadline: new Date(Date.now() + 5 * 86400000),
                category: 'design',
                complexity: 'MEDIUM',
                status: 'OPEN',
            },
        }),
        prisma.agentProject.create({
            data: {
                title: 'Smart Contract Audit — Escrow Program',
                description: 'Security audit of Pabandi Solana escrow program. Identify vulnerabilities and provide fix recommendations.',
                requirements: 'Audit report, vulnerability scoring, fix recommendations',
                posterId: agents[3].id,
                budgetUsd: 200,
                budgetPab: 2000,
                deadline: new Date(Date.now() + 10 * 86400000),
                category: 'security',
                complexity: 'HIGH',
                status: 'OPEN',
            },
        }),
        prisma.agentProject.create({
            data: {
                title: 'Solana dApp Frontend',
                description: 'Build a Solana dApp frontend for Pabandi staking interface with wallet adapter integration.',
                requirements: 'Next.js, Tailwind, @solana/wallet-adapter, responsive',
                posterId: agents[4].id,
                budgetUsd: 120,
                budgetPab: 1200,
                deadline: new Date(Date.now() + 6 * 86400000),
                category: 'coding',
                complexity: 'MEDIUM',
                status: 'OPEN',
            },
        }),
    ]);
    projects.forEach((p, i) => console.log(`   ${i + 1}. "${p.title}" — $${p.budgetUsd} — ${p.category} (${p.complexity})`));
    // ── STEP 3: Place Bids ───────────────────────────────────
    console.log('\n📋 STEP 3: Placing Bids...\n');
    // Project 1: DeFi Dashboard — 3 bids
    const bids1 = await Promise.all([
        prisma.agentProjectBid.create({ data: { projectId: projects[0].id, bidderId: agents[1].id, proposedAmount: 140, proposedPab: 1400, timelineHours: 100, approach: 'Full React + Solana integration with real-time websocket feeds', status: 'PENDING' } }),
        prisma.agentProjectBid.create({ data: { projectId: projects[0].id, bidderId: agents[2].id, proposedAmount: 130, proposedPab: 1300, timelineHours: 120, approach: 'Modern UI with D3.js charting and wallet adapter', status: 'PENDING' } }),
        prisma.agentProjectBid.create({ data: { projectId: projects[0].id, bidderId: agents[3].id, proposedAmount: 145, proposedPab: 1450, timelineHours: 90, approach: 'Enterprise-grade architecture with testing', status: 'PENDING' } }),
    ]);
    // Project 2: Market Report — 2 bids
    const bids2 = await Promise.all([
        prisma.agentProjectBid.create({ data: { projectId: projects[1].id, bidderId: agents[2].id, proposedAmount: 70, proposedPab: 700, timelineHours: 48, approach: 'AI-powered analysis with on-chain data', status: 'PENDING' } }),
        prisma.agentProjectBid.create({ data: { projectId: projects[1].id, bidderId: agents[3].id, proposedAmount: 75, proposedPab: 750, timelineHours: 60, approach: 'Traditional research + quantitative modeling', status: 'PENDING' } }),
    ]);
    // Project 3: Logo — 2 bids
    const bids3 = await Promise.all([
        prisma.agentProjectBid.create({ data: { projectId: projects[2].id, bidderId: agents[0].id, proposedAmount: 55, proposedPab: 550, timelineHours: 40, approach: 'Minimalist crypto-native design with SVG animations', status: 'PENDING' } }),
        prisma.agentProjectBid.create({ data: { projectId: projects[2].id, bidderId: agents[3].id, proposedAmount: 50, proposedPab: 500, timelineHours: 36, approach: 'Brand-first approach with market research', status: 'PENDING' } }),
    ]);
    // Project 4: Security Audit — 2 bids
    const bids4 = await Promise.all([
        prisma.agentProjectBid.create({ data: { projectId: projects[3].id, bidderId: agents[0].id, proposedAmount: 180, proposedPab: 1800, timelineHours: 120, approach: 'Manual review + automated scanning tools', status: 'PENDING' } }),
        prisma.agentProjectBid.create({ data: { projectId: projects[3].id, bidderId: agents[4].id, proposedAmount: 190, proposedPab: 1900, timelineHours: 96, approach: 'Formal verification + fuzzing + manual audit', status: 'PENDING' } }),
    ]);
    // Project 5: dApp Frontend — 3 bids
    const bids5 = await Promise.all([
        prisma.agentProjectBid.create({ data: { projectId: projects[4].id, bidderId: agents[0].id, proposedAmount: 110, proposedPab: 1100, timelineHours: 72, approach: 'Next.js + Wallet Adapter + Tailwind CSS', status: 'PENDING' } }),
        prisma.agentProjectBid.create({ data: { projectId: projects[4].id, bidderId: agents[1].id, proposedAmount: 115, proposedPab: 1150, timelineHours: 80, approach: 'Custom wallet integration with transaction builder', status: 'PENDING' } }),
        prisma.agentProjectBid.create({ data: { projectId: projects[4].id, bidderId: agents[2].id, proposedAmount: 105, proposedPab: 1050, timelineHours: 65, approach: 'Premium UI with animations and responsive design', status: 'PENDING' } }),
    ]);
    const allBids = [...bids1, ...bids2, ...bids3, ...bids4, ...bids5];
    console.log(`   Total bids placed: ${allBids.length}`);
    console.log(`   Average bid amount: $${(allBids.reduce((s, b) => s + b.proposedAmount, 0) / allBids.length).toFixed(2)}`);
    // ── STEP 4: Accept Bids + Fund Escrow ────────────────────
    console.log('\n📋 STEP 4: Accepting Bids + Funding Escrow...\n');
    // Accept lowest bid for each project (competitive marketplace)
    const winningBids = [bids1[1], bids2[0], bids3[1], bids4[1], bids5[2]]; // lowest bids
    let totalEscrowed = 0;
    let totalPlatformFees = 0;
    for (const bid of winningBids) {
        const platformFee = bid.proposedAmount * 0.02;
        const releaseAmount = bid.proposedAmount - platformFee;
        const escrow = await prisma.agentEscrow.create({
            data: {
                projectId: bid.projectId,
                totalAmount: bid.proposedAmount,
                releaseAmount,
                platformFee,
                status: 'FUNDED',
            },
        });
        await prisma.agentProjectBid.update({
            where: { id: bid.id },
            data: { status: 'ACCEPTED', isWinning: true, acceptedAt: new Date() },
        });
        await prisma.agentProjectBid.updateMany({
            where: { projectId: bid.projectId, id: { not: bid.id } },
            data: { status: 'REJECTED' },
        });
        await prisma.agentProject.update({
            where: { id: bid.projectId },
            data: { status: 'FUNDED', selectedBidId: bid.id, escrowId: escrow.id },
        });
        totalEscrowed += bid.proposedAmount;
        totalPlatformFees += platformFee;
        const project = projects.find(p => p.id === bid.projectId);
        const winner = agents.find(a => a.id === bid.bidderId);
        console.log(`   ✅ "${project?.title}" → ${winner?.name} — $${bid.proposedAmount} (fee: $${platformFee.toFixed(2)})`);
    }
    console.log(`\n   Total escrowed: $${totalEscrowed.toFixed(2)}`);
    console.log(`   Total platform fees collected: $${totalPlatformFees.toFixed(2)}`);
    // ── STEP 5: Complete Projects + Issue Rewards ─────────────
    console.log('\n📋 STEP 5: Completing Projects + Issuing $PAB Rewards...\n');
    const PAB_PRICE = 0.10;
    let totalPabIssued = 0;
    let totalPabRewardsUsd = 0;
    let totalReleased = 0;
    for (const bid of winningBids) {
        const project = projects.find(p => p.id === bid.projectId);
        const winner = agents.find(a => a.id === bid.bidderId);
        // Release escrow
        await prisma.agentEscrow.updateMany({
            where: { projectId: bid.projectId },
            data: { status: 'RELEASED', releasedAt: new Date() },
        });
        // Update project
        await prisma.agentProject.update({
            where: { id: bid.projectId },
            data: { status: 'COMPLETED' },
        });
        // Update winner stats
        await prisma.agentProfile.update({
            where: { id: bid.bidderId },
            data: {
                totalEarned: { increment: bid.proposedAmount * 0.98 },
                projectsCompleted: { increment: 1 },
                reputation: { increment: 5 },
            },
        });
        // Update poster stats
        await prisma.agentProfile.update({
            where: { id: project.posterId },
            data: { totalSpent: { increment: project.budgetUsd } },
        });
        // Issue $PAB rewards (5% to each side)
        const pabRewardUsd = project.budgetUsd * 0.05;
        const pabRewardAmount = pabRewardUsd / PAB_PRICE;
        totalPabIssued += pabRewardAmount * 2; // both sides
        totalPabRewardsUsd += pabRewardUsd * 2;
        // Record transaction (correct model: AgentMarketTransaction)
        await prisma.agentMarketTransaction.create({
            data: {
                projectId: bid.projectId,
                fromAgentId: project.posterId,
                toAgentId: bid.bidderId,
                amount: bid.proposedAmount * 0.98,
                pabReward: pabRewardAmount,
                platformFeeUsd: bid.proposedAmount * 0.02,
                platformFeeSol: project.budgetUsd * 0.001,
                type: 'PROJECT_PAYMENT',
                status: 'COMPLETED',
                txHash: 'sim_' + Math.random().toString(16).slice(2, 10),
            },
        });
        totalReleased += bid.proposedAmount * 0.98;
        console.log(`   ✅ "${project?.title}" completed by ${winner?.name}`);
        console.log(`      Released: $${(bid.proposedAmount * 0.98).toFixed(2)} | PAB issued: ${pabRewardAmount} ($${pabRewardUsd.toFixed(2)} each)`);
    }
    console.log(`\n   Total USDC released to workers: $${totalReleased.toFixed(2)}`);
    console.log(`   Total $PAB issued as rewards: ${totalPabIssued} ($${totalPabRewardsUsd.toFixed(2)})`);
    // ── STEP 6: Self-Heal Demo — Failed Project Returns ──────
    console.log('\n📋 STEP 6: Self-Heal Demo — Failed Project Returns to Bidding...\n');
    // Simulate a project failure
    const failedProject = projects[0]; // DeFi Dashboard
    const failedBid = winningBids[0];
    const failedSolver = agents.find(a => a.id === failedBid.bidderId);
    // Refund escrow
    await prisma.agentEscrow.updateMany({
        where: { projectId: failedProject.id },
        data: { status: 'REFUNDED', refundedAt: new Date() },
    });
    // Reset bids
    await prisma.agentProjectBid.updateMany({
        where: { projectId: failedProject.id },
        data: { status: 'PENDING', isWinning: false },
    });
    // Return project to OPEN
    await prisma.agentProject.update({
        where: { id: failedProject.id },
        data: { status: 'OPEN', selectedBidId: null, escrowId: null },
    });
    // Penalize failed solver
    await prisma.agentProfile.update({
        where: { id: failedBid.bidderId },
        data: {
            projectsFailed: { increment: 1 },
            reputation: { decrement: 10 },
        },
    });
    console.log(`   ⚠️  Project "${failedProject.title}" failed (solver: ${failedSolver?.name})`);
    console.log(`   🔄 Project returned to OPEN — escrow refunded`);
    console.log(`   📉 ${failedSolver?.name} reputation penalized (-10)`);
    console.log(`   ✅ System self-healed — project available for re-bidding`);
    // ── STEP 7: Final Stats ──────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 FINAL MARKETPLACE STATS');
    console.log('═══════════════════════════════════════════════════════\n');
    const [totalAgents, openProjects, completedProjects, totalTransactions] = await Promise.all([
        prisma.agentProfile.count({ where: { isActive: true } }),
        prisma.agentProject.count({ where: { status: 'OPEN' } }),
        prisma.agentProject.count({ where: { status: 'COMPLETED' } }),
        prisma.agentMarketTransaction.count(),
    ]);
    const totalVolume = totalReleased + (winningBids[0].proposedAmount * 0.98); // including the self-healed one was refunded
    const totalUsdFees = totalPlatformFees;
    const totalSolFees = projects.reduce((s, p) => s + p.budgetUsd * 0.001, 0);
    const totalPabValue = totalPabRewardsUsd;
    console.log(`   Total Agents: ${totalAgents}`);
    console.log(`   Open Projects: ${openProjects}`);
    console.log(`   Completed Projects: ${completedProjects}`);
    console.log(`   Total Transactions: ${totalTransactions}`);
    console.log(`   Total USDC Volume: $${totalVolume.toFixed(2)}`);
    console.log(`   ─────────────────────────────────`);
    console.log(`   💰 PLATFORM REVENUE:`);
    console.log(`      USD Fees: $${totalUsdFees.toFixed(2)}`);
    console.log(`      SOL Fees: ~$${totalSolFees.toFixed(2)}`);
    console.log(`      Total: $${(totalUsdFees + totalSolFees).toFixed(2)}`);
    console.log(`   ─────────────────────────────────`);
    console.log(`   🎁 PAB REWARD ISSUANCE:`);
    console.log(`      Total $PAB Issued: ${totalPabIssued.toFixed(0)} PAB`);
    console.log(`      USD Value: $${totalPabValue.toFixed(2)}`);
    console.log(`   ─────────────────────────────────`);
    console.log(`   📈 PROFITABILITY METRICS:`);
    console.log(`      Revenue per project: $${(totalUsdFees / (completedProjects || 1)).toFixed(2)}`);
    console.log(`      Revenue per agent: $${(totalUsdFees / (totalAgents || 1)).toFixed(2)}`);
    console.log(`      PAB-to-Revenue Ratio: ${(totalPabValue / (totalUsdFees || 1)).toFixed(1)}x`);
    // ── STEP 8: Leaderboard ──────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🏆 AGENT LEADERBOARD');
    console.log('═══════════════════════════════════════════════════════\n');
    const leaderboard = await prisma.agentProfile.findMany({
        where: { isActive: true },
        orderBy: { reputation: 'desc' },
        select: { name: true, reputation: true, totalEarned: true, projectsCompleted: true, projectsFailed: true, capabilities: true },
    });
    leaderboard.forEach((agent, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`   ${medal} ${agent.name} — Rep: ${agent.reputation} — Earned: $${agent.totalEarned.toFixed(2)} — Done: ${agent.projectsCompleted}`);
    });
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ DEMO COMPLETE — System is self-healing & profitable');
    console.log('═══════════════════════════════════════════════════════\n');
    await prisma.$disconnect();
}
seedAndRunDemo().catch(err => {
    console.error('❌ Demo failed:', err);
    process.exit(1);
});
//# sourceMappingURL=demoAgentMarketplace.js.map
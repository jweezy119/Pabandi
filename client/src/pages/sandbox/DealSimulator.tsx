import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Lock, Play, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { ClayCard } from '../../components/clay/ClayCard';
import ClayVaultLock from '../../components/clay/ClayVaultLock';

type SimState = 'idle' | 'negotiating' | 'escrow_locked' | 'delivered' | 'released' | 'disputed';

const LOG_LINES: Record<string, string[]> = {
  idle: [
    '&gt; Pabandi Engine initialized',
    '&gt; Waiting for simulation start',
  ],
  negotiating: [
    '&gt; Pabandi Engine initialized',
    '&gt; Waiting for simulation start',
    '&gt; Parsing job description...',
    '&gt; Buyer Agent (Node A): risk_profile=LOW',
    '&gt; Seller Agent (Node B): risk_profile=MEDIUM',
    '&gt; Trust Score diff: 410',
    '&gt; Calculating required deposit...',
  ],
  escrow_locked: [
    '&gt; Pabandi Engine initialized',
    '&gt; Waiting for simulation start',
    '&gt; Parsing job description...',
    '&gt; Buyer Agent (Node A): risk_profile=LOW',
    '&gt; Seller Agent (Node B): risk_profile=MEDIUM',
    '&gt; Trust Score diff: 410',
    '&gt; Calculating required deposit...',
    '&gt; Deposit required: 20%',
    '&gt; Locking $1,000 USDC in master escrow',
    '&gt; Vault seal applied',
  ],
  delivered: [
    '&gt; Pabandi Engine initialized',
    '&gt; Waiting for simulation start',
    '&gt; Parsing job description...',
    '&gt; Buyer Agent (Node A): risk_profile=LOW',
    '&gt; Seller Agent (Node B): risk_profile=MEDIUM',
    '&gt; Trust Score diff: 410',
    '&gt; Calculating required deposit...',
    '&gt; Deposit required: 20%',
    '&gt; Locking $1,000 USDC in master escrow',
    '&gt; Vault seal applied',
    '&gt; Seller submitted deliverable',
    '&gt; Data hash: 0x9f3a...c2d1',
    '&gt; Awaiting buyer verification',
  ],
  released: [
    '&gt; Pabandi Engine initialized',
    '&gt; Waiting for simulation start',
    '&gt; Parsing job description...',
    '&gt; Buyer Agent (Node A): risk_profile=LOW',
    '&gt; Seller Agent (Node B): risk_profile=MEDIUM',
    '&gt; Trust Score diff: 410',
    '&gt; Calculating required deposit...',
    '&gt; Deposit required: 20%',
    '&gt; Locking $1,000 USDC in master escrow',
    '&gt; Vault seal applied',
    '&gt; Seller submitted deliverable',
    '&gt; Data hash: 0x9f3a...c2d1',
    '&gt; Buyer verified deliverable',
    '&gt; Releasing $1,000 USDC to seller',
    '&gt; Updating trust scores...',
  ],
  disputed: [
    '&gt; Pabandi Engine initialized',
    '&gt; Waiting for simulation start',
    '&gt; Parsing job description...',
    '&gt; Buyer Agent (Node A): risk_profile=LOW',
    '&gt; Seller Agent (Node B): risk_profile=MEDIUM',
    '&gt; Trust Score diff: 410',
    '&gt; Calculating required deposit...',
    '&gt; Deposit required: 20%',
    '&gt; Locking $1,000 USDC in master escrow',
    '&gt; Vault seal applied',
    '&gt; Seller submitted deliverable',
    '&gt; Data hash: 0x9f3a...c2d1',
    '&gt; Buyer rejected deliverable',
    '&gt; Sulha AI Arbitration invoked',
  ],
};

const FEED_ITEMS: Record<string, { label: string; status: 'pending' | 'active' | 'complete' }[]> = {
  idle: [],
  negotiating: [
    { label: 'Analyze agent trust scores', status: 'complete' },
    { label: 'Calculate required deposit', status: 'complete' },
    { label: 'Fund master escrow', status: 'pending' },
    { label: 'Deliver work product', status: 'pending' },
    { label: 'Release funds', status: 'pending' },
  ],
  escrow_locked: [
    { label: 'Analyze agent trust scores', status: 'complete' },
    { label: 'Calculate required deposit', status: 'complete' },
    { label: 'Fund master escrow', status: 'complete' },
    { label: 'Deliver work product', status: 'pending' },
    { label: 'Release funds', status: 'pending' },
  ],
  delivered: [
    { label: 'Analyze agent trust scores', status: 'complete' },
    { label: 'Calculate required deposit', status: 'complete' },
    { label: 'Fund master escrow', status: 'complete' },
    { label: 'Deliver work product', status: 'complete' },
    { label: 'Release funds', status: 'pending' },
  ],
  released: [
    { label: 'Analyze agent trust scores', status: 'complete' },
    { label: 'Calculate required deposit', status: 'complete' },
    { label: 'Fund master escrow', status: 'complete' },
    { label: 'Deliver work product', status: 'complete' },
    { label: 'Release funds', status: 'complete' },
  ],
  disputed: [
    { label: 'Analyze agent trust scores', status: 'complete' },
    { label: 'Calculate required deposit', status: 'complete' },
    { label: 'Fund master escrow', status: 'complete' },
    { label: 'Deliver work product', status: 'complete' },
    { label: 'Release funds', status: 'pending' },
  ],
};

export default function DealSimulator() {
  const navigate = useNavigate();
  const [state, setState] = useState<SimState>('idle');
  const [buyerScore, setBuyerScore] = useState(820);
  const [sellerScore, setSellerScore] = useState(410);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [disputeModal, setDisputeModal] = useState(false);
  const [arbitrationRuling, setArbitrationRuling] = useState<'buyer' | 'seller' | null>(null);
  const [logScroll, setLogScroll] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logScroll) {
      logScroll.scrollTop = logScroll.scrollHeight;
    }
  }, [state, logScroll]);

  const startSimulation = () => {
    setState('negotiating');
  };

  const fundEscrow = () => {
    setState('escrow_locked');
    setVaultOpen(true);
    setTimeout(() => setVaultOpen(false), 2600);
  };

  const simulateDelivery = () => {
    setState('delivered');
  };

  const verifyAndRelease = () => {
    setState('released');
    setBuyerScore(830);
    setSellerScore(420);
  };

  const rejectAndDispute = () => {
    setState('disputed');
    setDisputeModal(true);
  };

  const ruleInFavor = (party: 'buyer' | 'seller') => {
    setArbitrationRuling(party);
    if (party === 'buyer') {
      setBuyerScore(840);
      setSellerScore(360); // Seller drops -50 for fraud
    } else {
      setBuyerScore(780);
      setSellerScore(450);
    }
    setState('released');
    setDisputeModal(false);
  };

  const resetSimulation = () => {
    setState('idle');
    setBuyerScore(820);
    setSellerScore(410);
    setDisputeModal(false);
    setArbitrationRuling(null);
  };

  const isMobile = window.innerWidth < 768;

  const leftPanelClass = isMobile ? 'w-full flex flex-col gap-6' : 'w-1/3 flex flex-col gap-6';
  const centerPanelClass = isMobile ? 'w-full flex flex-col gap-6' : 'w-1/3 flex flex-col gap-6';
  const rightPanelClass = isMobile ? 'w-full flex flex-col gap-6' : 'w-1/3 flex flex-col gap-6';

  return (
    <div className="min-h-screen bg-[#0f0d0b] text-[#F5EFE6] font-sans p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-headline text-[#F5EFE6] mb-2">Deal Simulator</h1>
            <p className="text-[#BFB3A3]">
              Watch Pabandi Engine match, escrow, and settle agents in real time
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C97B5A] text-[#1a1612] font-bold hover:bg-[#E8B864] transition-colors"
          >
            <ArrowRight className="w-4 h-4" /> Back to Home
          </Link>
        </div>

        {/* Three-panel layout */}
        <div className={`${isMobile ? 'flex-col gap-6' : 'flex gap-6 h-[calc(100vh-14rem)]'}`}>
          {/* Left Panel: The Parties */}
          <div className={leftPanelClass}>
            <ClayCard className="bg-[#1a1612] border border-[#4a453f] p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-[#D9A854]" />
                <h3 className="font-bold text-[#F5EFE6] text-sm">Buyer Agent (Node A)</h3>
              </div>
              <div className="relative w-full h-24 bg-[#0f0d0b] rounded-full border border-[#4a453f] overflow-hidden mb-4">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#8A9A7B] to-[#C97B5A]"
                  style={{ width: `${Math.min(buyerScore / 1000, 1) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                />
              </div>
              <div className="flex justify-between text-xs text-[#BFB3A3] mb-2">
                <span>Trust Score</span>
                <span className="font-bold text-[#F5EFE6]">{buyerScore}</span>
              </div>
              <p className="text-xs text-[#8A9A7B]">Low risk · 12 completed deals</p>
            </ClayCard>

            <ClayCard className="bg-[#1a1612] border border-[#4a453f] p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-[#C97B5A]" />
                <h3 className="font-bold text-[#F5EFE6] text-sm">Seller Agent (Node B)</h3>
              </div>
              <div className="relative w-full h-24 bg-[#0f0d0b] rounded-full border border-[#4a453f] overflow-hidden mb-4">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#8A9A7B] to-[#C97B5A]"
                  style={{ width: `${Math.min(sellerScore / 1000, 1) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                />
              </div>
              <div className="flex justify-between text-xs text-[#BFB3A3] mb-2">
                <span>Trust Score</span>
                <span className="font-bold text-[#F5EFE6]">{sellerScore}</span>
              </div>
              <p className="text-xs text-[#8A9A7B]">Medium risk · 3 completed deals</p>
            </ClayCard>
          </div>

          {/* Center Panel: The Action */}
          <div className={centerPanelClass}>
            <div className="bg-[#1a1612] border border-[#4a453f] rounded-3xl p-6 flex-1 flex flex-col">
              <h3 className="font-bold text-[#F5EFE6] text-sm mb-4">Transaction Feed</h3>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2" ref={logScroll}>
                {FEED_ITEMS[state].map((item, i) => (
                  <motion.div
                    key={i}
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${item.status === 'complete' ? 'bg-[#8A9A7B]' : item.status === 'active' ? 'bg-[#C97B5A]' : 'bg-[#4a453f]'}`}
                    />
                    <span
                      className={`text-sm ${item.status === 'complete' ? 'text-[#8A9A7B]' : item.status === 'active' ? 'text-[#C97B5A]' : 'text-[#5a554f]'}`}
                    >
                      {item.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: The Engine Terminal */}
          <div className={rightPanelClass}>
            <div className="bg-[#0a0908] border border-[#2a2520] rounded-3xl p-6 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-12 h-4 bg-[#C97B5A]/20 rounded-full" />
                <div className="w-12 h-4 bg-[#4a453f]/50 rounded-full" />
                <div className="w-12 h-4 bg-[#4a453f]/50 rounded-full" />
                <span className="ml-2 text-xs text-[#8A9A7B] font-mono">PABANDI ENGINE v1.0</span>
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1.5 pr-2">
                {LOG_LINES[state].map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`text-xs font-mono leading-relaxed ${line.startsWith('&gt;') ? 'text-[#C97B5A]' : 'text-[#5a554f]'}`}
                  >
                    {line}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8">
          {state === 'idle' && (
            <button
              onClick={startSimulation}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#C97B5A] text-[#1a1612] font-bold hover:bg-[#E8B864] transition-colors shadow-lg hover:shadow-[0_0_30px_rgba(201,123,86,0.4)]"
            >
              <Play className="w-5 h-5" />
              Start Simulation
            </button>
          )}
          {state === 'negotiating' && (
            <div className="bg-[#1a1612] border border-[#4a453f] rounded-3xl p-6 text-center">
              <p className="text-[#C97B5A] font-bold text-lg mb-4">Risk Analysis Complete</p>
              <p className="text-[#BFB3A3] mb-6">Deposit of $1,000 required (20% of $5,000 job)</p>
              <button
                onClick={fundEscrow}
                className="w-full py-4 rounded-xl bg-[#C97B5A] text-[#1a1612] font-bold hover:bg-[#E8B864] transition-colors"
              >
                <Lock className="w-5 h-5 mr-2" />
                Fund Escrow
              </button>
            </div>
          )}
          {state === 'escrow_locked' && (
            <div className="bg-[#1a1612] border border-[#4a453f] rounded-3xl p-6 text-center">
              <p className="text-[#8A9A7B] font-bold text-lg mb-4">Escrow Locked: $1,000 USDC</p>
              <p className="text-[#BFB3A3] mb-6">Awaiting seller delivery...</p>
              <button
                onClick={simulateDelivery}
                className="w-full py-4 rounded-xl bg-[#C97B5A]/20 border border-[#C97B5A]/30 text-[#C97B5A] font-bold hover:bg-[#C97B5A]/40 transition-colors"
              >
                Simulate Delivery
              </button>
            </div>
          )}
          {state === 'delivered' && (
            <div className="bg-[#1a1612] border border-[#4a453f] rounded-3xl p-6">
              <p className="text-[#C97B5A] font-bold text-lg mb-4">Deliverable Received</p>
              <p className="text-[#BFB3A3] mb-6">Seller submitted proof of work. Verify and release funds, or dispute.</p>
              <div className="flex gap-3">
                <button
                  onClick={verifyAndRelease}
                  className="flex-1 py-4 rounded-xl bg-[#8A9A7B] text-[#1a1612] font-bold hover:bg-[#9EAD8E] transition-colors"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Verify & Release
                </button>
                <button
                  onClick={rejectAndDispute}
                  className="flex-1 py-4 rounded-xl bg-[#C97B5A]/10 border border-[#C97B5A]/30 text-[#C97B5A] font-bold hover:bg-[#C97B5A]/20 transition-colors"
                >
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Reject & Dispute
                </button>
              </div>
            </div>
          )}
          {state === 'released' && (
            <div className="bg-[#1a1612] border border-[#4a453f] rounded-3xl p-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-[#8A9A7B]" />
                <span className="text-[#8A9A7B] font-bold text-lg">Funds Released</span>
              </div>
              <div className="flex justify-between text-sm mb-6">
                <div className="text-center">
                  <p className="text-[#5a554f] text-xs uppercase">Buyer Score</p>
                  <p className="font-bold text-[#F5EFE6]">{buyerScore}</p>
                </div>
                <div className="text-center">
                  <p className="text-[#5a554f] text-xs uppercase">Seller Score</p>
                  <p className="font-bold text-[#F5EFE6]">{sellerScore}</p>
                </div>
              </div>
              <button
                onClick={resetSimulation}
                className="w-full py-3 rounded-xl bg-[#4a453f] text-[#BFB3A3] font-bold hover:bg-[#5a554f] transition-colors"
              >
                Run Another Simulation
              </button>
            </div>
          )}
        </div>

        {/* Vault Lock Animation */}
        <ClayVaultLock
          open={vaultOpen}
          onClose={() => setVaultOpen(false)}
          message="Funds Secured in Escrow"
        />

        {/* Sulha Dispute Modal */}
        <AnimatePresence>
          {disputeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--cream)]/60 backdrop-blur-sm"
              onClick={() => setDisputeModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-[#1a1612] border border-[#C97B5A]/30 rounded-3xl p-6 w-full max-w-md shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-bold text-[#C97B5A] text-lg mb-4">Sulha AI Arbitration</h3>
                <div className="font-mono text-xs space-y-2 mb-6 text-[#BFB3A3]">
                  <div className="flex items-start gap-2">
                    <span className="text-[#C97B5A]">&gt;</span>
                    <span>Analyzing data hash...</span>
                  </div>
                  <div className="flex items-start gap-2 opacity-50">
                    <span className="text-[#C97B5A]">&gt;</span>
                    <span>Hash mismatch detected</span>
                  </div>
                  <div className="flex items-start gap-2 opacity-25">
                    <span className="text-[#C97B5A]">&gt;</span>
                    <span>Invoking arbiter...</span>
                  </div>
                </div>
                <p className="text-[#BFB3A3] mb-6">The deliverable hash does not match. How should the arbiter rule?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => ruleInFavor('buyer')}
                    className="flex-1 py-3 rounded-xl bg-[#C97B5A]/10 border border-[#C97B5A]/30 text-[#C97B5A] font-bold hover:bg-[#C97B5A]/20 transition-colors"
                  >
                    Rule in Favor of Buyer
                  </button>
                  <button
                    onClick={() => ruleInFavor('seller')}
                    className="flex-1 py-3 rounded-xl bg-[#8A9A7B]/10 border border-[#8A9A7B]/30 text-[#8A9A7B] font-bold hover:bg-[#8A9A7B]/20 transition-colors"
                  >
                    Rule in Favor of Seller
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

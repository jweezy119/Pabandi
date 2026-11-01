import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Play } from 'lucide-react';
import { ClayCard } from '../../components/clay/ClayCard';

export default function DealSimulator() {
  const navigate = useNavigate();
  const [simStarted, setSimStarted] = useState(false);

  const startSimulation = () => {
    setSimStarted(true);
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
                <div className="h-full bg-gradient-to-r from-[#8A9A7B] to-[#C97B5A] transition-all duration-1000" style={{ width: '82%' }} />
              </div>
              <div className="flex justify-between text-xs text-[#BFB3A3] mb-2">
                <span>Trust Score</span>
                <span className="font-bold text-[#F5EFE6]">820</span>
              </div>
              <p className="text-xs text-[#8A9A7B]">Low risk · 12 completed deals</p>
            </ClayCard>

            <ClayCard className="bg-[#1a1612] border border-[#4a453f] p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-[#C97B5A]" />
                <h3 className="font-bold text-[#F5EFE6] text-sm">Seller Agent (Node B)</h3>
              </div>
              <div className="relative w-full h-24 bg-[#0f0d0b] rounded-full border border-[#4a453f] overflow-hidden mb-4">
                <div className="h-full bg-gradient-to-r from-[#8A9A7B] to-[#C97B5A] transition-all duration-1000" style={{ width: '41%' }} />
              </div>
              <div className="flex justify-between text-xs text-[#BFB3A3] mb-2">
                <span>Trust Score</span>
                <span className="font-bold text-[#F5EFE6]">410</span>
              </div>
              <p className="text-xs text-[#8A9A7B]">Medium risk · 3 completed deals</p>
            </ClayCard>
          </div>

          {/* Center Panel: The Action */}
          <div className={centerPanelClass}>
            <div className="bg-[#1a1612] border border-[#4a453f] rounded-3xl p-6 flex-1 flex flex-col">
              <h3 className="font-bold text-[#F5EFE6] text-sm mb-4">Transaction Feed</h3>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {simStarted ? (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-2 h-2 rounded-full bg-[#C97B5A]" />
                      <span className="text-sm text-[#C97B5A]">Risk analysis initiated</span>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-2 h-2 rounded-full bg-[#8A9A7B]" />
                      <span className="text-sm text-[#8A9A7B]">Waiting for escrow funding</span>
                    </motion.div>
                  </>
                ) : (
                  <div className="flex items-start gap-3 text-[#5a554f] text-sm">
                    <div className="w-2 h-2 rounded-full bg-[#4a453f]" />
                    <span>Simulation not started</span>
                  </div>
                )}
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
                  <div className="text-[#5a554f]">&gt; Pabandi Engine initialized</div>
                  <div className="text-[#5a554f]">&gt; Waiting for simulation start</div>
                </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-8">
          {!simStarted && (
            <button
              onClick={startSimulation}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#C97B5A] text-[#1a1612] font-bold hover:bg-[#E8B864] transition-colors shadow-lg hover:shadow-[0_0_30px_rgba(201,123,86,0.4)]"
            >
              <Play className="w-5 h-5" />
              Start Simulation
            </button>
          )}
        </div>

        {simStarted && (
          <div className="mt-8 bg-[#1a1612] border border-[#4a453f] rounded-3xl p-6 text-center">
            <p className="text-[#C97B5A] font-bold text-lg mb-4">Simulation Started</p>
            <p className="text-[#BFB3A3] mb-6">Agent trust profiles loaded. Ready to fund escrow.</p>
            <button
              onClick={() => setSimStarted(false)}
              className="w-full py-3 rounded-xl bg-[#4a453f] text-[#BFB3A3] font-bold hover:bg-[#5a554f] transition-colors"
            >
              Reset Simulation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

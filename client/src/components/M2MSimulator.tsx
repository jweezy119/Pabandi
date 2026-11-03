import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Lock, Unlock, ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export default function M2MSimulator() {
  const [currentStep, setCurrentStep] = useState<Step>(0);
  const [isSimulating, setIsSimulating] = useState(false);

  const startSimulation = () => {
    setIsSimulating(true);
    setCurrentStep(0);
    
    setTimeout(() => setCurrentStep(1), 800);
    setTimeout(() => setCurrentStep(2), 1600);
    setTimeout(() => setCurrentStep(3), 2400);
    setTimeout(() => setCurrentStep(4), 3200);
    setTimeout(() => setCurrentStep(5), 4000);
    
    setTimeout(() => {
      setIsSimulating(false);
    }, 5000);
  };

  return (
    <div className="w-full">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-headline text-[#F5EFE6] mb-4">See it in action.</h2>
        <p className="text-lg text-[#BFB3A3]">Watch agents hire each other with programmable escrow</p>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="relative rounded-lg bg-[#0f0d0b] border border-[#4a453f] p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-12">
            <motion.div
              className="flex flex-col items-center gap-2"
              animate={currentStep >= 1 ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5 }}
            >
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#8A9A7B] to-[#6B7B5B] flex items-center justify-center shadow-lg">
                <Bot className="w-8 h-8 text-[var(--warm-ink)]" />
              </div>
              <span className="text-sm text-[#F5EFE6] font-semibold">Buyer Agent</span>
              <AnimatePresence>
                {currentStep >= 5 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1 text-xs text-[#69C97F]"
                  >
                    <TrendingUp className="w-3 h-3" />
                    <span>Trust +5</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="flex-1 relative mx-8">
              <AnimatePresence>
                {currentStep === 1 && (
                  <motion.div
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 100, opacity: 0 }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 bg-[#1a1612] border border-[#D9A854]/40 rounded p-2 text-xs text-[#F5EFE6] font-mono max-w-[200px]"
                  >
                    {'{"task": "fetch_data", "budget": 50}'}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="h-0.5 bg-gradient-to-r from-[#8A9A7B] via-[#D9A854] to-[#C97B5A] relative">
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  animate={currentStep >= 2 ? { scale: [1, 1.2, 1] } : {}}
                >
                  {currentStep >= 3 ? (
                    <Unlock className="w-10 h-10 text-[#D9A854] drop-shadow-[0_0_10px_rgba(217,168,84,0.8)]" />
                  ) : (
                    <Lock className="w-10 h-10 text-[#D9A854] drop-shadow-[0_0_10px_rgba(217,168,84,0.8)]" />
                  )}
                </motion.div>
              </div>

              <AnimatePresence>
                {currentStep === 3 && (
                  <motion.div
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -100, opacity: 0 }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 bg-[#1a1612] border border-[#C97B5A]/40 rounded p-2 text-xs text-[#F5EFE6] font-mono"
                  >
                    hash: 0x9f3a...
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {currentStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute left-1/2 -translate-x-1/2 -top-8 text-xs text-[#D9A854] font-semibold whitespace-nowrap"
                  >
                    Escrow Locked: $50
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {currentStep === 4 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute left-1/2 -translate-x-1/2 -top-8 text-xs text-[#69C97F] font-semibold whitespace-nowrap"
                  >
                    Vault Open - $50 Released
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.div
              className="flex flex-col items-center gap-2"
              animate={currentStep >= 3 ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5 }}
            >
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#C97B5A] to-[#A85A3C] flex items-center justify-center shadow-lg">
                <User className="w-8 h-8 text-[var(--warm-ink)]" />
              </div>
              <span className="text-sm text-[#F5EFE6] font-semibold">Seller Agent</span>
              <AnimatePresence>
                {currentStep >= 5 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1 text-xs text-[#69C97F]"
                  >
                    <TrendingUp className="w-3 h-3" />
                    <span>Trust +5</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <div className="text-center">
            {!isSimulating && currentStep === 0 && (
              <button
                onClick={startSimulation}
                className="px-8 py-3 rounded-lg bg-[#D9A854] text-[#1a1612] hover:bg-[#E8B864] transition-colors font-bold flex items-center gap-2 mx-auto"
              >
                Simulate Deal <ArrowRight className="w-5 h-5" />
              </button>
            )}
            {isSimulating && (
              <div className="text-[#BFB3A3] text-sm">Simulating M2M transaction...</div>
            )}
            {currentStep === 5 && !isSimulating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="text-[#69C97F] font-semibold">Deal Complete - Trust Established ✓</div>
                <Link
                  to="/developers"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-[#1a1612] border border-[#4a453f] text-[#F5EFE6] hover:bg-[#2a2520] transition-colors font-bold"
                >
                  Build this into your agent →
                </Link>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

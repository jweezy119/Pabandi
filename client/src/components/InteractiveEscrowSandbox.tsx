import { useState, useEffect } from "react";
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ArrowPathIcon, 
  CurrencyDollarIcon, 
  ShieldCheckIcon, 
  UserIcon, 
  BuildingStorefrontIcon,
  SparklesIcon,
  TicketIcon
} from "@heroicons/react/24/outline";

type SandboxState = "IDLE" | "LOCKING" | "LOCKED" | "VERIFYING" | "SUCCESS" | "SLASHED";

export default function InteractiveEscrowSandbox() {
  const [state, setState] = useState<SandboxState>("IDLE");
  const [balance, setBalance] = useState(1500);
  const [escrow, setEscrow] = useState(0);
  const [reliabilityScore, setReliabilityScore] = useState(85);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (state === "LOCKING") {
      timeout = setTimeout(() => {
        setBalance((b) => b - 100);
        setEscrow(100);
        setState("LOCKED");
      }, 1500);
    } else if (state === "VERIFYING") {
      // Just waiting for the button action to resolve
    }
    return () => clearTimeout(timeout);
  }, [state]);

  const handleBook = () => {
    if (state !== "IDLE") return;
    setState("LOCKING");
  };

  const handleShowUp = () => {
    if (state !== "LOCKED") return;
    setState("VERIFYING");
    setTimeout(() => {
      setEscrow(0);
      setBalance((b) => b + 10); // Reward only, 100 goes to business
      setReliabilityScore((s) => Math.min(100, s + 5));
      setState("SUCCESS");
    }, 1500);
  };

  const handleNoShow = () => {
    if (state !== "LOCKED") return;
    setState("VERIFYING");
    setTimeout(() => {
      setEscrow(0);
      setReliabilityScore((s) => Math.max(0, s - 15));
      setState("SLASHED");
    }, 1500);
  };

  const handleReset = () => {
    setState("IDLE");
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 md:p-10 bg-surface-container-low rounded-3xl border border-outline-variant/20 shadow-xl font-body relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="text-center mb-10 relative z-10">
        <h2 className="font-headline text-2xl md:text-3xl font-bold text-on-surface flex items-center justify-center gap-2 mb-3">
          <ShieldCheckIcon className="w-8 h-8 text-primary" />
          Smart Contract Movement
        </h2>
        <p className="text-on-surface-variant text-sm max-w-2xl mx-auto">
          Watch how funds move through the Pabandi protocol. Lock a deposit, and see the outcome when you honor or miss your appointment.
        </p>
      </div>

      {/* Animated Diagram Area */}
      <div className="relative w-full py-12 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-inner flex flex-col md:flex-row items-center mb-10 z-10">
        
        {/* Connection Lines (Background) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none hidden md:flex">
          {/* Line: User to Escrow (Forward payment) */}
          <div className="absolute left-[16.66%] w-[33.33%] h-1 bg-outline-variant/30 rounded-full overflow-hidden">
             <div className={`h-full transition-all duration-1000 ${
               (state === 'LOCKING' || state === 'LOCKED' || state === 'VERIFYING') ? 'bg-primary w-full origin-left' :
               'w-0'
             }`} />
          </div>
          {/* Line: Escrow to User (Reward & NFT) */}
          <div className="absolute left-[16.66%] w-[33.33%] h-1 -mt-8 bg-outline-variant/30 rounded-full overflow-hidden">
             <div className={`h-full transition-all duration-1000 ${
               state === 'SUCCESS' ? 'bg-purple-500 w-full float-right origin-right' : 
               'w-0'
             }`} />
          </div>
          {/* Line: Escrow to Business (Payment or Penalty) */}
          <div className="absolute right-[16.66%] w-[33.33%] h-1 bg-outline-variant/30 rounded-full overflow-hidden">
             <div className={`h-full transition-all duration-1000 origin-left ${
                state === 'SLASHED' ? 'bg-red-500 w-full' : 
                state === 'SUCCESS' ? 'bg-green-500 w-full' : 'w-0'
             }`} />
          </div>
        </div>

        {/* Moving Tokens (Desktop only) */}
        
        {/* Token 1: User -> Escrow -> Business */}
        <div className={`hidden md:flex absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full z-20 items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.2)] transition-all duration-1000 ease-in-out ${
          state === 'IDLE' ? 'left-[16.66%] -translate-x-1/2 opacity-0 scale-50 bg-primary' :
          state === 'LOCKING' ? 'left-1/2 -translate-x-1/2 opacity-100 scale-100 bg-amber-500' :
          state === 'LOCKED' || state === 'VERIFYING' ? 'left-1/2 -translate-x-1/2 opacity-0 scale-50 bg-blue-500' :
          state === 'SUCCESS' ? 'left-[83.33%] -translate-x-1/2 opacity-100 scale-100 bg-green-500' :
          state === 'SLASHED' ? 'left-[83.33%] -translate-x-1/2 opacity-100 scale-100 bg-red-500' : ''
        }`}>
          <CurrencyDollarIcon className="w-5 h-5 text-white" />
        </div>

        {/* Token 2: Escrow -> User (NFT Review Mint & Reward) */}
        <div className={`hidden md:flex absolute top-1/2 -mt-4 -translate-y-1/2 w-8 h-8 rounded-full z-20 items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.2)] transition-all duration-1000 ease-in-out ${
          state === 'SUCCESS' ? 'left-[16.66%] -translate-x-1/2 opacity-100 scale-100 bg-purple-500' : 'left-1/2 -translate-x-1/2 opacity-0 scale-50 bg-purple-500'
        }`}>
          <TicketIcon className="w-5 h-5 text-white" />
        </div>

        {/* User Node */}
        <div className="flex-1 flex flex-col items-center z-10 w-full md:w-auto relative group pt-10">
          
          {/* NFT Minted Badge Alert (Moved outside text box so it floats above the circle) */}
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg transition-all duration-500 whitespace-nowrap ${state === 'SUCCESS' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
            <SparklesIcon className="w-3 h-3" />
            Review NFT Minted!
          </div>

          <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 transition-colors duration-500 bg-surface shadow-md relative z-10 ${state === 'SUCCESS' ? 'border-purple-500 shadow-purple-500/20' : 'border-primary'}`}>
            <UserIcon className={`w-8 h-8 ${state === 'SUCCESS' ? 'text-purple-500' : 'text-primary'}`} />
          </div>
          <div className="mt-4 text-center bg-surface-container px-6 py-3 rounded-2xl border border-outline-variant/10 shadow-sm w-56 relative">
            <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1">Your Wallet</p>
            <p className="font-black text-on-surface text-2xl">{balance} <span className="text-sm text-primary">$PAB</span></p>
            <div className="mt-2 pt-2 border-t border-outline-variant/10">
              <p className="text-[11px] font-bold text-on-surface-variant">Trust Score: <span className={reliabilityScore > 80 ? 'text-green-500' : reliabilityScore < 50 ? 'text-red-500' : 'text-amber-500'}>{reliabilityScore}/100</span></p>
            </div>
            
            {state === 'SUCCESS' && (
               <p className="text-[10px] font-bold text-purple-500 mt-1 animate-pulse">+10 $PAB Reward</p>
            )}
          </div>
        </div>

        {/* Escrow Node */}
        <div className="flex-1 flex flex-col items-center z-10 w-full md:w-auto mt-16 md:mt-0 relative">
          {/* Mobile connecting line */}
          <div className="md:hidden absolute -top-16 left-1/2 -translate-x-1/2 w-1 h-16 bg-outline-variant/30" />
          
          <div className={`w-24 h-24 rounded-full flex items-center justify-center border-4 transition-all duration-500 shadow-2xl relative z-10 ${
            state === 'IDLE' ? 'bg-surface border-outline-variant/30 opacity-60 scale-90' : 
            state === 'LOCKING' ? 'bg-amber-500/10 border-amber-500 scale-110' :
            state === 'VERIFYING' ? 'bg-primary/20 border-primary animate-pulse scale-105' :
            (state === 'LOCKED' || state === 'SUCCESS' || state === 'SLASHED') ? 'bg-blue-500/10 border-blue-500 scale-100' : ''
          }`}>
            {state === 'VERIFYING' ? (
              <ArrowPathIcon className="w-12 h-12 text-primary animate-spin" />
            ) : (
              <ShieldCheckIcon className={`w-12 h-12 ${state === 'IDLE' ? 'text-outline-variant' : 'text-blue-500'}`} />
            )}
            
            {/* The trapped funds inside Escrow */}
            {(state === 'LOCKED' || state === 'VERIFYING') && (
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-12 h-12 bg-blue-500 text-white font-black text-sm rounded-full flex flex-col items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                   {escrow}
                   <span className="text-[8px] font-medium opacity-80 leading-none">$PAB</span>
                 </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 text-center w-56">
            <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1">Smart Contract</p>
            <p className="text-[12px] font-bold h-4">
              {state === 'IDLE' && <span className="text-on-surface-variant">Waiting...</span>}
              {state === 'LOCKING' && <span className="text-amber-500">Locking funds...</span>}
              {state === 'LOCKED' && <span className="text-blue-500">Funds Secured</span>}
              {state === 'VERIFYING' && <span className="text-primary">Validating...</span>}
              {state === 'SUCCESS' && <span className="text-green-500">Paying & Minting NFT...</span>}
              {state === 'SLASHED' && <span className="text-red-500">Slashing for Penalty!</span>}
            </p>
          </div>
        </div>

        {/* Business Node */}
        <div className="flex-1 flex flex-col items-center z-10 w-full md:w-auto mt-16 md:mt-0 relative pt-10">
          {/* Mobile connecting line */}
          <div className="md:hidden absolute -top-16 left-1/2 -translate-x-1/2 w-1 h-16 bg-outline-variant/30" />

          <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 transition-colors duration-500 bg-surface shadow-md relative z-10 ${
            state === 'SLASHED' ? 'border-red-500 shadow-red-500/20 bg-red-500/10' : 
            state === 'SUCCESS' ? 'border-green-500 shadow-green-500/20 bg-green-500/10' :
            'border-outline-variant/30'
          }`}>
            <BuildingStorefrontIcon className={`w-8 h-8 ${
              state === 'SLASHED' ? 'text-red-500' : 
              state === 'SUCCESS' ? 'text-green-500' :
              'text-on-surface-variant'
            }`} />
          </div>
          <div className="mt-4 text-center bg-surface-container px-6 py-3 rounded-2xl border border-outline-variant/10 shadow-sm w-48 relative">
            <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mb-1">Business</p>
            <p className="font-black text-on-surface text-2xl">{(state === 'SLASHED' || state === 'SUCCESS') ? '+100' : '0'} <span className="text-sm text-primary">$PAB</span></p>
            <div className="mt-2 pt-2 border-t border-outline-variant/10 h-8 flex items-center justify-center">
              {state === 'SUCCESS' ? (
                <p className="text-[11px] font-bold text-green-500">Service Payment</p>
              ) : state === 'SLASHED' ? (
                <p className="text-[11px] font-bold text-red-500">No-Show Penalty</p>
              ) : (
                <p className="text-[11px] font-bold text-on-surface-variant">Awaiting Funds</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row gap-4 justify-center relative z-10 max-w-2xl mx-auto">
        {state === 'IDLE' && (
          <button onClick={handleBook} className="w-full px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-[#06b6d4] text-on-primary font-bold shadow-[0_8px_20px_rgba(6,182,212,0.2)] hover:shadow-[0_8px_25px_rgba(6,182,212,0.3)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
            <CheckCircleIcon className="w-6 h-6" />
            Book Appointment (Lock 100 $PAB)
          </button>
        )}
        
        {state === 'LOCKED' && (
          <>
            <button onClick={handleShowUp} className="flex-1 py-4 rounded-xl bg-green-500 text-white font-bold shadow-[0_8px_20px_rgba(34,197,94,0.2)] hover:shadow-[0_8px_25px_rgba(34,197,94,0.3)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
              <CheckCircleIcon className="w-6 h-6" />
              Simulate Show Up
            </button>
            <button onClick={handleNoShow} className="flex-1 py-4 rounded-xl bg-red-500 text-white font-bold shadow-[0_8px_20px_rgba(239,68,68,0.2)] hover:shadow-[0_8px_25px_rgba(239,68,68,0.3)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
              <XCircleIcon className="w-6 h-6" />
              Simulate No-Show
            </button>
          </>
        )}

        {(state === 'SUCCESS' || state === 'SLASHED') && (
          <button onClick={handleReset} className="w-full px-8 py-4 rounded-xl bg-surface-container-highest text-on-surface font-bold shadow-sm hover:bg-outline-variant/20 transition-all flex items-center justify-center gap-2">
            <ArrowPathIcon className="w-6 h-6" />
            Reset Simulator
          </button>
        )}
      </div>
    </div>
  );
}

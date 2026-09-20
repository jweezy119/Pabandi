import React, { useState } from 'react';

interface OnboardingStep {
  step: number;
  total: number;
  targetId: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    step: 1,
    total: 6,
    targetId: 'balance-card',
    title: 'Your Balance',
    content: 'This is your total portfolio value in USD. It includes both USDC and PAB tokens — converted automatically at the best rate.',
    position: 'bottom',
  },
  {
    step: 2,
    total: 6,
    targetId: 'trust-tier',
    title: 'Trust Tier',
    content: 'Your trust tier determines the deals you get. Stake PAB to level up — Silver, Gold, Platinum. Higher tiers = bigger discounts.',
    position: 'bottom',
  },
  {
    step: 3,
    total: 6,
    targetId: 'pay-rent-btn',
    title: 'Pay Rent',
    content: 'Click here to pay rent. You can use USDC or PAB. PAB gives you a 5% discount! The agent handles all the crypto — you only see USD.',
    position: 'right',
  },
  {
    step: 4,
    total: 6,
    targetId: 'staking-card',
    title: 'Stake PAB',
    content: 'Earn up to 12% APY by staking PAB. Higher stakes unlock better trust tiers. Your PAB is locked for 7 days minimum.',
    position: 'left',
  },
  {
    step: 5,
    total: 6,
    targetId: 'maintenance-btn',
    title: 'Maintenance Requests',
    content: 'Need something fixed? Submit a request here. Stake PAB for priority processing — your request jumps the queue.',
    position: 'right',
  },
  {
    step: 6,
    total: 6,
    targetId: 'history-card',
    title: 'Payment History',
    content: 'Track all your payments here. See how much you saved with PAB discounts. Export for your records.',
    position: 'top',
  },
];

interface OnboardingTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  const step = ONBOARDING_STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setCompleted(true);
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const getTooltipPosition = () => {
    const target = document.getElementById(step.targetId);
    if (!target) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const rect = target.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    switch (step.position) {
      case 'top':
        return { top: rect.top + scrollY - 180, left: rect.left + scrollX + rect.width / 2 - 160 };
      case 'bottom':
        return { top: rect.bottom + scrollY + 16, left: rect.left + scrollX + rect.width / 2 - 160 };
      case 'left':
        return { top: rect.top + scrollY + rect.height / 2 - 80, left: rect.left + scrollX - 340 };
      case 'right':
        return { top: rect.top + scrollY + rect.height / 2 - 80, left: rect.right + scrollX + 16 };
      default:
        return { top: rect.bottom + scrollY + 16, left: rect.left + scrollX + rect.width / 2 - 160 };
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onSkip}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 9998,
        }}
      />

      {/* Highlight target */}
      <div
        style={{
          position: 'absolute',
          ...(() => {
            const target = document.getElementById(step.targetId);
            if (!target) return { display: 'none' };
            const rect = target.getBoundingClientRect();
            return {
              top: rect.top + window.scrollY - 4,
              left: rect.left + window.scrollX - 4,
              width: rect.width + 8,
              height: rect.height + 8,
            };
          })(),
          borderRadius: 12,
          border: '2px solid #14f195',
          boxShadow: '0 0 20px rgba(20,241,149,0.4)',
          zIndex: 9999,
          pointerEvents: 'none',
          transition: 'all 0.3s ease',
        }}
      />

      {/* Tooltip */}
      <div
        style={{
          position: 'absolute',
          ...getTooltipPosition(),
          width: 320,
          padding: '20px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.95))',
          border: '1px solid rgba(20,241,149,0.3)',
          backdropFilter: 'blur(12px)',
          zIndex: 10000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          {Array.from({ length: ONBOARDING_STEPS.length }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i <= currentStep ? '#14f195' : 'rgba(148,163,184,0.2)',
              }}
            />
          ))}
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
            {currentStep + 1}/{ONBOARDING_STEPS.length}
          </span>
        </div>

        {/* Title */}
        <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>
          {step.title}
        </h4>

        {/* Content */}
        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
          {step.content}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <button
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: 12,
              cursor: 'pointer',
              padding: '6px 0',
            }}
          >
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid rgba(148,163,184,0.3)',
                  background: 'transparent',
                  color: '#94a3b8',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: 'linear-gradient(135deg, #14f195, #059669)',
                color: '#0f172a',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {currentStep === ONBOARDING_STEPS.length - 1 ? "Let's Go!" : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingTour;

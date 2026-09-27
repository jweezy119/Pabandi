import React, { useEffect, useRef } from 'react';

interface ClayDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  position?: 'left' | 'right';
  width?: string;
  showClose?: boolean;
}

export function ClayDrawer({ isOpen, onClose, title, children, position = 'right', width = '380px', showClose = true }: ClayDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50"
          style={{ backgroundColor: 'rgba(42,37,32,0.25)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}
      <div
        ref={drawerRef}
        className={`fixed top-0 h-full z-50 clay-drawer ${position === 'right' ? 'right-0' : 'left-0'} ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          width,
          maxWidth: '100vw',
          backgroundColor: 'var(--warm-sand)',
          boxShadow: position === 'right'
            ? '-8px 0 24px rgba(180,130,90,0.08)'
            : '8px 0 24px rgba(180,130,90,0.08)',
          transform: isOpen ? 'translateX(0)' : (position === 'right' ? 'translateX(100%)' : 'translateX(-100%)'),
          transition: 'transform 300ms var(--ease-smooth)',
          display: 'flex',
          flexDirection: 'column',
        }}
        role="dialog"
        aria-modal="true"
      >
        {(title || showClose) && (
          <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(191,179,163,0.2)' }}>
            {title && (
              <h2 className="text-lg font-bold" style={{ color: 'var(--warm-ink)', fontFamily: 'var(--font-headline)', letterSpacing: '-0.01em' }}>
                {title}
              </h2>
            )}
            {showClose && (
              <button
                onClick={onClose}
                className="rounded-full p-2 transition-colors hover:bg-[var(--warm-sand)]/60"
                style={{ color: 'var(--soft-stone)' }}
                aria-label="Close drawer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </>
  );
}

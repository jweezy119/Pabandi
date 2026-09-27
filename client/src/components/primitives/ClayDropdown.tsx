import React, { useState, useRef, useEffect } from 'react';

interface ClayDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  align?: 'left' | 'right';
  className?: string;
}

export function ClayDropdown({ trigger, children, position = 'bottom-left', align = 'left', className = '' }: ClayDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      if (rect.bottom > window.innerHeight) {
        menuRef.current.style.maxHeight = `${window.innerHeight - rect.top - 8}px`;
      }
    }
  }, [isOpen]);

  const positionStyles: Record<string, React.CSSProperties> = {
    'bottom-left': { top: '100%', left: 0, marginTop: '4px' },
    'bottom-right': { top: '100%', right: 0, marginTop: '4px' },
    'top-left': { bottom: '100%', left: 0, marginBottom: '4px' },
    'top-right': { bottom: '100%', right: 0, marginBottom: '4px' },
  };

  return (
    <div className={`relative inline-block ${className}`} ref={triggerRef}>
      <div onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>
      {isOpen && (
        <div
          ref={menuRef}
          className="clay-dropdown-menu-clay absolute z-50 rounded-xl overflow-hidden"
          style={{
            ...positionStyles[position],
            backgroundColor: 'white',
            border: '1px solid rgba(191,179,163,0.3)',
            boxShadow: '0 8px 24px rgba(42,37,32,0.12), 0 2px 4px rgba(180,130,90,0.06)',
            minWidth: '160px',
            ...(align === 'right' ? { right: 0, left: 'auto' } : {}),
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

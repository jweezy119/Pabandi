import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let sequence = '';

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Cmd+K for Search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Here we could open a global search modal, if one exists
        console.log('Cmd+K pressed');
        return;
      }

      // Sequential shortcuts (g then something)
      const key = e.key.toLowerCase();
      sequence += key;
      
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => { sequence = ''; }, 1000);

      if (sequence === 'gd') {
        navigate('/dashboard');
        sequence = '';
      } else if (sequence === 'gc') {
        navigate('/contact');
        sequence = '';
      } else if (sequence === 'gp') {
        navigate('/property');
        sequence = '';
      } else if (sequence === 'gl') {
        navigate('/ledger');
        sequence = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeoutId);
    };
  }, [navigate]);
}

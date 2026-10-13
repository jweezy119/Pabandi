import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Keyboard navigation for the CRM.
 *
 * This hook existed and was called from nowhere, and its ⌘K handler did
 * `console.log('Cmd+K pressed')` with a comment saying a global search modal could be
 * opened "if one exists". One does now.
 *
 * The `g`-then-key sequences it already defined all point at routes that exist
 * (`/dashboard`, `/contact`, `/property`, `/capital` — each verified against App.tsx),
 * so they are kept as written.
 *
 * Two details that are easy to get wrong and are handled explicitly:
 *
 *   - Keystrokes are ignored while focus is in a field, in any element that is
 *     editable, or inside the command palette. Without the contentEditable check,
 *     typing "c" into a note whose text was selected would navigate away and lose
 *     the typing — and with ⌘K open, typing "clients" would fire `gc` and close it.
 *   - The sequence resets after a second, so a stray `g` does not leave a letter
 *     pending indefinitely and fire a jump minutes later.
 */
export function useKeyboardShortcuts(options?: {
  /** Opens the command palette. ⌘K is ignored while this is absent. */
  onOpenPalette?: () => void;
}) {
  const navigate = useNavigate();
  const onOpenPalette = options?.onOpenPalette;

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let sequence = '';

    const isTyping = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node || !node.tagName) return false;
      const tag = node.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        node.isContentEditable === true
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K works from anywhere, including from inside a field — it is a shortcut to
      // search, not a character anyone is typing.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (!onOpenPalette) return;
        e.preventDefault();
        onOpenPalette();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      const key = e.key.toLowerCase();
      if (key.length !== 1) return;

      sequence += key;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => { sequence = ''; }, 1000);

      const go = (href: string) => {
        sequence = '';
        navigate(href);
      };

      if (sequence === 'gd') go('/dashboard');
      else if (sequence === 'gc') go('/contact');
      else if (sequence === 'gp') go('/property');
      else if (sequence === 'gl') go('/capital');
      else if (sequence === 'gs') go('/contact/settings');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeoutId);
    };
  }, [navigate, onOpenPalette]);
}
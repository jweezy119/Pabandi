import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/api';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export function useTelegramWebApp() {
  const { isAuthenticated, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [isInsideTelegram, setIsInsideTelegram] = useState(false);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const authAttempted = useRef(false);
  const mainButtonHandler = useRef<(() => void) | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    // Detect if actually running inside a Telegram WebApp container.
    // On desktop browsers, telegram-web-app.js still creates a stub object with
    // empty initData, platform === 'unknown', and version === '6.0'; calling
    // Mini App APIs on the desktop stub emits noisy console warnings.
    const hasInitData = Boolean(tg.initData && typeof tg.initData === 'string' && tg.initData.length > 0);
    const hasTelegramPlatform = Boolean(tg.platform && tg.platform !== 'unknown');
    if (!hasInitData && !hasTelegramPlatform) {
      setIsInsideTelegram(false);
      return;
    }

    setIsInsideTelegram(true);

    if (tg.initDataUnsafe?.user) {
      setTelegramUser(tg.initDataUnsafe.user);
    }

    const supports = (version: string) =>
      typeof tg.isVersionAtLeast === 'function' ? Boolean(tg.isVersionAtLeast(version)) : false;

    let onBack: (() => void) | undefined;

    try {
      // 1. Tell Telegram the Mini App is ready to display
      tg.ready();

      // 2. Expand full-height inside the chat
      tg.expand();

      // 3. Match Pabandi dark command aesthetic (supported in Bot API 6.1+)
      if (supports('6.1') && typeof tg.setHeaderColor === 'function') {
        tg.setHeaderColor('#0a1118');
      }
      if (supports('6.1') && typeof tg.setBackgroundColor === 'function') {
        tg.setBackgroundColor('#0a1118');
      }

      // 4. Protect against accidental swipe-to-close during active forms (6.2+)
      if (supports('6.2') && typeof tg.enableClosingConfirmation === 'function') {
        tg.enableClosingConfirmation();
      }

      // 4b. Telegram's native Back button — Android hardware/nav works without
      // requiring the app's own hamburger to be reachable behind a form.
      if (supports('5.1') && tg.BackButton && typeof tg.BackButton.onClick === 'function') {
        onBack = () => navigate(-1);
        tg.BackButton.onClick(onBack);
        tg.BackButton.show();
      }

      // 5. Zero-Click Silent Authentication for Mini App visitors
      if (!isAuthenticated && hasInitData && !authAttempted.current) {
        authAttempted.current = true;
        authService
          .telegramAuth({ initData: tg.initData })
          .then((res) => {
            const { user, token, refreshToken } = res.data?.data || {};
            if (user && token) {
              setAuth(user, token, refreshToken);
            }
          })
          .catch((err) => {
            console.warn('[TelegramMiniApp] Auto-auth skipped/failed:', err?.message);
          });
      }
    } catch (e) {
      console.warn('[TelegramMiniApp] Initialization error:', e);
    }

    return () => {
      if (onBack && tg.BackButton) {
        tg.BackButton.offClick(onBack);
        tg.BackButton.hide();
      }
    };
  }, [isAuthenticated, setAuth, navigate]);

  const closeWebApp = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && typeof tg.close === 'function') {
      tg.close();
    }
  };

  // Contextual primary action (e.g. "Create Invoice") in Telegram's native
  // sticky MainButton, so phone users never have to scroll a long form to save.
  const showMainButton = useCallback((text: string, onClick: () => void) => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.MainButton) return;
    if (mainButtonHandler.current && typeof tg.MainButton.offClick === 'function') {
      tg.MainButton.offClick(mainButtonHandler.current);
    }
    mainButtonHandler.current = onClick;
    tg.MainButton.setText(text);
    tg.MainButton.onClick(onClick);
    tg.MainButton.show();
  }, []);

  const hideMainButton = useCallback(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.MainButton) return;
    if (mainButtonHandler.current && typeof tg.MainButton.offClick === 'function') {
      tg.MainButton.offClick(mainButtonHandler.current);
    }
    mainButtonHandler.current = null;
    tg.MainButton.hide();
  }, []);

  return {
    isInsideTelegram,
    telegramUser,
    closeWebApp,
    showMainButton,
    hideMainButton,
  };
}


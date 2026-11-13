import { useEffect, useRef, useState } from 'react';
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
  const [isInsideTelegram, setIsInsideTelegram] = useState(false);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const authAttempted = useRef(false);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    // Detect if running inside Telegram
    const hasInitData = Boolean(tg.initData && typeof tg.initData === 'string' && tg.initData.length > 0);
    setIsInsideTelegram(true);

    if (tg.initDataUnsafe?.user) {
      setTelegramUser(tg.initDataUnsafe.user);
    }

    try {
      // 1. Tell Telegram the Mini App is ready to display
      tg.ready();

      // 2. Expand full-height inside the chat
      tg.expand();

      // 3. Match Pabandi dark command aesthetic
      if (typeof tg.setHeaderColor === 'function') {
        tg.setHeaderColor('#0a1118');
      }
      if (typeof tg.setBackgroundColor === 'function') {
        tg.setBackgroundColor('#0a1118');
      }

      // 4. Protect against accidental swipe-to-close during active forms
      if (typeof tg.enableClosingConfirmation === 'function') {
        tg.enableClosingConfirmation();
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
  }, [isAuthenticated, setAuth]);

  const closeWebApp = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && typeof tg.close === 'function') {
      tg.close();
    }
  };

  return {
    isInsideTelegram,
    telegramUser,
    closeWebApp,
  };
}


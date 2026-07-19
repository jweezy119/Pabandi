import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import { Helmet } from 'react-helmet-async';

export default function ShopifyAppBridge() {
  const [searchParams] = useSearchParams();
  const shop = searchParams.get('shop');
  const { user, isAuthenticated, token } = useAuthStore();
  const [isLinked, setIsLinked] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    // If authenticated and shop is present, link the store
    const linkStore = async () => {
      if (isAuthenticated && shop && token && !isLinked && !isLinking) {
        setIsLinking(true);
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/shopify/connect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ shop })
          });
          if (response.ok) {
            setIsLinked(true);
          }
        } catch (error) {
          console.error("Failed to link store", error);
        } finally {
          setIsLinking(false);
        }
      }
    };
    
    linkStore();
  }, [isAuthenticated, shop, token, isLinked]);

  if (!shop) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="p-8 text-center max-w-md">
          <h2 className="text-xl font-bold font-headline mb-2 text-on-surface">Invalid Shopify Session</h2>
          <p className="text-on-surface-variant text-sm">
            This page must be loaded from within the Shopify Admin panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest p-6 font-body">
      <Helmet>
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
        <meta name="shopify-api-key" content={import.meta.env.VITE_SHOPIFY_API_KEY || "022dcfed1c002a1f6a9ce6a655aefab4"} />
      </Helmet>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-outline-variant/30">
          <div>
            <h1 className="text-2xl font-bold font-headline text-on-surface">Pabandi Escrow Checkout</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Connected Store: <span className="font-medium text-on-surface">{shop}</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <ShieldCheckIcon className="w-6 h-6" />
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="bg-primary-container/20 border border-primary/20 rounded-2xl p-8 text-center max-w-lg mx-auto">
            <h3 className="text-lg font-bold text-on-surface mb-2">Connect Your Pabandi Account</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              To process escrow payments on your store, link your Pabandi Business account.
            </p>
            <button 
              onClick={() => window.open('/', '_blank')}
              className="px-6 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl hover:opacity-90 transition-opacity mb-4"
            >
              Log in to Pabandi
            </button>
            <p className="text-xs text-on-surface-variant">After logging in, refresh this page.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface border border-outline-variant/30 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2 mb-4">
                {isLinked ? (
                  <><CheckCircleIcon className="w-5 h-5 text-green-500" /> Account Linked</>
                ) : (
                  <span className="text-yellow-600">Linking Account...</span>
                )}
              </h3>
              <p className="text-sm text-on-surface-variant mb-1">
                Business Name: <span className="font-bold text-on-surface">{user?.firstName} {user?.lastName}</span>
              </p>
              <p className="text-sm text-on-surface-variant mb-6">
                Trust Score: <span className="font-bold text-green-600">82 (High)</span>
              </p>
              
              <button 
                className="w-full py-2.5 bg-surface-container-high border border-outline-variant/30 text-on-surface font-bold text-sm rounded-xl hover:bg-surface-container-highest transition-colors"
              >
                Disconnect Account
              </button>
            </div>

            <div className="bg-surface border border-outline-variant/30 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-on-surface mb-1">Payment Method Status</h3>
              <p className="text-sm text-on-surface-variant mb-4">
                Configure how Pabandi appears at checkout.
              </p>
              
              <div className="flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant/30 rounded-xl mb-4">
                <div>
                  <p className="font-bold text-sm text-on-surface">Escrow Checkout</p>
                  <p className="text-xs text-on-surface-variant">Active on your storefront</p>
                </div>
                <div className="w-10 h-6 bg-primary rounded-full relative">
                  <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1 shadow-sm" />
                </div>
              </div>

              <button className="w-full py-2.5 bg-primary text-on-primary font-bold text-sm rounded-xl hover:opacity-90 transition-opacity">
                Save Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

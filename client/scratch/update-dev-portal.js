const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/DeveloperPortalPage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add imports
content = content.replace(
  `import { API_HOST } from '../services/api';`,
  `import { API_HOST } from '../services/api';\nimport { executeBscDeposit, executeSolanaDeposit, PABANDI_TREASURY_BSC, PABANDI_TREASURY_SOLANA } from '../utils/web3';`
);

// 2. Add State and effects inside the component
const componentStart = `export default function DeveloperPortalPage() {`;
const stateToAdd = `
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'safepay' | 'solana' | 'bsc' | 'free'>('safepay');
  const [apiKeyGenerated, setApiKeyGenerated] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Check for safepay callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('safepay_mock_success') === 'true' || params.get('tracker')) {
      const ref = params.get('ref') || params.get('reference');
      if (ref && ref.startsWith('api_sub_')) {
        // Automatically verify
        verifySubscription(ref, 'safepay');
      }
    }
  }, []);

  const verifySubscription = async (txHash: string, method: string) => {
    setIsProcessing(true);
    try {
      // In a real app we'd get email/company from local storage or context since we redirected.
      // For MVP, we'll use placeholder if they disappeared.
      const savedEmail = localStorage.getItem('api_sub_email') || 'dev@example.com';
      const savedCompany = localStorage.getItem('api_sub_company') || 'My App';
      const savedTier = localStorage.getItem('api_sub_tier') || 'growth';

      const res = await fetch(\`\${API_HOST}/api/v1/api-subscription/verify\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: savedTier,
          email: savedEmail,
          companyName: savedCompany,
          paymentMethod: method,
          transactionHash: txHash
        })
      });
      const data = await res.json();
      if (data.success && data.apiKey) {
        setApiKeyGenerated(data.apiKey);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubscribe = async () => {
    if (!email || !company) return alert('Email and Company Name are required.');
    
    // Save to local storage in case of redirect
    localStorage.setItem('api_sub_email', email);
    localStorage.setItem('api_sub_company', company);
    localStorage.setItem('api_sub_tier', selectedTier || 'starter');

    setIsProcessing(true);

    try {
      if (selectedTier === 'starter') {
        // Free tier
        await verifySubscription(\`free_\${Date.now()}\`, 'free');
        return;
      }

      if (paymentMethod === 'safepay') {
        const res = await fetch(\`\${API_HOST}/api/v1/api-subscription/safepay\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: selectedTier, email, companyName: company })
        });
        const data = await res.json();
        if (data.success && data.url) {
          window.location.href = data.url;
        } else {
          alert('Failed to initialize Safepay: ' + data.error);
        }
      } else if (paymentMethod === 'solana') {
        // $99 = ~0.7 SOL
        const amount = selectedTier === 'growth' ? 0.7 : 3.5;
        const result = await executeSolanaDeposit(amount, PABANDI_TREASURY_SOLANA);
        if (result.success && result.transactionHash) {
          await verifySubscription(result.transactionHash, 'solana');
        } else {
          alert(result.error);
        }
      } else if (paymentMethod === 'bsc') {
        // $99 = ~0.3 BNB
        const amount = selectedTier === 'growth' ? '0.3' : '1.5';
        const result = await executeBscDeposit(amount, PABANDI_TREASURY_BSC);
        if (result.success && result.transactionHash) {
          await verifySubscription(result.transactionHash, 'bsc');
        } else {
          alert(result.error);
        }
      }
    } catch (e) {
      console.error(e);
      alert('Subscription failed');
    } finally {
      setIsProcessing(false);
    }
  };
`;

content = content.replace(componentStart, componentStart + '\n' + stateToAdd);

// 3. Update the CTA text in Tiers
content = content.replace(/'Get Started Free'/g, "selectedTier === 'starter' ? 'Selected' : 'Get Started Free'");
content = content.replace(/'Start Free Trial'/g, "selectedTier === 'growth' ? 'Selected' : 'Buy Growth Tier'");
content = content.replace(/'Contact Sales'/g, "selectedTier === 'enterprise' ? 'Selected' : 'Buy Enterprise'");

content = content.replace(
  /onClick=\{\(\) => \{ if \(email && company\) setSubmitted\(true\); \}\}/g,
  `onClick={handleSubscribe} disabled={isProcessing || !selectedTier}`
);

// 4. Update the "Get Your API Key" Form
const oldFormStart = `<h2 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '8px' }}>Get Your API Key</h2>`;
const newFormStart = `<h2 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '8px' }}>Get Your API Key</h2>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px', lineHeight: 1.6 }}>
                Subscribe to access Live Reliability Scores.
              </p>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <button 
                  onClick={() => setSelectedTier('starter')}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: selectedTier === 'starter' ? '1px solid #4ade80' : '1px solid #334155', background: selectedTier === 'starter' ? 'rgba(74, 222, 128, 0.1)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}
                >Starter</button>
                <button 
                  onClick={() => setSelectedTier('growth')}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: selectedTier === 'growth' ? '1px solid #818cf8' : '1px solid #334155', background: selectedTier === 'growth' ? 'rgba(129, 140, 248, 0.1)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}
                >Growth ($99)</button>
                <button 
                  onClick={() => setSelectedTier('enterprise')}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: selectedTier === 'enterprise' ? '1px solid #fb923c' : '1px solid #334155', background: selectedTier === 'enterprise' ? 'rgba(251, 146, 60, 0.1)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}
                >Enterprise ($499)</button>
              </div>

              {selectedTier && selectedTier !== 'starter' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  <button 
                    onClick={() => setPaymentMethod('safepay')}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: paymentMethod === 'safepay' ? '1px solid #fff' : '1px solid #334155', background: paymentMethod === 'safepay' ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}
                  >Safepay (Card)</button>
                  <button 
                    onClick={() => setPaymentMethod('solana')}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: paymentMethod === 'solana' ? '1px solid #14F195' : '1px solid #334155', background: paymentMethod === 'solana' ? 'rgba(20, 241, 149, 0.1)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}
                  >Solana</button>
                  <button 
                    onClick={() => setPaymentMethod('bsc')}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: paymentMethod === 'bsc' ? '1px solid #F3BA2F' : '1px solid #334155', background: paymentMethod === 'bsc' ? 'rgba(243, 186, 47, 0.1)' : 'transparent', color: '#e2e8f0', cursor: 'pointer' }}
                  >BSC (BNB)</button>
                </div>
              )}
`;

content = content.replace(
  /<h2 style=\{\{ fontSize: '26px', fontWeight: 700, marginBottom: '8px' \}\}>Get Your API Key<\/h2>[\s\S]*?<input\n\s*type="text"/m,
  newFormStart + `\n              <input\n                type="text"`
);

// 5. Success screen replacement
const successScreen = `{apiKeyGenerated ? (
            <div>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔑</div>
              <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Payment Successful!</h3>
              <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>Here is your Live Reliability Score API Key. Keep it secret.</p>
              
              <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '24px' }}>
                <code style={{ flex: 1, color: '#4ade80', fontSize: '14px' }}>{apiKeyGenerated}</code>
                <button onClick={() => handleCopy(apiKeyGenerated, 'api-key')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  {copied === 'api-key' ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <Link to="/" style={{ display: 'inline-block', color: '#818cf8', fontSize: '14px', fontWeight: 600 }}>← Back to Pabandi</Link>
            </div>
          ) : submitted ? (`;

content = content.replace(/\{submitted \? \(/, successScreen);

// Update button text
content = content.replace(/Request Early Access →/, "{isProcessing ? 'Processing...' : 'Complete Purchase →'}");
content = content.replace(/No credit card required for Starter tier./, "Powered by Safepay & Web3.");

fs.writeFileSync(filePath, content);
console.log('Update script completed successfully!');

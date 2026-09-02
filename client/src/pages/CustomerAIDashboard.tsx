import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Surface, Button, Badge, tokens } from '../design-system';

interface PropertyRecommendation {
  id: string;
  title: string;
  address: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  matchScore: number;
  matchReasons: string[];
  image: string;
}

interface AiInsight {
  id: string;
  type: 'tip' | 'alert' | 'opportunity';
  title: string;
  description: string;
  action?: string;
  actionLink?: string;
}

interface AffordabilityResult {
  maxMonthlyPayment: number;
  maxPurchasePrice: number;
  recommendedBudget: number;
  downPaymentNeeded: number;
  monthlyBreakdown: {
    mortgage: number;
    tax: number;
    insurance: number;
    hoa: number;
  };
}

export const CustomerAIDashboard: React.FC = () => {
  const [tab, setTab] = useState<'discover' | 'affordability' | 'saved' | 'ai'>('discover');
  const [recommendations, setRecommendations] = useState<PropertyRecommendation[]>([]);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [affordForm, setAffordForm] = useState({ monthlyIncome: '', monthlyDebts: '', downPayment: '', interestRate: '7.5' });
  const [affordResult, setAffordResult] = useState<AffordabilityResult | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setRecommendations([
        { id: '1', title: '2BR Apartment - Downtown', address: '123 Main St', city: 'Chicago, IL', price: 1800, bedrooms: 2, bathrooms: 1, sqft: 850, matchScore: 95, matchReasons: ['Within budget', 'Near transit', 'Good schools'], image: '🏠' },
        { id: '2', title: '1BR Condo - Lakeview', address: '456 Oak Ave', city: 'Chicago, IL', price: 1200, bedrooms: 1, bathrooms: 1, sqft: 600, matchScore: 88, matchReasons: ['Below budget', 'Walkable', 'Low fees'], image: '🏢' },
        { id: '3', title: 'Studio - University', address: '789 Pine Rd', city: 'Chicago, IL', price: 800, bedrooms: 0, bathrooms: 1, sqft: 400, matchScore: 82, matchReasons: ['Affordable', 'Near campus'], image: '🏬' },
        { id: '4', title: '3BR House - Suburbs', address: '321 Elm St', city: 'Chicago, IL', price: 2400, bedrooms: 3, bathrooms: 2, sqft: 1500, matchScore: 75, matchReasons: ['More space', 'Garage', 'Quiet area'], image: '🏡' },
      ]);

      setInsights([
        { id: '1', type: 'tip', title: 'Rent vs Buy Analysis', description: 'Based on your budget, buying may be cheaper than renting after 3 years. Run the numbers with our calculator.', action: 'Try Calculator', actionLink: '/calculator' },
        { id: '2', type: 'opportunity', title: 'Price Drop Alert', description: 'A property you saved dropped 8% in price. Now within your budget range.', action: 'View', actionLink: '/listing/1' },
        { id: '3', type: 'alert', title: 'Lease Renewal Coming', description: 'If you\'re renting, start looking 60 days before lease end for best options.', action: 'Browse', actionLink: '/marketplace' },
      ]);

      setLoading(false);
    }, 500);
  }, []);

  const calculateAffordability = () => {
    const income = parseFloat(affordForm.monthlyIncome) || 0;
    const debts = parseFloat(affordForm.monthlyDebts) || 0;
    const down = parseFloat(affordForm.downPayment) || 0;
    const rate = parseFloat(affordForm.interestRate) / 100 / 12;

    // 28% front-end DTI, 36% back-end DTI
    const maxHousingPayment = income * 0.28;
    const maxTotalDebt = income * 0.36;
    const availableForHousing = Math.min(maxHousingPayment, maxTotalDebt - debts);

    // Estimate taxes and insurance (1.25% annually)
    const monthlyTaxInsuranceFactor = 0.0125 / 12;
    const monthlyRate = rate;

    // Solve for max loan amount
    const maxLoan = availableForHousing / (monthlyRate + monthlyTaxInsuranceFactor - monthlyRate * monthlyTaxInsuranceFactor);
    const maxPurchase = maxLoan + down;
    const recommendedBudget = maxPurchase * 0.9; // 10% buffer

    setAffordResult({
      maxMonthlyPayment: Math.round(availableForHousing),
      maxPurchasePrice: Math.round(maxPurchase),
      recommendedBudget: Math.round(recommendedBudget),
      downPaymentNeeded: down,
      monthlyBreakdown: {
        mortgage: Math.round(availableForHousing * 0.75),
        tax: Math.round(maxPurchase * 0.0125 / 12),
        insurance: Math.round(maxPurchase * 0.005 / 12),
        hoa: 0,
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: tokens.color.background }}>
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">🏠</div>
          <p className="text-slate-400">Finding your perfect match...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-100 font-headline">
              Your Home Finder
            </h1>
            <p className="text-sm mt-1" style={{ color: tokens.color.muted }}>
              AI-powered property search and affordability analysis
            </p>
          </div>
          <Badge tone="success">● AI Active</Badge>
        </div>

        {/* AI Insights */}
        {insights.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💡</span>
              <div className="flex-1">
                <div className="font-bold text-indigo-200">{insights[0].title}</div>
                <div className="text-sm text-indigo-300/80">{insights[0].description}</div>
              </div>
              <Link to={insights[0].actionLink || '#'}>
                <Button size="sm">{insights[0].action}</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['discover', 'affordability', 'saved', 'ai'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap ${tab === t ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30' : 'bg-white/5 text-slate-400 border border-white/10'}`}>
              {t === 'discover' ? '🔍 Discover' : t === 'affordability' ? '💰 Affordability' : t === 'saved' ? '❤️ Saved' : '🤖 AI Insights'}
            </button>
          ))}
        </div>

        {/* Discover Tab */}
        {tab === 'discover' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map(rec => (
                <Surface key={rec.id} className="p-4 hover:bg-white/5 transition-all cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{rec.image}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-semibold text-slate-100 text-sm truncate">{rec.title}</div>
                        <Badge tone="success">{rec.matchScore}% match</Badge>
                      </div>
                      <div className="text-xs text-slate-400 mb-2">{rec.address}, {rec.city}</div>
                      <div className="flex items-center gap-3 text-xs text-slate-300 mb-2">
                        <span>{rec.bedrooms} bd</span>
                        <span>{rec.bathrooms} ba</span>
                        <span>{rec.sqft} sqft</span>
                      </div>
                      <div className="text-lg font-bold text-emerald-300">${rec.price}/mo</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {rec.matchReasons.map((reason, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">{reason}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        )}

        {/* Affordability Tab */}
        {tab === 'affordability' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">Your Financial Profile</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Monthly Gross Income</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">$</span>
                    <input value={affordForm.monthlyIncome} onChange={e => setAffordForm({ ...affordForm, monthlyIncome: e.target.value })} placeholder="6000" type="number" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Monthly Debts (credit cards, car, student loans)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">$</span>
                    <input value={affordForm.monthlyDebts} onChange={e => setAffordForm({ ...affordForm, monthlyDebts: e.target.value })} placeholder="500" type="number" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Available Down Payment</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">$</span>
                    <input value={affordForm.downPayment} onChange={e => setAffordForm({ ...affordForm, downPayment: e.target.value })} placeholder="50000" type="number" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Interest Rate</label>
                  <div className="flex items-center gap-2">
                    <input value={affordForm.interestRate} onChange={e => setAffordForm({ ...affordForm, interestRate: e.target.value })} type="number" step="0.1" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none" />
                    <span className="text-slate-400">%</span>
                  </div>
                </div>
              </div>
              <Button onClick={calculateAffordability} className="w-full mt-4">Calculate Affordability</Button>
            </Surface>

            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">AI Affordability Analysis</h3>
              {!affordResult ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="text-3xl mb-2">📊</div>
                  <p>Enter your financial details to see what you can afford</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <div className="text-xs text-emerald-300">Recommended Budget</div>
                    <div className="text-3xl font-black text-emerald-300">${affordResult.recommendedBudget.toLocaleString()}</div>
                    <div className="text-xs text-emerald-400/80">Max: ${affordResult.maxPurchasePrice.toLocaleString()}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5">
                    <div className="text-xs text-slate-400">Max Monthly Payment</div>
                    <div className="text-xl font-bold text-slate-100">${affordResult.maxMonthlyPayment.toLocaleString()}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5">
                    <div className="text-xs text-slate-400 mb-2">Monthly Breakdown</div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Mortgage</span><span className="text-slate-100">${affordResult.monthlyBreakdown.mortgage}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Tax</span><span className="text-slate-100">${affordResult.monthlyBreakdown.tax}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Insurance</span><span className="text-slate-100">${affordResult.monthlyBreakdown.insurance}</span></div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <div className="text-xs font-bold text-indigo-300">🤖 AI Recommendation</div>
                    <div className="text-xs text-indigo-200/80">With your profile, you can comfortably afford a ${affordResult.recommendedBudget.toLocaleString()} property. Consider putting 20% down to avoid PMI.</div>
                  </div>
                </div>
              )}
            </Surface>
          </div>
        )}

        {/* Saved Tab */}
        {tab === 'saved' && (
          <Surface className="p-8 text-center">
            <div className="text-3xl mb-2">❤️</div>
            <p className="text-slate-400">Your saved properties will appear here</p>
            <Link to="/marketplace"><Button className="mt-4">Browse Properties</Button></Link>
          </Surface>
        )}

        {/* AI Tab */}
        {tab === 'ai' && (
          <div className="space-y-4">
            <Surface className="p-4 md:p-6">
              <h3 className="text-base font-bold text-slate-100 mb-4">🤖 AI Insights for You</h3>
              <div className="space-y-3">
                {insights.map(insight => (
                  <div key={insight.id} className={`p-3 rounded-xl border ${
                    insight.type === 'opportunity' ? 'bg-emerald-500/10 border-emerald-500/20' :
                    insight.type === 'alert' ? 'bg-amber-500/10 border-amber-500/20' :
                    'bg-indigo-500/10 border-indigo-500/20'
                  }`}>
                    <div className="font-semibold text-slate-100 text-sm mb-1">{insight.title}</div>
                    <div className="text-xs text-slate-300">{insight.description}</div>
                    {insight.action && (
                      <Link to={insight.actionLink || '#'} className="text-xs text-indigo-300 hover:text-indigo-200 mt-1 inline-block">
                        {insight.action} →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </Surface>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerAIDashboard;

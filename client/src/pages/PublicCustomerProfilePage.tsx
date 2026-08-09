import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { userService } from '../services/api';
import toast from 'react-hot-toast';
import { tokens } from '../design-system';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export const PublicCustomerProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeApp, setActiveApp] = useState<'checkout' | 'portfolio' | 'chat'>('checkout');

  // Chat State
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (!id) return;
        // In reality, this could be a slug or an ID
        const res = await userService.getPublicProfile(id);
        const fetchedUser = res.data.data.user;
        setUserProfile(fetchedUser);
        setMessages([
          { role: 'assistant', content: `Hi! I'm the AI assistant for ${fetchedUser.firstName}. I can answer questions about their services, negotiate a custom scope, and generate a secure Escrow checkout link for you. How can I help?` }
        ]);
      } catch (error) {
        console.error('Error fetching public user profile:', error);
        toast.error('Profile not found.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id, navigate]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setIsTyping(true);

    try {
      const response = await api.post('/ai/nlp/generate', {
        template: `You are an AI sales concierge for a professional named ${userProfile.firstName}.
        The user said: {userMessage}. 
        Respond professionally, keep it short, and try to negotiate or guide them towards opening an escrow contract.`,
        context: JSON.stringify({ userMessage })
      });
      
      const aiResponse = response.data.data.copy;
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I am having trouble connecting to my brain right now. Please try again later." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!userProfile) return null;

  const isOwner = currentUser?.id === userProfile.id;
  const isFreelancer = userProfile.role === 'FREELANCER' || userProfile.businesses?.length > 0;
  const freelanceBusiness = userProfile.businesses?.[0];
  const hourlyRate = freelanceBusiness?.externalDetails?.hourlyRate || 50;
  
  // Fake services mapping for demo purposes. Ideally fetched from business.products.
  const services = [
    { id: '1', name: 'Custom Project Consultation', price: hourlyRate, delivery: '1 hour', description: 'Discuss your project scope and requirements.' },
    { id: '2', name: 'Standard Retainer', price: hourlyRate * 10, delivery: '1 week', description: '10 hours of dedicated professional services.' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 pb-24 font-body" style={{ color: tokens.color.text }}>
      
      {/* STOREFRONT HEADER */}
      <div className="relative w-full h-64 md:h-80 bg-gradient-to-r from-indigo-900 via-slate-800 to-indigo-950 overflow-hidden group mt-16">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000')] bg-cover bg-center mix-blend-overlay"></div>
        
        {/* Owner Edit Ability */}
        {isOwner && (
          <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-black/70">
              <span>✏️</span> Edit Storefront Banner
            </button>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative -mt-24">
        
        {/* Profile Card */}
        <div className="bg-slate-800/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-2xl relative">
          
          {isOwner && (
             <button className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white p-2 rounded-lg text-xs font-bold transition-colors">
               Edit Profile
             </button>
          )}

          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-slate-900 shadow-xl bg-indigo-500/20 flex items-center justify-center text-4xl font-bold overflow-hidden shrink-0">
             {userProfile.firstName?.charAt(0)}{userProfile.lastName?.charAt(0)}
          </div>
          
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-black font-headline text-white">{userProfile.firstName} {userProfile.lastName}</h1>
              <span className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-2 py-1 rounded-lg uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                {isFreelancer ? 'Available for Work' : 'Active Member'}
              </span>
            </div>
            <p className="text-lg text-indigo-300 font-medium mb-3">
               {freelanceBusiness?.name || (isFreelancer ? 'Freelance Professional' : 'Pabandi Community Member')}
            </p>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
               {freelanceBusiness?.description || `Pabandi verified user since ${new Date(userProfile.createdAt).getFullYear()}.`}
            </p>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex gap-6 md:min-w-[250px] shrink-0">
             <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Trust Passport</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black text-emerald-400">{userProfile.reliabilityScore}</span>
                  <span className="text-sm text-emerald-400/70 font-bold mb-1">{userProfile.verificationTier}</span>
                </div>
             </div>
             <div className="w-px bg-white/10"></div>
             <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Escrow Deals</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black text-white">{userProfile.businesses?.length * 12 || 4}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Modular "Apps" Navigation */}
        <div className="flex items-center gap-2 mt-8 mb-6 overflow-x-auto no-scrollbar border-b border-white/5 pb-2">
           <button 
             onClick={() => setActiveApp('checkout')}
             className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeApp === 'checkout' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
           >
             🛍️ {isFreelancer ? 'Escrow Services' : 'Public Activity'}
           </button>
           {isFreelancer && (
             <button 
               onClick={() => setActiveApp('portfolio')}
               className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeApp === 'portfolio' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
             >
               📁 Verified Portfolio
             </button>
           )}
           <button 
             onClick={() => setActiveApp('chat')}
             className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeApp === 'chat' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
           >
             🤖 AI Concierge
           </button>
        </div>

        {/* Dynamic App Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2">
            
            {activeApp === 'checkout' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold font-headline mb-4 flex items-center gap-2">
                  <span className="text-indigo-400">⚡</span> {isFreelancer ? 'Available Services' : 'Activity'}
                </h2>
                {isFreelancer ? services.map(service => (
                  <div key={service.id} className="bg-slate-800/40 border border-white/10 rounded-2xl p-6 hover:border-indigo-500/50 transition-colors group flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">{service.name}</h3>
                      <p className="text-sm text-slate-400 mb-4">{service.description}</p>
                      <span className="inline-flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-300">
                        ⏱️ Delivery: {service.delivery}
                      </span>
                    </div>
                    <div className="flex flex-col items-start sm:items-end justify-between shrink-0">
                      <p className="text-2xl font-black text-white">${service.price}</p>
                      <Link to={`/checkout/mock-escrow`} className="mt-4 sm:mt-0 bg-white text-black font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-indigo-400 hover:text-white transition-colors w-full sm:w-auto text-center">
                        Fund Escrow
                      </Link>
                    </div>
                  </div>
                )) : (
                  <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-6">
                    <p className="text-slate-400">No active services. This is a standard consumer profile.</p>
                  </div>
                )}
                
                {isOwner && (
                   <button className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white border-dashed py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-colors mt-4">
                     <span>+</span> Add New Service
                   </button>
                )}
              </div>
            )}

            {activeApp === 'portfolio' && (
              <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
                 <span className="text-4xl mb-4 grayscale">🖼️</span>
                 <h3 className="text-xl font-bold mb-2">Verified Deliverables</h3>
                 <p className="text-slate-400 max-w-sm mb-6">Past work completed through Pabandi Escrow is automatically verified and showcased here.</p>
                 {isOwner && (
                    <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold transition-colors">
                      Upload Deliverable
                    </button>
                 )}
              </div>
            )}

            {activeApp === 'chat' && (
              <div className="bg-slate-800/40 border border-white/10 rounded-2xl h-[500px] flex flex-col overflow-hidden">
                <div className="bg-black/30 p-4 border-b border-white/5 flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 text-xl">🤖</div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{userProfile.firstName}'s AI Concierge</h3>
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Online</p>
                  </div>
                </div>
                
                <div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${msg.role === 'user' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                        {msg.role === 'user' ? '👤' : '🤖'}
                      </div>
                      <div className={`text-sm p-3 rounded-2xl ${msg.role === 'user' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-tr-none' : 'bg-indigo-500/10 border border-indigo-500/20 text-slate-300 rounded-tl-none'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex gap-3 max-w-[80%]">
                      <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex-shrink-0 flex items-center justify-center text-xs">🤖</div>
                      <div className="bg-indigo-500/10 border border-indigo-500/20 text-slate-300 text-sm p-3 rounded-2xl rounded-tl-none flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleChatSubmit} className="p-4 bg-black/20 border-t border-white/5">
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-2 focus-within:border-indigo-500/50 transition-colors">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message..." 
                      className="flex-1 bg-transparent border-none outline-none text-sm px-2 text-white placeholder-slate-500" 
                      disabled={isTyping}
                    />
                    <button 
                      type="submit"
                      disabled={isTyping || !chatInput.trim()}
                      className="bg-indigo-500 text-white p-2 rounded-lg hover:bg-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>

          <div className="space-y-6">
            
            {/* Guarantee Box */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <span className="text-6xl">🛡️</span>
              </div>
              <h3 className="font-bold text-lg mb-2 relative z-10">Zero Risk Guarantee</h3>
              <p className="text-sm text-slate-400 mb-4 relative z-10">
                All services are powered by Pabandi Smart Escrow. Your funds are locked securely on-chain and only released when you approve the final deliverables.
              </p>
              <ul className="text-xs space-y-2 text-slate-300 font-medium relative z-10">
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> No Ghosting</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Instant AI Arbitration</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Zero-Fee Off-Ramps</li>
              </ul>
            </div>

            {/* Verification Widget */}
            <div className="bg-black/30 border border-white/5 rounded-2xl p-6 relative">
               {isOwner && (
                 <button className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                   <span className="text-xs">⚙️</span>
                 </button>
               )}
               <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-4">Trust Oracle Verification</p>
               <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-slate-300">Identity / Liveness</span>
                   <span className="text-sm font-bold text-emerald-400">99%</span>
                 </div>
                 {isFreelancer && (
                   <div className="flex items-center justify-between">
                     <span className="text-sm text-slate-300">Competence (Gig Hist.)</span>
                     <span className="text-sm font-bold text-emerald-400">95%</span>
                   </div>
                 )}
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-slate-300">Wallet Temporal Age</span>
                   <span className="text-sm font-bold text-emerald-400">Verified</span>
                 </div>
               </div>
               <button className="w-full mt-6 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold py-2 rounded-lg transition-colors">
                 View Full AI Audit Report
               </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

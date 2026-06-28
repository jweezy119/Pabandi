import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { businessService, reservationService, stakingService, walletService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { ShieldCheckIcon, StarIcon, MapPinIcon, ClockIcon, PhoneIcon } from '@heroicons/react/24/outline';
import BusinessMap from '../components/BusinessMap';
import ReviewCarousel from '../components/ReviewCarousel';
import { executeBscDeposit, executeSolanaDeposit } from '../utils/web3';

export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [isProcessingWeb3, setIsProcessingWeb3] = useState(false);
  
  const [formData, setFormData] = useState({
    reservationDate: '',
    reservationTime: '',
    numberOfGuests: 2,
    customerName: '',
    customerPhone: '',
    specialRequests: '',
    paymentMethod: 'safepay',
  });

  // Hero Demo: Interactive AI Score Slider
  const { user } = useAuthStore();
  const [demoScore, setDemoScore] = useState(
    user?.reliabilityScore ? Math.round(user.reliabilityScore / 10) : 87
  );
  
  // Calculate dynamic deposit based on the demo score
  const dynamicDeposit = demoScore >= 80 ? 0 : demoScore >= 50 ? 5 : 15;

  const { data: businessData, isLoading: businessLoading } = useQuery(
    ['business', id],
    () => businessService.getBusiness(id!),
    { enabled: !!id }
  );

  const business = businessData?.data?.business;

  const { data: analyticsData } = useQuery(
    ['business-analytics', id],
    () => businessService.getBusinessAnalytics(id!),
    { enabled: !!id }
  );
  
  const analytics = analyticsData?.data?.analytics;

  const googleRating = business?.rating || analytics?.googleRating || 4.9;

  // Get Wallet Balance for Staking
  const { data: walletData } = useQuery('pab-wallet-balances', async () => {
    const res = await walletService.getBalances();
    return res.data?.data;
  }, { enabled: isAuthenticated });
  
  const offChainBalance = Number(walletData?.offChainBalance || 0);
  const REQUIRED_STAKE = 50; // Mock required stake amount for premium venues

  const bookingMutation = useMutation(
    (data: any) => reservationService.createReservation(data),
    {
      onSuccess: async (res) => {
        const data = res?.data?.data;
        if (data?.prediction?.requiresDeposit || data?.reservation?.depositRequired) {
          // Show the AI deposit screen instead of redirecting
          setBookingResult(data);
        } else {
          // No deposit required, go to reservations
          navigate('/reservations');
        }
      },
    }
  );

  const handlePayDeposit = async () => {
    // Haptic Feedback
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate([30, 50, 30]);
    }

    if (!bookingResult) return;
    const { checkoutUrl, reservation } = bookingResult;

    if (formData.paymentMethod === 'paypal' || formData.paymentMethod === 'safepay') {
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } else {
      setIsProcessingWeb3(true);
      try {
        if (formData.paymentMethod === 'bsc') {
          const result = await executeBscDeposit(reservation.depositAmount?.toString() || "0.05", business.walletAddress || "0xMockBusinessAddress");
          if (!result.success) throw new Error(result.error);
        } else if (formData.paymentMethod === 'solana') {
          const result = await executeSolanaDeposit(0.1, business.walletAddress || "MockBusinessAddress"); // Mocking conversion
          if (!result.success) throw new Error(result.error);
        } else if (formData.paymentMethod === 'stake') {
          await stakingService.stake({ reservationId: reservation.id, amount: REQUIRED_STAKE });
        }
        
        // Update reservation on backend
        await reservationService.updateReservation(reservation.id, {
           depositStatus: 'PAID',
           cryptoDepositTxHash: 'WEB3_TX_MOCK', // In real app, pass actual tx hash
        });
        navigate('/reservations');
      } catch (err: any) {
        alert('Transaction failed: ' + (err.message || 'Unknown error'));
      } finally {
        setIsProcessingWeb3(false);
      }
    }
  };

  useEffect(() => {
    if (!isAuthenticated && showBookingForm) {
      // Prompt logic if unauthenticated and trying to book
    }
  }, [isAuthenticated, showBookingForm]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!isAuthenticated) {
        navigate('/login');
        return;
    }
    
    // Haptic Feedback
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(50);
    }
    
    // Pass paymentMethod so the backend creates the fiat checkoutUrl if needed
    bookingMutation.mutate({ businessId: id, ...formData });
  };

  if (businessLoading || !business) {
    return (
      <div className="min-h-screen bg-surface p-4 md:p-8 flex flex-col max-w-7xl mx-auto gap-8 mt-16 animate-pulse">
        {/* Skeleton Hero */}
        <div className="w-full h-[353px] md:h-[442px] bg-surface-container-low rounded-xl"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-surface-container-lowest h-48 rounded-xl shadow-sm border border-outline-variant/20"></div>
            <div className="bg-surface-container-lowest h-48 rounded-xl shadow-sm border border-outline-variant/20"></div>
          </div>
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-surface-container-lowest h-24 rounded-xl shadow-sm border border-outline-variant/20"></div>
            <div className="bg-surface-container-lowest h-24 rounded-xl shadow-sm border border-outline-variant/20"></div>
            <div className="bg-surface-container-lowest h-24 rounded-xl shadow-sm border border-outline-variant/20"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen pb-24 md:pb-12 text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container">
      {/* Top App Bar - Web */}
      <header className="hidden md:flex justify-between items-center w-full px-6 py-4 bg-surface/80 backdrop-blur-md sticky top-0 z-40 transition-all duration-300">
        <h1 className="font-headline text-2xl font-bold tracking-tighter text-primary cursor-pointer" onClick={() => navigate('/')}>Pabandi</h1>
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <button onClick={() => navigate('/reservations')} className="text-on-surface-variant hover:text-primary font-body text-sm font-medium transition-colors">My Bookings</button>
          ) : (
            <button onClick={() => navigate('/login')} className="text-on-surface-variant hover:text-primary font-body text-sm font-medium transition-colors">Sign In</button>
          )}
        </div>
      </header>

      {/* Main Content Box */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 md:mt-8">
        
        {/* Validation/Booking Success or Failure */}
        {bookingMutation.isError && (
          <div className="bg-error-container text-on-error-container p-4 rounded-lg mb-6 border border-error/20 flex items-center shadow-sm">
            <span className="material-symbols-outlined mr-2">error</span>
            {(bookingMutation.error as any)?.response?.data?.message || 'Booking failed'}
          </div>
        )}

        {/* Claim Business Banner */}
        {business.isClaimed === false && (
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl mb-6 flex flex-col sm:flex-row items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 mb-3 sm:mb-0">
              <span className="material-symbols-outlined text-primary text-2xl">verified</span>
              <div>
                <h3 className="text-on-surface font-semibold">Is this your business?</h3>
                <p className="text-on-surface-variant text-sm">Claim this listing to manage bookings, respond to reviews, and update details.</p>
              </div>
            </div>
            <button 
              onClick={async () => {
                if (!isAuthenticated) {
                  navigate('/login');
                  return;
                }
                if (confirm('Are you sure you want to claim this business?')) {
                  try {
                    await businessService.claimBusiness(business.id);
                    alert('Business claimed successfully!');
                    navigate('/dashboard');
                  } catch (e: any) {
                    alert(e.response?.data?.message || 'Failed to claim business');
                  }
                }
              }}
              className="bg-primary text-on-primary px-6 py-2 rounded-full font-medium hover:bg-primary/90 transition-colors shrink-0"
            >
              Claim Now
            </button>
          </div>
        )}

        {/* Hero Section */}
        <div className="relative w-full h-[353px] md:h-[442px] rounded-xl overflow-hidden mb-8 md:mb-16 shadow-sm">
          <img 
            alt={business.name} 
            className="w-full h-full object-cover" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAs0Ker3tH73HShnpzCYS57ru-3m9EJycGJWEoAjRes7gsogMja6_xbRcECJxl_z65r8L8K1RlEZ2Yi88YJIyaf83nLezBsjFXmlb_CGtThPJ6ogXH5z611EYKzBEDTMXJzLDG7fyLLKF34ij9frHsDsecGNoy_hs7IvUhUmEZAuY_nv4p5KYyTXW-LOg21c0WpklLm6jEm6yaeo4IOy7Cbsvl4x9UTkBa5rXOf0SxMRAdn2ZWlqSWwjXH_p0OZcyCMXCl4COE9RDOk" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#011d35]/90 via-[#011d35]/40 to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 text-white">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant font-label text-[11px] font-medium tracking-wide">
                    <StarIcon className="h-3 w-3 mr-1" /> {googleRating} Rating
                  </span>
                  <span className={`inline-flex items-center px-2 py-1 rounded font-label text-[11px] font-bold tracking-wide transition-colors ${demoScore >= 80 ? 'bg-green-500/20 text-green-300 border border-green-500/50' : demoScore >= 50 ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50' : 'bg-red-500/20 text-red-300 border border-red-500/50'}`}>
                    <ShieldCheckIcon className="h-3 w-3 mr-1" /> AI Score: {demoScore}% Reliable → ${dynamicDeposit} Deposit
                  </span>
                  <span className="hidden md:inline-flex items-center px-2 py-1 rounded bg-white/20 backdrop-blur-sm text-white font-label text-[11px] font-medium tracking-wide">
                     Premium Partner
                  </span>
                </div>
                
                {/* Demo Control Slider (Only visible in demo environments or for admins, keeping it visible for the pitch) */}
                <div className="flex items-center gap-3 mb-2 bg-black/40 p-2 rounded-lg backdrop-blur-md border border-white/10 w-fit">
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Demo AI Control</span>
                  <input 
                    type="range" 
                    min="10" 
                    max="99" 
                    value={demoScore} 
                    onChange={(e) => setDemoScore(parseInt(e.target.value))}
                    className="w-32 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-xs font-mono font-bold text-primary">{demoScore}%</span>
                </div>

                <h2 className="font-headline text-3xl md:text-[2.75rem] font-bold tracking-tight mb-2 leading-tight">{business.name}</h2>
                <p className="font-body text-sm md:text-[0.875rem] text-slate-200 flex items-center">
                  <MapPinIcon className="h-4 w-4 mr-1" /> {business.address || 'Global Partner'}
                </p>
              </div>
              <div className="hidden md:flex gap-3">
                <button 
                  className="bg-white/10 backdrop-blur-md text-white font-body text-sm font-medium px-6 py-3 rounded border border-white/30 hover:bg-white/20 transition-all hover:scale-105 active:scale-95"
                >
                    Save
                </button>
                <button 
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) window.navigator.vibrate(30);
                    setShowBookingForm(true);
                  }} 
                  className="bg-white text-primary font-body text-sm font-semibold px-8 py-3 rounded hover:bg-slate-50 transition-all shadow-sm hover:scale-105 hover:shadow-primary/20 active:scale-95"
                >
                    Make Reservation
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Columns */}
        <div className={`grid grid-cols-1 ${showBookingForm ? 'lg:grid-cols-2' : 'lg:grid-cols-12'} gap-8 md:gap-12 transition-all duration-300`}>
          
          {/* Details & Location */}
          <div className={`${showBookingForm ? 'lg:col-span-1' : 'lg:col-span-4'} space-y-8`}>
            
            {/* Info Card */}
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/20">
              <h3 className="font-headline text-xl font-semibold text-primary mb-6">Details</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary shrink-0">
                    <ClockIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-body text-[0.875rem] font-medium text-on-surface mb-1">Opening Hours</h4>
                    <p className="font-body text-[0.875rem] text-on-surface-variant">Mon - Sat: 10:00 AM - 9:00 PM</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary shrink-0">
                    <PhoneIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-body text-[0.875rem] font-medium text-on-surface mb-1">Contact</h4>
                    <p className="font-body text-[0.875rem] text-on-surface-variant">{business.address || `${business.city || ''}, ${business.state || business.country || 'United States'}`}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Card */}
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/20">
               <h3 className="font-headline text-xl font-semibold text-primary mb-4">Location</h3>
               <div className="w-full h-48 rounded-lg overflow-hidden bg-surface-container-low">
                  <BusinessMap 
                    latitude={business.latitude || 24.8607} 
                    longitude={business.longitude || 67.0011} 
                    name={business.name} 
                    zoom={15} 
                  />
               </div>
            </div>

          </div>

          {/* Booking Form Or Services */}
          <div className={`${showBookingForm ? 'lg:col-span-1' : 'lg:col-span-8'}`}>
            {showBookingForm ? (
               <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 shadow-sm border border-outline-variant/20 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-headline text-[1.5rem] font-semibold text-primary">Table Reservation</h3>
                    <button onClick={() => setShowBookingForm(false)} className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium">
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-on-surface mb-1">Date *</label>
                        <input type="date" name="reservationDate" required min={format(new Date(), 'yyyy-MM-dd')} value={formData.reservationDate} onChange={handleChange} className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-on-surface mb-1">Time *</label>
                        <input type="time" name="reservationTime" required value={formData.reservationTime} onChange={handleChange} className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <label className="block text-sm font-medium text-on-surface mb-1">Guests *</label>
                         <select name="numberOfGuests" required value={formData.numberOfGuests} onChange={handleChange} className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm">
                           {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                             <option key={num} value={num}>{num} {num === 1 ? 'Person' : 'People'}</option>
                           ))}
                         </select>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-on-surface mb-1">Your Name *</label>
                         <input type="text" name="customerName" required value={formData.customerName} onChange={handleChange} className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm" />
                       </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-on-surface mb-1">Phone Number *</label>
                       <input type="tel" name="customerPhone" required value={formData.customerPhone} onChange={handleChange} className="w-full bg-surface-container-low border-0 text-on-surface rounded-md focus:ring-1 focus:ring-primary px-3 py-2 outline-none font-body text-sm" placeholder="+1 (555) 000-0000" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-on-surface mb-2">Deposit Payment Method</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                        {/* Safepay / Fiat */}
                        <label className={`flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer transition-all shadow-sm ${formData.paymentMethod === 'safepay' ? 'bg-surface-container-lowest border border-primary ring-1 ring-primary' : 'bg-surface-container-lowest border border-outline-variant/20 hover:bg-surface-container-low'}`}>
                          <input type="radio" name="paymentMethod" value="safepay" checked={formData.paymentMethod === 'safepay'} onChange={handleChange} className="sr-only" />
                          <span className="material-symbols-outlined text-primary mb-1">credit_card</span>
                          <span className="text-xs font-medium text-center">Safepay</span>
                        </label>

                        {/* BSC BNB */}
                        <label className={`flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer transition-all shadow-sm ${formData.paymentMethod === 'bsc' ? 'bg-surface-container-lowest border border-primary ring-1 ring-primary' : 'bg-surface-container-lowest border border-outline-variant/20 hover:bg-surface-container-low'}`}>
                          <input type="radio" name="paymentMethod" value="bsc" checked={formData.paymentMethod === 'bsc'} onChange={handleChange} className="sr-only" />
                          <span className="font-semibold text-on-surface text-sm">Web3 BSC</span>
                          <span className="text-[10px] text-on-surface-variant font-medium mt-1">BNB / USDT</span>
                        </label>

                        {/* Solana */}
                        <label className={`flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer transition-all shadow-sm ${formData.paymentMethod === 'solana' ? 'bg-surface-container-lowest border border-primary ring-1 ring-primary' : 'bg-surface-container-lowest border border-outline-variant/20 hover:bg-surface-container-low'}`}>
                          <input type="radio" name="paymentMethod" value="solana" checked={formData.paymentMethod === 'solana'} onChange={handleChange} className="sr-only" />
                          <span className="font-semibold text-on-surface text-sm">Web3 Solana</span>
                          <span className="text-[10px] text-on-surface-variant font-medium mt-1">SOL / USDC</span>
                        </label>

                        {/* Stake PAB */}
                        <label className={`flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer transition-all shadow-sm relative overflow-hidden ${formData.paymentMethod === 'stake' ? 'bg-primary-container/20 border border-primary ring-1 ring-primary' : 'bg-surface-container-lowest border border-outline-variant/20 hover:bg-surface-container-low'} ${offChainBalance < REQUIRED_STAKE ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input type="radio" name="paymentMethod" value="stake" disabled={offChainBalance < REQUIRED_STAKE} checked={formData.paymentMethod === 'stake'} onChange={handleChange} className="sr-only" />
                          {formData.paymentMethod === 'stake' && <div className="absolute inset-0 bg-[radial-gradient(var(--color-primary)_1px,transparent_1px)] [background-size:8px_8px] opacity-10 pointer-events-none" />}
                          <span className="font-headline font-black text-primary text-sm flex items-center gap-1 z-10"><ShieldCheckIcon className="h-4 w-4" /> Stake PAB</span>
                          <span className="text-[10px] text-on-surface-variant font-medium mt-1 z-10">{REQUIRED_STAKE} PAB required</span>
                          {offChainBalance < REQUIRED_STAKE && (
                            <span className="text-[8px] text-error font-bold mt-1 z-10">You have {offChainBalance}</span>
                          )}
                        </label>
                      </div>
                    </div>

                    <div className="bg-tertiary-fixed/20 border-l-4 border-tertiary p-4 rounded-r-lg flex items-start gap-4 mt-6">
                       <div className="text-tertiary mt-0.5">
                         <ShieldCheckIcon className="h-5 w-5" />
                       </div>
                       <div>
                         <h4 className="font-body text-sm font-semibold text-on-tertiary-fixed-variant">Pabandi Protected Booking</h4>
                         <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                           Your booking is verified. Checking in securely earns you Pabandi Reliability Tokens. No-shows may affect your platform reliability score.
                         </p>
                       </div>
                    </div>

                    <div className="pt-2">
                       <button 
                         type="submit" 
                         disabled={bookingMutation.isLoading} 
                         className="w-full relative overflow-hidden bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline text-lg font-semibold py-4 rounded-lg shadow-[0_0_20px_rgba(var(--color-primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--color-primary),0.5)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 flex justify-center items-center gap-2"
                       >
                         {bookingMutation.isLoading && (
                           <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                         )}
                         <span className="relative z-10 flex items-center gap-2">
                           {bookingMutation.isLoading ? (
                             <>
                               <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                               Analyzing Risk...
                             </>
                           ) : 'Request Reservation'}
                         </span>
                       </button>
                    </div>
                  </form>
               </div>
            ) : bookingResult ? (
               <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 shadow-[0_0_40px_rgba(var(--color-primary),0.15)] border border-primary/30 animate-in slide-in-from-bottom-8 fade-in duration-700 relative overflow-hidden">
                  {/* Neon Glow Effects */}
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>
                  <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-tertiary/20 rounded-full blur-3xl mix-blend-screen pointer-events-none"></div>

                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <ShieldCheckIcon className="w-48 h-48 text-primary animate-pulse" />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-2xl">robot_2</span>
                      </div>
                      <h3 className="font-headline text-[1.75rem] font-bold text-primary tracking-tight">AI Risk Analysis</h3>
                    </div>
                    
                    <p className="text-on-surface-variant font-body mb-8">
                      Our autonomous agent has analyzed your booking request to secure this reservation.
                    </p>

                    <div className="bg-surface-container-low rounded-xl p-6 mb-8 border border-outline-variant/30">
                      <div className="flex justify-between items-center mb-6 pb-6 border-b border-outline-variant/20">
                        <div>
                          <p className="text-sm font-medium text-on-surface-variant mb-1">No-Show Risk Score</p>
                          <div className="flex items-end gap-2">
                            <span className={`text-4xl font-black font-headline ${bookingResult.prediction.riskScore >= 70 ? 'text-error' : bookingResult.prediction.riskScore >= 40 ? 'text-orange-500' : 'text-primary'}`}>
                              {bookingResult.prediction.riskScore}
                            </span>
                            <span className="text-on-surface-variant mb-1 font-medium">/ 100</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-on-surface-variant mb-1">Required Deposit</p>
                          <div className="text-3xl font-black font-headline text-on-surface">
                             {business.currency || 'USD'} {bookingResult.reservation.depositAmount || 0}
                          </div>
                        </div>
                      </div>

                      <div>
                         <h4 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
                           <span className="material-symbols-outlined text-sm">insights</span>
                           Agent Insights
                         </h4>
                         <ul className="space-y-3">
                           {Object.entries(bookingResult.reservation.aiFactors || {}).map(([factor, impact]: [string, any]) => (
                             <li key={factor} className="flex justify-between items-center bg-surface-container p-3 rounded-lg border border-outline-variant/10">
                               <span className="font-body text-sm font-medium text-on-surface capitalize">{factor.replace(/([A-Z])/g, ' $1').trim()}</span>
                               <span className={`font-mono text-xs font-bold px-2 py-1 rounded ${impact > 0 ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'}`}>
                                 {impact > 0 ? '+' : ''}{impact}% Risk
                               </span>
                             </li>
                           ))}
                           {Object.keys(bookingResult.reservation.aiFactors || {}).length === 0 && (
                             <li className="text-sm text-on-surface-variant italic">Standard baseline risk applied.</li>
                           )}
                         </ul>
                      </div>
                    </div>

                    <div className="bg-tertiary-fixed/20 border-l-4 border-tertiary p-4 rounded-r-lg mb-8">
                       <p className="text-sm text-on-surface-variant font-medium">
                         <strong className="text-on-tertiary-fixed-variant">Trust Ecosystem:</strong> This deposit is fully credited towards your final bill. Checking in successfully will reward you with $PAB tokens and lower your future risk scores!
                       </p>
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => { setBookingResult(null); setShowBookingForm(false); }}
                        className="flex-1 bg-surface-container text-on-surface font-semibold py-4 rounded-lg hover:bg-surface-container-high transition-all active:scale-95"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handlePayDeposit}
                        disabled={isProcessingWeb3}
                        className="flex-[2] relative overflow-hidden bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline text-lg font-semibold py-4 rounded-lg shadow-[0_0_20px_rgba(var(--color-primary),0.4)] hover:shadow-[0_0_30px_rgba(var(--color-primary),0.6)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300 flex justify-center items-center gap-2 group"
                      >
                        {isProcessingWeb3 ? (
                          <span className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Processing Web3 Tx...
                          </span>
                        ) : (
                          <>
                            Pay Deposit & Confirm
                            <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                          </>
                        )}
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none"></div>
                      </button>
                    </div>
                  </div>
               </div>
            ) : (
               <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="flex justify-between items-end mb-6">
                    <h3 className="font-headline text-[1.5rem] font-semibold text-primary">Services Overview</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Placeholder Services */}
                    {[1,2,3,4].map((i) => (
                      <div key={i} className="bg-surface-container-lowest p-5 rounded-xl flex justify-between items-center group shadow-sm border border-outline-variant/20 hover:border-primary/50 transition-all cursor-pointer" onClick={() => setShowBookingForm(true)}>
                        <div>
                          <h4 className="font-body text-[0.875rem] font-medium text-on-surface mb-1">Standard Reservation</h4>
                          <p className="font-body text-[0.6875rem] text-on-surface-variant">Secure your spot instantly</p>
                        </div>
                        <button className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                          <span className="material-symbols-outlined text-[16px]">add</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8">
                    <h3 className="font-headline text-[1.5rem] font-semibold text-primary mb-6">Latest Reviews</h3>
                    <ReviewCarousel reviews={analytics?.reviews || [
                      { id: '1', authorName: 'Ali Khan', rating: 5, text: 'Fantastic service! Checked in smoothly using Pabandi.', time: new Date().toISOString(), sentimentLabel: 'positive' },
                    ]} />
                  </div>
               </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Fixed CTA */}
      {!showBookingForm && (
        <div className="md:hidden fixed bottom-6 left-4 right-4 z-40 flex justify-center animate-in slide-in-from-bottom-8 duration-500">
          <button 
            onClick={() => {
              if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) window.navigator.vibrate(30);
              setShowBookingForm(true);
            }} 
            className="w-full max-w-sm bg-gradient-to-r from-primary to-primary-container text-on-primary font-body text-sm font-medium px-8 py-4 rounded-full shadow-[0_0_20px_rgba(var(--color-primary),0.3)] flex justify-center items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
          >
            <span>Book Appointment</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      )}
    </div>
  );
}

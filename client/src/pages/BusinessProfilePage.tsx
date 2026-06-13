import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { format } from 'date-fns';
import { 
  StarIcon, MapPinIcon, ClockIcon, PhoneIcon, 
  ShieldCheckIcon, GlobeAltIcon, ArrowLeftIcon, 
  SparklesIcon, PhotoIcon, ChatBubbleLeftRightIcon, 
  CalendarDaysIcon, ShareIcon, HeartIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { businessService, reservationService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import BusinessMap from '../components/BusinessMap';
import { executeBscDeposit, executeSolanaDeposit } from '../utils/web3';

type Tab = 'overview' | 'promotions' | 'reviews' | 'media';

export default function BusinessProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isLiked, setIsLiked] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Booking Form State
  const [formData, setFormData] = useState({
    reservationDate: '',
    reservationTime: '',
    numberOfGuests: 2,
    customerName: '',
    customerPhone: '',
    specialRequests: '',
    paymentMethod: 'paypal',
  });

  // Load User Details into Booking Form when Authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData(prev => ({
        ...prev,
        customerName: `${user.firstName} ${user.lastName}`,
        customerPhone: user.phone || '',
      }));
    }
  }, [isAuthenticated, user]);

  // Fetch Business Data
  const { data: businessData, isLoading: businessLoading, isError, error, refetch } = useQuery(
    ['business', id],
    () => businessService.getBusiness(id!),
    { enabled: !!id }
  );

  const business = businessData?.data?.business;

  // Fetch Synced Reviews
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery(
    ['business-reviews', business?.id],
    () => businessService.getBusinessReviews(business?.id as string),
    { enabled: !!business?.id }
  );

  const reviews = reviewsData?.data?.reviews || [];

  // Create Reservation Mutation
  const bookingMutation = useMutation(
    (data: any) => reservationService.createReservation(data),
    {
      onSuccess: (res) => {
        const checkoutUrl = res?.data?.data?.checkoutUrl;
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        } else {
          navigate('/reservations');
        }
      },
    }
  );

  const handleBookingChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !business) return;
    if (!isAuthenticated) {
      navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    let transactionHash = undefined;

    try {
      if (formData.paymentMethod === 'bsc') {
        const result = await executeBscDeposit("0.05", business.walletAddress || "0xMockBusinessAddress");
        if (!result.success) {
          alert(`BSC Deposit Failed: ${result.error}`);
          return;
        }
        transactionHash = result.transactionHash;
      } else if (formData.paymentMethod === 'solana') {
        const result = await executeSolanaDeposit(0.1, business.walletAddress || "MockBusinessAddress");
        if (!result.success) {
          alert(`Solana Deposit Failed: ${result.error}`);
          return;
        }
        transactionHash = result.transactionHash;
      }
    } catch (err: any) {
      alert(err.message || 'Web3 transaction failed');
      return;
    }

    bookingMutation.mutate({ businessId: business.id, ...formData, transactionHash });
  };

  const handleClaim = async () => {
    if (!isAuthenticated) {
      navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    if (confirm('Are you sure you want to claim this business listing on Pabandi?')) {
      try {
        await businessService.claimBusiness(business.id);
        alert('Listing claimed successfully! Welcome to Pabandi.');
        refetch();
        navigate('/dashboard');
      } catch (e: any) {
        alert(e.response?.data?.message || 'Failed to claim business');
      }
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (isError) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-surface text-on-surface p-6">
        <div className="text-center max-w-sm bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-error-container/20 text-error flex items-center justify-center mx-auto mb-4">
            ⚠️
          </div>
          <h3 className="font-headline font-bold text-lg mb-2">Failed to Load Profile</h3>
          <p className="font-body text-xs text-on-surface-variant mb-6 leading-relaxed">
            {(error as any)?.response?.data?.message || (error as any)?.message || 'We had trouble connecting to the server. Please try again.'}
          </p>
          <button 
            onClick={() => refetch()} 
            className="w-full bg-primary text-on-primary font-headline text-sm font-bold py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (businessLoading || !business) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-surface">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-body text-sm text-on-surface-variant font-medium">Loading venue profile...</p>
      </div>
    );
  }

  // Categories helper
  const getCategoryLabel = (c: string) => {
    if (c === 'RESTAURANT') return 'Fine Dining';
    if (c === 'FITNESS_CENTER') return 'Fitness';
    return c.charAt(0) + c.slice(1).toLowerCase();
  };

  // Mock promotions based on business type
  const getPromotions = () => {
    const defaultPromos = [
      {
        id: 'promo-1',
        title: 'Solana Web3 Summer Check-In',
        desc: 'Book with a Solana wallet and verify your attendance. Get 25 PAB tokens direct-deposited and a complimentary drink/service upgrade on arrival.',
        badge: 'Web3 Exclusive',
        color: 'from-[#14F195]/10 to-[#9945FF]/10',
        borderColor: 'border-[#14F195]/30'
      },
      {
        id: 'promo-2',
        title: 'Karachi Web3 Meetup Venue Discount',
        desc: 'Show your Pabandi Soulbound NFT (Gold Patron or above) to get 15% off your final bill. Valid for table bookings containing 4+ guests.',
        badge: 'SBT Loyalty',
        color: 'from-primary/5 to-[#38bdf8]/10',
        borderColor: 'border-primary/20'
      }
    ];

    if (business.category === 'RESTAURANT') {
      return [
        ...defaultPromos,
        {
          id: 'promo-3',
          title: 'Founding Partner Gastronomy Deal',
          desc: 'Enjoy a free chef-choice dessert with every main course reservation booked before 7 PM.',
          badge: 'Limited Promo',
          color: 'from-amber-500/5 to-orange-500/5',
          borderColor: 'border-amber-500/20'
        }
      ];
    }
    return defaultPromos;
  };

  // Mock gallery images
  const getGalleryImages = () => {
    const images: Record<string, string[]> = {
      RESTAURANT: [
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=600',
      ],
      SALON: [
        'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1620331311520-246422fd82f9?auto=format&fit=crop&q=80&w=600',
      ],
      FITNESS_CENTER: [
        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=600',
        'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&q=80&w=600',
      ]
    };
    return images[business.category] || images.RESTAURANT;
  };

  return (
    <div className="bg-surface min-h-screen pb-28 text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container">
      
      {/* Cover Hero Banner */}
      <section className="relative w-full h-80 md:h-[400px] overflow-hidden">
        <img 
          alt={business.name} 
          className="w-full h-full object-cover" 
          src={business.coverImageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200"} 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/50 to-transparent"></div>
        
        {/* Navigation & Action Overlays */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-10">
          <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          
          <div className="flex gap-2">
            <button onClick={handleShare} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors">
              {copiedLink ? <span className="text-xs font-bold text-emerald-400">Copied</span> : <ShareIcon className="h-5 w-5" />}
            </button>
            <button onClick={() => setIsLiked(!isLiked)} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors">
              <HeartIcon className={`h-5 w-5 ${isLiked ? 'text-red-500 fill-red-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Brand Information overlay */}
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 text-white z-10">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider font-headline">
                  {getCategoryLabel(business.category)}
                </span>
                
                <span className="flex items-center bg-black/30 backdrop-blur-md px-2.5 py-1 rounded text-xs font-bold font-headline">
                  <StarIconSolid className="h-3.5 w-3.5 text-yellow-400 mr-1" />
                  {business.rating ? business.rating.toFixed(1) : '4.8'} ({business.reviewCount} Reviews)
                </span>

                {business.isClaimed ? (
                  <span className="bg-[#14F195]/20 backdrop-blur-md text-[#14F195] px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border border-[#14F195]/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse"></span>
                    Verified Solana Partner
                  </span>
                ) : (
                  <span className="bg-amber-500/20 backdrop-blur-md text-[#fbbf24] px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider border border-[#fbbf24]/30">
                    Unclaimed Lead
                  </span>
                )}
              </div>
              
              <h1 className="font-headline text-3xl md:text-5xl font-black tracking-tight mb-2 leading-none">{business.name}</h1>
              
              <p className="font-body text-sm text-slate-300 flex items-center">
                <MapPinIcon className="h-4 w-4 mr-1.5 text-slate-400" /> 
                {business.address}, {business.city}, Pakistan
              </p>
            </div>
            
            {/* Direct Booking Shortcut Button */}
            {!business.isClaimed && (
              <button onClick={handleClaim} className="bg-amber-500 text-primary font-headline text-sm font-extrabold px-6 py-3.5 rounded-xl hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-2">
                <SparklesIcon className="h-4 w-4" /> Claim Listing
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Layout Area */}
      <main className="max-w-5xl mx-auto px-4 md:px-8 mt-8">
        
        {/* Unclaimed Notice Banner */}
        {!business.isClaimed && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm glowing-border">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-amber-500 text-3xl mt-0.5">verified</span>
              <div>
                <h3 className="font-headline font-bold text-on-surface text-lg">Are you the owner of {business.name}?</h3>
                <p className="font-body text-on-surface-variant text-sm mt-0.5 leading-relaxed">
                  Claim this listing to set up automated, no-show proof reservations, answer customer reviews, and earn $PAB tokens on honored bookings.
                </p>
              </div>
            </div>
            <button onClick={handleClaim} className="bg-amber-500 text-primary px-6 py-2.5 rounded-xl font-headline font-bold text-sm hover:bg-amber-400 transition-colors shrink-0">
              Claim Profile
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-outline-variant/30 gap-6 mb-8 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Overview & Booking', icon: <CalendarDaysIcon className="h-4 w-4" /> },
            { id: 'promotions', label: 'Web3 Promotions', icon: <SparklesIcon className="h-4 w-4" /> },
            { id: 'reviews', label: `Google Reviews (${reviews.length})`, icon: <ChatBubbleLeftRightIcon className="h-4 w-4" /> },
            { id: 'media', label: 'Photos & Socials', icon: <PhotoIcon className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 pb-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap font-headline ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-extrabold'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Areas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
          
          {/* Left Column (Main Tab Content) */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="space-y-4">
                  <h3 className="font-headline text-2xl font-black text-primary">About Venue</h3>
                  <p className="font-body text-base text-on-surface-variant leading-relaxed">
                    {business.description || `${business.name} is a premier ${getCategoryLabel(business.category).toLowerCase()} destination located in ${business.city}, Pakistan. Discover premium quality and service with Pabandi reliability.`}
                  </p>
                </div>

                <div className="border-t border-outline-variant/20 pt-6 space-y-4">
                  <h4 className="font-headline text-lg font-bold text-on-surface">Details & Contact</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <ClockIcon className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm font-body text-on-surface-variant">Mon - Sun: 12:00 PM - 11:30 PM</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <PhoneIcon className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm font-body text-on-surface-variant">{business.phone}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <GlobeAltIcon className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm font-body text-on-surface-variant">{business.website || 'No website listed'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPinIcon className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm font-body text-on-surface-variant">{business.address}</span>
                    </div>
                  </div>
                </div>

                {/* Map integration */}
                <div className="border-t border-outline-variant/20 pt-6 space-y-4">
                  <h4 className="font-headline text-lg font-bold text-on-surface">Location Map</h4>
                  <div className="w-full h-64 rounded-2xl overflow-hidden bg-surface-container border border-outline-variant/10 shadow-sm">
                    <BusinessMap 
                      latitude={business.latitude || 24.8607} 
                      longitude={business.longitude || 67.0011} 
                      name={business.name} 
                      zoom={15} 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PROMOTIONS */}
            {activeTab === 'promotions' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <h3 className="font-headline text-2xl font-black text-primary">Active Promotions</h3>
                  <p className="font-body text-sm text-on-surface-variant">
                    Exclusive rewards and token-back deals for checkout bookings in Pakistan.
                  </p>
                </div>

                <div className="space-y-4">
                  {getPromotions().map((promo) => (
                    <div key={promo.id} className={`p-6 rounded-2xl bg-gradient-to-br ${promo.color} border ${promo.borderColor} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm glowing-border`}>
                      <div className="space-y-2">
                        <span className="bg-primary-container text-on-primary-container text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider font-label inline-block">
                          {promo.badge}
                        </span>
                        <h4 className="font-headline font-bold text-lg text-on-surface">{promo.title}</h4>
                        <p className="font-body text-xs text-on-surface-variant leading-relaxed max-w-lg">{promo.desc}</p>
                      </div>
                      <button className="btn-primary text-xs shrink-0 py-2.5 px-4">
                        Claim Deal
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: REVIEWS */}
            {activeTab === 'reviews' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-headline text-2xl font-black text-primary">Google Reviews</h3>
                    <p className="font-body text-sm text-on-surface-variant mt-0.5">
                      Verified customer feedback pulled directly from Google Maps reviews.
                    </p>
                  </div>
                  
                  {/* Rating Big Badge */}
                  <div className="bg-surface-container p-4 rounded-2xl flex items-center gap-3 border border-outline-variant/10 shadow-sm shrink-0">
                    <div className="text-4xl font-headline font-black text-primary">
                      {business.rating ? business.rating.toFixed(1) : '4.8'}
                    </div>
                    <div>
                      <div className="flex text-yellow-400">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <StarIconSolid key={i} className="h-4 w-4" />
                        ))}
                      </div>
                      <div className="text-xs text-on-surface-variant font-medium font-body mt-0.5">
                        based on {business.reviewCount} user ratings
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reviews List */}
                {reviewsLoading ? (
                  <div className="text-center py-8 text-on-surface-variant">Loading reviews...</div>
                ) : reviews.length === 0 ? (
                  <div className="text-center py-10 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/30">
                    <ChatBubbleLeftRightIcon className="h-10 w-10 text-on-surface-variant opacity-40 mx-auto mb-2" />
                    <p className="text-sm font-body text-on-surface-variant">No reviews found for this venue.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review: any) => (
                      <div key={review.id} className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm space-y-3">
                        <div className="flex justify-between items-start gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary text-sm font-headline uppercase shrink-0">
                              {review.authorName.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-headline font-bold text-sm text-on-surface leading-none">{review.authorName}</h4>
                              <span className="text-[10px] text-on-surface-variant font-body mt-1 block">
                                {review.time ? format(new Date(review.time), 'MMMM dd, yyyy') : ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="flex text-yellow-400">
                              {Array.from({ length: 5 }).map((_, i) => (
                                i < review.rating ? <StarIconSolid key={i} className="h-3.5 w-3.5" /> : <StarIcon key={i} className="h-3.5 w-3.5" />
                              ))}
                            </span>
                            {review.sentimentLabel && (
                              <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                                review.sentimentLabel === 'positive' 
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              }`}>
                                AI: {review.sentimentLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="font-body text-sm text-on-surface-variant leading-relaxed italic">
                          "{review.text}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: MEDIA & SOCIALS */}
            {activeTab === 'media' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <h3 className="font-headline text-2xl font-black text-primary">Media Gallery</h3>
                  <p className="font-body text-sm text-on-surface-variant">
                    Photos of the venue, dishes, and ambient atmosphere from Google Place photos.
                  </p>
                </div>

                {/* Photo Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {getGalleryImages().map((imgUrl, i) => (
                    <div key={i} className="aspect-square rounded-2xl overflow-hidden bg-surface-container border border-outline-variant/15 shadow-sm group relative cursor-zoom-in">
                      <img 
                        src={imgUrl} 
                        alt={`${business.name} detail ${i}`} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                      />
                    </div>
                  ))}
                </div>

                {/* Mock Social Feed (Pakistan & Web3 community focus) */}
                <div className="border-t border-outline-variant/20 pt-8 space-y-4">
                  <h4 className="font-headline text-lg font-bold text-on-surface">Recent Community Buzz</h4>
                  <div className="space-y-4 max-w-lg">
                    {[
                      {
                        user: 'solana_pakistan',
                        name: 'Solana Pakistan 🇵🇰',
                        handle: '@solanapakistan',
                        avatar: '🪙',
                        text: `Great catching up with the devs and creators at ${business.name} last night! Easiest check-in flow with @PabandiApp score. Earned our loyalty PAB tokens. #SolanaPakistan #KarachiWeb3`,
                        time: '12h ago'
                      },
                      {
                        user: 'karachi_foodie',
                        name: 'Karachi Food Diaries',
                        handle: '@karachi_food',
                        avatar: '🍽️',
                        text: `Highly recommend booking a slot at ${business.name} via Pabandi. Completely zero deposit fee once your score hits 800. Checking in takes 3 seconds at the door.`,
                        time: '1d ago'
                      }
                    ].map((post, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl shrink-0">
                          {post.avatar}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-headline font-bold text-xs text-on-surface">{post.name}</span>
                            <span className="font-body text-[10px] text-on-surface-variant">{post.handle} · {post.time}</span>
                          </div>
                          <p className="font-body text-xs text-on-surface-variant leading-relaxed">
                            {post.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Right Column (Booking Widget Box) */}
          <div className="lg:col-span-5">
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-md border border-outline-variant/20 sticky top-28 glowing-border">
              <div className="flex justify-between items-center mb-6 border-b border-outline-variant/10 pb-4">
                <div>
                  <h3 className="font-headline text-xl font-bold text-primary">Book Table</h3>
                  <p className="font-body text-xs text-on-surface-variant mt-0.5">Secure your spot instantly</p>
                </div>
                
                {/* Reliability SBT check indicators */}
                <div className="text-right">
                  <span className="font-headline text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#38bdf8]">
                    {business.isClaimed ? 'Zero Dep' : 'No Deposit'}
                  </span>
                  <p className="font-body text-[9px] text-[#10b981] font-bold uppercase tracking-wide">Pabandi score active</p>
                </div>
              </div>

              {bookingMutation.isError && (
                <div className="bg-error-container text-on-error-container p-3 rounded-lg mb-4 text-xs font-semibold border border-error/25">
                  {(bookingMutation.error as any)?.response?.data?.message || 'Booking submission failed.'}
                </div>
              )}

              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Date *</label>
                    <input 
                      type="date" 
                      name="reservationDate" 
                      required 
                      min={format(new Date(), 'yyyy-MM-dd')} 
                      value={formData.reservationDate} 
                      onChange={handleBookingChange} 
                      className="input-field" 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Time *</label>
                    <input 
                      type="time" 
                      name="reservationTime" 
                      required 
                      value={formData.reservationTime} 
                      onChange={handleBookingChange} 
                      className="input-field" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Guests *</label>
                    <select 
                      name="numberOfGuests" 
                      required 
                      value={formData.numberOfGuests} 
                      onChange={handleBookingChange} 
                      className="input-field"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <option key={num} value={num}>{num} {num === 1 ? 'Person' : 'People'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Your Name *</label>
                    <input 
                      type="text" 
                      name="customerName" 
                      required 
                      value={formData.customerName} 
                      onChange={handleBookingChange} 
                      className="input-field" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Phone Number *</label>
                  <input 
                    type="tel" 
                    name="customerPhone" 
                    required 
                    value={formData.customerPhone} 
                    onChange={handleBookingChange} 
                    className="input-field" 
                    placeholder="+92 300 1234567" 
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-1">Special Requests</label>
                  <textarea 
                    name="specialRequests" 
                    rows={2} 
                    value={formData.specialRequests} 
                    onChange={handleBookingChange} 
                    className="input-field" 
                    placeholder="Allergies, seating preference, etc."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-on-surface-variant uppercase mb-2">Check-in Verification Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Safepay / Fiat */}
                    <label className={`flex flex-col items-center justify-center p-2.5 rounded-xl cursor-pointer border text-center transition-all ${
                      formData.paymentMethod === 'paypal' 
                        ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary' 
                        : 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}>
                      <input type="radio" name="paymentMethod" value="paypal" checked={formData.paymentMethod === 'paypal'} onChange={handleBookingChange} className="sr-only" />
                      <span className="font-bold text-xs">Safepay</span>
                      <span className="text-[9px] opacity-80 mt-0.5">PKR Card</span>
                    </label>

                    {/* Solana */}
                    <label className={`flex flex-col items-center justify-center p-2.5 rounded-xl cursor-pointer border text-center transition-all ${
                      formData.paymentMethod === 'solana' 
                        ? 'border-[#14F195] bg-[#14F195]/5 text-[#14F195] ring-1 ring-[#14F195]' 
                        : 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}>
                      <input type="radio" name="paymentMethod" value="solana" checked={formData.paymentMethod === 'solana'} onChange={handleBookingChange} className="sr-only" />
                      <span className="font-bold text-xs">Solana</span>
                      <span className="text-[9px] opacity-80 mt-0.5">SOL Escrow</span>
                    </label>

                    {/* BSC */}
                    <label className={`flex flex-col items-center justify-center p-2.5 rounded-xl cursor-pointer border text-center transition-all ${
                      formData.paymentMethod === 'bsc' 
                        ? 'border-[#f59e0b] bg-[#f59e0b]/5 text-[#d97706] ring-1 ring-[#f59e0b]' 
                        : 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}>
                      <input type="radio" name="paymentMethod" value="bsc" checked={formData.paymentMethod === 'bsc'} onChange={handleBookingChange} className="sr-only" />
                      <span className="font-bold text-xs">BSC</span>
                      <span className="text-[9px] opacity-80 mt-0.5">BNB Token</span>
                    </label>
                  </div>
                </div>

                {/* Web3 rewards hint */}
                <div className="bg-primary/5 border border-primary/10 p-3 rounded-xl flex items-start gap-2.5">
                  <ShieldCheckIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-headline font-bold text-primary">Web3 Protected check-in</h4>
                    <p className="text-[10px] text-on-surface-variant font-body leading-relaxed">
                      Completing this reservation earns you up to <strong className="text-primary">25 PAB tokens</strong>.
                    </p>
                  </div>
                </div>

                {/* Concierge Agent Explainer (for unclaimed listings) */}
                {!business.isClaimed && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-start gap-2.5 glowing-border">
                    <span className="material-symbols-outlined text-amber-500 shrink-0 mt-0.5 text-[20px]">smart_toy</span>
                    <div className="space-y-0.5 text-left">
                      <h4 className="text-xs font-headline font-bold text-amber-600">Pabandi Agent Concierge Active</h4>
                      <p className="text-[10px] text-on-surface-variant font-body leading-relaxed">
                        Our autonomous booking agent will secure your spot on external systems and sync your receipt code within seconds!
                      </p>
                    </div>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={bookingMutation.isLoading}
                  className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline text-sm font-bold py-3.5 rounded-xl shadow-md hover:opacity-95 transition-opacity flex justify-center items-center gap-2"
                >
                  {bookingMutation.isLoading ? 'Verifying...' : business.isClaimed ? 'Confirm Booking' : 'Book via Pabandi Agent'}
                </button>
              </form>
            </div>
          </div>

        </div>

      </main>

    </div>
  );
}

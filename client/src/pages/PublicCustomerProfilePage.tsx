import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { userService } from '../services/api';
import toast from 'react-hot-toast';

export const PublicCustomerProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (!id) return;
        const res = await userService.getPublicProfile(id);
        setUser(res.data.data.user);
      } catch (error) {
        console.error('Error fetching public user profile:', error);
        toast.error('User not found.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  const scoreColor = 
    user.reliabilityScore >= 800 ? 'text-primary' : 
    user.reliabilityScore >= 600 ? 'text-[#D97706]' : 'text-error';

  return (
    <div className="min-h-screen bg-surface pt-24 pb-12 px-4 md:px-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#D97706]/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors mb-6"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Back
        </button>

        <div className="glass-panel p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-[#D97706] to-primary"></div>
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar & Name */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-24 h-24 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-3xl font-headline mb-4 shadow-xl border-4 border-surface">
                {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
              </div>
              <h1 className="text-2xl font-headline font-bold text-center">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-sm text-on-surface-variant mt-1">
                Joined {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Stats */}
            <div className="flex-grow w-full space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold mb-1">Trust Score</span>
                  <span className={`text-3xl font-headline font-bold ${scoreColor}`}>
                    {user.reliabilityScore}
                  </span>
                </div>
                <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold mb-1">Tier</span>
                  <span className="text-lg font-headline font-bold text-on-surface mt-1">
                    {user.verificationTier}
                  </span>
                </div>
              </div>

              {/* Connected Accounts */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5">
                <h3 className="text-sm font-semibold mb-4 text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  Verified Identities
                </h3>
                {user.connectedSocials && user.connectedSocials.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {user.connectedSocials.map((social: string) => (
                      <div key={social} className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low rounded-lg text-sm capitalize">
                        <span className="material-symbols-outlined text-[16px]">
                          {social === 'google' ? 'mail' : social === 'facebook' ? 'facebook' : 'link'}
                        </span>
                        {social}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant/70 italic">No public social identities linked.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Favorite Businesses (if exposed) */}
        {user.businesses && user.businesses.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-headline font-bold mb-4">Favorite Businesses</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {user.businesses.map((biz: any) => (
                <div 
                  key={biz.id}
                  onClick={() => navigate(`/business/${biz.id}`)}
                  className="bg-surface-container-low p-3 rounded-2xl flex gap-3 cursor-pointer hover:bg-surface-container transition-colors"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
                    <img src={biz.coverImageUrl} alt={biz.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <h4 className="font-semibold text-sm line-clamp-1">{biz.name}</h4>
                    <p className="text-xs text-on-surface-variant">{biz.city}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs font-medium text-[#D97706]">
                      <span className="material-symbols-outlined text-[12px]">star</span>
                      {biz.rating} ({biz.reviewCount})
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

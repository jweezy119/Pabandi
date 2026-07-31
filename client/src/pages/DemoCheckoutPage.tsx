import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

export const DemoCheckoutPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const response = await api.post('/checkout/session/demo');
        const sessionId = response.data?.data?.sessionId;
        if (sessionId) {
          navigate(`/checkout/${sessionId}`, { replace: true });
        } else {
          toast.error('Demo checkout could not start');
          setLoading(false);
        }
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Demo checkout failed');
        setLoading(false);
      }
    };

    init();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-sm">Starting demo checkout...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <button
        onClick={() => navigate('/')}
        className="px-4 py-2 rounded-lg bg-[#95BF47] text-black font-bold"
      >
        Return home
      </button>
    </div>
  );
};

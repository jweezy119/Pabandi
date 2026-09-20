/**
 * ShareButton - Share booking/payment via WhatsApp
 * Mobile-first, responsive component
 */

import React, { useState } from 'react';

interface ShareButtonProps {
  type: 'booking' | 'payment' | 'general';
  title?: string;
  message?: string;
  phone?: string;
  bookingData?: {
    id: string;
    businessName: string;
    date: string;
    time: string;
    partySize: number;
    totalAmount?: number;
  };
  paymentData?: {
    id: string;
    amount: number;
    businessName: string;
  };
  className?: string;
  variant?: 'primary' | 'outline' | 'icon';
  size?: 'sm' | 'md' | 'lg';
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  type,
  title,
  message,
  phone,
  bookingData,
  paymentData,
  className = '',
  variant = 'primary',
  size = 'md',
}) => {
  const [isShared, setIsShared] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const generateMessage = (): string => {
    if (message) return message;

    switch (type) {
      case 'booking':
        if (bookingData) {
          return `📅 Booking Confirmation\n\n🏪 ${bookingData.businessName}\n📅 ${bookingData.date}\n⏰ ${bookingData.time}\n👥 ${bookingData.partySize} people\n💰 PKR ${bookingData.totalAmount?.toLocaleString()}\n\nBooking ID: ${bookingData.id}\n\nPowered by Pabandi 🇵🇰`;
        }
        return 'Booking shared via Pabandi';
      case 'payment':
        if (paymentData) {
          return `💳 Payment Confirmation\n\n🏪 ${paymentData.businessName}\n💰 PKR ${paymentData.amount.toLocaleString()}\n\nPayment ID: ${paymentData.id}\n\nSecure payment via Pabandi 🇵🇰`;
        }
        return 'Payment shared via Pabandi';
      default:
        return 'Shared via Pabandi 🇵🇰';
    }
  };

  const handleShare = async () => {
    setIsLoading(true);
    try {
      const shareMessage = generateMessage();
      
      if (phone) {
        // Open WhatsApp with pre-filled message
        const formattedPhone = phone.replace(/\D/g, '');
        const encodedMessage = encodeURIComponent(shareMessage);
        window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
      } else {
        // Use Web Share API if available
        if (navigator.share) {
          await navigator.share({
            title: title || 'Pabandi',
            text: shareMessage,
          });
        } else {
          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(shareMessage);
          alert('Message copied to clipboard!');
        }
      }
      setIsShared(true);
      setTimeout(() => setIsShared(false), 2000);
    } catch (error) {
      console.error('Share failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary: 'bg-green-600 hover:bg-green-700 text-white',
    outline: 'border-2 border-green-600 text-green-600 hover:bg-green-50',
    icon: 'bg-green-600 hover:bg-green-700 text-white p-2 rounded-full',
  };

  return (
    <button
      onClick={handleShare}
      disabled={isLoading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      aria-label="Share via WhatsApp"
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      )}
      {variant !== 'icon' && (
        <span>{isShared ? 'Shared!' : title || 'Share via WhatsApp'}</span>
      )}
    </button>
  );
};

export default ShareButton;

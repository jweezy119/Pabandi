/**
 * QR Code Utility
 * Generates a QR code URL from a booking reference.
 * Uses the free QRServer API (no API key required).
 */

export function generateQRCodeUrl(data: string, size: number = 200): string {
  const encoded = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=FFFFFF&color=1a1a2e&margin=10`;
}

export function generateQRCodeDataUrl(data: string, size: number = 200): string {
  return generateQRCodeUrl(data, size);
}

/**
 * Generate a check-in QR code payload
 * This encodes the booking reference as a structured string
 */
export function generateCheckInQRPayload(bookingRef: string): string {
  const payload = {
    type: 'PABANDI_CHECKIN',
    ref: bookingRef,
    ts: Date.now(),
  };
  return JSON.stringify(payload);
}

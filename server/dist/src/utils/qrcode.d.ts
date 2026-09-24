/**
 * QR Code Utility
 * Generates a QR code URL from a booking reference.
 * Uses the free QRServer API (no API key required).
 */
export declare function generateQRCodeUrl(data: string, size?: number): string;
export declare function generateQRCodeDataUrl(data: string, size?: number): string;
/**
 * Generate a check-in QR code payload
 * This encodes the booking reference as a structured string
 */
export declare function generateCheckInQRPayload(bookingRef: string): string;
//# sourceMappingURL=qrcode.d.ts.map
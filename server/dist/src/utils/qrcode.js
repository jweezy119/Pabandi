"use strict";
/**
 * QR Code Utility
 * Generates a QR code URL from a booking reference.
 * Uses the free QRServer API (no API key required).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQRCodeUrl = generateQRCodeUrl;
exports.generateQRCodeDataUrl = generateQRCodeDataUrl;
exports.generateCheckInQRPayload = generateCheckInQRPayload;
function generateQRCodeUrl(data, size = 200) {
    const encoded = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=FFFFFF&color=1a1a2e&margin=10`;
}
function generateQRCodeDataUrl(data, size = 200) {
    return generateQRCodeUrl(data, size);
}
/**
 * Generate a check-in QR code payload
 * This encodes the booking reference as a structured string
 */
function generateCheckInQRPayload(bookingRef) {
    const payload = {
        type: 'PABANDI_CHECKIN',
        ref: bookingRef,
        ts: Date.now(),
    };
    return JSON.stringify(payload);
}
//# sourceMappingURL=qrcode.js.map
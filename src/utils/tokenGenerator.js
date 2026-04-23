import crypto from 'crypto';

/**
 * Generates a high-entropy cryptographically secure token.
 * Option 1: UUIDv4
 * Option 2: 32 bytes hex string (256-bit entropy)
 * 
 * We use 32 random bytes represented as a hex string for maximum entropy.
 * 
 * @returns {string} The securely generated QR token
 */
export const generateSecureToken = () => {
    // 32 bytes = 256 bits of entropy.
    return crypto.randomBytes(32).toString('hex');
};

import { generateKeyPairSync } from 'crypto';

let cached: { privateKey: string; publicKey: string } | null = null;

export function getJwtKeys() {
    if (cached) return cached;

    const privateKeyEnv = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const publicKeyEnv = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n');

    if (privateKeyEnv && publicKeyEnv) {
        cached = { privateKey: privateKeyEnv, publicKey: publicKeyEnv };
        return cached;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set in production');
    }

    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    cached = {
        privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
        publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    };
    return cached;
}

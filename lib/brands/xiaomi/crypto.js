/**
 * Xiaomi cloud crypto primitives: the RC4 + HMAC-SHA1 + SHA1 signature scheme used by
 * api.io.mi.com. Adapted for TypeScript from hass-xiaomi-miot (Copyright (c) al-one,
 * Apache-2.0, https://github.com/al-one/hass-xiaomi-miot) core/utils.py RC4 and the micloud
 * library's miutils, so the wire format matches the Python reference byte for byte.
 * @module dsh-iot-studio/brands/xiaomi/crypto
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';
/** Uppercase alphanumeric alphabet used for account device ids and nonces. */
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
/**
 * RC4 stream cipher with the Xiaomi twist of skipping the first 1024 keystream bytes
 * (Python "RC4(pwd).init1024().crypt(data)"). Encryption and decryption are the same call.
 * @param key - raw RC4 key bytes.
 * @param data - bytes to transform.
 * @returns keystream-xored bytes.
 */
export function rc4Skip1024(key, data) {
    const ksa = new Uint8Array(256);
    for (let i = 0; i < 256; i++)
        ksa[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + ksa[i] + key[(i % key.length)]) & 255;
        const tmp = ksa[i];
        ksa[i] = ksa[j];
        ksa[j] = tmp;
    }
    let idx = 0;
    let jdx = 0;
    const out = Buffer.alloc(data.length);
    const advance = (count) => {
        for (let n = 0; n < count; n++) {
            idx = (idx + 1) & 255;
            jdx = (jdx + ksa[idx]) & 255;
            const tmp = ksa[idx];
            ksa[idx] = ksa[jdx];
            ksa[jdx] = tmp;
        }
    };
    advance(1024);
    for (let n = 0; n < data.length; n++) {
        idx = (idx + 1) & 255;
        jdx = (jdx + ksa[idx]) & 255;
        const tmp = ksa[idx];
        ksa[idx] = ksa[jdx];
        ksa[jdx] = tmp;
        const k = ksa[(ksa[idx] + ksa[jdx]) & 255];
        out[n] = data[n] ^ k;
    }
    return out;
}
/** Generate the per-request "_nonce": base64 of 8 random uppercase-alphanumeric bytes. */
export function genNonce() {
    const raw = randomBytes(8);
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++)
        bytes[i] = ALNUM.charCodeAt(raw[i] % ALNUM.length);
    return Buffer.from(bytes).toString('base64');
}
/**
 * HMAC-SHA1 of the decoded nonce under the decoded ssecurity, re-encoded in base64.
 * @param ssecurity - base64 security key from login.
 * @param nonce - base64 request nonce.
 * @returns base64 signed nonce used as the RC4 key and signing tail.
 */
export function signedNonce(ssecurity, nonce) {
    return createHmac('sha1', Buffer.from(ssecurity, 'base64'))
        .update(Buffer.from(nonce, 'base64'))
        .digest('base64');
}
/**
 * SHA1 signature over "METHOD&path&k1=v1&k2=v2&...&signedNonce"; a leading "/app/" in the
 * path is reduced to "/" exactly like the Python reference before hashing.
 * @param method - HTTP verb.
 * @param url - full request URL.
 * @param params - form fields participating in the signature, insertion order.
 * @param nonce - signed nonce appended last.
 * @returns base64 signature.
 */
export function sha1Sign(method, url, params, nonce) {
    const path = new URL(url).pathname;
    const fixed = path.startsWith('/app/') ? path.slice(4) : path;
    const parts = [method.toUpperCase(), fixed];
    for (const [k, v] of Object.entries(params))
        parts.push(`${k}=${v}`);
    parts.push(nonce);
    return createHash('sha1').update(parts.join('&'), 'utf8').digest('base64');
}
/** RC4-encrypt a string under the base64 signed nonce and return base64. */
export function encryptData(signedNonceB64, data) {
    return rc4Skip1024(Buffer.from(signedNonceB64, 'base64'), Buffer.from(data, 'utf8')).toString('base64');
}
/** RC4-decrypt a base64 payload under the base64 signed nonce and return the utf8 string. */
export function decryptData(signedNonceB64, dataB64) {
    return rc4Skip1024(Buffer.from(signedNonceB64, 'base64'), Buffer.from(dataB64, 'base64')).toString('utf8');
}
/** Uppercase hex MD5 of the utf8 text: the "hash" field of the login form. */
export function md5Upper(text) {
    return createHash('md5').update(text, 'utf8').digest('hex').toUpperCase();
}
/**
 * Random alphanumeric agent/client id (the "deviceId" cookie and UA token).
 * @param length - characters to produce.
 * @returns uppercase alnum string.
 */
export function randomString(length) {
    const raw = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++)
        out += ALNUM[raw[i] % ALNUM.length];
    return out;
}

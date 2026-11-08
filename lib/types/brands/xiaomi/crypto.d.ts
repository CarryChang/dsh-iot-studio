/**
 * Xiaomi cloud crypto primitives: the RC4 + HMAC-SHA1 + SHA1 signature scheme used by
 * api.io.mi.com. Adapted for TypeScript from hass-xiaomi-miot (Copyright (c) al-one,
 * Apache-2.0, https://github.com/al-one/hass-xiaomi-miot) core/utils.py RC4 and the micloud
 * library's miutils, so the wire format matches the Python reference byte for byte.
 * @module dsh-iot-studio/brands/xiaomi/crypto
 */
/**
 * RC4 stream cipher with the Xiaomi twist of skipping the first 1024 keystream bytes
 * (Python "RC4(pwd).init1024().crypt(data)"). Encryption and decryption are the same call.
 * @param key - raw RC4 key bytes.
 * @param data - bytes to transform.
 * @returns keystream-xored bytes.
 */
export declare function rc4Skip1024(key: Uint8Array, data: Uint8Array): Buffer;
/** Generate the per-request "_nonce": base64 of 8 random uppercase-alphanumeric bytes. */
export declare function genNonce(): string;
/**
 * HMAC-SHA1 of the decoded nonce under the decoded ssecurity, re-encoded in base64.
 * @param ssecurity - base64 security key from login.
 * @param nonce - base64 request nonce.
 * @returns base64 signed nonce used as the RC4 key and signing tail.
 */
export declare function signedNonce(ssecurity: string, nonce: string): string;
/**
 * SHA1 signature over "METHOD&path&k1=v1&k2=v2&...&signedNonce"; a leading "/app/" in the
 * path is reduced to "/" exactly like the Python reference before hashing.
 * @param method - HTTP verb.
 * @param url - full request URL.
 * @param params - form fields participating in the signature, insertion order.
 * @param nonce - signed nonce appended last.
 * @returns base64 signature.
 */
export declare function sha1Sign(method: string, url: string, params: Record<string, string>, nonce: string): string;
/** RC4-encrypt a string under the base64 signed nonce and return base64. */
export declare function encryptData(signedNonceB64: string, data: string): string;
/** RC4-decrypt a base64 payload under the base64 signed nonce and return the utf8 string. */
export declare function decryptData(signedNonceB64: string, dataB64: string): string;
/** Uppercase hex MD5 of the utf8 text: the "hash" field of the login form. */
export declare function md5Upper(text: string): string;
/**
 * Random alphanumeric agent/client id (the "deviceId" cookie and UA token).
 * @param length - characters to produce.
 * @returns uppercase alnum string.
 */
export declare function randomString(length: number): string;

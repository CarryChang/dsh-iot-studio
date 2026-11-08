/**
 * Xiaomi cloud client: account login (serviceLogin / serviceLoginAuth2 / serviceToken), the
 * RC4-signed api.io.mi.com request pipeline, device listing and miotspec prop/action calls.
 * Adapted for TypeScript from hass-xiaomi-miot core/xiaomi_cloud.py (Copyright (c) al-one,
 * Apache-2.0, https://github.com/al-one/hass-xiaomi-miot); captcha and SMS-verify challenges
 * raise an actionable IotUserError instead of an interactive flow. Credentials and tokens are
 * never included in returned strings or logs.
 * @module dsh-iot-studio/brands/xiaomi/cloud
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { decryptData, encryptData, genNonce, md5Upper, randomString, sha1Sign, signedNonce } from "./crypto.js";
import { IotUserError } from "../types.js";
const ACCOUNT_BASE = 'https://account.xiaomi.com';
const UA_TEMPLATE = 'Android-7.1.1-1.0.0-ONEPLUS A3010-136-%s APP/xiaomi.smarthome APPV/62830';
function isTokenExpired(data) {
    const code = data['code'];
    const msg = typeof data['message'] === 'string' ? data['message'] : '';
    if (code === 2 || code === 3)
        return true;
    return msg.includes('auth err') || msg === 'invalid signature' || msg === 'SERVICETOKEN_EXPIRED';
}
function apiBase(country) {
    return country && country !== 'cn' ? `https://${country}.api.io.mi.com/app` : 'https://api.io.mi.com/app';
}
/** Strip the anti-JSON "&&&START&&&" prefix Xiaomi account endpoints prepend. */
function parseAccountJson(text) {
    return JSON.parse(text.replace('&&&START&&&', ''));
}
/**
 * Minimal same-origin cookie jar: Xiaomi hands out serviceToken/userId across redirect hops, so
 * redirects are followed manually and every Set-Cookie is captured.
 */
class CookieJar {
    map = new Map();
    /** Absorb every Set-Cookie header of a response into the jar. */
    absorb(response) {
        for (const line of response.headers.getSetCookie()) {
            const [pair] = line.split(';');
            if (!pair)
                continue;
            const eq = pair.indexOf('=');
            if (eq <= 0)
                continue;
            this.map.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
        }
    }
    /** Seed one cookie (used for the pre-login deviceId/sdkVersion pair). */
    set(name, value) {
        this.map.set(name, value);
    }
    get(name) {
        return this.map.get(name);
    }
    /** Jar rendered as a Cookie header value. */
    header() {
        return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
}
/** Xiaomi cloud session with lazy login, token persistence and the miotspec request surface. */
export class MiotCloud {
    config;
    userAgent;
    cookies = new CookieJar();
    userId = '';
    serviceToken = '';
    ssecurity = '';
    deviceId = '';
    authLoaded = false;
    constructor(config) {
        this.config = config;
        this.deviceId = randomString(16);
        this.userAgent = UA_TEMPLATE.replace('%s', this.deviceId);
    }
    get authFile() {
        const uid = (this.userId || this.config.username).replace(/[^A-Za-z0-9@._-]/g, '_');
        return join(this.config.stateDir, `xiaomi-auth-${uid}-${this.config.serverCountry}.json`);
    }
    /** Load the cached service token once; a cache for a different account is ignored. */
    async ensureAuthLoaded() {
        if (this.authLoaded)
            return;
        this.authLoaded = true;
        let stored;
        try {
            stored = JSON.parse(await readFile(this.authFile, 'utf8'));
        }
        catch {
            return;
        }
        if (stored.username && stored.username !== this.config.username)
            return;
        this.deviceId = stored.deviceId && stored.deviceId.length <= 32 ? stored.deviceId : this.deviceId;
        this.userAgent = UA_TEMPLATE.replace('%s', this.deviceId);
        this.userId = stored.userId ?? '';
        this.serviceToken = stored.serviceToken ?? '';
        this.ssecurity = stored.ssecurity ?? '';
        if (this.serviceToken) {
            this.cookies.set('userId', this.userId);
            this.cookies.set('serviceToken', this.serviceToken);
            this.cookies.set('yetAnotherServiceToken', this.serviceToken);
        }
    }
    async saveAuth() {
        const data = {
            username: this.config.username,
            userId: this.userId,
            deviceId: this.deviceId,
            serviceToken: this.serviceToken,
            ssecurity: this.ssecurity,
            updatedAt: new Date().toISOString(),
        };
        await mkdir(dirname(this.authFile), { recursive: true });
        await writeFile(this.authFile, JSON.stringify(data, null, 2), { mode: 0o600 });
    }
    dropAuth() {
        this.serviceToken = '';
        this.cookies = new CookieJar();
    }
    fetchTimeout(path, init) {
        return fetch(path, { ...init, signal: AbortSignal.timeout(this.config.httpTimeoutSec * 1000) });
    }
    /**
     * Password login: step1 serviceLogin, step2 serviceLoginAuth2 with MD5(password), step3
     * following the returned location for the serviceToken cookie.
     * @throws IotUserError with the exact next user action on captcha, device verification,
     * or rejected credentials.
     */
    async login() {
        if (!this.config.password) {
            throw new IotUserError('Xiaomi token cache is missing or expired and no password is configured. '
                + 'Set xiaomi.password in cordis.yml or the XIAOMI_PASSWORD environment variable, then retry.');
        }
        this.cookies = new CookieJar();
        this.cookies.set('sdkVersion', '3.8.6');
        this.cookies.set('deviceId', this.deviceId);
        const auth = await this.accountGet('/pass/serviceLogin', { sid: 'xiaomiio', _json: 'true' });
        const location = await this.loginStep2(auth);
        await this.loginStep3(location);
        if (!this.serviceToken) {
            throw new IotUserError('Xiaomi login finished without a serviceToken; retry later or check the account.');
        }
        await this.saveAuth();
    }
    async accountGet(path, query) {
        const url = new URL(path, ACCOUNT_BASE);
        for (const [k, v] of Object.entries(query))
            url.searchParams.set(k, v);
        const response = await this.fetchTimeout(url.toString(), {
            headers: { 'User-Agent': this.userAgent, Cookie: this.cookies.header() },
        });
        this.cookies.absorb(response);
        const text = await response.text();
        let data;
        try {
            data = parseAccountJson(text);
        }
        catch {
            throw new IotUserError(`Xiaomi account endpoint ${path} returned an unreadable response (HTTP ${response.status}).`);
        }
        return data;
    }
    async accountPost(url, form) {
        const response = await this.fetchTimeout(url, {
            method: 'POST',
            headers: {
                'User-Agent': this.userAgent,
                'Content-Type': 'application/x-www-form-urlencoded',
                Cookie: this.cookies.header(),
            },
            body: new URLSearchParams(form).toString(),
        });
        this.cookies.absorb(response);
        const text = await response.text();
        let data;
        try {
            data = parseAccountJson(text);
        }
        catch {
            throw new IotUserError(`Xiaomi login returned an unreadable response (HTTP ${response.status}).`);
        }
        return data;
    }
    async loginStep2(auth) {
        const body = {
            user: this.config.username,
            hash: md5Upper(this.config.password),
            callback: String(auth['callback'] ?? ''),
            sid: 'xiaomiio',
            qs: String(auth['qs'] ?? ''),
            _sign: String(auth['_sign'] ?? ''),
        };
        const url = new URL('/pass/serviceLoginAuth2', ACCOUNT_BASE);
        url.searchParams.set('_json', 'true');
        const data = await this.accountPost(url.toString(), body);
        const location = typeof data['location'] === 'string' ? data['location'] : '';
        if (location) {
            this.userId = String(data['userId'] ?? this.userId);
            this.ssecurity = String(data['ssecurity'] ?? '');
            return location;
        }
        if (data['notificationUrl']) {
            throw new IotUserError('Xiaomi login requires device verification (SMS / email confirmation). '
                + 'Open https://account.xiaomi.com in a browser, complete the verification once, then retry; '
                + 'or keep the Mi Home app logged in so a fresh token cache can be produced by a password-capable client.');
        }
        if (data['captchaUrl']) {
            throw new IotUserError('Xiaomi login requires a captcha for this account and IP. Sign in once in the Mi Home app or at '
                + 'https://account.xiaomi.com to clear the challenge, then retry.');
        }
        const code = data['code'];
        if (code === 20003 || code === 70002 || code === 70016) {
            throw new IotUserError('Xiaomi rejected the credentials. Check xiaomi.username / XIAOMI_PASSWORD.');
        }
        throw new IotUserError(`Xiaomi login step2 failed (code ${String(code)}).`);
    }
    async loginStep3(location) {
        let url = location;
        for (let hop = 0; hop < 10 && url; hop++) {
            const response = await this.fetchTimeout(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'content-type': 'application/x-www-form-urlencoded',
                    Cookie: this.cookies.header(),
                },
                redirect: 'manual',
            });
            this.cookies.absorb(response);
            url = response.headers.get('location') ?? '';
        }
        const serviceToken = this.cookies.get('serviceToken');
        if (serviceToken) {
            this.serviceToken = serviceToken;
            this.userId = this.cookies.get('userId') ?? this.userId;
        }
    }
    /**
     * RC4-signed POST to one api.io.mi.com endpoint. Expired tokens trigger one re-login and one
     * retry when a password is configured; otherwise the failure surfaces for the user to fix.
     * @param api - path below /app, e.g. "miotspec/prop/get".
     * @param data - JSON body payload.
     * @returns parsed response JSON.
     */
    async requestApi(api, data) {
        await this.ensureAuthLoaded();
        if (!this.serviceToken)
            await this.login();
        const first = await this.signedRequest(api, data);
        if (isTokenExpired(first)) {
            if (!this.config.password) {
                throw new IotUserError('The cached Xiaomi service token expired and no password is configured to renew it. '
                    + 'Set xiaomi.password or XIAOMI_PASSWORD, then retry.');
            }
            this.dropAuth();
            await this.login();
            return await this.signedRequest(api, data);
        }
        return first;
    }
    async signedRequest(api, data) {
        const url = `${apiBase(this.config.serverCountry)}/${api.replace(/^\/+/, '')}`;
        const params = { data: JSON.stringify(data ?? {}) };
        const nonce = genNonce();
        const signed = signedNonce(this.ssecurity, nonce);
        params['rc4_hash__'] = sha1Sign('POST', url, params, signed);
        for (const key of Object.keys(params))
            params[key] = encryptData(signed, params[key]);
        params['signature'] = sha1Sign('POST', url, params, signed);
        params['ssecurity'] = this.ssecurity;
        params['_nonce'] = nonce;
        const response = await this.fetchTimeout(url, {
            method: 'POST',
            headers: {
                'User-Agent': this.userAgent,
                'Content-Type': 'application/x-www-form-urlencoded',
                'MIOT-ENCRYPT-ALGORITHM': 'ENCRYPT-RC4',
                'Accept-Encoding': 'identity',
                Cookie: this.cookieHeader(),
            },
            body: new URLSearchParams(params).toString(),
        });
        const text = await response.text();
        return this.decodeApiResponse(text, nonce);
    }
    cookieHeader() {
        const timezone = 'GMT+08:00';
        const extras = {
            locale: 'zh_CN',
            timezone,
            is_daylight: '0',
            dst_offset: '0',
            channel: 'MI_APP_STORE',
        };
        const base = this.cookies.header();
        const joined = Object.entries(extras).map(([k, v]) => `${k}=${v}`).join('; ');
        return base ? `${base}; ${joined}` : joined;
    }
    decodeApiResponse(text, nonce) {
        const direct = this.tryJson(text);
        if (direct)
            return direct;
        const signed = signedNonce(this.ssecurity, nonce);
        const decrypted = this.tryJson(decryptData(signed, text.trim()));
        if (decrypted)
            return decrypted;
        throw new IotUserError('Xiaomi cloud returned a response that could not be decoded.');
    }
    tryJson(text) {
        try {
            return JSON.parse(text);
        }
        catch {
            return undefined;
        }
    }
    async miotSpec(api, params) {
        const resp = await this.requestApi(`miotspec/${api}`, { params });
        const result = resp['result'];
        if (Array.isArray(result))
            return result;
        if (resp['code']) {
            throw new IotUserError(`Xiaomi miotspec/${api} failed: ${JSON.stringify(resp)}`);
        }
        return [];
    }
    /** All cloud devices, enriched with home and room names when that lookup succeeds. */
    async getDevices() {
        const resp = await this.requestApi('home/device_list', {
            getVirtualModel: true,
            getHuamiDevices: 1,
            get_split_device: false,
            support_smart_home: true,
        });
        const result = resp['result'];
        const list = result?.list ?? [];
        const rooms = await this.getHomerooms().catch(() => undefined);
        if (!rooms)
            return list;
        for (const device of list) {
            const placed = rooms[device.did ?? ''];
            if (!placed)
                continue;
            if (placed.homeName)
                device.home_name = placed.homeName;
            if (placed.roomName)
                device.room_name = placed.roomName;
        }
        return list;
    }
    async getHomerooms() {
        const resp = await this.requestApi('v2/homeroom/gethome_merged', {
            fg: true,
            fetch_share: true,
            fetch_share_dev: true,
            limit: 300,
            app_ver: 7,
            plat_form: 0,
        });
        const result = resp['result'];
        const map = {};
        for (const home of result?.homelist ?? []) {
            for (const room of home.roomlist ?? []) {
                for (const did of room.dids ?? []) {
                    const placed = {};
                    if (home.name)
                        placed.homeName = home.name;
                    if (room.name)
                        placed.roomName = room.name;
                    map[did] = placed;
                }
            }
        }
        return map;
    }
    /** Read current property values for {did, siid, piid} references. */
    async getProps(refs) {
        return await this.miotSpec('prop/get', refs);
    }
    /** Write one property; throws IotUserError when the device rejects the change. */
    async setProp(did, siid, piid, value) {
        return await this.miotSpec('prop/set', [{ did, siid, piid, value }]);
    }
    /** Invoke one action; throws IotUserError when the device rejects the call. */
    async doAction(did, siid, aiid, inArgs) {
        return await this.miotSpec('action', [{ did, siid, aiid, in: inArgs }]);
    }
}

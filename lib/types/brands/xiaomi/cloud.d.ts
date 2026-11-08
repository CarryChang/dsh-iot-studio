/**
 * Xiaomi cloud client: account login (serviceLogin / serviceLoginAuth2 / serviceToken), the
 * RC4-signed api.io.mi.com request pipeline, device listing and miotspec prop/action calls.
 * Adapted for TypeScript from hass-xiaomi-miot core/xiaomi_cloud.py (Copyright (c) al-one,
 * Apache-2.0, https://github.com/al-one/hass-xiaomi-miot); captcha and SMS-verify challenges
 * raise an actionable IotUserError instead of an interactive flow. Credentials and tokens are
 * never included in returned strings or logs.
 * @module dsh-iot-studio/brands/xiaomi/cloud
 */
/** Deployment-supplied Xiaomi account settings, already resolved from config or environment. */
export interface XiaomiCloudConfig {
    /** Account name: phone / email / Xiaomi id. */
    username: string;
    /** Account password; empty means token-cache-only operation. */
    password: string;
    /** Server region, "cn" or an overseas prefix such as "de". */
    serverCountry: string;
    /** Directory for the service-token cache file. */
    stateDir: string;
    /** Per-request timeout in seconds. */
    httpTimeoutSec: number;
}
/** One raw device row from home/device_list, trimmed to the fields this plugin reads. */
interface CloudDevice {
    did?: string;
    name?: string;
    model?: string;
    online?: boolean;
    home_id?: number;
    room_name?: string;
    home_name?: string;
    [key: string]: unknown;
}
/** Xiaomi cloud session with lazy login, token persistence and the miotspec request surface. */
export declare class MiotCloud {
    private readonly config;
    private userAgent;
    private cookies;
    private userId;
    private serviceToken;
    private ssecurity;
    private deviceId;
    private authLoaded;
    constructor(config: XiaomiCloudConfig);
    private get authFile();
    /** Load the cached service token once; a cache for a different account is ignored. */
    private ensureAuthLoaded;
    private saveAuth;
    private dropAuth;
    private fetchTimeout;
    /**
     * Password login: step1 serviceLogin, step2 serviceLoginAuth2 with MD5(password), step3
     * following the returned location for the serviceToken cookie.
     * @throws IotUserError with the exact next user action on captcha, device verification,
     * or rejected credentials.
     */
    login(): Promise<void>;
    private accountGet;
    private accountPost;
    private loginStep2;
    private loginStep3;
    /**
     * RC4-signed POST to one api.io.mi.com endpoint. Expired tokens trigger one re-login and one
     * retry when a password is configured; otherwise the failure surfaces for the user to fix.
     * @param api - path below /app, e.g. "miotspec/prop/get".
     * @param data - JSON body payload.
     * @returns parsed response JSON.
     */
    requestApi(api: string, data: unknown): Promise<Record<string, unknown>>;
    private signedRequest;
    private cookieHeader;
    private decodeApiResponse;
    private tryJson;
    private miotSpec;
    /** All cloud devices, enriched with home and room names when that lookup succeeds. */
    getDevices(): Promise<CloudDevice[]>;
    private getHomerooms;
    /** Read current property values for {did, siid, piid} references. */
    getProps(refs: {
        did: string;
        siid: number;
        piid: number;
    }[]): Promise<Record<string, unknown>[]>;
    /** Write one property; throws IotUserError when the device rejects the change. */
    setProp(did: string, siid: number, piid: number, value: unknown): Promise<Record<string, unknown>[]>;
    /** Invoke one action; throws IotUserError when the device rejects the call. */
    doAction(did: string, siid: number, aiid: number, inArgs: unknown[]): Promise<Record<string, unknown>[]>;
}
export {};

/**
 * Brand registry: maps brand keys to provider factories fed by resolved settings. Adding a
 * brand (tuya, apple home, ...) means one new provider file plus one register() row; tool
 * signatures and the skill never change.
 * @module dsh-iot-studio/brands/registry
 */
import type { IotBrandProvider } from './types.ts';
/** Whole-plugin settings as declared by Config in the entry module. */
export interface IotStudioSettings {
    defaultBrand: string;
    xiaomi: {
        username: string;
        password: string;
        serverCountry: string;
        stateDir: string;
        httpTimeoutSec: number;
    };
}
/** Supported brand keys in registration order, for error messages and the tool enum. */
export declare function supportedBrands(): string[];
/**
 * Lazily build and memoize the provider for one brand key.
 * @param brand - registry key such as "xiaomi".
 * @param settings - resolved plugin settings.
 * @returns the shared provider instance for that brand.
 * @throws IotUserError listing the supported brands when the key is unknown.
 */
export declare function getProvider(brand: string, settings: IotStudioSettings): IotBrandProvider;

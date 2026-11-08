/**
 * dsh-iot-studio Cordis plugin entry. Registers the IoT-control methodology skill and five
 * brand-agnostic iot_* tools routed through the brand registry (xiaomi today). Cloud access is
 * scoped to the configured Xiaomi account; tokens are cached under stateDir and never returned
 * in tool output.
 * @module dsh-iot-studio
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "iot-studio";
export declare const inject: string[];
/** Per-brand Xiaomi account settings; empty strings mean "read the environment instead". */
export interface XiaomiConfig {
    username: string;
    password: string;
    serverCountry: string;
    stateDir: string;
    httpTimeoutSec: number;
}
/** Deployment configuration for the plugin. */
export interface Config {
    /** Brand used when a call omits "brand". */
    defaultBrand: string;
    xiaomi: XiaomiConfig;
}
export declare const Config: z<Config>;
/**
 * Register the methodology skill and the five brand-routed IoT tools.
 * @param ctx - registrant context carrying the skill and tool registries.
 * @param config - deployment account and brand settings.
 * @returns when the plugin is ready.
 */
export declare function apply(ctx: Context, config: Config): Promise<void>;

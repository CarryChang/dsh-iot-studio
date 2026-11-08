/**
 * MIoT spec lookup: downloads the instance JSON for a "urn:miot-spec-v2:..." model from
 * miot-spec.org (fallback spec.miot-spec.com, the host pair chosen by hass-xiaomi-miot,
 * Copyright (c) al-one, Apache-2.0, https://github.com/al-one/hass-xiaomi-miot) and trims it
 * into the IotSpecSummary the tools return. Results are cached in memory for the process
 * lifetime.
 * @module dsh-iot-studio/brands/xiaomi/spec
 */
import type { IotSpecSummary } from '../types.ts';
interface RawInstance {
    description?: string;
    services?: {
        iid: number;
        type: string;
        description?: string;
        /** Newer specs carry a name field; older ones only description. */
        name?: string;
        properties?: {
            piid: number;
            name?: string;
            description?: string;
            access?: string[];
            format?: string;
            'value-range'?: number[];
            'value-list'?: {
                value: unknown;
                description: string;
            }[];
            unit?: string;
            properties?: number[];
        }[];
        actions?: {
            aiid: number;
            name?: string;
            description?: string;
            in?: number[];
            out?: number[];
        }[];
    }[];
}
/** Whether a model string is a directly resolvable miot-spec instance urn. */
export declare function isSpecUrn(model: string): boolean;
/**
 * Fetch and summarize the spec instance for a device urn, caching per urn.
 * @param urn - model string starting with "urn:miot-spec-v2:".
 * @param timeoutMs - per-host download timeout.
 * @returns trimmed spec summary.
 */
export declare function getSpecSummary(urn: string, timeoutMs: number): Promise<IotSpecSummary>;
/** Every read-accessible property reference across a spec, for whole-device status reads. */
export declare function readableProps(summary: IotSpecSummary): {
    siid: number;
    piid: number;
    name: string;
}[];
/** Flat name lookup for annotating property values; undefined when the piid is unknown. */
export declare function propertyNames(summary: IotSpecSummary): Map<string, string>;
/** Parse the recorded instance fixture shape without network; exported for smoke coverage. */
export declare function summarizeInstance(instance: RawInstance): IotSpecSummary;
export type { RawInstance };

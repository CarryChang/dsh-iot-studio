/**
 * MIoT spec lookup: downloads the instance JSON for a "urn:miot-spec-v2:..." model from
 * miot-spec.org (fallback spec.miot-spec.com, the host pair chosen by hass-xiaomi-miot,
 * Copyright (c) al-one, Apache-2.0, https://github.com/al-one/hass-xiaomi-miot) and trims it
 * into the IotSpecSummary the tools return. Results are cached in memory for the process
 * lifetime.
 * @module dsh-iot-studio/brands/xiaomi/spec
 */
import { IotUserError } from "../types.js";
const SPEC_HOSTS = ['https://miot-spec.org', 'https://spec.miot-spec.com'];
const cache = new Map();
/** Whether a model string is a directly resolvable miot-spec instance urn. */
export function isSpecUrn(model) {
    return model.startsWith('urn:');
}
async function fetchInstance(urn, timeoutMs) {
    const query = `type=${encodeURIComponent(urn)}`;
    let lastError = '';
    for (const host of SPEC_HOSTS) {
        const url = `${host}/miot-spec-v2/instance?${query}`;
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
            if (response.ok)
                return (await response.json());
            lastError = `HTTP ${response.status} from ${host}`;
        }
        catch (error) {
            lastError = `${host}: ${String(error)}`;
        }
    }
    throw new IotUserError(`Could not download the MIoT spec instance for ${urn} (${lastError}).`);
}
function summarizeProperty(raw) {
    const summary = {
        piid: raw.piid,
        name: raw.name ?? raw.description ?? `property.${raw.piid}`,
        access: raw.access ?? [],
        format: raw.format ?? 'unknown',
    };
    if (raw.unit)
        summary.unit = raw.unit;
    const range = raw['value-range'];
    if (Array.isArray(range) && range.length === 3)
        summary.valueRange = [range[0], range[1], range[2]];
    const values = raw['value-list'];
    if (Array.isArray(values) && values.length > 0) {
        summary.valueList = values.map((item) => ({ value: item.value, description: item.description }));
    }
    if (raw.description && raw.name)
        summary.description = raw.description;
    return summary;
}
function summarizeService(raw) {
    const typeTail = raw.type.split(':').at(-2) ?? raw.type;
    const service = {
        siid: raw.iid,
        name: raw.name ?? raw.description ?? typeTail,
        type: raw.type,
        properties: (raw.properties ?? []).map(summarizeProperty),
        actions: (raw.actions ?? []).map((action) => {
            const summarized = {
                aiid: action.aiid,
                name: action.name ?? action.description ?? `action.${action.aiid}`,
                in: action.in ?? [],
                out: action.out ?? [],
            };
            if (action.description)
                summarized.description = action.description;
            return summarized;
        }),
    };
    if (raw.description)
        service.description = raw.description;
    return service;
}
/**
 * Fetch and summarize the spec instance for a device urn, caching per urn.
 * @param urn - model string starting with "urn:miot-spec-v2:".
 * @param timeoutMs - per-host download timeout.
 * @returns trimmed spec summary.
 */
export async function getSpecSummary(urn, timeoutMs) {
    const hit = cache.get(urn);
    if (hit)
        return hit;
    const instance = await fetchInstance(urn, timeoutMs);
    const summary = {
        model: urn,
        services: (instance.services ?? []).map(summarizeService),
    };
    if (instance.description)
        summary.description = instance.description;
    cache.set(urn, summary);
    return summary;
}
/** Every read-accessible property reference across a spec, for whole-device status reads. */
export function readableProps(summary) {
    const out = [];
    for (const service of summary.services) {
        for (const property of service.properties) {
            if (property.access.includes('read'))
                out.push({ siid: service.siid, piid: property.piid, name: property.name });
        }
    }
    return out;
}
/** Flat name lookup for annotating property values; undefined when the piid is unknown. */
export function propertyNames(summary) {
    const map = new Map();
    for (const service of summary.services) {
        for (const property of service.properties)
            map.set(`${service.siid}.${property.piid}`, property.name);
    }
    return map;
}
/** Parse the recorded instance fixture shape without network; exported for smoke coverage. */
export function summarizeInstance(instance) {
    const summary = {
        model: 'fixture',
        services: (instance.services ?? []).map(summarizeService),
    };
    if (instance.description)
        summary.description = instance.description;
    return summary;
}

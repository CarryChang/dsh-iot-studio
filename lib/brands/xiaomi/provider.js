/**
 * Xiaomi brand provider: adapts MiotCloud plus the MIoT spec lookup to the neutral
 * IotBrandProvider seam the iot_* tools call. Device rows are mapped to IotDeviceSummary and
 * every cloud result carries an ok/error envelope instead of throwing raw responses.
 * @module dsh-iot-studio/brands/xiaomi/provider
 */
import { IotUserError } from "../types.js";
import { MiotCloud } from "./cloud.js";
import { getSpecSummary, isSpecUrn, propertyNames, readableProps } from "./spec.js";
/** Map a raw home/device_list row onto the neutral summary shape. Exported for smoke coverage. */
export function toDeviceSummary(row) {
    if (!row.did)
        return undefined;
    const summary = {
        did: String(row.did),
        name: String(row.name ?? row.did),
        model: String(row.model ?? ''),
        online: row.online === true,
    };
    if (row.home_name)
        summary.homeName = String(row.home_name);
    if (row.room_name)
        summary.roomName = String(row.room_name);
    return summary;
}
/** The "prop-urn" a cloud device carries differs by firmware; model is authoritative for MIoT. */
function specUrnOf(device) {
    if (isSpecUrn(device.model))
        return device.model;
    throw new IotUserError(`Device "${device.name}" (model ${device.model || 'unknown'}) is not a MIoT-spec urn device. `
        + 'Legacy miio-only models are not supported yet; check the Mi Home app to confirm the model string.');
}
/** Xiaomi cloud implementation of the brand provider seam. */
export class XiaomiBrandProvider {
    brand = 'xiaomi';
    cloud;
    specTimeoutMs;
    deviceCache;
    constructor(config) {
        this.cloud = new MiotCloud(config);
        this.specTimeoutMs = config.httpTimeoutSec * 1000;
    }
    async listDevices() {
        const rows = await this.cloud.getDevices();
        const devices = rows
            .map(row => toDeviceSummary(row))
            .filter((d) => d !== undefined);
        this.deviceCache = devices;
        return devices;
    }
    async requireDevice(did) {
        if (!this.deviceCache)
            await this.listDevices();
        const device = this.deviceCache?.find(d => d.did === did);
        if (!device) {
            throw new IotUserError(`Unknown device did "${did}". Run iot_list_devices and use one of its did values.`);
        }
        return device;
    }
    async getSpec(device) {
        return await getSpecSummary(specUrnOf(device), this.specTimeoutMs);
    }
    /** Spec summary addressed by did (lists devices first when the cache is cold). */
    async getSpecForDid(did) {
        return await this.getSpec(await this.requireDevice(did));
    }
    async getProps(did, refs) {
        if (refs.length === 0) {
            const spec = await this.getSpecForDid(did);
            refs = readableProps(spec).slice(0, 60);
        }
        const payload = refs.map(ref => ({ did, siid: ref.siid, piid: ref.piid }));
        const rows = await this.cloud.getProps(payload);
        let names = new Map();
        try {
            names = propertyNames(await this.getSpecForDid(did));
        }
        catch (error) {
            // Naming values is best-effort: the read already succeeded, so a spec-download
            // failure must not turn the whole result into an error.
            void error;
        }
        const results = rows.map(row => {
            const siid = Number(row['siid']);
            const piid = Number(row['piid']);
            const value = { siid, piid, value: row['value'], code: row['code'] };
            const name = names.get(`${siid}.${piid}`);
            if (name)
                value['name'] = name;
            return value;
        });
        return { ok: true, results };
    }
    async setProp(did, siid, piid, value) {
        const rows = await this.cloud.setProp(did, siid, piid, value);
        return envelopeFrom(rows);
    }
    async callAction(did, siid, aiid, inArgs) {
        const rows = await this.cloud.doAction(did, siid, aiid, inArgs);
        return envelopeFrom(rows);
    }
}
/** Turn per-item miotspec rows into the shared ok/error envelope (code != 0 is a failure). */
function envelopeFrom(rows) {
    const failed = rows.filter(row => Number(row['code'] ?? 0) !== 0);
    if (failed.length > 0) {
        return { ok: false, results: rows, error: `Device rejected the request: ${JSON.stringify(failed)}` };
    }
    return { ok: true, results: rows };
}

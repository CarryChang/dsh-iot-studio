/**
 * Xiaomi brand provider: adapts MiotCloud plus the MIoT spec lookup to the neutral
 * IotBrandProvider seam the iot_* tools call. Device rows are mapped to IotDeviceSummary and
 * every cloud result carries an ok/error envelope instead of throwing raw responses.
 * @module dsh-iot-studio/brands/xiaomi/provider
 */
import type { IotBrandProvider, IotCallResult, IotDeviceSummary, IotPropertyRef, IotSpecSummary } from '../types.ts';
import { type XiaomiCloudConfig } from './cloud.ts';
interface CloudDeviceRow {
    did?: string;
    name?: string;
    model?: string;
    online?: boolean;
    home_name?: string;
    room_name?: string;
    [key: string]: unknown;
}
/** Map a raw home/device_list row onto the neutral summary shape. Exported for smoke coverage. */
export declare function toDeviceSummary(row: CloudDeviceRow): IotDeviceSummary | undefined;
/** Xiaomi cloud implementation of the brand provider seam. */
export declare class XiaomiBrandProvider implements IotBrandProvider {
    readonly brand = "xiaomi";
    private readonly cloud;
    private readonly specTimeoutMs;
    private deviceCache;
    constructor(config: XiaomiCloudConfig);
    listDevices(): Promise<IotDeviceSummary[]>;
    private requireDevice;
    getSpec(device: IotDeviceSummary): Promise<IotSpecSummary>;
    /** Spec summary addressed by did (lists devices first when the cache is cold). */
    getSpecForDid(did: string): Promise<IotSpecSummary>;
    getProps(did: string, refs: IotPropertyRef[]): Promise<IotCallResult>;
    setProp(did: string, siid: number, piid: number, value: unknown): Promise<IotCallResult>;
    callAction(did: string, siid: number, aiid: number, inArgs: unknown[]): Promise<IotCallResult>;
}
export {};

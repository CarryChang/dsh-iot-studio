/**
 * Xiaomi brand provider: adapts MiotCloud plus the MIoT spec lookup to the neutral
 * IotBrandProvider seam the iot_* tools call. Device rows are mapped to IotDeviceSummary and
 * every cloud result carries an ok/error envelope instead of throwing raw responses.
 * @module dsh-iot-studio/brands/xiaomi/provider
 */

import type {
  IotBrandProvider,
  IotCallResult,
  IotDeviceSummary,
  IotPropertyRef,
  IotSpecSummary,
} from '../types.ts'
import { IotUserError } from '../types.ts'
import { MiotCloud, type XiaomiCloudConfig } from './cloud.ts'
import { getSpecSummary, isSpecUrn, propertyNames, readableProps } from './spec.ts'

interface CloudDeviceRow {
  did?: string
  name?: string
  model?: string
  online?: boolean
  home_name?: string
  room_name?: string
  [key: string]: unknown
}

/** Map a raw home/device_list row onto the neutral summary shape. Exported for smoke coverage. */
export function toDeviceSummary(row: CloudDeviceRow): IotDeviceSummary | undefined {
  if (!row.did) return undefined
  const summary: IotDeviceSummary = {
    did: String(row.did),
    name: String(row.name ?? row.did),
    model: String(row.model ?? ''),
    online: row.online === true,
  }
  if (row.home_name) summary.homeName = String(row.home_name)
  if (row.room_name) summary.roomName = String(row.room_name)
  return summary
}

/** The "prop-urn" a cloud device carries differs by firmware; model is authoritative for MIoT. */
function specUrnOf(device: IotDeviceSummary): string {
  if (isSpecUrn(device.model)) return device.model
  throw new IotUserError(
    `Device "${device.name}" (model ${device.model || 'unknown'}) is not a MIoT-spec urn device. `
    + 'Legacy miio-only models are not supported yet; check the Mi Home app to confirm the model string.',
  )
}

/** Xiaomi cloud implementation of the brand provider seam. */
export class XiaomiBrandProvider implements IotBrandProvider {
  readonly brand = 'xiaomi'
  private readonly cloud: MiotCloud
  private readonly specTimeoutMs: number
  private deviceCache: IotDeviceSummary[] | undefined

  constructor(config: XiaomiCloudConfig) {
    this.cloud = new MiotCloud(config)
    this.specTimeoutMs = config.httpTimeoutSec * 1000
  }

  async listDevices(): Promise<IotDeviceSummary[]> {
    const rows = await this.cloud.getDevices()
    const devices = rows
      .map(row => toDeviceSummary(row as CloudDeviceRow))
      .filter((d): d is IotDeviceSummary => d !== undefined)
    this.deviceCache = devices
    return devices
  }

  private async requireDevice(did: string): Promise<IotDeviceSummary> {
    if (!this.deviceCache) await this.listDevices()
    const device = this.deviceCache?.find(d => d.did === did)
    if (!device) {
      throw new IotUserError(`Unknown device did "${did}". Run iot_list_devices and use one of its did values.`)
    }
    return device
  }

  async getSpec(device: IotDeviceSummary): Promise<IotSpecSummary> {
    return await getSpecSummary(specUrnOf(device), this.specTimeoutMs)
  }

  /** Spec summary addressed by did (lists devices first when the cache is cold). */
  async getSpecForDid(did: string): Promise<IotSpecSummary> {
    return await this.getSpec(await this.requireDevice(did))
  }

  async getProps(did: string, refs: IotPropertyRef[]): Promise<IotCallResult> {
    if (refs.length === 0) {
      const spec = await this.getSpecForDid(did)
      refs = readableProps(spec).slice(0, 60)
    }
    const payload = refs.map(ref => ({ did, siid: ref.siid, piid: ref.piid }))
    const rows = await this.cloud.getProps(payload)
    let names = new Map<string, string>()
    try {
      names = propertyNames(await this.getSpecForDid(did))
    } catch (error) {
      // Naming values is best-effort: the read already succeeded, so a spec-download
      // failure must not turn the whole result into an error.
      void error
    }
    const results = rows.map(row => {
      const siid = Number(row['siid'])
      const piid = Number(row['piid'])
      const value: Record<string, unknown> = { siid, piid, value: row['value'], code: row['code'] }
      const name = names.get(`${siid}.${piid}`)
      if (name) value['name'] = name
      return value
    })
    return { ok: true, results }
  }

  async setProp(did: string, siid: number, piid: number, value: unknown): Promise<IotCallResult> {
    const rows = await this.cloud.setProp(did, siid, piid, value)
    return envelopeFrom(rows)
  }

  async callAction(did: string, siid: number, aiid: number, inArgs: unknown[]): Promise<IotCallResult> {
    const rows = await this.cloud.doAction(did, siid, aiid, inArgs)
    return envelopeFrom(rows)
  }
}

/** Turn per-item miotspec rows into the shared ok/error envelope (code != 0 is a failure). */
function envelopeFrom(rows: Record<string, unknown>[]): IotCallResult {
  const failed = rows.filter(row => Number(row['code'] ?? 0) !== 0)
  if (failed.length > 0) {
    return { ok: false, results: rows, error: `Device rejected the request: ${JSON.stringify(failed)}` }
  }
  return { ok: true, results: rows }
}

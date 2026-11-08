/**
 * Brand-provider seam for dsh-iot-studio. Every IoT brand adapter (xiaomi today; tuya, apple
 * home, and others later) implements IotBrandProvider, and the registered tools only see this
 * interface plus the neutral DTOs below, so a new brand never changes tool signatures.
 * @module dsh-iot-studio/brands/types
 */

/** Neutral device record returned by every brand's device listing. */
export interface IotDeviceSummary {
  /** Brand-scoped device id used by all subsequent calls. */
  did: string
  /** User-facing device name as set in the brand app. */
  name: string
  /** Model identifier; for MIoT devices a "urn:miot-spec-v2:..." string when the cloud reports one. */
  model: string
  /** Whether the cloud currently sees the device as reachable. */
  online: boolean
  /** Home and room names when the brand organizes devices spatially. */
  homeName?: string
  roomName?: string
}

/** One MIoT-style property reference inside a device. */
export interface IotPropertyRef {
  /** Service instance id. */
  siid: number
  /** Property instance id. */
  piid: number
}

/** One resolved property read result with friendly naming attached by the provider. */
export interface IotPropertyValue extends IotPropertyRef {
  name?: string
  value?: unknown
  /** Brand code; 0 means success on the MIoT control API. */
  code?: number
  /** Raw MIoT status code such as "0" or "-4003" when the provider reports one. */
  aiidCode?: string
}

/** Summary of one spec property, trimmed to what the model needs to act safely. */
export interface IotSpecProperty {
  piid: number
  name: string
  /** Access flags: read, write, subscribe. */
  access: string[]
  /** Scalar format such as bool, float, int, string, value. */
  format: string
  /** MIoT unit identifier such as percentage or celsius when the spec declares one. */
  unit?: string
  /** [min, max, step] when the spec declares a numeric range. */
  valueRange?: [number, number, number]
  /** Allowed string/enum values when the spec declares them. */
  valueList?: unknown[]
  description?: string
}

/** Summary of one spec action. */
export interface IotSpecAction {
  aiid: number
  name: string
  /** piids of the in arguments, in call order. */
  in: number[]
  /** piids returned by the action. */
  out: number[]
  description?: string
}

/** Summary of one spec service. */
export interface IotSpecService {
  siid: number
  name: string
  type: string
  properties: IotSpecProperty[]
  actions: IotSpecAction[]
  description?: string
}

/** Parsed device specification: enough to pick siid/piid/aiid without reading raw JSON. */
export interface IotSpecSummary {
  model: string
  description?: string
  services: IotSpecService[]
}

/** Result envelope shared by mutating calls so tools can render uniformly. */
export interface IotCallResult {
  ok: boolean
  /** Per-item results (properties or action output) when the brand returns a list. */
  results?: unknown[]
  /** Human-readable failure reason when ok is false. */
  error?: string
}

/**
 * One brand's cloud surface expressed as device discovery plus MIoT-style property/action
 * control. Providers own their credential lifecycle; tools call methods and surface errors.
 */
export interface IotBrandProvider {
  /** Registry key, e.g. "xiaomi". */
  readonly brand: string
  /** All devices visible to the configured account. */
  listDevices(): Promise<IotDeviceSummary[]>
  /** Specification summary for a device (looked up from its model urn). */
  getSpec(device: IotDeviceSummary): Promise<IotSpecSummary>
  /** Current values of the requested properties. */
  getProps(did: string, refs: IotPropertyRef[]): Promise<IotCallResult>
  /** Write one property value. */
  setProp(did: string, siid: number, piid: number, value: unknown): Promise<IotCallResult>
  /** Invoke one action with positional in-arguments. */
  callAction(did: string, siid: number, aiid: number, inArgs: unknown[]): Promise<IotCallResult>
}

/** Error carrying a user-actionable message; tool execute maps it into the result envelope. */
export class IotUserError extends Error {}

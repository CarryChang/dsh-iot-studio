/**
 * dsh-iot-studio Cordis plugin entry. Registers the IoT-control methodology skill and five
 * brand-agnostic iot_* tools routed through the brand registry (xiaomi today). Cloud access is
 * scoped to the configured Xiaomi account; tokens are cached under stateDir and never returned
 * in tool output.
 * @module dsh-iot-studio
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
// Type-only: pulls the ctx.skills and ctx.tools service declarations into the Context graph.
import type {} from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-tools'
import { SKILL_NAME, SKILL_DESCRIPTION, SKILL_WHEN_TO_USE, SKILL_BODY } from './skill.ts'
import { getProvider, supportedBrands, type IotStudioSettings } from './brands/registry.ts'
import { IotUserError, type IotCallResult } from './brands/types.ts'

export const name = 'iot-studio'
export const inject = ['skills', 'tools']

/** Per-brand Xiaomi account settings; empty strings mean "read the environment instead". */
export interface XiaomiConfig {
  username: string
  password: string
  serverCountry: string
  stateDir: string
  httpTimeoutSec: number
}

/** Deployment configuration for the plugin. */
export interface Config {
  /** Brand used when a call omits "brand". */
  defaultBrand: string
  xiaomi: XiaomiConfig
}

export const Config: z<Config> = z.object({
  defaultBrand: z.string().default('xiaomi'),
  xiaomi: z.object({
    username: z.string().default(''),
    password: z.string().default(''),
    serverCountry: z.string().default('cn'),
    stateDir: z.string().default(''),
    httpTimeoutSec: z.number().default(15),
  }),
})

const BRAND_DESCRIPTION = `IoT brand key; defaults to the configured default brand. Currently supported: xiaomi.`

function settings(config: Config): IotStudioSettings {
  return { defaultBrand: config.defaultBrand, xiaomi: { ...config.xiaomi } }
}

/** Wrap a provider call so typed user errors become ok:false results instead of crashes. */
async function guarded(run: () => Promise<IotCallResult | { ok: true; [key: string]: unknown }>): Promise<string> {
  try {
    return JSON.stringify(await run())
  } catch (error) {
    const message = error instanceof IotUserError || error instanceof Error ? error.message : String(error)
    return JSON.stringify({ ok: false, error: message })
  }
}

const jsonRender = (_args: unknown, value: string) => [
  { type: 'text' as const, text: JSON.stringify(JSON.parse(value), null, 2) },
]

/**
 * Register the methodology skill and the five brand-routed IoT tools.
 * @param ctx - registrant context carrying the skill and tool registries.
 * @param config - deployment account and brand settings.
 * @returns when the plugin is ready.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const resolved = settings(config)

  ctx.effect(() => ctx.skills.register({
    name: SKILL_NAME,
    description: SKILL_DESCRIPTION,
    whenToUse: SKILL_WHEN_TO_USE,
    content: SKILL_BODY,
    source: 'bundled',
    invocation: { modelInvocable: true, userInvocable: true },
  }))

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'iot_list_devices',
    description:
      `List every IoT device visible to the configured cloud account: did, name, model urn, online flag, home and room. `
      + BRAND_DESCRIPTION + ' Run this first in any IoT task; every other tool needs a did from here.',
    parameters: {
      brand: { type: 'string', description: BRAND_DESCRIPTION },
    },
    output: { schema: { type: 'string' }, render: jsonRender },
    execute(args) {
      return guarded(async () => {
        const provider = getProvider(args.brand ?? resolved.defaultBrand, resolved)
        const devices = await provider.listDevices()
        return { ok: true, brand: provider.brand, count: devices.length, devices }
      })
    },
    presentCall: args => ({
      card: 'generic',
      title: `List IoT devices (${args.brand ?? resolved.defaultBrand})`,
      kind: 'fetch',
      rawInput: { brand: args.brand ?? resolved.defaultBrand },
    }),
  })))

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'iot_get_spec',
    description:
      'Fetch and summarize the MIoT specification for one device did: services with friendly '
      + 'names, each property (piid, access, format, value-range, value-list) and each action '
      + '(aiid, in/out piids). Read this before any iot_set_prop / iot_call_action so ids and '
      + 'allowed values come from the spec, not guesses.',
    parameters: {
      did: { type: 'string', required: true, description: 'Device id from iot_list_devices.' },
      brand: { type: 'string', description: BRAND_DESCRIPTION },
    },
    output: { schema: { type: 'string' }, render: jsonRender },
    execute(args) {
      return guarded(async () => {
        const provider = getProvider(args.brand ?? resolved.defaultBrand, resolved)
        const devices = await provider.listDevices()
        const device = devices.find(d => d.did === args.did)
        if (!device) {
          throw new IotUserError(`Unknown did "${args.did}". Supported brands: ${supportedBrands().join(', ')}. Run iot_list_devices first.`)
        }
        const spec = await provider.getSpec(device)
        return { ok: true, device, spec }
      })
    },
    presentCall: args => ({
      card: 'generic',
      title: `Read MIoT spec for ${args.did}`,
      kind: 'fetch',
      rawInput: { did: args.did, brand: args.brand ?? resolved.defaultBrand },
    }),
  })))

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'iot_get_props',
    description:
      'Read current property values of one device. Pass props as [{siid, piid}] from the spec; '
      + 'omit props for a whole-device snapshot of up to 60 readable properties. Values are '
      + 'annotated with spec names. Read-only and safe to call at any time.',
    parameters: {
      did: { type: 'string', required: true, description: 'Device id from iot_list_devices.' },
      props: {
        type: 'array',
        description: 'Property references [{siid, piid}]; empty means all readable properties from the spec.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            siid: { type: 'integer', required: true, description: 'Service instance id from the spec.' },
            piid: { type: 'integer', required: true, description: 'Property instance id from the spec.' },
          },
        },
      },
      brand: { type: 'string', description: BRAND_DESCRIPTION },
    },
    output: { schema: { type: 'string' }, render: jsonRender },
    execute(args) {
      return guarded(async () => {
        const provider = getProvider(args.brand ?? resolved.defaultBrand, resolved)
        return await provider.getProps(args.did, args.props ?? [])
      })
    },
    presentCall: args => ({
      card: 'generic',
      title: `Read properties of ${args.did}`,
      kind: 'fetch',
      rawInput: { did: args.did, props: args.props?.length ?? 'all-readable' },
    }),
  })))

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'iot_set_prop',
    description:
      'Write one device property (power, brightness, target temperature, mode...). value is any '
      + 'JSON type matching the spec format: bool for boolean properties, a number inside '
      + 'value-range, or a value-list member. The tool returns the device per-item code; 0 means '
      + 'the device accepted the write. Confirm risky devices with the user before calling.',
    parameters: {
      did: { type: 'string', required: true, description: 'Device id from iot_list_devices.' },
      siid: { type: 'integer', required: true, description: 'Service instance id from the spec.' },
      piid: { type: 'integer', required: true, description: 'Writable property instance id from the spec.' },
      value: { type: 'json', required: true, description: 'New value: true/false, a number, or a string, per the spec format.' },
      brand: { type: 'string', description: BRAND_DESCRIPTION },
    },
    output: { schema: { type: 'string' }, render: jsonRender },
    execute(args) {
      return guarded(async () => {
        const provider = getProvider(args.brand ?? resolved.defaultBrand, resolved)
        return await provider.setProp(args.did, args.siid, args.piid, args.value)
      })
    },
    presentCall: args => ({
      card: 'generic',
      title: `Set ${args.siid}.${args.piid} on ${args.did}`,
      kind: 'execute',
      rawInput: { did: args.did, siid: args.siid, piid: args.piid, value: args.value },
    }),
  })))

  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'iot_call_action',
    description:
      'Invoke one device action (start cleaning, set mode, siren...). inArgs must follow the '
      + 'action\'s in-piid order from iot_get_spec exactly; omit inArgs when the action declares '
      + 'none. Returns the action out values when the device reports success.',
    parameters: {
      did: { type: 'string', required: true, description: 'Device id from iot_list_devices.' },
      siid: { type: 'integer', required: true, description: 'Service instance id from the spec.' },
      aiid: { type: 'integer', required: true, description: 'Action instance id from the spec.' },
      inArgs: {
        type: 'array',
        description: 'Positional in-arguments in the order of the action in-piid list.',
        items: { type: 'json' },
      },
      brand: { type: 'string', description: BRAND_DESCRIPTION },
    },
    output: { schema: { type: 'string' }, render: jsonRender },
    execute(args) {
      return guarded(async () => {
        const provider = getProvider(args.brand ?? resolved.defaultBrand, resolved)
        return await provider.callAction(args.did, args.siid, args.aiid, args.inArgs ?? [])
      })
    },
    presentCall: args => ({
      card: 'generic',
      title: `Run action ${args.siid}.${args.aiid} on ${args.did}`,
      kind: 'execute',
      rawInput: { did: args.did, siid: args.siid, aiid: args.aiid, args: args.inArgs?.length ?? 0 },
    }),
  })))
}

/**
 * Brand registry: maps brand keys to provider factories fed by resolved settings. Adding a
 * brand (tuya, apple home, ...) means one new provider file plus one register() row; tool
 * signatures and the skill never change.
 * @module dsh-iot-studio/brands/registry
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import type { IotBrandProvider } from './types.ts'
import { IotUserError } from './types.ts'
import type { XiaomiCloudConfig } from './xiaomi/cloud.ts'
import { XiaomiBrandProvider } from './xiaomi/provider.ts'

/** Whole-plugin settings as declared by Config in the entry module. */
export interface IotStudioSettings {
  defaultBrand: string
  xiaomi: {
    username: string
    password: string
    serverCountry: string
    stateDir: string
    httpTimeoutSec: number
  }
}

type ProviderFactory = (settings: IotStudioSettings) => IotBrandProvider

const providers = new Map<string, ProviderFactory>()
const instances = new Map<string, IotBrandProvider>()

function register(brand: string, factory: ProviderFactory): void {
  providers.set(brand, factory)
}

register('xiaomi', settings => {
  const xiaomi = settings.xiaomi
  const username = xiaomi.username || process.env['XIAOMI_USERNAME'] || process.env['XIAOMI_USER'] || ''
  const password = xiaomi.password || process.env['XIAOMI_PASSWORD'] || ''
  if (!username) {
    throw new IotUserError(
      'Xiaomi account is not configured. Set xiaomi.username (or XIAOMI_USERNAME) in the plugin config.',
    )
  }
  const cloudConfig: XiaomiCloudConfig = {
    username,
    password,
    serverCountry: xiaomi.serverCountry || 'cn',
    stateDir: xiaomi.stateDir || join(homedir(), '.dsh-iot-studio'),
    httpTimeoutSec: xiaomi.httpTimeoutSec > 0 ? xiaomi.httpTimeoutSec : 15,
  }
  return new XiaomiBrandProvider(cloudConfig)
})

/** Supported brand keys in registration order, for error messages and the tool enum. */
export function supportedBrands(): string[] {
  return [...providers.keys()]
}

/**
 * Lazily build and memoize the provider for one brand key.
 * @param brand - registry key such as "xiaomi".
 * @param settings - resolved plugin settings.
 * @returns the shared provider instance for that brand.
 * @throws IotUserError listing the supported brands when the key is unknown.
 */
export function getProvider(brand: string, settings: IotStudioSettings): IotBrandProvider {
  const existing = instances.get(brand)
  if (existing) return existing
  const factory = providers.get(brand)
  if (!factory) {
    throw new IotUserError(
      `IoT brand "${brand}" is not supported yet. Supported brands: ${supportedBrands().join(', ')}.`,
    )
  }
  const provider = factory(settings)
  instances.set(brand, provider)
  return provider
}

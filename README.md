# dsh-iot-studio

English | [简体中文](README.zh-CN.md)

IoT studio plugin for [DeepSeek Harness](https://github.com/deepseek-ai): let the agent discover, inspect, and control your smart-home devices through typed tools. Xiaomi / Mijia lands first; more IoT brands attach behind the same provider seam.

> **Open-source attribution.** The Xiaomi cloud protocol implementation in this
> plugin (login, RC4/SHA1 request signing, device listing, MIoT spec lookup) is
> adapted for TypeScript from [hass-xiaomi-miot](https://github.com/al-one/hass-xiaomi-miot)
> by **al-one**, licensed under **Apache License 2.0** — the same license as
> this repository. See [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
> for the file-by-file provenance and changes. This plugin is an independent
> derivative work and is not affiliated with, endorsed by, or sponsored by
> Xiaomi Inc. or the Home Assistant project.

## What it gives the agent

| Tool | Purpose |
|---|---|
| `iot_list_devices` | All devices on the account: did, name, model urn, online, home/room |
| `iot_get_spec` | Friendly MIoT spec of one device: services, properties (access/format/range/enum), actions (in/out) |
| `iot_get_props` | Read specific properties, or a whole-device snapshot (≤ 60 readable props) |
| `iot_set_prop` | Write one property: power, brightness, target temperature, mode… |
| `iot_call_action` | Run one action with positional in-arguments |

Plus a bundled skill (`iot-studio`) that teaches the agent the safe loop:
list → spec → read → act → verify, with explicit confirmation before touching
locks, cameras, power strips, heaters, and vacuums.

## Install

```sh
dsh plugin --profile web add https://github.com/CarryChang/dsh-iot-studio
```

## Configure credentials

Option A — environment (recommended, keeps secrets out of files):

```
XIAOMI_USERNAME=<phone/email/user id>
XIAOMI_PASSWORD=<password>
```

Option B — the plugin config block in your profile's `cordis.yml`:

```yaml
- id: iot-studio
  name: dsh-iot-studio
  config:
    defaultBrand: xiaomi
    xiaomi:
      username: 'you@example.com'
      password: '...'          # or leave empty and use XIAOMI_PASSWORD
      serverCountry: cn        # cn, de, ru, ...
      stateDir: ''             # token cache dir; default ~/.dsh-iot-studio
      httpTimeoutSec: 15
```

On first use the plugin logs in and caches the service token under
`stateDir` (`0600` permissions, never committed, never printed). With only a
valid cache and no password it keeps working until the token expires.

## Try it

```
> 帮我看下家里现在有哪些米家设备在线？
> 把卧室台灯调到 40% 亮度
> 扫地机开始清扫客厅
```

## Architecture (for brand contributors)

```
src/
  index.ts               plugin entry: Config + skill + 5 tools
  skill.ts               embedded IoT-control methodology
  brands/
    types.ts             IotBrandProvider seam (brand-neutral DTOs)
    registry.ts          brand key -> provider factory
    xiaomi/
      crypto.ts          RC4-skip-1024, nonce, HMAC-SHA1, SHA1 sign
      cloud.ts           login step1/2/3, signed api.io.mi.com requests
      spec.ts            miot-spec.org instance fetch + summary
      provider.ts        IotBrandProvider implementation
```

A new brand is one folder under `src/brands/<name>/` plus one `register()` line;
tool signatures, config shape, and the skill contract stay identical. The tools
only ever see the `IotBrandProvider` interface.

## Limitations (v0.1)

- Captcha / SMS / email verification during login is not interactive: the tool
  returns an actionable message asking you to sign in once at
  account.xiaomi.com or in the Mi Home app.
- Legacy miio-only devices (model is not a `urn:miot-spec-v2:...`) are not
  supported; MIoT-spec devices only.
- Cloud control only; no LAN/local token path yet.
- Mainland China and overseas server sites are supported via `serverCountry`.

## Development

```sh
pnpm install     # needs access to the @deepseek-ai registry packages
pnpm run build   # tsc -> lib/
pnpm run check   # build + offline deterministic smoke
```

## License

Apache License 2.0 (same as the upstream [hass-xiaomi-miot](https://github.com/al-one/hass-xiaomi-miot)).
Third-party notices: [NOTICE](NOTICE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

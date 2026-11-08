# Third-Party Notices

dsh-iot-studio is a derivative work. This file lists every upstream project whose
authorship matters, per Apache License 2.0 section 4.

## hass-xiaomi-miot

- Project: <https://github.com/al-one/hass-xiaomi-miot>
- Author: al-one
- License: Apache License 2.0
- Copyright: (c) al-one
- Version referenced: 1.1.5

Adapted for TypeScript from Python sources under
`custom_components/xiaomi_miot/core/`:

| This plugin | Upstream source | Changes made |
|---|---|---|
| `src/brands/xiaomi/crypto.ts` | `core/utils.py` (class `RC4`), `micloud` library `miutils` (`gen_nonce`, `signed_nonce`) | Rewritten on `node:crypto`; the 1024-byte RC4 keystream skip of `init1024()` is preserved; no protocol-format changes. |
| `src/brands/xiaomi/cloud.ts` | `core/xiaomi_cloud.py` (`MiotCloud`) | Rewritten on global `fetch` with a manual cookie jar; login step1/2/3, RC4-signed `api.io.mi.com` requests, `home/device_list`, `v2/homeroom/gethome_merged` and `miotspec/prop/get|set|action` semantics preserved; captcha and SMS/email verification challenges now raise an actionable error instead of an interactive flow; Home Assistant state, notifications, and retry decorators removed; token cache is a plain JSON file instead of HA `Store`. |
| `src/brands/xiaomi/spec.ts` | `core/miot_spec.py` (spec hosts, instance download) | Trimmed to instance summary only (services/properties/actions); translations, property mapping and HA entity logic not ported; hosts `miot-spec.org` (primary) and `spec.miot-spec.com` (fallback) kept as in upstream. |

## micloud (Python package)

- Project: <https://pypi.org/project/micloud/>
- Role: dependency of hass-xiaomi-miot whose `miutils` defines the nonce and
  signature wire format that `crypto.ts` reimplements. No code is copied from it;
  the algorithm semantics were followed through the upstream calls in
  `xiaomi_cloud.py`.

## Xiaomi MIoT-Spec standard

- Specification: <https://iot.mi.com/new/doc/design/spec/overall>
- Runtime data mirrors: <https://miot-spec.org>, <https://spec.miot-spec.com>

The plugin downloads device specification JSON from the community mirrors at
runtime and bundles no specification data.

## DeepSeek Harness / Cordis

`@deepseek-ai/cordis`, `@deepseek-ai/schemastery`, `@deepseek-ai/dsh-tools`, and
`@deepseek-ai/dsh-skill` are peer/dev dependencies used as public APIs. They are
not vendored in this repository.

## dsh-genui

- Project: <https://github.com/omdsh-dev/dsh-genui>

Used as a reference for DSH bundle packaging conventions (`dsh.bundle` manifest,
`cordis.patch.yml`, skill + tool registration layout). No code was copied.

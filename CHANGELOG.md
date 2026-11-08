# Changelog

All notable changes to dsh-iot-studio are documented here.

## 0.1.0 — 2026-11-08

First release. Converts the Xiaomi cloud capability of the open-source
[hass-xiaomi-miot](https://github.com/al-one/hass-xiaomi-miot) (al-one,
Apache-2.0) into a DeepSeek Harness plugin.

- Xiaomi cloud client ported to TypeScript: password login (serviceLogin /
  serviceLoginAuth2 / serviceToken), RC4 + HMAC-SHA1 signed `api.io.mi.com`
  requests, expired-token re-login with a single retry, and a 0600-permission
  service-token cache under `stateDir`.
- MIoT spec lookup with friendly summaries (services, properties with
  access/format/value-range/value-list, actions with in/out piids), dual
  mirrors `miot-spec.org` / `spec.miot-spec.com`, in-process cache.
- Brand-provider seam (`IotBrandProvider` + registry): xiaomi registered
  first; future brands (tuya, apple home, ...) attach without changing tool
  signatures.
- Five tools registered: `iot_list_devices`, `iot_get_spec`, `iot_get_props`,
  `iot_set_prop`, `iot_call_action`; every mutating call returns an
  ok/error envelope with the device's per-item miotspec codes.
- Bundled `iot-studio` skill: list → spec → read → act → verify loop, value
  discipline against the spec, explicit safety confirmation for risky device
  classes, and actionable auth-failure guidance.
- Offline deterministic smoke (crypto wire format, spec summarization from a
  recorded fixture, device-row mapping, registry errors) runs without network
  or credentials.
- License: Apache-2.0, matching the upstream; NOTICE and
  THIRD_PARTY_NOTICES.md record file-by-file provenance and changes.

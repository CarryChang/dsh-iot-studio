---
name: iot-studio
description: Control smart-home devices from the agent through a generic IoT layer: discover devices, read their specification, then read state and change properties or run actions. Brands attach as providers; xiaomi / mijia ships built-in.
---

# IoT Studio: device-control methodology

You operate real physical devices through brand cloud accounts via one generic tool layer. Precision and confirmation beat cleverness. Built-in brand today: xiaomi / mijia; every other provider that registers behind the same seam behaves identically.

## New devices need no setup

A freshly paired device appears in the device list as soon as the brand app or cloud knows it. Never ask the user to "register" a device into this plugin; re-run the list instead.

## Fixed call order

1. `iot_list_devices` once per session to obtain did, name, model, online. Quote the human name back before acting ("即将操作：卧室的米家台灯").
2. `iot_get_spec` for the target did. Never guess siid/piid/aiid; read them from the spec services. Pick the service by type name (light, switch, fan, humidifier, vacuum, climate...).
3. Read before write: `iot_get_props` without props returns up to 60 readable values for a whole-device status snapshot.
4. Act with the narrowest tool: `iot_set_prop` for a single value (power on/off, brightness, target temperature), `iot_call_action` for behaviors (start-clean, set-mode). `in` arguments follow the action's `in` piid list from the spec, in order.
5. Verify: re-read the specific property after every write and report the confirmed value.

## Value discipline

- bool properties take true/false; numeric writes MUST stay inside value-range [min,max] and honor step; enum writes use a value-list entry's number or string exactly as the spec declares.
- A set with an out-of-range value is your bug: re-read the spec, fix the argument, retry at most once.
- miotspec per-item code 0 is success; -4003 (property not writeable) and -4004 (out of range) mean the plan is wrong, not the network.

## Safety confirmations

Ask the user once, explicitly, before operating: door locks, gates, cameras, anything that cuts power (sockets on high-load appliances), gas/water heaters, and robot vacuums that leave their dock unattended. Reading state never needs confirmation.

## Failure handling

- Token expired / auth errors: the tool message says what to renew (XIAOMI_PASSWORD or the token cache). Report it verbatim to the user; do not retry in a loop.
- Captcha / device-verification challenges: tell the user to sign in once at account.xiaomi.com or in the Mi Home app, then retry.
- "not a MIoT-spec urn device": legacy miio model, unsupported in v0.x; say so plainly.
- Offline device: stop and tell the user which device is offline instead of writing blindly.

## Session etiquette

- Cache the device list mentally: map the user's room/nickname to one did; if two devices share a name, ask which one.
- Batch reads: one `iot_get_props` for all needed properties, not one call per property.
- Never print passwords, service tokens, or the auth cache file contents in replies.
- Multi-brand: every tool takes `brand`; the registry lists what is loaded. New brands keep identical semantics, so this workflow transfers unchanged.

## Provenance

The built-in xiaomi provider's cloud protocol layer is adapted from the open-source
[hass-xiaomi-miot](https://github.com/al-one/hass-xiaomi-miot) project (Apache-2.0).
See NOTICE and THIRD_PARTY_NOTICES.md in the repository root.

/**
 * Embedded IoT-control methodology skill. The body must stay free of raw backticks: it is a
 * template literal, and inline code uses 「」 instead (a backtick truncates it with a boot-time
 * SyntaxError that tsc cannot catch).
 * @module dsh-iot-studio/skill
 */

export const SKILL_NAME = 'iot-studio'
export const SKILL_DESCRIPTION = 'Control Xiaomi / Mijia smart-home devices from the agent: discover devices, read their MIoT spec, then read state and change properties or run actions.'
export const SKILL_WHEN_TO_USE = 'The user asks about smart-home devices: 米家 / Xiaomi device status, turning things on or off, adjusting values, scenes backed by devices, or IoT automation questions.'

export const SKILL_BODY = `# IoT Studio: device-control methodology

You operate real physical devices through the Xiaomi cloud. Precision and confirmation beat cleverness.

## Fixed call order

1. 「iot_list_devices」 once per session to obtain did, name, model, online. Quote the human name back before acting ("即将操作：卧室的米家台灯").
2. 「iot_get_spec」 for the target did. Never guess siid/piid/aiid; read them from the spec services. Pick the service by type name (light, switch, fan, humidifier, vacuum, climate...).
3. Read before write: 「iot_get_props」 without props returns up to 60 readable values for a whole-device status snapshot.
4. Act with the narrowest tool: 「iot_set_prop」 for a single value (power on/off, brightness, target temperature), 「iot_call_action」 for behaviors (start-clean, set-mode). 「in」 arguments follow the action's 「in」 piid list from the spec, in order.
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
- Batch reads: one 「iot_get_props」 for all needed properties, not one call per property.
- Never print passwords, service tokens, or the auth cache file contents in replies.
- Multi-brand: every tool takes 「brand」; it is "xiaomi" today. Future providers keep identical semantics.
`

/**
 * Deterministic offline smoke: crypto wire format against the Python reference values, spec
 * summarization from a recorded miot-spec fixture shape, device-row mapping, and registry
 * failure messages. No network, no credentials.
 */
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { decryptData, encryptData, genNonce, md5Upper, randomString, sha1Sign, signedNonce } from '../src/brands/xiaomi/crypto.ts'
import { readableProps, summarizeInstance, propertyNames, isSpecUrn } from '../src/brands/xiaomi/spec.ts'
import { toDeviceSummary } from '../src/brands/xiaomi/provider.ts'
import { getProvider, supportedBrands } from '../src/brands/registry.ts'
import { SKILL_BODY } from '../src/skill.ts'

// --- crypto ------------------------------------------------------------------
assert.equal(md5Upper('password'), '5F4DCC3B5AA765D61D8327DEB882CF99')

const key = Buffer.from('0123456789ABCDEF0123456789ABCDEF', 'base64')
const plain = JSON.stringify({ params: [{ did: '3182141', siid: 2, piid: 1, value: true }] })
assert.equal(decryptData(key.toString('base64'), encryptData(key.toString('base64'), plain)), plain, 'rc4 roundtrip')

const fixedNonce = Buffer.from('AB12CD34').toString('base64')
const expectedSigned = createHmac('sha1', key).update(Buffer.from(fixedNonce, 'base64')).digest('base64')
assert.equal(signedNonce(key.toString('base64'), fixedNonce), expectedSigned, 'signedNonce = b64(HMAC-SHA1(b64d(sk), b64d(nonce)))')

const nonce = genNonce()
const nonceChars = Buffer.from(nonce, 'base64').toString('utf8')
assert.equal(nonceChars.length, 8)
assert.match(nonceChars, /^[A-Z0-9]+$/)
assert.match(randomString(16), /^[A-Z0-9]{16}$/)

// sha1Sign must drop the /app prefix and join method&path&k=v...&signedNonce.
const url = 'https://api.io.mi.com/app/miotspec/prop/get'
const params = { data: '{}', rc4_hash__: 'x' }
const expectedSign = createHash('sha1')
  .update(['POST', '/miotspec/prop/get', 'data={}', 'rc4_hash__=x', expectedSigned].join('&'), 'utf8')
  .digest('base64')
assert.equal(sha1Sign('post', url, params, expectedSigned), expectedSign, 'sha1Sign wire format')

// --- spec summarization (recorded instance shape) ----------------------------
const fixtureLight = {
  description: 'MIoT spec of a desk lamp',
  services: [
    {
      iid: 2,
      type: 'urn:miot-spec-v2:service:light:00007899:placeholder:1',
      description: 'Light',
      properties: [
        { piid: 1, description: 'Power', access: ['read', 'write', 'change'], format: 'bool' },
        { piid: 2, description: 'Brightness', access: ['read', 'write', 'subscribe'], format: 'int', 'value-range': [1, 100, 1], unit: 'percentage' },
        { piid: 3, description: 'Mode', access: ['read', 'write'], format: 'string', 'value-list': [{ value: 'day', description: 'Day' }, { value: 'night', description: 'Night' }] },
      ],
      actions: [
        { aiid: 1, description: 'Toggle', in: [], out: [] },
        { aiid: 2, description: 'Set scene', in: [4], out: [] },
      ],
    },
    {
      iid: 1,
      type: 'urn:miot-spec-v2:service:device-information:00000001:placeholder:1',
      description: 'Device Information',
      properties: [
        { piid: 1, description: 'Manufacturer', access: ['read'], format: 'string' },
        { piid: 2, description: 'Model', access: ['read'], format: 'string' },
      ],
    },
  ],
}
assert.ok(isSpecUrn('urn:miot-spec-v2:device:light:0000A001:placeholder:1'))
const spec = summarizeInstance(fixtureLight)
assert.equal(spec.services.length, 2)
const light = spec.services.find(s => s.siid === 2)
assert.ok(light, 'light service kept')
assert.equal(light.name, 'Light')
assert.deepEqual(light.properties.find(p => p.piid === 2)?.valueRange, [1, 100, 1])
assert.equal(light.actions[1]?.name, 'Set scene')
const readable = readableProps(spec)
assert.equal(readable.length, 5, 'all fixture props are read-accessible')
assert.equal(propertyNames(spec).get('2.2'), 'Brightness')

// --- device row mapping ------------------------------------------------------
const row = { did: '911562472', name: '卧室台灯', model: 'urn:miot-spec-v2:device:light:0000A001:yeelink:1', online: true, home_name: '家', room_name: '卧室' }
const mapped = toDeviceSummary(row)
assert.deepEqual(mapped, { did: '911562472', name: '卧室台灯', model: row.model, online: true, homeName: '家', roomName: '卧室' })
assert.equal(toDeviceSummary({ name: 'no did' }), undefined)
assert.equal(toDeviceSummary({ did: '1', model: 'lock.basic' })?.online, false, 'missing online is false')

// --- registry ----------------------------------------------------------------
assert.deepEqual(supportedBrands(), ['xiaomi'])
assert.throws(
  () => getProvider('tuya', { defaultBrand: 'xiaomi', xiaomi: { username: 'u', password: 'p', serverCountry: 'cn', stateDir: '', httpTimeoutSec: 15 } }),
  /IoT brand "tuya" is not supported yet\. Supported brands: xiaomi\./,
)
delete process.env['XIAOMI_USERNAME']
delete process.env['XIAOMI_USER']
assert.throws(
  () => getProvider('xiaomi', { defaultBrand: 'xiaomi', xiaomi: { username: '', password: '', serverCountry: 'cn', stateDir: '', httpTimeoutSec: 0 } }),
  /Xiaomi account is not configured/,
)

// --- skill body boot safety --------------------------------------------------
assert.ok(!SKILL_BODY.includes('`'), 'SKILL_BODY must not contain raw backticks')
for (const tool of ['iot_list_devices', 'iot_get_spec', 'iot_get_props', 'iot_set_prop', 'iot_call_action']) {
  assert.ok(SKILL_BODY.includes(tool), `skill body walks through ${tool}`)
}

console.log('smoke: all assertions passed')

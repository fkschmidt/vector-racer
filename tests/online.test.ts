import assert from 'node:assert/strict'
import test from 'node:test'
import { parseOnlineMessage } from '../src/online-connection.ts'
import { decodeSignal, encodeSignal, type OnlineSignal } from '../src/online-link.ts'

const sdp = [
  'v=0', 'o=- 4611731400430051336 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
  'a=candidate:1 1 udp 2113937151 192.168.1.20 51234 typ host', 'a=ice-ufrag:abcd', 'a=mid:0', '',
].join('\r\n')

test('an invite survives the trip through a link', async () => {
  const invite: OnlineSignal = { kind: 'join', id: 'k3x9', sdp }
  const fragment = await encodeSignal(invite)

  assert.match(fragment, /^join=[A-Za-z0-9_-]+$/)
  assert.deepEqual(await decodeSignal(`#${fragment}`), invite)
})

test('a reply is found in pasted text around the link', async () => {
  const reply: OnlineSignal = { kind: 'answer', id: 'k3x9', sdp }
  const pasted = `here you go: https://example.org/vector-racer/#${await encodeSignal(reply)}\n`

  assert.deepEqual(await decodeSignal(pasted), reply)
})

test('text that is not a valid link is rejected', async () => {
  const fragment = await encodeSignal({ kind: 'join', id: 'k3x9', sdp })

  assert.equal(await decodeSignal(''), null)
  assert.equal(await decodeSignal('#section'), null)
  assert.equal(await decodeSignal('#join=not-a-real-invite'), null)
  assert.equal(await decodeSignal(`#${fragment.slice(0, -6)}`), null)
})

test('messages from the other player are read only when well formed', () => {
  const move = { type: 'move', race: 1, turn: 4, point: { x: 12, y: -1 } }
  const newRace = { type: 'new-race', race: 2, trackId: 'monza' }

  assert.deepEqual(parseOnlineMessage(JSON.stringify(move)), move)
  assert.deepEqual(parseOnlineMessage(JSON.stringify(newRace)), newRace)
  assert.equal(parseOnlineMessage('not json'), null)
  assert.equal(parseOnlineMessage(new ArrayBuffer(4)), null)
  assert.equal(parseOnlineMessage(JSON.stringify({ ...move, turn: -1 })), null)
  assert.equal(parseOnlineMessage(JSON.stringify({ ...move, point: { x: 1.5, y: 2 } })), null)
  assert.equal(parseOnlineMessage(JSON.stringify({ ...move, type: 'teleport' })), null)
  assert.equal(parseOnlineMessage(JSON.stringify({ type: 'new-race', race: 2 })), null)
})

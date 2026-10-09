// Invite and reply links carry one browser's connection details in the part of the URL after "#".
// The players pass the links to each other, so no server is needed to introduce the two browsers.

export type OnlineSignal = {
  kind: 'join' | 'answer'
  // Names the invite, so a reply can be matched to the race it belongs to.
  id: string
  sdp: string
}

const SIGNAL_PATTERN = /(join|answer)=([A-Za-z0-9_-]+)/
const MAX_ENCODED_LENGTH = 8000

async function pipeBytes(bytes: Uint8Array<ArrayBuffer>, transform: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(transform)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

/** Returns the URL fragment for a signal, without the leading "#". */
export async function encodeSignal(signal: OnlineSignal): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify([signal.id, signal.sdp]))
  return `${signal.kind}=${toBase64Url(await pipeBytes(payload, new CompressionStream('deflate-raw')))}`
}

/** Reads a signal out of a URL fragment, a whole link, or text that contains one. */
export async function decodeSignal(text: string): Promise<OnlineSignal | null> {
  const match = SIGNAL_PATTERN.exec(text)
  if (!match || match[2].length > MAX_ENCODED_LENGTH) return null

  try {
    const payload = await pipeBytes(fromBase64Url(match[2]), new DecompressionStream('deflate-raw'))
    const fields: unknown = JSON.parse(new TextDecoder().decode(payload))
    if (!Array.isArray(fields) || fields.length !== 2) return null
    const [id, sdp] = fields
    if (typeof id !== 'string' || typeof sdp !== 'string' || !id || !sdp) return null
    return { kind: match[1] as OnlineSignal['kind'], id, sdp }
  } catch {
    return null
  }
}

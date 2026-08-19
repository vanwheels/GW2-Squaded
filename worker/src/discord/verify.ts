/** Verifies a Discord interaction webhook's Ed25519 signature, per Discord's own requirement
 *  ("every request will contain X-Signature-Ed25519 and X-Signature-Timestamp headers ... you
 *  must verify these").
 *  https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization
 *
 *  Uses the Workers runtime's native Web Crypto Ed25519 support (workerd added this in 2023) —
 *  no npm dependency (e.g. `discord-interactions`/tweetnacl) needed. */
export async function verifyDiscordRequest(
  body: string,
  signature: string | null,
  timestamp: string | null,
  publicKeyHex: string
): Promise<boolean> {
  if (!signature || !timestamp) return false

  let key: CryptoKey
  try {
    key = await crypto.subtle.importKey(
      'raw',
      hexToBytes(publicKeyHex),
      { name: 'Ed25519' },
      false,
      ['verify']
    )
  } catch {
    return false // malformed public key hex
  }

  const message = new TextEncoder().encode(timestamp + body)

  try {
    return await crypto.subtle.verify('Ed25519', key, hexToBytes(signature), message)
  } catch {
    return false // malformed signature hex (odd length, etc.)
  }
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('odd-length hex string')
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

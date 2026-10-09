import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, generateToken, hashToken, constantTimeEqual, isValidUsername, isValidPassword } from './crypto'

describe('hashPassword / verifyPassword', () => {
  it('verifies the correct password against its own hash', async () => {
    const stored = await hashPassword('correct horse battery staple')
    await expect(verifyPassword('correct horse battery staple', stored)).resolves.toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const stored = await hashPassword('correct horse battery staple')
    await expect(verifyPassword('wrong password', stored)).resolves.toBe(false)
  })

  it('salts each hash differently, even for the same password', async () => {
    const a = await hashPassword('same password')
    const b = await hashPassword('same password')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
  })
})

describe('generateToken / hashToken', () => {
  it('generates unique tokens', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toBe(b)
  })

  it('hashes the same token to the same digest', async () => {
    const token = generateToken()
    const first = await hashToken(token)
    const second = await hashToken(token)
    expect(first).toBe(second)
  })

  it('hashes different tokens to different digests', async () => {
    const a = await hashToken(generateToken())
    const b = await hashToken(generateToken())
    expect(a).not.toBe(b)
  })
})

describe('constantTimeEqual', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEqual('abc123', 'abc123')).toBe(true)
  })

  it('returns false for different strings of the same length', () => {
    expect(constantTimeEqual('abc123', 'abc124')).toBe(false)
  })

  it('returns false for strings of different lengths', () => {
    expect(constantTimeEqual('short', 'muchlonger')).toBe(false)
  })
})

describe('isValidUsername', () => {
  it('accepts alphanumeric/underscore usernames within length bounds', () => {
    expect(isValidUsername('ethan_123')).toBe(true)
  })

  it('rejects usernames that are too short', () => {
    expect(isValidUsername('a')).toBe(false)
  })

  it('rejects usernames with a discriminator suffix', () => {
    expect(isValidUsername('ethan#1234')).toBe(false)
  })

  it('rejects usernames with disallowed characters', () => {
    expect(isValidUsername('ethan!')).toBe(false)
  })
})

describe('isValidPassword', () => {
  it('accepts passwords of at least 8 characters', () => {
    expect(isValidPassword('password')).toBe(true)
  })

  it('rejects passwords shorter than 8 characters', () => {
    expect(isValidPassword('short')).toBe(false)
  })
})

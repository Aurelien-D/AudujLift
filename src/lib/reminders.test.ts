import { describe, expect, it } from 'vitest'
import { needsBackup } from './reminders'

const DAY = 86400000
const now = Date.UTC(2026, 5, 1)

describe('needsBackup', () => {
  it('ne rappelle rien pour un profil tout neuf ou sans données', () => {
    expect(needsBackup(undefined, undefined, now)).toBe(false)
    expect(needsBackup(undefined, now - 3 * DAY, now)).toBe(false)
  })
  it('rappelle quand il n’y a jamais eu d’export', () => {
    expect(needsBackup(undefined, now - 20 * DAY, now)).toBe(true)
  })
  it('rappelle quand le dernier export a plus de 2 semaines', () => {
    expect(needsBackup(now - 15 * DAY, now - 60 * DAY, now)).toBe(true)
    expect(needsBackup(now - 5 * DAY, now - 60 * DAY, now)).toBe(false)
  })
})

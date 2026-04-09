import { safeStorage, app } from 'electron'
import fs from 'fs'
import path from 'path'

function getKeyPath(): string {
  return path.join(app.getPath('userData'), 'api-key.enc')
}

export function saveApiKey(key: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system')
  }

  const encrypted = safeStorage.encryptString(key)
  fs.writeFileSync(getKeyPath(), encrypted)
}

export function loadApiKey(): string | null {
  const keyPath = getKeyPath()

  if (!fs.existsSync(keyPath)) return null
  if (!safeStorage.isEncryptionAvailable()) return null

  const encrypted = fs.readFileSync(keyPath)
  return safeStorage.decryptString(encrypted)
}

export function deleteApiKey(): void {
  const keyPath = getKeyPath()
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath)
  }
}

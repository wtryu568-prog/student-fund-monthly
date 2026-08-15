/**
 * Unique ID generation helpers
 * Generates unique IDs with prefix, timestamp, and random suffix
 */

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

export function generateSimpleId(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

export function generateTimestampId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

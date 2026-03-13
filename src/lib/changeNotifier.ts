// Simple in-memory change counter for push-like updates
// Webhooks increment this; UI polls it cheaply to know when to re-fetch items
// Uses globalThis to survive Next.js dev mode module re-evaluation

const g = globalThis as unknown as { __changeCounter?: number };

export function notifyChange(): void {
  g.__changeCounter = (g.__changeCounter ?? 0) + 1;
}

export function getChangeCounter(): number {
  return g.__changeCounter ?? 0;
}

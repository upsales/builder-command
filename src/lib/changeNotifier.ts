// Simple in-memory change counter for push-like updates
// Webhooks increment this; UI polls it cheaply to know when to re-fetch items

let changeCounter = 0;

export function notifyChange(): void {
  changeCounter++;
}

export function getChangeCounter(): number {
  return changeCounter;
}

// shortcut: time + random ids are unique enough for one device's local data; use UUIDs when sync arrives (V1).
export const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

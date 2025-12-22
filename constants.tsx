
// Fix: Restore export constants to resolve "is not a module" error in ImportModal.tsx.
import { Header } from './types';

/**
 * Common constants used across the application.
 */
export const DEFAULT_HEADERS: Header[] = [
  { key: 'Content-Type', value: 'application/json', enabled: true },
];

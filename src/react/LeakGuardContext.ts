import { createContext } from 'react';

/**
 * Контекст для автоматической передачи componentRef в безопасные хуки.
 */
export const LeakGuardContext = createContext<object | null>(null);
LeakGuardContext.displayName = 'LeakGuardContext';

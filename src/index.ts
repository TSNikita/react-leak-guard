/**
 * react-leak-guard
 * Automatic memory leak prevention for React applications.
 * Patent Pending.
 */

// Экспорт ядра
export { LeakGuardEngine, globalEngine } from './core/engine';
export { LeakBuffer } from './core/buffer';

// Экспорт React-хуков
export * from './react';

// Экспорт типов
export type {
    OperationType,
    TrackedOperation,
    ComponentState,
    LeakRecord,
    LeakReport,
    LeakGuardMode,
} from './core/types';
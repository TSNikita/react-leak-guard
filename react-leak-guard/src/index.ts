/**
 * react-leak-guard
 * Automatic memory leak prevention for React applications
 *
 * Patent Pending
 */

export { LeakGuardEngine, leakGuard } from './leak-guard';
export type {
    AsyncOperation,
    LeakRecord,
    LeakReport,
    LeakGuardMode,
    OperationType,
} from './leak-guard';
export { useLeakGuard } from './useLeakGuard';
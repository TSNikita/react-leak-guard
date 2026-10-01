import { useCallback } from 'react';
import { globalEngine } from '../core/engine';

/**
 * Безопасная замена setInterval.
 * Автоматически вызывает clearInterval при размонтировании компонента.
 */
export function useSafeInterval(componentRef: object) {
    return useCallback(
        (fn: () => void, ms: number): number => {
            const id = window.setInterval(fn, ms);

            globalEngine.trackOperation(componentRef, {
                type: 'interval',
                cleanup: () => window.clearInterval(id),
                source: new Error().stack?.split('\n')[2]?.trim() || 'unknown',
            });

            return id;
        },
        [componentRef]
    );
}
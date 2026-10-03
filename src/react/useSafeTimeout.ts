import { useCallback } from 'react';
import { globalEngine } from '../core/engine';

/**
 * Безопасная замена setTimeout.
 * Автоматически вызывает clearTimeout при размонтировании компонента.
 */
export function useSafeTimeout(componentRef: object) {
  return useCallback(
    (fn: () => void, ms: number): number => {
      const id = window.setTimeout(fn, ms);

      globalEngine.trackOperation(componentRef, {
        type: 'timer',
        cleanup: () => window.clearTimeout(id),
        source: new Error().stack?.split('\n')[2]?.trim() || 'unknown',
      });

      return id;
    },
    [componentRef],
  );
}

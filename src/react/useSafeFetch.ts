import { useCallback } from 'react';
import { globalEngine } from '../core/engine';

/**
 * Безопасная обертка для fetch.
 * Автоматически создает AbortController и прерывает запрос при размонтировании.
 */
export function useSafeFetch(componentRef: object) {
  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const controller = new AbortController();

      const operationId = globalEngine.trackOperation(componentRef, {
        type: 'fetch',
        cleanup: () => controller.abort(),
        source: new Error().stack?.split('\n')[2]?.trim() || 'unknown',
      });

      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });

        // Если запрос успешен, убираем его из трекинга (опционально,
        // но полезно для точной статистики активных операций)
        if (operationId) {
          globalEngine.untrackOperation(componentRef, operationId);
        }

        return response;
      } catch (error) {
        if (operationId) {
          globalEngine.untrackOperation(componentRef, operationId);
        }
        throw error;
      }
    },
    [componentRef],
  );
}

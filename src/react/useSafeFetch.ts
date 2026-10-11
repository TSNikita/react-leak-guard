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

      // Теперь trackOperation возвращает ID, который мы можем использовать
      const operationId = globalEngine.trackOperation(componentRef, {
        type: 'fetch',
        cleanup: () => controller.abort(),
        source: 'useSafeFetch',
      });

      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });

        // Если запрос успешен, убираем его из трекинга активных операций
        if (operationId) {
          globalEngine.untrackOperation(componentRef, operationId);
        }

        return response;
      } catch (error) {
        // При ошибке (включая AbortError при размонтировании) тоже убираем из трекинга
        if (operationId) {
          globalEngine.untrackOperation(componentRef, operationId);
        }
        throw error;
      }
    },
    [componentRef],
  );
}

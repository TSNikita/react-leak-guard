import { useContext, useEffect } from 'react';
import { globalEngine } from '../core/engine';
import { LeakGuardContext } from './LeakGuardContext';

// Перегрузка 1: Явный режим (с ref) - СТРОГО типизирована
export function useSafeTimeout(componentRef: object, callback: () => void, delay: number): void;
// Перегрузка 2: Контекстный режим (без ref) - СТРОГО типизирована
export function useSafeTimeout(callback: () => void, delay: number): void;

// Реализация (используем any ТОЛЬКО внутри, чтобы обойти строгую проверку TS при перегрузках)
// Публичный API остается строго типизированным!
export function useSafeTimeout(arg1: any, arg2: any, arg3?: number): void {
  let componentRef: object;
  let callback: () => void;
  let delay: number = 0;

  if (typeof arg1 === 'function') {
    // Режим Контекста
    componentRef = useContext(LeakGuardContext)!;
    if (!componentRef) {
      throw new Error(
        'useSafeTimeout: componentRef not found. Wrap your app in <LeakGuardProvider>.',
      );
    }
    callback = arg1;
    delay = arg2;
  } else {
    // Явный режим
    componentRef = arg1;
    callback = arg2;
    delay = arg3 ?? 0;
  }

  // ОПТИМИЗАЦИЯ: В продакшене с disableInProduction используем нативный setTimeout
  if (globalEngine.disableInProduction && globalEngine.mode === 'production') {
    useEffect(() => {
      const timerId = setTimeout(callback, delay);
      return () => clearTimeout(timerId);
    }, [callback, delay]);
    return;
  }

  useEffect(() => {
    const timerId = setTimeout(callback, delay);

    globalEngine.trackOperation(componentRef, {
      type: 'timer',
      cleanup: () => clearTimeout(timerId),
      source: 'useSafeTimeout',
    });

    return () => {
      clearTimeout(timerId);
    };
  }, [componentRef, callback, delay]);
}

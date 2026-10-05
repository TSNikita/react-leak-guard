import { useContext, useEffect } from 'react';
import { globalEngine } from '../core/engine';
import { LeakGuardContext } from './LeakGuardContext';

// Перегрузка 1: Явный режим (с ref)
export function useSafeTimeout(componentRef: object, callback: () => void, delay: number): void;
// Перегрузка 2: Контекстный режим (без ref, берет из LeakGuardProvider)
export function useSafeTimeout(callback: () => void, delay: number): void;

// Реализация
export function useSafeTimeout(arg1: any, arg2: any, arg3?: number): void {
  let componentRef: object;
  let callback: () => void;
  // ИСПРАВЛЕНИЕ: инициализируем delay нулем, чтобы TS не ругался на undefined
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
    // ИСПРАВЛЕНИЕ: используем ?? 0 на случай, если arg3 не передан
    delay = arg3 ?? 0;
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

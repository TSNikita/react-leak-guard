import { useContext, useEffect } from 'react';
import { globalEngine } from '../core/engine';
import { LeakGuardContext } from './LeakGuardContext';

// Перегрузка 1: Явный режим
export function useSafeEventListener(
  componentRef: object,
  target: EventTarget | null,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): void;

// Перегрузка 2: Контекстный режим
export function useSafeEventListener(
  target: EventTarget | null,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): void;

// Реализация с union types
export function useSafeEventListener(
  arg1: object | EventTarget | null,
  arg2: EventTarget | null | string,
  arg3?: string | EventListenerOrEventListenerObject,
  arg4?: EventListenerOrEventListenerObject | boolean | AddEventListenerOptions,
  arg5?: boolean | AddEventListenerOptions,
): void {
  let componentRef: object;
  let target: EventTarget | null;
  let type: string;
  let listener: EventListenerOrEventListenerObject;
  let options: boolean | AddEventListenerOptions | undefined;

  // Type guard: проверяем, является ли arg1 DOM-элементом (имеет addEventListener)
  const isDOMElement = arg1 !== null && typeof arg1 === 'object' && 'addEventListener' in arg1;

  if (!isDOMElement && arg1 !== null && typeof arg1 === 'object') {
    // Явный режим (arg1 - это componentRef)
    componentRef = arg1;
    target = arg2 as EventTarget | null;
    type = arg3 as string;
    listener = arg4 as EventListenerOrEventListenerObject;
    options = arg5;
  } else {
    // Контекстный режим (arg1 - это target)
    componentRef = useContext(LeakGuardContext)!;
    if (!componentRef) {
      throw new Error(
        'useSafeEventListener: componentRef not found. Wrap your app in <LeakGuardProvider>.',
      );
    }
    target = arg1 as EventTarget | null;
    type = arg2 as string;
    listener = arg3 as EventListenerOrEventListenerObject;
    options = arg4 as boolean | AddEventListenerOptions | undefined;
  }

  // ОПТИМИЗАЦИЯ: В продакшене с disableInProduction используем нативный addEventListener
  if (globalEngine.disableInProduction && globalEngine.mode === 'production') {
    useEffect(() => {
      if (!target) return;
      target.addEventListener(type, listener, options);
      return () => {
        target.removeEventListener(type, listener, options);
      };
    }, [target, type, listener, options]);
    return;
  }

  useEffect(() => {
    if (!target) return;

    target.addEventListener(type, listener, options);

    globalEngine.trackOperation(componentRef, {
      type: 'event',
      cleanup: () => {
        target!.removeEventListener(type, listener, options);
      },
      source: 'useSafeEventListener',
    });

    return () => {
      target!.removeEventListener(type, listener, options);
    };
  }, [componentRef, target, type, listener, options]);
}

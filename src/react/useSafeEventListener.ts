import { useContext, useEffect } from 'react';
import { globalEngine } from '../core/engine';
import { LeakGuardContext } from './LeakGuardContext';

// Перегрузка 1: Явный режим (с componentRef)
export function useSafeEventListener(
  componentRef: object,
  target: EventTarget | null,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): void;

// Перегрузка 2: Контекстный режим (без componentRef)
export function useSafeEventListener(
  target: EventTarget | null,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): void;

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

  // Определяем режим по типу первого аргумента
  // Если arg1 - это объект (но не null и не DOM-элемент), то это componentRef
  const isExplicitMode = arg1 !== null && typeof arg1 === 'object' && !('addEventListener' in arg1);

  if (isExplicitMode) {
    // Явный режим: useSafeEventListener(ref, target, type, listener, options)
    componentRef = arg1 as object;
    target = arg2 as EventTarget | null;
    type = arg3 as string;
    listener = arg4 as EventListenerOrEventListenerObject;
    options = arg5;
  } else {
    // Контекстный режим: useSafeEventListener(target, type, listener, options)
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

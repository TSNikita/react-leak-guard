import { Dispatch, SetStateAction, useContext, useDebugValue, useRef, useState } from 'react';
import { globalEngine } from '../core/engine';
import { LeakGuardContext as LGContext } from './LeakGuardContext';

export interface UseSafeStateOptions {
  allowPostUnmount?: boolean;
}

// Перегрузка 1: Явный режим
export function useSafeState<T>(
  componentRef: object,
  componentName: string,
  initialState: T | (() => T),
  options?: UseSafeStateOptions,
): [T, Dispatch<SetStateAction<T>>];

// Перегрузка 2: Контекстный режим
export function useSafeState<T>(
  componentName: string,
  initialState: T | (() => T),
  options?: UseSafeStateOptions,
): [T, Dispatch<SetStateAction<T>>];

// Реализация с union types вместо any
export function useSafeState<T>(
  arg1: object | string,
  arg2: string | T | (() => T),
  arg3?: T | (() => T) | UseSafeStateOptions,
  arg4?: UseSafeStateOptions,
): [T, Dispatch<SetStateAction<T>>] {
  let componentRef: object;
  let componentName: string;
  let initialState: T | (() => T);
  let options: UseSafeStateOptions = {};

  // Type guard: проверяем, является ли arg1 строкой (именем компонента)
  if (typeof arg1 === 'string') {
    // Контекстный режим
    componentRef = useContext(LGContext)!;
    if (!componentRef) {
      throw new Error(
        'useSafeState: componentRef not found in context. Wrap your app in <LeakGuardProvider>.',
      );
    }
    componentName = arg1;
    initialState = arg2 as T | (() => T);

    // Проверяем, является ли arg3 опциями
    if (arg3 && typeof arg3 === 'object' && !Array.isArray(arg3) && typeof arg3 !== 'function') {
      options = arg3 as UseSafeStateOptions;
    }
  } else {
    // Явный режим
    componentRef = arg1;
    componentName = arg2 as string;
    initialState = arg3 as T | (() => T);
    options = arg4 || {};
  }

  const { allowPostUnmount = false } = options;

  // ОПТИМИЗАЦИЯ: В продакшене с disableInProduction возвращаем нативный useState
  if (globalEngine.disableInProduction && globalEngine.mode === 'production') {
    return useState(initialState);
  }

  const [state, setState] = useState(initialState);
  const safeSetState = useRef(
    globalEngine.createSafeSetter(componentRef, setState, componentName, allowPostUnmount),
  ).current;

  const isMounted = globalEngine.isMounted(componentRef);
  useDebugValue(isMounted ? `Active (${componentName})` : `Unmounted (${componentName})`);

  return [state, safeSetState];
}

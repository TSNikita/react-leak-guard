import { Dispatch, SetStateAction, useContext, useRef, useState } from 'react';
import { globalEngine } from '../core/engine';
import { LeakGuardContext } from './LeakGuardContext';

export interface UseSafeStateOptions {
  allowPostUnmount?: boolean;
}

// Перегрузки для TypeScript
export function useSafeState<T>(
  componentRef: object,
  componentName: string,
  initialState: T | (() => T),
  options?: UseSafeStateOptions,
): [T, Dispatch<SetStateAction<T>>];

export function useSafeState<T>(
  componentName: string,
  initialState: T | (() => T),
  options?: UseSafeStateOptions,
): [T, Dispatch<SetStateAction<T>>];

// Реализация
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

  // Определяем режим вызова (Явный или Контекстный)
  if (typeof arg1 === 'string') {
    // Режим Контекста: useSafeState('Name', initialState, options)
    componentRef = useContext(LeakGuardContext)!;
    if (!componentRef) {
      throw new Error(
        'useSafeState: componentRef not found in context. Wrap your app in <LeakGuardProvider>.',
      );
    }
    componentName = arg1;
    initialState = arg2 as T | (() => T);
    if (
      arg3 &&
      typeof arg3 === 'object' &&
      !('value' in (arg3 as unknown as Record<string, unknown>))
    ) {
      options = arg3 as UseSafeStateOptions;
    }
  } else {
    // Явный режим: useSafeState(ref, 'Name', initialState, options)
    componentRef = arg1;
    componentName = arg2 as string;
    initialState = arg3 as T | (() => T);
    options = arg4 || {};
  }

  const [state, setState] = useState(initialState);
  const { allowPostUnmount = false } = options;

  const safeSetState = useRef(
    globalEngine.createSafeSetter(componentRef, setState, componentName, allowPostUnmount),
  ).current;

  return [state, safeSetState];
}

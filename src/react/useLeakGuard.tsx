import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { globalEngine } from '../core/engine';
import { LeakGuardContext } from './LeakGuardContext';

/**
 * Базовый хук для регистрации компонента в LeakGuard Engine.
 */
export function useLeakGuard(componentName: string) {
  const componentRef = useRef<object>({}).current;

  const useRegistrationEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
  useRegistrationEffect(() => {
    // Передаем имя компонента в движок для лучшего логирования и отчетов
    globalEngine.register(componentRef, componentName);

    return () => {
      globalEngine.unregister(componentRef);
    };
  }, [componentRef, componentName]);

  return componentRef;
}

/**
 * Провайдер для автоматической передачи componentRef дочерним компонентам и хукам.
 */

export function LeakGuardProvider({
  children,
  componentName,
}: {
  children: React.ReactNode;
  componentName: string;
}) {
  const componentRef = useLeakGuard(componentName);

  return <LeakGuardContext.Provider value={componentRef}>{children}</LeakGuardContext.Provider>;
}

import React from 'react';
import { useLeakGuard } from './useLeakGuard';

/**
 * Higher-Order Component для защиты классовых компонентов от утечек памяти.
 * Автоматически регистрирует компонент в LeakGuard Engine.
 *
 * @example
 * class MyComponent extends React.Component {
 *   render() {
 *     return <div>Hello</div>;
 *   }
 * }
 *
 * export default withLeakGuard(MyComponent, 'MyComponent');
 */
export function withLeakGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string,
): React.FC<P> {
  const WithLeakGuard: React.FC<P> = (props) => {
    const componentRef = useLeakGuard(componentName);

    // Передаем componentRef через пропсы (опционально, для продвинутого использования)
    return <WrappedComponent {...props} leakGuardRef={componentRef} />;
  };

  // Устанавливаем displayName для удобства отладки
  WithLeakGuard.displayName = `WithLeakGuard(${componentName})`;

  return WithLeakGuard;
}

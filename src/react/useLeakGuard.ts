import { useEffect, useRef } from 'react';
import { globalEngine } from '../core/engine';

/**
 * Базовый хук для регистрации компонента в LeakGuard Engine.
 * Возвращает стабильную ссылку (ref), которую необходимо передавать в другие safe-хуки.
 *
 * @param componentName - Уникальное имя компонента для телеметрии и отладки.
 * @returns Стабильный объект-ссылка на экземпляр компонента.
 */
export function useLeakGuard(componentName: string) {
    // Используем пустой объект как стабильный ключ для WeakMap.
    // Он не меняется между рендерами, что идеально для WeakMap.
    const componentRef = useRef<object>({}).current;

    useEffect(() => {
        globalEngine.register(componentRef);

        return () => {
            globalEngine.unregister(componentRef);
        };
    }, [componentRef]);

    return componentRef;
}
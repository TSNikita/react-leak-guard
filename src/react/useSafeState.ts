import { useState, useCallback, useRef } from 'react';
import { globalEngine } from '../core/engine';

/**
 * Безопасная замена стандартному useState.
 * Автоматически блокирует вызовы setState, если компонент уже размонтирован,
 * предотвращая утечки памяти и предупреждения React.
 *
 * @param componentRef - Ссылка, полученная из useLeakGuard.
 * @param componentName - Имя компонента для логирования.
 * @param initialState - Начальное состояние.
 */
export function useSafeState<T>(
    componentRef: object,
    componentName: string,
    initialState: T | (() => T)
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState(initialState);

    // Создаем безопасный setter один раз при инициализации
    const safeSetState = useRef(
        globalEngine.createSafeSetter(componentRef, setState, componentName)
    ).current;

    return [state, safeSetState];
}
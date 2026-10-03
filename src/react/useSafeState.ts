import {useState, useRef, Dispatch, SetStateAction} from 'react';
import { globalEngine } from '../core/engine';

export interface UseSafeStateOptions {
    /**
     * Если true, позволяет обновлять состояние после размонтирования компонента.
     * Полезно для работы с глобальными сторами (Redux, Zustand) и контекстами.
     * @default false
     */
    allowPostUnmount?: boolean;
}

/**
 * Безопасная замена стандартному useState.
 * Автоматически блокирует вызовы setState, если компонент уже размонтирован,
 * предотвращая утечки памяти и предупреждения React.
 *
 * @param componentRef - Ссылка, полученная из useLeakGuard.
 * @param componentName - Имя компонента для логирования.
 * @param initialState - Начальное состояние.
 * @param options - Дополнительные опции.
 */
export function useSafeState<T>(
    componentRef: object,
    componentName: string,
    initialState: T | (() => T),
    options: UseSafeStateOptions = {}
): [T, Dispatch<SetStateAction<T>>] {
    const { allowPostUnmount = false } = options;
    const [state, setState] = useState(initialState);

    // Создаем безопасный setter один раз при инициализации
    const safeSetState = useRef(
        globalEngine.createSafeSetter(componentRef, setState, componentName, allowPostUnmount)
    ).current;

    return [state, safeSetState];
}
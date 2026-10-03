import { ComponentState, TrackedOperation, LeakRecord, LeakGuardMode } from './types';
import { LeakBuffer } from './buffer';

/**
 * Центральное ядро LeakGuard Engine.
 * Управляет жизненным циклом компонентов, проксированием состояний и автоматической очисткой.
 * Использует WeakMap для гарантии нулевого оверхеда по памяти (Zero Memory Overhead).
 */
export class LeakGuardEngine {
    private registry = new WeakMap<object, ComponentState>();
    private buffer: LeakBuffer;
    public readonly mode: LeakGuardMode;

    constructor(mode: LeakGuardMode = 'production', maxBufferSize = 1000) {
        this.mode = mode;
        this.buffer = new LeakBuffer(mode, maxBufferSize);
    }

    /**
     * Регистрирует компонент в реестре при монтировании.
     */
    public register(component: object): void {
        this.registry.set(component, {
            isMounted: true,
            operations: new Map(),
            leakCount: 0,
        });
    }

    /**
     * Снимает компонент с регистрации и гарантированно очищает все его операции.
     */
    public unregister(component: object): void {
        const state = this.registry.get(component);
        if (!state) return;

        state.isMounted = false;

        // Автоочистка всех зарегистрированных операций
        for (const [, operation] of state.operations.entries()) {
            try {
                operation.cleanup();
            } catch (error) {
                // Игнорируем ошибки очистки в продакшене, чтобы не ломать UI
                if (this.mode === 'development') {
                    console.error(`[LeakGuard] Cleanup error for ${operation.type}:`, error);
                }
            }
        }
        state.operations.clear();
        this.registry.delete(component);
    }

    /**
     * Проверяет, смонтирован ли компонент.
     */
    public isMounted(component: object): boolean {
        return this.registry.get(component)?.isMounted ?? false;
    }

    /**
     * Регистрирует асинхронную операцию для последующей автоочистки.
     */
    public trackOperation(component: object, operation: Omit<TrackedOperation, 'id'>): string {
        const state = this.registry.get(component);

        // Если компонент уже размонтирован, выполняем очистку немедленно
        if (!state || !state.isMounted) {
            operation.cleanup();
            return '';
        }

        const id = `${operation.type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        state.operations.set(id, { ...operation, id });
        return id;
    }

    /**
     * Удаляет операцию из трекинга (например, после успешного завершения fetch).
     */
    public untrackOperation(component: object, operationId: string): void {
        const state = this.registry.get(component);
        if (state) {
            state.operations.delete(operationId);
        }
    }

    /**
     * Создает безопасную обертку (Proxy) для функций обновления состояния.
     *
     * @param component - Объект компонента.
     * @param originalSetter - Оригинальная функция setState.
     * @param componentName - Имя компонента для логирования.
     * @param allowPostUnmount - Если true, позволяет обновлять состояние после unmount.
     */
    public createSafeSetter<T>(
        component: object,
        originalSetter: (value: T | ((prev: T) => T)) => void,
        componentName: string,
        allowPostUnmount: boolean = false
    ): (value: T | ((prev: T) => T)) => void {
        return (value: T | ((prev: T) => T)) => {
            if (!this.isMounted(component)) {
                // Если разрешено обновление после unmount, пропускаем проверку
                if (allowPostUnmount) {
                    originalSetter(value);
                    return;
                }

                const leakRecord: LeakRecord = {
                    component: componentName,
                    operation: 'setState',
                    stack: this.mode === 'development' ? new Error().stack || '' : '',
                    timestamp: Date.now(),
                };

                this.buffer.record(leakRecord);

                if (this.mode === 'development') {
                    console.warn(
                        `[LeakGuard] 🚨 BLOCKED setState on unmounted component "${componentName}".\n` +
                        `This indicates a potential memory leak. Stack:\n${leakRecord.stack}`
                    );
                }
                return; // Блокируем обновление
            }

            // Компонент жив, передаем управление оригинальному setter
            originalSetter(value);
        };
    }

    /**
     * Возвращает агрегированный отчет об утечках.
     */
    public getReport() {
        return this.buffer.getReport();
    }

    /**
     * Очищает буфер отчетов.
     */
    public clearReport() {
        this.buffer.clear();
    }
}

// Определение окружения для глобального экземпляра
const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

/**
 * Глобальный синглтон экземпляра движка.
 * Рекомендуется использовать его для большинства случаев.
 */
export const globalEngine = new LeakGuardEngine(isDev ? 'development' : 'production');
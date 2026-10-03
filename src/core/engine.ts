import { LeakBuffer } from './buffer';
import type {
  ComponentState,
  LeakGuardMode,
  LeakRecord,
  LeakReport,
  TrackedOperation,
} from './types';

export class LeakGuardEngine {
  private registry = new WeakMap<object, ComponentState>();
  private buffer: LeakBuffer;
  public readonly mode: LeakGuardMode;

  // Добавляем свойство strict (без readonly, чтобы можно было переключать)
  public strict: boolean;

  private pendingWarnings = new Map<object, ReturnType<typeof setTimeout>>();

  constructor(mode: LeakGuardMode = 'production', strict: boolean = false) {
    this.mode = mode;
    this.strict = strict;
    // ИСПРАВЛЕНИЕ: передаем mode и maxSize, как требует конструктор LeakBuffer
    this.buffer = new LeakBuffer(this.mode, 1000);
  }

  public register(component: object, componentName?: string): void {
    // Если компонент был размонтирован и снова смонтирован (StrictMode),
    // отменяем все отложенные предупреждения для него
    if (this.pendingWarnings.has(component)) {
      clearTimeout(this.pendingWarnings.get(component)!);
      this.pendingWarnings.delete(component);
    }

    this.registry.set(component, {
      isMounted: true,
      operations: new Map(),
      leakCount: 0,
      name: componentName, // Сохраняем имя компонента
    });
  }

  public unregister(component: object): void {
    const state = this.registry.get(component);
    if (state) {
      state.isMounted = false;

      // Автоматическая очистка всех зарегистрированных операций
      state.operations.forEach((op) => {
        if (op.cleanup) {
          op.cleanup();
        }
      });
      state.operations.clear();
    }
  }

  public isMounted(component: object): boolean {
    return this.registry.get(component)?.isMounted ?? false;
  }

  public trackOperation(component: object, operation: TrackedOperation): void {
    const state = this.registry.get(component);
    if (state && state.isMounted) {
      const opId = `${operation.type}_${Date.now()}`;
      state.operations.set(opId, operation);
    } else {
      // Если компонент уже размонтирован, сразу вызываем cleanup
      if (operation.cleanup) {
        operation.cleanup();
      }
    }
  }

  public createSafeSetter<T>(
    component: object,
    originalSetter: (value: T | ((prev: T) => T)) => void,
    componentName: string,
    allowPostUnmount: boolean = false,
  ): (value: T | ((prev: T) => T)) => void {
    return (value: T | ((prev: T) => T)) => {
      if (!this.isMounted(component)) {
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
          const message =
            `[LeakGuard] 🚨 BLOCKED setState on unmounted component "${componentName}".\n` +
            `This indicates a potential memory leak. Stack:\n${leakRecord.stack}`;

          if (this.strict) {
            // Строгий режим: выводим КРАСНУЮ ошибку (console.error), но НЕ роняем приложение
            console.error(message);
          } else {
            // Обычный режим: откладываем предупреждение (для React StrictMode)
            const timer = setTimeout(() => {
              console.warn(message);
              this.pendingWarnings.delete(component);
            }, 0);

            this.pendingWarnings.set(component, timer);
          }
        }
        return;
      }

      // Компонент жив, передаем управление оригинальному setter
      originalSetter(value);
    };
  }

  // Упростили метод, так как вся логика уже есть в твоем LeakBuffer
  public getReport(): LeakReport {
    return this.buffer.getReport();
  }
}

// Умное определение окружения: в тестах (Vitest) включаем режим разработки для проверки логов
const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export const globalEngine = new LeakGuardEngine(isTestEnv ? 'development' : 'production', false);

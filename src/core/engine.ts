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
  public strict: boolean;
  public disableInProduction: boolean; // <-- Новая опция

  private pendingWarnings = new Map<object, ReturnType<typeof setTimeout>>();

  constructor(
    mode: LeakGuardMode = 'production',
    strict: boolean = false,
    disableInProduction: boolean = false,
  ) {
    this.mode = mode;
    this.strict = strict;
    this.disableInProduction = disableInProduction; // <-- Сохраняем
    this.buffer = new LeakBuffer(this.mode, 1000);
  }

  public register(component: object, componentName?: string): void {
    if (this.pendingWarnings.has(component)) {
      clearTimeout(this.pendingWarnings.get(component)!);
      this.pendingWarnings.delete(component);
    }

    this.registry.set(component, {
      isMounted: true,
      operations: new Map(),
      leakCount: 0,
      name: componentName,
    });
  }

  public unregister(component: object): void {
    const state = this.registry.get(component);
    if (state) {
      state.isMounted = false;

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

  public trackOperation(component: object, operation: TrackedOperation): string | undefined {
    const state = this.registry.get(component);
    if (state && state.isMounted) {
      const opId = `${operation.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      operation.id = opId;
      state.operations.set(opId, operation);
      return opId;
    } else {
      if (operation.cleanup) {
        operation.cleanup();
      }
      return undefined;
    }
  }

  public untrackOperation(component: object, opId: string): void {
    const state = this.registry.get(component);
    if (state) {
      state.operations.delete(opId);
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
            console.error(message);
          } else {
            const timer = setTimeout(() => {
              console.warn(message);
              this.pendingWarnings.delete(component);
            }, 0);

            this.pendingWarnings.set(component, timer);
          }
        }
        return;
      }

      originalSetter(value);
    };
  }

  public getReport(): LeakReport {
    return this.buffer.getReport();
  }
}

// Умное определение окружения: в тестах включаем режим разработки
const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export const globalEngine = new LeakGuardEngine(
  isTestEnv ? 'development' : 'production',
  false,
  false, // disableInProduction по умолчанию выключен
);

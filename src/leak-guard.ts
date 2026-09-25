/**
 * LeakGuard Engine — Core runtime for automatic memory leak prevention
 *
 * Patent Pending: Lifecycle Registry + StateUpdateProxy + AutoCleanup Engine1
 */

export type OperationType = 'fetch' | 'timer' | 'interval' | 'event' | 'animation';

export interface AsyncOperation {
    type: OperationType;
    cleanup: () => void;
    source: string;
    createdAt: number;
}

export interface LeakRecord {
    component: string;
    operation: string;
    stack: string;
    timestamp: number;
}

export interface LeakReport {
    totalLeaks: number;
    byComponent: Record<string, number>;
    byOperation: Record<string, number>;
    leaks: LeakRecord[];
}

export type LeakGuardMode = 'development' | 'production';

export class LeakGuardEngine {
    // 1. Lifecycle Registry (WeakMap ensures no memory leak from the registry itself)
    private registry = new WeakMap<object, Set<AsyncOperation>>();
    private leakBuffer: LeakRecord[] = [];
    private mode: LeakGuardMode;
    private maxBufferSize: number;

    constructor(mode: LeakGuardMode = 'development', maxBufferSize = 1000) {
        this.mode = mode;
        this.maxBufferSize = maxBufferSize;
    }

    /**
     * Register a component instance in the lifecycle registry.
     * Called automatically by useLeakGuard on mount.
     */
    register(component: object): void {
        this.registry.set(component, new Set());
    }

    /**
     * Unregister a component and force-cancel all tracked operations.
     * Called automatically by useLeakGuard on unmount.
     */
    unregister(component: object): void {
        const operations = this.registry.get(component);

        if (operations) {
            operations.forEach((op) => {
                try {
                    op.cleanup(); // Auto-cleanup (AbortController, clearTimeout, etc.)
                } catch (e) {
                    // Ignore cleanup errors in production
                }
            });
            operations.clear();
        }

        this.registry.delete(component);
    }

    /**
     * Track an async operation and associate it with a component.
     */
    trackOperation(component: object, operation: Omit<AsyncOperation, 'createdAt'>): void {
        const operations = this.registry.get(component);
        if (operations) {
            operations.add({
                ...operation,
                createdAt: Date.now(),
            });
        }
    }

    /**
     * Remove a completed operation from tracking.
     */
    untrackOperation(component: object, operation: AsyncOperation): void {
        const operations = this.registry.get(component);
        if (operations) {
            operations.delete(operation);
        }
    }

    /**
     * 2. StateUpdateProxy: Create a safe setter that blocks state updates after unmount.
     * This is the core mechanism of the patent.
     */
    createSafeSetter<T>(
        component: object,
        originalSetter: (value: T | ((prev: T) => T)) => void,
        componentName: string
    ): (value: T | ((prev: T) => T)) => void {
        return (value: T | ((prev: T) => T)) => {
            if (!this.registry.has(component)) {
                // Component is unmounted! Block the update.
                const leak: LeakRecord = {
                    component: componentName,
                    operation: 'setState',
                    stack: this.mode === 'development' ? new Error().stack || '' : '',
                    timestamp: Date.now(),
                };

                this.addToBuffer(leak);

                if (this.mode === 'development') {
                    console.error(
                        `[LeakGuard] 🚨 BLOCKED setState on unmounted component "${componentName}"\n`,
                        `Stack: ${leak.stack}`
                    );
                }

                return; // BLOCKED
            }

            // Component is still mounted, proceed normally
            originalSetter(value);
        };
    }

    /**
     * Check if a component is still mounted (registered).
     */
    isMounted(component: object): boolean {
        return this.registry.has(component);
    }

    /**
     * Get aggregated leak report.
     */
    getReport(): LeakReport {
        const byComponent: Record<string, number> = {};
        const byOperation: Record<string, number> = {};

        this.leakBuffer.forEach((leak) => {
            byComponent[leak.component] = (byComponent[leak.component] || 0) + 1;
            byOperation[leak.operation] = (byOperation[leak.operation] || 0) + 1;
        });

        return {
            totalLeaks: this.leakBuffer.length,
            byComponent,
            byOperation,
            leaks: this.mode === 'development' ? [...this.leakBuffer] : [],
        };
    }

    /**
     * Clear the leak buffer.
     */
    clearReport(): void {
        this.leakBuffer = [];
    }

    private addToBuffer(leak: LeakRecord): void {
        this.leakBuffer.push(leak);
        // Prevent memory leak in the buffer itself
        if (this.leakBuffer.length > this.maxBufferSize) {
            this.leakBuffer = this.leakBuffer.slice(-this.maxBufferSize);
        }
    }
}

// Global singleton instance
const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

export const leakGuard = new LeakGuardEngine(isDev ? 'development' : 'production');
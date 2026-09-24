import { useEffect, useRef, useCallback, useState } from 'react';
import { leakGuard, type AsyncOperation } from './leak-guard';

/**
 * React hook for automatic memory leak prevention.
 *
 * Registers the component in the LeakGuard registry on mount,
 * and force-cancels all tracked operations on unmount.
 */
export function useLeakGuard(componentName: string) {
    const componentRef = useRef<object>({});

    // Register on mount, unregister on unmount
    useEffect(() => {
        const component = componentRef.current;
        leakGuard.register(component);

        return () => {
            leakGuard.unregister(component);
        };
    }, []);

    /**
     * Safe replacement for useState.
     * Blocks setState calls after component unmount.
     */
    const useSafeState = useCallback(
        <T>(initialValue: T | (() => T)) => {
            const [state, setState] = useState(initialValue);

            const safeSetState = useCallback(
                (value: T | ((prev: T) => T)) => {
                    const safeSetter = leakGuard.createSafeSetter(
                        componentRef.current,
                        setState,
                        componentName
                    );
                    safeSetter(value);
                },
                [componentName]
            );

            return [state, safeSetState] as const;
        },
        [componentName]
    );

    /**
     * Safe fetch wrapper.
     * Automatically aborts the request on component unmount.
     */
    const useSafeFetch = useCallback(() => {
        return useCallback(
            async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                const controller = new AbortController();

                const operation: Omit<AsyncOperation, 'createdAt'> = {
                    type: 'fetch',
                    cleanup: () => controller.abort(),
                    source: new Error().stack?.split('\n')[2]?.trim() || 'unknown',
                };

                leakGuard.trackOperation(componentRef.current, operation);

                try {
                    const response = await fetch(input, {
                        ...init,
                        signal: controller.signal,
                    });

                    leakGuard.untrackOperation(componentRef.current, {
                        ...operation,
                        createdAt: Date.now(),
                    });

                    return response;
                } catch (error) {
                    leakGuard.untrackOperation(componentRef.current, {
                        ...operation,
                        createdAt: Date.now(),
                    });
                    throw error;
                }
            },
            []
        );
    }, []);

    /**
     * Safe setTimeout wrapper.
     * Automatically clears the timeout on component unmount.
     */
    const useSafeTimeout = useCallback(() => {
        return useCallback(
            (fn: () => void, ms: number): number => {
                const id = window.setTimeout(() => {
                    fn();
                }, ms);

                leakGuard.trackOperation(componentRef.current, {
                    type: 'timer',
                    cleanup: () => window.clearTimeout(id),
                    source: new Error().stack?.split('\n')[2]?.trim() || 'unknown',
                });

                return id;
            },
            []
        );
    }, []);

    /**
     * Safe setInterval wrapper.
     * Automatically clears the interval on component unmount.
     */
    const useSafeInterval = useCallback(() => {
        return useCallback(
            (fn: () => void, ms: number): number => {
                const id = window.setInterval(fn, ms);

                leakGuard.trackOperation(componentRef.current, {
                    type: 'interval',
                    cleanup: () => window.clearInterval(id),
                    source: new Error().stack?.split('\n')[2]?.trim() || 'unknown',
                });

                return id;
            },
            []
        );
    }, []);

    /**
     * Safe addEventListener wrapper.
     * Automatically removes the listener on component unmount.
     */
    const useSafeEventListener = useCallback(
        <K extends keyof WindowEventMap>(
            target: EventTarget,
            event: K,
            handler: (ev: WindowEventMap[K]) => void,
            options?: AddEventListenerOptions
        ): void => {
            useEffect(() => {
                target.addEventListener(event, handler as EventListener, options);

                leakGuard.trackOperation(componentRef.current, {
                    type: 'event',
                    cleanup: () =>
                        target.removeEventListener(event, handler as EventListener, options),
                    source: new Error().stack?.split('\n')[2]?.trim() || 'unknown',
                });

                return () => {
                    target.removeEventListener(event, handler as EventListener, options);
                };
            }, [target, event, handler, options]);
        },
        []
    );

    return {
        useSafeState,
        useSafeFetch,
        useSafeTimeout,
        useSafeInterval,
        useSafeEventListener,
        isMounted: () => leakGuard.isMounted(componentRef.current),
    };
}
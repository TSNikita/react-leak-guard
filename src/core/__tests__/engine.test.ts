import { describe, it, expect, vi } from 'vitest';
import { LeakGuardEngine } from '../engine';

describe('LeakGuardEngine', () => {
    it('должен регистрировать и удалять компоненты', () => {
        const engine = new LeakGuardEngine('production');
        const component = {};

        engine.register(component);
        expect(engine.isMounted(component)).toBe(true);

        engine.unregister(component);
        expect(engine.isMounted(component)).toBe(false);
    });

    it('должен автоматически вызывать cleanup при unregister', () => {
        const engine = new LeakGuardEngine('production');
        const component = {};
        const cleanupFn = vi.fn();

        engine.register(component);
        engine.trackOperation(component, {
            type: 'timer',
            cleanup: cleanupFn,
            source: 'test',
        });

        engine.unregister(component);

        expect(cleanupFn).toHaveBeenCalledTimes(1);
    });

    it('createSafeSetter должен блокировать setState после unmount', () => {
        const engine = new LeakGuardEngine('development');
        const component = {};
        const originalSetter = vi.fn();

        engine.register(component);
        const safeSetter = engine.createSafeSetter(component, originalSetter, 'TestComp');

        safeSetter(42);
        expect(originalSetter).toHaveBeenCalledWith(42);

        engine.unregister(component);

        safeSetter(100);
        expect(originalSetter).toHaveBeenCalledTimes(1);
    });

    it('должен немедленно очищать операции, если компонент уже размонтирован', () => {
        const engine = new LeakGuardEngine('production');
        const component = {};
        const cleanupFn = vi.fn();

        engine.register(component);
        engine.unregister(component);

        engine.trackOperation(component, {
            type: 'timer',
            cleanup: cleanupFn,
            source: 'test',
        });

        expect(cleanupFn).toHaveBeenCalledTimes(1);
    });

    it('getReport должен возвращать корректную статистику утечек', () => {
        const engine = new LeakGuardEngine('development');
        const component = {};
        const originalSetter = vi.fn();

        engine.register(component);
        const safeSetter = engine.createSafeSetter(component, originalSetter, 'TestComp');

        engine.unregister(component);
        safeSetter(1);

        const report = engine.getReport();
        expect(report.totalLeaks).toBe(1);
        expect(report.byComponent['TestComp']).toBe(1);
        expect(report.byOperation['setState']).toBe(1);
    });
});
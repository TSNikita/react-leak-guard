import { describe, it, expect, beforeEach } from '@jest/globals';
import { LeakGuardEngine } from '../src/leak-guard';

describe('LeakGuardEngine', () => {
    let engine: LeakGuardEngine;

    beforeEach(() => {
        engine = new LeakGuardEngine('development');
    });

    describe('register/unregister', () => {
        it('should register a component', () => {
            const component = {};
            engine.register(component);
            expect(engine.isMounted(component)).toBe(true);
        });

        it('should unregister a component', () => {
            const component = {};
            engine.register(component);
            engine.unregister(component);
            expect(engine.isMounted(component)).toBe(false);
        });
    });

    describe('auto-cleanup on unmount', () => {
        it('should call cleanup for all tracked operations on unmount', () => {
            const component = {};
            const cleanup1 = jest.fn();
            const cleanup2 = jest.fn();

            engine.register(component);
            engine.trackOperation(component, {
                type: 'fetch',
                cleanup: cleanup1,
                source: 'test',
            });
            engine.trackOperation(component, {
                type: 'timer',
                cleanup: cleanup2,
                source: 'test',
            });

            engine.unregister(component);

            expect(cleanup1).toHaveBeenCalledTimes(1);
            expect(cleanup2).toHaveBeenCalledTimes(1);
        });
    });

    describe('createSafeSetter (StateUpdateProxy)', () => {
        it('should allow setState when component is mounted', () => {
            const component = {};
            const originalSetter = jest.fn();
            const safeSetter = engine.createSafeSetter(component, originalSetter, 'TestComponent');

            engine.register(component);
            safeSetter('new value');

            expect(originalSetter).toHaveBeenCalledWith('new value');
        });

        it('should BLOCK setState when component is unmounted', () => {
            const component = {};
            const originalSetter = jest.fn();
            const safeSetter = engine.createSafeSetter(component, originalSetter, 'TestComponent');

            engine.register(component);
            engine.unregister(component); // Unmount!

            safeSetter('new value'); // This should be BLOCKED

            expect(originalSetter).not.toHaveBeenCalled(); // Original setter NOT called
        });

        it('should record leak when setState is called after unmount', () => {
            const component = {};
            const originalSetter = jest.fn();
            const safeSetter = engine.createSafeSetter(component, originalSetter, 'TestComponent');

            engine.register(component);
            engine.unregister(component);

            safeSetter('new value');

            const report = engine.getReport();
            expect(report.totalLeaks).toBe(1);
            expect(report.byComponent['TestComponent']).toBe(1);
            expect(report.byOperation['setState']).toBe(1);
        });
    });

    describe('getReport', () => {
        it('should return empty report initially', () => {
            const report = engine.getReport();
            expect(report.totalLeaks).toBe(0);
            expect(report.byComponent).toEqual({});
            expect(report.byOperation).toEqual({});
        });

        it('should aggregate leaks by component and operation', () => {
            const comp1 = {};
            const comp2 = {};

            engine.register(comp1);
            engine.unregister(comp1);
            engine.createSafeSetter(comp1, jest.fn(), 'Comp1')('value');
            engine.createSafeSetter(comp1, jest.fn(), 'Comp1')('value');

            engine.register(comp2);
            engine.unregister(comp2);
            engine.createSafeSetter(comp2, jest.fn(), 'Comp2')('value');

            const report = engine.getReport();
            expect(report.totalLeaks).toBe(3);
            expect(report.byComponent['Comp1']).toBe(2);
            expect(report.byComponent['Comp2']).toBe(1);
        });
    });
});
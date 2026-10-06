import { describe, expect, it, vi } from 'vitest';
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

  it('createSafeSetter должен блокировать setState после unmount', async () => {
    const engine = new LeakGuardEngine('development');
    const component = {};
    const originalSetter = vi.fn();
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    engine.register(component);
    const safeSetter = engine.createSafeSetter(component, originalSetter, 'TestComp');

    safeSetter(42);
    expect(originalSetter).toHaveBeenCalledWith(42);

    engine.unregister(component);

    safeSetter(100);
    expect(originalSetter).toHaveBeenCalledTimes(1);

    // Ждем, чтобы асинхронный warning сработал внутри этого теста
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
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

  it('getReport должен возвращать корректную статистику утечек (через LeakBuffer)', async () => {
    const engine = new LeakGuardEngine('development');
    const component = {};
    const originalSetter = vi.fn();
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    engine.register(component);
    const safeSetter = engine.createSafeSetter(component, originalSetter, 'TestComp');

    engine.unregister(component);
    safeSetter(1);

    // Ждем, чтобы асинхронный warning и запись в буфер завершились
    await new Promise((resolve) => setTimeout(resolve, 20));

    const report = engine.getReport();

    // Проверяем структуру, которую возвращает твой LeakBuffer
    expect(report.totalLeaks).toBe(1);
    expect(report.byComponent['TestComp']).toBe(1);
    expect(report.byOperation['setState']).toBe(1);
    expect(Array.isArray(report.leaks)).toBe(true); // LeakBuffer возвращает массив leaks в dev-режиме

    consoleWarnSpy.mockRestore();
  });

  it('createSafeSetter должен позволять обновления после unmount если allowPostUnmount=true', () => {
    const engine = new LeakGuardEngine('development');
    const component = {};
    const originalSetter = vi.fn();

    engine.register(component);
    const safeSetter = engine.createSafeSetter(
      component,
      originalSetter,
      'TestComp',
      true, // allowPostUnmount
    );

    safeSetter(42);
    expect(originalSetter).toHaveBeenCalledWith(42);

    engine.unregister(component);

    safeSetter(100);
    expect(originalSetter).toHaveBeenCalledTimes(2);
  });

  it('должен отменять предупреждения при быстром ремонтировании (React StrictMode)', async () => {
    const engine = new LeakGuardEngine('development');
    const component = {};
    const originalSetter = vi.fn();
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // 1. Первый маунт
    engine.register(component);
    const safeSetter = engine.createSafeSetter(component, originalSetter, 'StrictComp');

    // 2. Первый анмаунт (StrictMode)
    engine.unregister(component);

    // Пытаемся обновить состояние (должно отложить warning)
    safeSetter(1);

    // 3. Мгновенный ремонт (StrictMode)
    engine.register(component);

    // Ждем выполнения микрозадач и таймеров
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Warning НЕ должен был сработать, так как компонент "воскрес"
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it('должен выводить красную ошибку (console.error) в strict режиме, но не ронять приложение', () => {
    const engine = new LeakGuardEngine('development', true); // strict = true
    const component = {};
    const originalSetter = vi.fn();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    engine.register(component);
    const safeSetter = engine.createSafeSetter(component, originalSetter, 'StrictComp');

    engine.unregister(component);

    // Вызов НЕ должен выбросить ошибку (приложение не падает)
    expect(() => safeSetter(1)).not.toThrow();

    // Но должен вывести красное сообщение в консоль
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[LeakGuard] 🚨 BLOCKED setState on unmounted component "StrictComp".',
      ),
    );

    // И оригинальный setter НЕ должен быть вызван
    expect(originalSetter).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('должен поддерживать режим disableInProduction для нулевого оверхеда', () => {
    // Создаем движок с disableInProduction = true
    const engine = new LeakGuardEngine('production', false, true);

    expect(engine.disableInProduction).toBe(true);
    expect(engine.mode).toBe('production');
  });
});

import { describe, expect, it, vi } from 'vitest';
import React, { useEffect } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { LeakGuardProvider, useLeakGuard } from '../useLeakGuard';
import { useSafeState } from '../useSafeState';
import { useSafeTimeout } from '../useSafeTimeout';
import { useSafeEventListener } from '../useSafeEventListener';
import { useSafeWebSocket } from '../useSafeWebSocket';

describe('React Hooks', () => {
  it('useSafeState должен работать как обычный useState при монтировании', () => {
    function TestComponent() {
      const ref = useLeakGuard('TestComponent');
      const [count, setCount] = useSafeState(ref, 'TestComponent', 0);
      return (
        <div>
          <span data-testid="count">{count}</span>
          <button data-testid="btn" onClick={() => setCount(1)}>
            Update
          </button>
        </div>
      );
    }

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('count').textContent).toBe('0');

    act(() => {
      fireEvent.click(getByTestId('btn'));
    });

    expect(getByTestId('count').textContent).toBe('1');
  });

  it('useSafeState должен блокировать обновления после размонтирования (симуляция утечки)', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setterRef: { current: (() => void) | null } = { current: null };

    function TestComponent() {
      const ref = useLeakGuard('TestComponentCapture');
      const [, setCount] = useSafeState(ref, 'TestComponentCapture', 0);

      useEffect(() => {
        setterRef.current = () => setCount(999);
      }, [setCount]);

      return <div>Test</div>;
    }

    const { unmount } = render(<TestComponent />);
    unmount();

    if (setterRef.current) {
      act(() => {
        setterRef.current!();
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('BLOCKED setState on unmounted component'),
    );

    consoleWarnSpy.mockRestore();
  });

  it('useLeakGuard должен корректно монтировать и размонтировать компонент без ошибок', () => {
    function TestComponent() {
      useLeakGuard('LifecycleTest');
      return <div data-testid="lifecycle">OK</div>;
    }

    const { getByTestId, unmount } = render(<TestComponent />);
    expect(getByTestId('lifecycle').textContent).toBe('OK');

    expect(() => unmount()).not.toThrow();
  });

  it('useSafeState должен работать через LeakGuardProvider без явной передачи ref', () => {
    function ContextChild() {
      const [count, setCount] = useSafeState('ContextChild', 0);
      return (
        <div>
          <span data-testid="context-count">{count}</span>
          <button data-testid="context-btn" onClick={() => setCount((c: number) => c + 1)}>
            Inc
          </button>
        </div>
      );
    }

    const { getByTestId } = render(
      <LeakGuardProvider componentName="Parent">
        <ContextChild />
      </LeakGuardProvider>,
    );

    expect(getByTestId('context-count').textContent).toBe('0');

    act(() => {
      fireEvent.click(getByTestId('context-btn'));
    });

    expect(getByTestId('context-count').textContent).toBe('1');
  });

  it('useSafeTimeout должен работать через LeakGuardProvider и предотвращать выполнение колбэка после unmount', async () => {
    vi.useFakeTimers();
    const mockCallback = vi.fn();

    function ContextChild() {
      // Используем БЕЗ явного ref, берем из контекста
      useSafeTimeout(mockCallback, 1000);
      return <div>Test</div>;
    }

    const { unmount } = render(
      <LeakGuardProvider componentName="TimerParent">
        <ContextChild />
      </LeakGuardProvider>,
    );

    // 1. Размонтируем компонент ДО того, как таймер сработает
    unmount();

    // 2. Проматываем время вперед (таймер должен был сработать)
    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();

    // 3. ГЛАВНАЯ ПРОВЕРКА: Колбэк НЕ должен был быть вызван,
    // потому что useSafeTimeout автоматически вызвал clearTimeout при unmount!
    expect(mockCallback).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('useSafeEventListener должен автоматически очищать слушатель при unmount через контекст', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    function ContextChild() {
      const handler = () => {};
      useSafeEventListener(window, 'resize', handler);
      return <div>Test</div>;
    }

    const { unmount } = render(
      <LeakGuardProvider componentName="EventParent">
        <ContextChild />
      </LeakGuardProvider>,
    );

    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function), undefined);

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function), undefined);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('useSafeWebSocket должен работать через LeakGuardProvider и закрывать соединение при unmount', () => {
    const mockWebSocket = {
      close: vi.fn(),
      readyState: 1, // OPEN
    };
    vi.spyOn(global, 'WebSocket').mockImplementation(() => mockWebSocket as any);

    function ContextChild() {
      useSafeWebSocket('ws://localhost:8080');
      return <div>Test</div>;
    }

    const { unmount } = render(
      <LeakGuardProvider componentName="WebSocketParent">
        <ContextChild />
      </LeakGuardProvider>,
    );

    unmount();

    expect(mockWebSocket.close).toHaveBeenCalledWith(
      1000,
      'Component unmounted - LeakGuard cleanup',
    );
  });

  it('useSafeWebSocket должен работать через LeakGuardProvider и закрывать соединение при unmount', () => {
    const mockWebSocket = {
      close: vi.fn(),
      readyState: 1, // OPEN
    };

    // Создаем полный мок WebSocket с конструктором
    const MockWebSocket = vi.fn(() => mockWebSocket);

    // Используем stubGlobal для надёжной подмены
    vi.stubGlobal('WebSocket', MockWebSocket);

    function ContextChild() {
      useSafeWebSocket('ws://localhost:8080');
      return <div>Test</div>;
    }

    const { unmount } = render(
      <LeakGuardProvider componentName="WebSocketParent">
        <ContextChild />
      </LeakGuardProvider>,
    );

    unmount();

    expect(mockWebSocket.close).toHaveBeenCalledWith(
      1000,
      'Component unmounted - LeakGuard cleanup',
    );

    // Очистка мока
    vi.unstubAllGlobals();
  });
});

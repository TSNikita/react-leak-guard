import { describe, expect, it, vi } from 'vitest';
import React, { useEffect } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { LeakGuardProvider, useLeakGuard } from '../useLeakGuard';
import { useSafeState } from '../useSafeState';

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

    // Используем безопасный объект-обертку вместо let, чтобы TypeScript не ругался на null
    const setterRef: { current: (() => void) | null } = { current: null };

    function TestComponent() {
      const ref = useLeakGuard('TestComponentCapture');
      // ИСПРАВЛЕНИЕ: используем [, setCount], чтобы не объявлять неиспользуемую переменную count
      const [, setCount] = useSafeState(ref, 'TestComponentCapture', 0);

      useEffect(() => {
        // Сохраняем функцию, которая попытается обновить состояние
        setterRef.current = () => setCount(999);
      }, [setCount]);

      return <div>Test</div>;
    }

    const { unmount } = render(<TestComponent />);

    // 1. Размонтируем компонент
    unmount();

    // 2. Пытаемся обновить состояние ПОСЛЕ размонтирования
    if (setterRef.current) {
      act(() => {
        // '!' говорит TypeScript: "Я проверил выше, что это не null, доверяй мне"
        setterRef.current!();
      });
    }

    // 3. Ждем, чтобы асинхронный warning сработал (из-за setTimeout(..., 0) в engine.ts)
    await new Promise((resolve) => setTimeout(resolve, 20));

    // 4. Проверяем, что LeakGuard перехватил попытку и вывел предупреждение
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

    // Проверка, что размонтирование не вызывает исключений
    expect(() => unmount()).not.toThrow();
  });

  it('useSafeState должен работать через LeakGuardProvider без явной передачи ref', () => {
    function ContextChild() {
      // Используем хук БЕЗ явной передачи ref, он возьмет его из контекста
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
});

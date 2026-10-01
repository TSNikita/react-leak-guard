import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { useLeakGuard } from '../useLeakGuard';
import { useSafeState } from '../useSafeState';

// Обычный компонент для тестов нормальной работы
function TestComponent({ onUnmount }: { onUnmount?: () => void }) {
    const ref = useLeakGuard('TestComponent');
    const [count, setCount] = useSafeState(ref, 'TestComponent', 0);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setCount(999);
        }, 100);

        return () => {
            clearTimeout(timer); // Здесь мы делаем всё правильно
            onUnmount?.();
        };
    }, [setCount]);

    return (
        <div>
            <span data-testid="count">{count}</span>
            <button data-testid="btn" onClick={() => setCount(c => c + 1)}>
                Increment
            </button>
        </div>
    );
}

// Специальный компонент, который НАМЕРЕННО допускает утечку (забывает clearTimeout)
function LeakyTestComponent({ onUnmount }: { onUnmount?: () => void }) {
    const ref = useLeakGuard('LeakyComponent');
    const [count, setCount] = useSafeState(ref, 'LeakyComponent', 0);

    React.useEffect(() => {
        // Намеренно НЕ очищаем таймер, чтобы симулировать утечку памяти
        setTimeout(() => {
            setCount(999); // Эта попытка должна быть заблокирована библиотекой!
        }, 100);

        return () => {
            onUnmount?.();
        };
    }, [setCount]);

    return <span data-testid="count">{count}</span>;
}

describe('React Hooks', () => {
    it('useSafeState должен работать как обычный useState при монтировании', () => {
        const { getByTestId } = render(<TestComponent />);

        expect(getByTestId('count').textContent).toBe('0');

        act(() => {
            fireEvent.click(getByTestId('btn'));
        });

        expect(getByTestId('count').textContent).toBe('1');
    });

    it('useSafeState должен блокировать обновления после размонтирования (симуляция утечки)', async () => {
        const onUnmount = vi.fn();
        // Шпионим за console.warn, чтобы поймать сообщение от LeakGuard
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { unmount } = render(<LeakyTestComponent onUnmount={onUnmount} />);

        // Размонтируем компонент ДО того, как сработает setTimeout (100мс)
        unmount();

        expect(onUnmount).toHaveBeenCalledTimes(1);

        // Ждем 150мс, чтобы убедиться, что "забытый" setTimeout сработал
        await new Promise(resolve => setTimeout(resolve, 150));

        // Проверяем, что LeakGuard перехватил попытку обновления и вывел предупреждение
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('BLOCKED setState on unmounted component')
        );

        // Очищаем шпиона
        consoleWarnSpy.mockRestore();
    });

    it('useLeakGuard должен корректно регистрировать и удалять компонент', () => {
        const { unmount, rerender } = render(<TestComponent />);

        rerender(<TestComponent />);

        unmount();
    });
});
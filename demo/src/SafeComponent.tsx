import React, { useState, useEffect } from 'react';
import { useLeakGuard, useSafeState, useSafeTimeout } from 'react-leak-guard';

export function SafeComponent() {
    const componentRef = useLeakGuard('SafeComponent');
    const [count, setCount] = useSafeState(componentRef, 'SafeComponent', 0);
    const safeSetTimeout = useSafeTimeout(componentRef);
    const [timeLeft, setTimeLeft] = useState(5);

    useEffect(() => {
        // Обратный отсчет для визуализации
        const countdown = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        // НАМЕРЕННАЯ УТЕЧКА: таймер сработает через 5 секунд
        safeSetTimeout(() => {
            console.log('🟢 SafeComponent: Таймер сработал, но обновление состояния заблокировано LeakGuard!');
            setCount(999);
        }, 5000);

        return () => {
            clearInterval(countdown);
            // ВАЖНО: мы НЕ очищаем safeSetTimeout, чтобы симулировать утечку!
        };
    }, [safeSetTimeout, setCount]);

    return (
        <div style={{ padding: '20px', border: '2px solid #22c55e', borderRadius: '8px', background: '#f0fdf4' }}>
            <h3>🟢 Safe Component (с react-leak-guard)</h3>
            <p>Count: {count}</p>
            <p style={{ fontSize: '14px', color: '#15803d', fontWeight: 'bold' }}>
                ⏱️ Таймер сработает через: {timeLeft} сек
            </p>
            <p style={{ fontSize: '13px', color: '#15803d' }}>
                Нажми <b>"Скрыть"</b> до того, как таймер дойдет до 0. В консоли появится предупреждение LeakGuard, а React НЕ выдаст ошибку.
            </p>
        </div>
    );
}
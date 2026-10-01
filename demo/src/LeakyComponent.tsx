import React, { useState, useEffect } from 'react';

export function LeakyComponent() {
    const [count, setCount] = useState(0);
    const [timeLeft, setTimeLeft] = useState(5);

    useEffect(() => {
        // Обратный отсчет для визуализации
        const countdown = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        // НАМЕРЕННАЯ УТЕЧКА: таймер сработает через 5 секунд
        const timer = setTimeout(() => {
            console.log('🔴 LeakyComponent: Таймер сработал после размонтирования! Попытка обновления состояния...');
            setCount(999);
        }, 5000);

        return () => {
            clearInterval(countdown);
            // ВАЖНО: мы НЕ очищаем timer, чтобы симулировать утечку!
        };
    }, []);

    return (
        <div style={{ padding: '20px', border: '2px solid #ef4444', borderRadius: '8px', marginBottom: '20px', background: '#fef2f2' }}>
            <h3>🔴 Leaky Component (Обычный React)</h3>
            <p>Count: {count}</p>
            <p style={{ fontSize: '14px', color: '#b91c1c', fontWeight: 'bold' }}>
                ⏱️ Таймер сработает через: {timeLeft} сек
            </p>
            <p style={{ fontSize: '13px', color: '#b91c1c' }}>
                Нажми <b>"Скрыть"</b> до того, как таймер дойдет до 0. В консоли появится красное предупреждение React.
            </p>
        </div>
    );
}
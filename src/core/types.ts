/**
 * Типы отслеживаемых асинхронных операций
 */
export type OperationType = 'setState' | 'fetch' | 'timer' | 'interval' | 'event' | 'animation' | 'custom';

/**
 * Интерфейс отслеживаемой операции
 */
export interface TrackedOperation {
    id: string;
    type: OperationType;
    cleanup: () => void;
    source: string; // Стек вызовов или имя источника
}

/**
 * Состояние компонента в реестре движка
 */
export interface ComponentState {
    isMounted: boolean;
    operations: Map<string, TrackedOperation>;
    leakCount: number;
}

/**
 * Запись об обнаруженной утечке
 */
export interface LeakRecord {
    component: string;
    operation: OperationType;
    stack: string;
    timestamp: number;
}

/**
 * Агрегированный отчет об утечках
 */
export interface LeakReport {
    totalLeaks: number;
    byComponent: Record<string, number>;
    byOperation: Record<string, number>;
    leaks: LeakRecord[];
}

export type LeakGuardMode = 'development' | 'production';
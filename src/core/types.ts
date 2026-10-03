export type OperationType =
  | 'setState'
  | 'fetch'
  | 'timer'
  | 'interval'
  | 'event'
  | 'animation'
  | 'websocket'
  | 'worker'
  | 'custom';

export interface TrackedOperation {
  id?: string; // <-- Сделали опциональным, так как движок генерирует ключ сам
  type: OperationType;
  cleanup?: () => void;
  source?: string;
}

export interface ComponentState {
  isMounted: boolean;
  operations: Map<string, TrackedOperation>;
  leakCount: number;
  name?: string;
}

export interface LeakRecord {
  component: string;
  operation: string;
  stack: string;
  timestamp: number;
}

export interface LeakReport {
  totalLeaks: number;
  byComponent: Record<string, number>;
  byOperation: Record<string, number>;
  leaks?: LeakRecord[];
}

export type LeakGuardMode = 'development' | 'production';

import { LeakGuardMode, LeakRecord, LeakReport } from './types';

/**
 * Легковесный буфер для агрегации статистики утечек в памяти.
 * Защищен от собственных утечек памяти через ограничение максимального размера.
 */
export class LeakBuffer {
  private records: LeakRecord[] = [];
  private readonly maxSize: number;
  private readonly mode: LeakGuardMode;

  constructor(mode: LeakGuardMode, maxSize = 1000) {
    this.mode = mode;
    this.maxSize = maxSize;
  }

  public record(leak: LeakRecord): void {
    this.records.push(leak);

    // Защита от утечки памяти в самом буфере (кольцевой буфер)
    if (this.records.length > this.maxSize) {
      this.records = this.records.slice(-this.maxSize);
    }
  }

  public getReport(): LeakReport {
    const byComponent: Record<string, number> = {};
    const byOperation: Record<string, number> = {};

    this.records.forEach((record) => {
      byComponent[record.component] = (byComponent[record.component] || 0) + 1;
      byOperation[record.operation] = (byOperation[record.operation] || 0) + 1;
    });

    return {
      totalLeaks: this.records.length,
      byComponent,
      byOperation,
      // В продакшене не отдаем полные стеки вызовов для экономии памяти
      leaks: this.mode === 'development' ? [...this.records] : [],
    };
  }

  public clear(): void {
    this.records = [];
  }
}

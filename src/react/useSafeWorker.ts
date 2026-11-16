import { useEffect, useState, useContext } from 'react';
import { globalEngine } from '../core/engine';
import { LeakGuardContext } from './LeakGuardContext';

// Перегрузка 1: Явный режим
export function useSafeWorker(
  componentRef: object,
  workerUrl: string | URL,
  options?: WorkerOptions,
): Worker | null;

// Перегрузка 2: Контекстный режим
export function useSafeWorker(workerUrl: string | URL, options?: WorkerOptions): Worker | null;

// Реализация
export function useSafeWorker(
  arg1: object | string | URL,
  arg2?: string | URL | WorkerOptions,
  arg3?: WorkerOptions,
): Worker | null {
  let componentRef: object;
  let workerUrl: string | URL;
  let options: WorkerOptions | undefined;

  if (typeof arg1 === 'string' || arg1 instanceof URL) {
    // Контекстный режим
    componentRef = useContext(LeakGuardContext)!;
    if (!componentRef) {
      throw new Error(
        'useSafeWorker: componentRef not found. Wrap your app in <LeakGuardProvider>.',
      );
    }
    workerUrl = arg1;
    options = arg2 as WorkerOptions | undefined;
  } else {
    // Явный режим
    componentRef = arg1;
    workerUrl = arg2 as string | URL;
    options = arg3;
  }

  const [worker, setWorker] = useState<Worker | null>(null);

  // ОПТИМИЗАЦИЯ: В продакшене с disableInProduction используем нативный Worker
  if (globalEngine.disableInProduction && globalEngine.mode === 'production') {
    useEffect(() => {
      const worker = new Worker(workerUrl, options);
      setWorker(worker);
      return () => {
        worker.terminate();
      };
    }, [workerUrl, options]);
    return worker;
  }

  useEffect(() => {
    const worker = new Worker(workerUrl, options);
    setWorker(worker);

    let terminated = false;
    const terminate = () => {
      if (!terminated) {
        terminated = true;
        worker.terminate();
      }
    };
    const operationId = globalEngine.trackOperation(componentRef, {
      type: 'worker',
      cleanup: terminate,
      source: 'useSafeWorker',
    });

    return () => {
      terminate();
      if (operationId) {
        globalEngine.untrackOperation(componentRef, operationId);
      }
    };
  }, [workerUrl, options, componentRef]);

  return worker;
}

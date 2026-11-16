import { useContext, useEffect, useState } from 'react';
import { globalEngine } from '../core/engine';
import { LeakGuardContext } from './LeakGuardContext';

// WebSocket readyState constants (для надёжности при мокировании)
const WS_CONNECTING = 0;
const WS_OPEN = 1;

// Перегрузка 1: Явный режим
export function useSafeWebSocket(
  componentRef: object,
  url: string,
  protocols?: string | string[],
): WebSocket | null;

// Перегрузка 2: Контекстный режим
export function useSafeWebSocket(url: string, protocols?: string | string[]): WebSocket | null;

// Реализация
export function useSafeWebSocket(
  arg1: object | string,
  arg2?: string | string[],
  arg3?: string | string[],
): WebSocket | null {
  let componentRef: object;
  let url: string;
  let protocols: string | string[] | undefined;

  if (typeof arg1 === 'string') {
    componentRef = useContext(LeakGuardContext)!;
    if (!componentRef) {
      throw new Error(
        'useSafeWebSocket: componentRef not found. Wrap your app in <LeakGuardProvider>.',
      );
    }
    url = arg1;
    protocols = arg2 as string | string[] | undefined;
  } else {
    componentRef = arg1;
    url = arg2 as string;
    protocols = arg3;
  }

  const [ws, setWebSocket] = useState<WebSocket | null>(null);

  // ОПТИМИЗАЦИЯ: В продакшене с disableInProduction используем нативный WebSocket
  if (globalEngine.disableInProduction && globalEngine.mode === 'production') {
    useEffect(() => {
      const ws = new WebSocket(url, protocols);
      setWebSocket(ws);
      return () => {
        if (ws.readyState === WS_OPEN || ws.readyState === WS_CONNECTING) {
          ws.close(1000, 'Component unmounted');
        }
      };
    }, [url, protocols]);
    return ws;
  }

  useEffect(() => {
    const ws = new WebSocket(url, protocols);
    setWebSocket(ws);

    let closed = false;
    const operationId = globalEngine.trackOperation(componentRef, {
      type: 'websocket',
      cleanup: () => {
        if (!closed && (ws.readyState === WS_OPEN || ws.readyState === WS_CONNECTING)) {
          closed = true;
          ws.close(1000, 'Component unmounted - LeakGuard cleanup');
        }
      },
      source: 'useSafeWebSocket',
    });

    return () => {
      if (!closed && (ws.readyState === WS_OPEN || ws.readyState === WS_CONNECTING)) {
        closed = true;
        ws.close(1000, 'Component unmounted');
      }
      if (operationId) {
        globalEngine.untrackOperation(componentRef, operationId);
      }
    };
  }, [url, protocols, componentRef]);

  return ws;
}

import React, { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useLeakGuard, useSafeWebSocket, useSafeWorker } from '../../index';

afterEach(() => vi.unstubAllGlobals());

describe('resource hooks', () => {
  it('exposes resources after creation and cleans them up on unmount', async () => {
    const socket = { readyState: 1, close: vi.fn() };
    const worker = { terminate: vi.fn() };
    vi.stubGlobal(
      'WebSocket',
      vi.fn(function () {
        return socket;
      }),
    );
    vi.stubGlobal(
      'Worker',
      vi.fn(function () {
        return worker;
      }),
    );
    const seen: Array<[WebSocket | null, Worker | null]> = [];
    function Component() {
      const guard = useLeakGuard('Component');
      const ws = useSafeWebSocket(guard, 'ws://localhost');
      const w = useSafeWorker(guard, '/worker.js');
      useEffect(() => {
        seen.push([ws, w]);
      }, [ws, w]);
      return <div>{ws && w ? 'ready' : 'loading'}</div>;
    }
    const view = render(<Component />);
    await waitFor(() => expect(view.getByText('ready')).toBeTruthy());
    expect(seen[0]).toEqual([null, null]);
    expect(seen.at(-1)).toEqual([socket, worker]);
    view.unmount();
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(worker.terminate).toHaveBeenCalled();
  });
});

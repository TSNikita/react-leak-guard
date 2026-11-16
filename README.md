# React Leak Guard

React hooks and utilities for associating asynchronous operations with a component's lifetime. The library can clear timers and event listeners, abort tracked requests, and block tracked state updates after a registered component unmounts. Its hooks run in production as well as development.

It only manages operations registered through its API. It is not a general memory profiler, and a state update after unmount does not by itself prove a memory leak.

## Installation

```bash
npm install react-leak-guard
```

React 16.8 or later is declared as a peer dependency.

## Getting started

Register each component whose lifetime should control its operations, then pass the returned reference to the hooks:

```tsx
import { useCallback } from 'react';
import { useLeakGuard, useSafeState, useSafeTimeout } from 'react-leak-guard';

function Counter() {
  const guard = useLeakGuard('Counter');
  const [count, setCount] = useSafeState(guard, 'Counter', 0);
  const increment = useCallback(() => setCount(value => value + 1), [setCount]);

  useSafeTimeout(guard, increment, 1000);

  return <div>{count}</div>;
}
```

`useLeakGuard` registers the reference in an effect and unregisters it during cleanup. The engine calls cleanup functions for operations still tracked under that reference. The timeout hook also clears its own timer when its effect is cleaned up. A changing callback or delay restarts the timeout; use a stable callback when that is not desired.

## Hooks

### `useLeakGuard(componentName)`

Returns a stable object identifying the component to the global engine. Pass it to the explicit-reference forms below. Registration occurs in an effect, so invoke tracked operations after registration, such as in an effect declared after `useLeakGuard` or in a user event.

### `useSafeState`

```tsx
const [value, setValue] = useSafeState(guard, 'Counter', 0);
// Also supports a lazy initial value and functional updates.
```

The setter checks whether the registered reference is mounted. By default it blocks calls after unregistration and records them in the engine's report. `useSafeState(guard, name, initialValue, { allowPostUnmount: true })` instead forwards those calls to React. This does not cancel the work that called the setter.

### `useSafeTimeout`

```tsx
useSafeTimeout(guard, callback, 1000);
```

Schedules a timeout and clears it on effect cleanup. Changes to the callback or delay recreate the timer.

### `useSafeInterval`

```tsx
const startInterval = useSafeInterval(guard);

useEffect(() => {
  const id = startInterval(() => console.log('tick'), 1000);
  return () => window.clearInterval(id);
}, [startInterval]);
```

Returns a function that starts an interval and registers its cleanup with the engine. The returned ID can also be cleared manually. The hook does not unregister a manually cleared interval from the engine, so its cleanup may be called again on unmount.

### `useSafeEventListener`

```tsx
useSafeEventListener(guard, window, 'resize', handleResize);
// Optional final argument: event listener options or capture boolean.
```

Adds the listener in an effect and removes it when the effect is cleaned up. As with ordinary effects, changes to the target, listener, event type or options cause reattachment. Access browser globals only where they are available; for server rendering, pass a suitable target once running in the browser.

### `useSafeFetch`

```tsx
const safeFetch = useSafeFetch(guard);

useEffect(() => {
  safeFetch('/api/data')
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => {
      if (error.name !== 'AbortError') console.error(error);
    });
}, [safeFetch]);
```

Each call creates an `AbortController` and registers its `abort()` function with the engine. The request is removed from tracking when `fetch` resolves or rejects. Since `fetch` can resolve before the response body has been consumed, body reading after that point is not covered by the engine's cleanup. The hook replaces any `signal` provided in `init` with its own signal. Handle rejected requests, including `AbortError`.

## Context mode

`LeakGuardProvider` creates a single guard reference and makes it available to descendant hooks that support context mode:

```tsx
<LeakGuardProvider componentName="Section">
  <SectionContents />
</LeakGuardProvider>
```

Within the provider, `useSafeState(name, initialValue)`, `useSafeTimeout(callback, delay)` and `useSafeEventListener(target, type, listener, options?)` can omit the reference. `useSafeFetch` and `useSafeInterval` require an explicit reference.

The context reference belongs to the **provider**, not independently to each child. Operations tracked against it are tied to the provider's lifetime. In particular, a child's safe state setter can still be considered mounted after that child unmounts if the provider remains mounted. Timeout and event listener hooks additionally clean up their own effects. Use `useLeakGuard` in the component itself when its own lifetime must control tracked operations.

## Reports and configuration

```ts
import { globalEngine } from 'react-leak-guard';

const report = globalEngine.getReport();
console.log(report.totalLeaks, report.byComponent, report.byOperation);
```

The report counts recorded blocked setter calls, not confirmed memory leaks. It retains up to 1,000 records. In production mode it returns aggregate counts; detailed records are returned in development mode.

The exported `globalEngine` is constructed in production mode except when `NODE_ENV` is `test`, when it uses development mode. Development mode can log blocked setter calls; setting `globalEngine.strict = true` selects error logging instead of warnings. In the default production mode those warnings are not emitted.

`globalEngine.disableInProduction = true` enables alternate paths in `useSafeState`, `useSafeTimeout`, and `useSafeEventListener`: the state hook returns the native setter, while timeout and event-listener hooks still clean up through their effects. It does not disable all hooks or guarantee zero overhead. Configure it before rendering and keep it stable during a component's lifetime.

`globalEngine.setTestingMode(true)` disables engine registration, tracking and setter checks; it resets the registry. This is different from merely running with `NODE_ENV=test`. Hooks with their own effect cleanup still perform that cleanup. Set it back to `false` when engine behavior needs to be tested.

On the server the engine skips registration and tracking and returns the original setter. Effects do not run during server rendering.

## Other exports

- `withLeakGuard(Component, name)` wraps a component, registers a guard and passes it as the `leakGuardRef` prop. The wrapped component must use that reference for tracked operations; wrapping alone does not clean up arbitrary work.
- `LeakGuardEngine`, `LeakBuffer` and associated TypeScript types are exported for advanced use. The React hooks use the shared `globalEngine`.

WebSocket and Worker hooks exist in the source tree but are not currently exported by the package entry point, so they are not part of the public API described here.

## Development

```bash
npm install
npm run test:run
npm run lint
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md). The package metadata declares the MIT license; the repository currently does not contain a separate license file.

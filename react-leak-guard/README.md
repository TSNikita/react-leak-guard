# 🛡️ react-leak-guard

> **Automatic memory leak prevention for React applications**
> Runtime detection · Auto-cleanup · Production diagnostics

⚠️ **Patent Pending** — The core technology described in this repository is subject to a pending patent application.

---

## 🤔 Why?

Memory leaks in React are a silent killer of SPA performance. A single forgotten `clearInterval` or uncancelled `fetch` can cause a tab to consume 2GB+ of RAM and eventually crash.

**react-leak-guard** automatically catches all types of leaks — fetch, timers, event listeners, and stale setState calls — with zero boilerplate and <1% overhead in production.

---

## ⚡ Quick Start

```bash


npm install react-leak-guard

import { useLeakGuard } from 'react-leak-guard';

function UserProfile({ userId }) {
  const { useSafeState, useSafeFetch } = useLeakGuard('UserProfile');
  const [user, setUser] = useSafeState(null);
  const safeFetch = useSafeFetch();

  useEffect(() => {
    // ✅ Auto-cancelled on unmount
    safeFetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => setUser(data)); // ✅ Blocked if unmounted
  }, [userId]);

  return <div>{user?.name}</div>;
}

┌─────────────────────────────────────────────┐
│              React Application              │
├─────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ComponentA│  │ComponentB│  │ComponentC│  │
│  │ (mount)  │  │ (mount)  │  │(unmount!)│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │        │
│       ▼              ▼              ▼        │
│  ┌─────────────────────────────────────┐     │
│  │     LeakGuard Runtime Engine        │     │
│  │  - LifecycleRegistry (WeakMap)      │     │
│  │  - StateUpdateProxy                 │     │
│  │  - AutoCleanup Engine               │     │
│  │  - LeakBuffer (diagnostics)         │     │
│  └─────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
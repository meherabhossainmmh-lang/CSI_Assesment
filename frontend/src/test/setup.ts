import '@testing-library/jest-dom/vitest';

// recharts' ResponsiveContainer needs ResizeObserver, absent in jsdom.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = ResizeObserverStub;

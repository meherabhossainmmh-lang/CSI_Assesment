import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface SourceFilterValue {
  /** '' means "All Sources". */
  source: string;
  setSource: (s: string) => void;
}

const SourceFilterContext = createContext<SourceFilterValue>({
  source: '',
  setSource: () => {},
});

/**
 * Change request FSE-01/03: one shared Production Source filter applied
 * consistently to the Summary (Dashboard), Pending and Exceptions views, and
 * preserved across navigation.
 */
export function SourceFilterProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState('');
  const value = useMemo(() => ({ source, setSource }), [source]);
  return <SourceFilterContext.Provider value={value}>{children}</SourceFilterContext.Provider>;
}

export function useSourceFilter(): SourceFilterValue {
  return useContext(SourceFilterContext);
}

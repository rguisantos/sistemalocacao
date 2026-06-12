'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => getQueryClient());
  return <QueryClientProvider client={client}>{children as any}</QueryClientProvider>;
}

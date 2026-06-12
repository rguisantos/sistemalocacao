'use client';
import { Shell } from '@/components/Shell';
import { Providers } from '../providers';

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <Shell>{children}</Shell>
    </Providers>
  );
}

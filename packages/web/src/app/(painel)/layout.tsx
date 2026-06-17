import { Providers } from '../providers';
import { PainelGuard } from '@/components/PainelGuard';

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <PainelGuard>{children}</PainelGuard>
    </Providers>
  );
}

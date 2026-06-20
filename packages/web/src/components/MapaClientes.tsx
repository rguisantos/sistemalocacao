'use client';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import type { PontoMapa } from './MapaClientesInterno';

export type { PontoMapa };

// react-leaflet não roda em SSR — carrega o mapa só no cliente.
const Interno = dynamic(() => import('./MapaClientesInterno'), {
  ssr: false,
  loading: () => <div className="h-[70vh] grid place-items-center text-suave border border-borda rounded-xl">Carregando mapa…</div>,
});

export function MapaClientes({ pontos }: { pontos: PontoMapa[] }) {
  return <Interno pontos={pontos} />;
}

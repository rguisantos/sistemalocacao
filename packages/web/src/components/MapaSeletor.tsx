'use client';
import dynamic from 'next/dynamic';
import { Botao } from '@/components/ui/primitives';

// react-leaflet não roda em SSR — carrega o mapa só no cliente.
const Interno = dynamic(() => import('./MapaSeletorInterno'), { ssr: false, loading: () => <div className="h-full grid place-items-center text-suave">Carregando mapa…</div> });

/** Seletor de coordenadas: clique/arraste no mapa ou use a localização do navegador. */
export function MapaSeletor({ latitude, longitude, onChange }: { latitude?: number; longitude?: number; onChange: (lat: number, lng: number) => void }) {
  const lat = latitude ?? -23.55, lng = longitude ?? -46.63;
  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => onChange(pos.coords.latitude, pos.coords.longitude));
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="h-64 rounded-xl overflow-hidden border border-borda">
        <Interno lat={lat} lng={lng} onChange={onChange} />
      </div>
      <div className="flex items-center justify-between text-sm text-suave">
        <span className="valor">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
        <Botao variante="secundario" onClick={usarMinhaLocalizacao}>Usar minha localização</Botao>
      </div>
    </div>
  );
}

'use client';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// react-leaflet não funciona em SSR — carrega só no cliente.
const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });

export interface PontoMapa { nome: string; lat: number; lng: number; detalhe?: string; }

export function MapaClientes({ pontos }: { pontos: PontoMapa[] }) {
  const centro: [number, number] = pontos[0] ? [pontos[0].lat, pontos[0].lng] : [-23.55, -46.63];
  return (
    <div className="h-[70vh] rounded-xl overflow-hidden border border-borda">
      <MapContainer center={centro} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
        {pontos.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]}>
            <Popup><strong>{p.nome}</strong>{p.detalhe ? <><br />{p.detalhe}</> : null}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

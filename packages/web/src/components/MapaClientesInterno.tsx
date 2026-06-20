'use client';
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';

// Ícone padrão do Leaflet (corrige assets quebrados em bundlers — pin "sem imagem").
const icone = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

export interface PontoMapa { nome: string; lat: number; lng: number; detalhe?: string; }

/** Botão "Perto de mim" — recentraliza o mapa na localização do navegador. */
function BotaoPertoDeMim() {
  const map = useMap();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (ref.current) { L.DomEvent.disableClickPropagation(ref.current); L.DomEvent.disableScrollPropagation(ref.current); }
  }, []);
  function localizar() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 15),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }
  return (
    <button ref={ref} onClick={localizar}
      className="absolute top-3 right-3 z-[500] bg-white text-tinta border border-borda rounded-lg shadow px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-papel transition">
      <LocateFixed size={14} className="text-latao" /> Perto de mim
    </button>
  );
}

export default function MapaClientesInterno({ pontos }: { pontos: PontoMapa[] }) {
  const centro: [number, number] = pontos[0] ? [pontos[0].lat, pontos[0].lng] : [-23.55, -46.63];
  return (
    // `isolate` cria um contexto de empilhamento próprio: os z-index internos do
    // Leaflet ficam contidos aqui e NÃO sobrepõem mais a sidebar (z-40).
    <div className="relative h-[70vh] rounded-xl overflow-hidden border border-borda isolate">
      <MapContainer center={centro} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
        {pontos.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]} icon={icone}>
            <Popup><strong>{p.nome}</strong>{p.detalhe ? <><br />{p.detalhe}</> : null}</Popup>
          </Marker>
        ))}
        <BotaoPertoDeMim />
      </MapContainer>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { MapaClientes, PontoMapa } from '@/components/MapaClientes';
import { Cartao } from '@/components/ui/primitives';

export default function Mapa() {
  const [pontos, setPontos] = useState<PontoMapa[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    // Pontos geolocalizados numa única chamada (escopada por rota no servidor).
    api.get('/clientes/mapa')
      .then((pts: PontoMapa[]) => { setPontos(pts); setCarregado(true); })
      .catch(() => setCarregado(true));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Mapa de clientes</h1>
      {carregado && pontos.length === 0
        ? <Cartao className="text-suave">Nenhum endereço com coordenadas ainda. Defina a localização ao cadastrar o endereço (Leaflet/GPS).</Cartao>
        : <MapaClientes pontos={pontos} />}
    </div>
  );
}

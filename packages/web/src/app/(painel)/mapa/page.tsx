'use client';
import { useState } from 'react';
import { useApi } from '@/lib/swr';
import { formatarBRL } from '@/lib/format';
import { Cartao, Select, Header, Badge, SkeletonCard, Botao } from '@/components/ui/primitives';
import { MapaClientes, PontoMapa } from '@/components/MapaClientes';
import { MapPin, Users, Filter, List } from 'lucide-react';
import Link from 'next/link';

export default function MapaPage() {
  const [rotaFiltro, setRotaFiltro] = useState('');
  const [mostrarLista, setMostrarLista] = useState(true);

  const { data: rotas } = useApi<any[]>('/rotas');
  const { data: pontos, isLoading } = useApi<PontoMapa[]>('/clientes/mapa' + (rotaFiltro ? `?rotaId=${rotaFiltro}` : ''));

  const pontosFiltrados = pontos ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Header titulo="Mapa de Clientes" subtitulo={`${pontosFiltrados.length} cliente${pontosFiltrados.length !== 1 ? 's' : ''} no mapa`}
        acoes={
          <div className="flex gap-2">
            <Select value={rotaFiltro} onChange={(e) => setRotaFiltro(e.target.value)} className="sm:w-48">
              <option value="">Todas as rotas</option>
              {(rotas ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </Select>
            <Botao variante="secundario" tamanho="sm" icon={List} onClick={() => setMostrarLista(!mostrarLista)}>
              {mostrarLista ? 'Ocultar lista' : 'Lista'}
            </Botao>
          </div>
        }
      />

      {isLoading ? (
        <SkeletonCard />
      ) : pontosFiltrados.length === 0 ? (
        <Cartao className="p-8 text-center">
          <MapPin size={48} className="mx-auto text-suave/40 mb-3" />
          <p className="text-suave font-medium">Nenhum endereço com coordenadas</p>
          <p className="text-xs text-suave mt-1">Defina a localização ao cadastrar o endereço do cliente (GPS ou mapa).</p>
        </Cartao>
      ) : (
        <div className="flex gap-4">
          {/* Mapa */}
          <div className={mostrarLista ? 'flex-1' : 'w-full'}>
            <MapaClientes pontos={pontosFiltrados} />
          </div>

          {/* Sidebar lista */}
          {mostrarLista && (
            <div className="hidden lg:block w-72 flex-shrink-0 max-h-[70vh] overflow-y-auto">
              <Cartao className="flex flex-col gap-2 p-3">
                <p className="text-xs text-suave uppercase tracking-wider font-medium mb-1">Clientes no mapa</p>
                {pontosFiltrados.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 py-2 border-b border-borda last:border-0">
                    <MapPin size={14} className="text-latao mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.nome}</p>
                      {p.detalhe && <p className="text-xs text-suave truncate">{p.detalhe}</p>}
                    </div>
                  </div>
                ))}
              </Cartao>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

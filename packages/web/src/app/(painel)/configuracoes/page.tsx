'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Botao, Campo, Cartao, Header, Select, toast } from '@/components/ui/primitives';
import { Settings, Moon, Sun, Monitor, Shield, Bell, Palette } from 'lucide-react';

export default function ConfiguracoesPage() {
  const { usuario } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [accessToken, setAccessToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [dias, setDias] = useState('');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  // Preferências locais
  const [tema, setTema] = useState('claro');
  const [notificacoes, setNotificacoes] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('tema') ?? 'claro';
    setTema(t);
  }, []);

  function salvarTema(novo: string) {
    setTema(novo);
    localStorage.setItem('tema', novo);
    document.documentElement.classList.toggle('dark', novo === 'escuro');
    toast('Tema atualizado!', 'sucesso');
  }

  const carregar = () => api.get('/integracao/config/status').then((s) => { setStatus(s); setDias(String(s.diasTolerancia)); }).catch(() => {});
  useEffect(() => { carregar(); }, []);

  async function salvar() {
    setErro(''); setMsg('');
    try {
      await api.post('/integracao/config', {
        accessToken: accessToken || undefined,
        webhookSecret: webhookSecret || undefined,
        diasTolerancia: dias ? Number(dias) : undefined,
      });
      setAccessToken(''); setWebhookSecret('');
      toast('Configurações salvas!', 'sucesso');
      carregar();
    } catch (e: any) { setErro(e.message); toast(e.message, 'erro'); }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Header titulo="Configurações" subtitulo="Preferências e integrações" />

      {/* Aparência */}
      <Cartao className="flex flex-col gap-4">
        <div className="flex items-center gap-2"><Palette size={18} className="text-latao" /><h2 className="font-display font-semibold">Aparência</h2></div>
        <p className="text-sm text-suave">Escolha o tema da interface.</p>
        <div className="flex gap-3">
          <button onClick={() => salvarTema('claro')} className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition ${tema === 'claro' ? 'border-latao bg-latao/10 text-latao font-medium' : 'border-borda text-suave hover:bg-papel'}`}>
            <Sun size={16} /> Claro
          </button>
          <button onClick={() => salvarTema('escuro')} className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition ${tema === 'escuro' ? 'border-latao bg-latao/10 text-latao font-medium' : 'border-borda text-suave hover:bg-papel'}`}>
            <Moon size={16} /> Escuro
          </button>
          <button onClick={() => { const pref = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'; salvarTema(pref); }} className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition ${tema !== 'claro' && tema !== 'escuro' ? 'border-latao bg-latao/10 text-latao font-medium' : 'border-borda text-suave hover:bg-papel'}`}>
            <Monitor size={16} /> Sistema
          </button>
        </div>
      </Cartao>

      {/* Conta */}
      <Cartao className="flex flex-col gap-4">
        <div className="flex items-center gap-2"><Shield size={18} className="text-latao" /><h2 className="font-display font-semibold">Conta</h2></div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-suave">Nome</p><p className="font-medium">{usuario?.nome}</p></div>
          <div><p className="text-suave">CPF</p><p className="font-medium font-ficha">{(usuario as any)?.cpfCnpj ? String((usuario as any).cpfCnpj).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***.$2') : '—'}</p></div>
        </div>
      </Cartao>

      {/* Mercado Pago */}
      <Cartao className="flex flex-col gap-4">
        <div className="flex items-center gap-2"><Bell size={18} className="text-latao" /><h2 className="font-display font-semibold">Mercado Pago (PIX)</h2></div>
        <p className="text-suave text-sm">Os segredos são criptografados e nunca são exibidos de volta.</p>
        {status && (
          <div className="text-sm flex gap-4">
            <span>Access token: <strong className={status.mercadoPagoConfigurado ? 'text-emerald-600' : 'text-alerta'}>{status.mercadoPagoConfigurado ? '✓ Configurado' : 'Pendente'}</strong></span>
            <span>Webhook: <strong className={status.webhookConfigurado ? 'text-emerald-600' : 'text-alerta'}>{status.webhookConfigurado ? '✓ Configurado' : 'Pendente'}</strong></span>
          </div>
        )}
        <Campo label="Novo access token (vazio = manter)" type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
        <Campo label="Novo webhook secret (vazio = manter)" type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
      </Cartao>

      <Cartao className="flex flex-col gap-3">
        <h2 className="font-display font-semibold">Notificações</h2>
        <Campo label="Dias de tolerância para cobrança percentual atrasada" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} />
      </Cartao>

      {erro && <p className="text-alerta text-sm">{erro}</p>}
      <div><Botao onClick={salvar} icon={Settings}>Salvar configurações</Botao></div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Botao, Campo, Cartao } from '@/components/ui/primitives';

export default function Configuracoes() {
  const [status, setStatus] = useState<any>(null);
  const [accessToken, setAccessToken] = useState(''); const [webhookSecret, setWebhookSecret] = useState('');
  const [dias, setDias] = useState(''); const [msg, setMsg] = useState(''); const [erro, setErro] = useState('');

  const carregar = () => api.get('/integracao/config/status').then((s) => { setStatus(s); setDias(String(s.diasTolerancia)); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  async function salvar() {
    setErro(''); setMsg('');
    try {
      await api.post('/integracao/config', {
        accessToken: accessToken || undefined,
        webhookSecret: webhookSecret || undefined,
        diasTolerancia: dias ? Number(dias) : undefined,
      });
      setAccessToken(''); setWebhookSecret(''); setMsg('Configurações salvas.'); carregar();
    } catch (e: any) { setErro(e.message); }
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <h1 className="font-display text-2xl font-bold">Configurações</h1>

      <Cartao className="flex flex-col gap-4">
        <div>
          <h2 className="font-display font-semibold">Mercado Pago (PIX)</h2>
          <p className="text-suave text-sm">Os segredos são criptografados e nunca são exibidos de volta.</p>
        </div>
        {status && (
          <div className="text-sm flex gap-4">
            <span>Access token: <strong className={status.mercadoPagoConfigurado ? 'text-feltro' : 'text-alerta'}>{status.mercadoPagoConfigurado ? 'configurado' : 'pendente'}</strong></span>
            <span>Webhook: <strong className={status.webhookConfigurado ? 'text-feltro' : 'text-alerta'}>{status.webhookConfigurado ? 'configurado' : 'pendente'}</strong></span>
          </div>
        )}
        <Campo label="Novo access token (deixe vazio para manter)" type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
        <Campo label="Novo webhook secret (deixe vazio para manter)" type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
      </Cartao>

      <Cartao className="flex flex-col gap-3">
        <h2 className="font-display font-semibold">Notificações</h2>
        <Campo label="Dias de tolerância para cobrança percentual atrasada" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} />
      </Cartao>

      {msg && <p className="text-feltro text-sm">{msg}</p>}
      {erro && <p className="text-alerta text-sm">{erro}</p>}
      <div><Botao onClick={salvar}>Salvar configurações</Botao></div>
    </div>
  );
}

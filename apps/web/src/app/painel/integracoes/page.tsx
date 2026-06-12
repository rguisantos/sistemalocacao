'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

interface Config {
  mercadopago: {
    accessToken: string;   // mascarado
    webhookSecret: string; // mascarado
    payerEmail: string;
    origem: { accessToken: string; webhookSecret: string };
  };
}

export default function IntegracoesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery({
    queryKey: ['integracoes'],
    queryFn: () => api<Config>('/api/configuracoes/integracoes'),
  });

  const [accessToken, setAccessToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (data) setPayerEmail(data.mercadopago.payerEmail);
  }, [data]);

  const salvar = useMutation({
    mutationFn: () =>
      api('/api/configuracoes/integracoes', {
        method: 'PUT',
        body: JSON.stringify({
          // campos vazios não são enviados → valores atuais permanecem
          ...(accessToken ? { accessToken } : {}),
          ...(webhookSecret ? { webhookSecret } : {}),
          ...(payerEmail ? { payerEmail } : {}),
        }),
      }),
    onSuccess: () => {
      setOk(true); setErro(''); setAccessToken(''); setWebhookSecret('');
      qc.invalidateQueries({ queryKey: ['integracoes'] });
      toast({ titulo: 'Configuração salva', descricao: 'Credenciais do Mercado Pago atualizadas.' });
      setTimeout(() => setOk(false), 4000);
    },
    onError: (e: Error) => { setErro(e.message); setOk(false); },
  });

  return (
    <div className="mx-auto max-w-2xl p-8">
      <PageHeader icone={CreditCard} titulo="Integrações de Pagamento"
        descricao="Credenciais do Mercado Pago — valores do painel têm precedência sobre o env" />

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="mb-4 font-bold text-foreground/90">Mercado Pago</h2>

        <label className="mb-1 block text-sm font-semibold text-foreground/80">Access Token</label>
        <p className="mb-1 text-xs text-muted-foreground">
          Atual: <code>{data?.mercadopago.accessToken || 'não configurado'}</code>
          {data && ` (origem: ${data.mercadopago.origem.accessToken})`}
        </p>
        <input type="password" className="mb-4 w-full rounded-lg border px-3 py-2"
          placeholder="Cole o novo token para substituir (deixe vazio para manter)"
          value={accessToken} onChange={(e) => setAccessToken(e.target.value)} autoComplete="off" />

        <label className="mb-1 block text-sm font-semibold text-foreground/80">Webhook Secret</label>
        <p className="mb-1 text-xs text-muted-foreground">
          Atual: <code>{data?.mercadopago.webhookSecret || 'não configurado'}</code>
          {data && ` (origem: ${data.mercadopago.origem.webhookSecret})`}
        </p>
        <input type="password" className="mb-4 w-full rounded-lg border px-3 py-2"
          placeholder="Cole o novo secret para substituir (deixe vazio para manter)"
          value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} autoComplete="off" />

        <label className="mb-1 block text-sm font-semibold text-foreground/80">E-mail do pagador (PIX)</label>
        <input type="email" className="mb-4 w-full rounded-lg border px-3 py-2"
          placeholder="cliente@exemplo.com"
          value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} />

        {erro && <p className="mb-3 text-sm text-destructive">{erro}</p>}
        {ok && <p className="mb-3 text-sm text-feltro">✓ Configurações salvas. Valem para as próximas cobranças (até 60s de cache).</p>}

        <button onClick={() => salvar.mutate()} disabled={salvar.isPending}
          className="rounded-lg bg-feltro px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Salvar
        </button>
        <p className="mt-4 text-xs text-muted-foreground">
          Os segredos nunca são exibidos por completo após salvos. A alteração é auditada
          (registra quem alterou e quais campos — nunca os valores).
        </p>
      </div>
    </div>
  );
}

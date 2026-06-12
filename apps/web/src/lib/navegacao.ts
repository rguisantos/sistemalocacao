// Fonte única da navegação do painel — usada pelo Shell (sidebar)
// e pela Command Palette (Ctrl+K).
import {
  LayoutDashboard, Users, FileText, AlertTriangle, Wallet, BarChart3,
  Package, MapPin, UserCog, CreditCard, GitMerge, ScrollText,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSOES } from '@locacoes/shared';

export interface ItemNav { href: string; rotulo: string; icone: LucideIcon; perm: string | null }
export interface GrupoNav { titulo: string; itens: ItemNav[] }

export const GRUPOS_NAV: GrupoNav[] = [
  {
    titulo: 'Operação',
    itens: [
      { href: '/painel', rotulo: 'Dashboard', icone: LayoutDashboard, perm: PERMISSOES.VISUALIZAR_RELATORIOS },
      { href: '/painel/clientes', rotulo: 'Clientes', icone: Users, perm: null },
      { href: '/painel/locacoes', rotulo: 'Locações', icone: FileText, perm: null },
      { href: '/painel/vencidas', rotulo: 'Vencidas', icone: AlertTriangle, perm: null },
      { href: '/painel/saldos', rotulo: 'Saldos Devedores', icone: Wallet, perm: null },
    ],
  },
  {
    titulo: 'Cadastros',
    itens: [
      { href: '/painel/produtos', rotulo: 'Produtos', icone: Package, perm: null },
      { href: '/painel/cadastros', rotulo: 'Rotas e Depósitos', icone: MapPin, perm: null },
    ],
  },
  {
    titulo: 'Administração',
    itens: [
      { href: '/painel/relatorios', rotulo: 'Relatórios', icone: BarChart3, perm: PERMISSOES.VISUALIZAR_RELATORIOS },
      { href: '/painel/usuarios', rotulo: 'Usuários', icone: UserCog, perm: PERMISSOES.GERENCIAR_USUARIOS },
      { href: '/painel/integracoes', rotulo: 'Integrações', icone: CreditCard, perm: PERMISSOES.GERENCIAR_INTEGRACOES_PAGAMENTO },
      { href: '/painel/conflitos', rotulo: 'Conflitos de Sync', icone: GitMerge, perm: PERMISSOES.VISUALIZAR_LOGS_AUDITORIA },
      { href: '/painel/auditoria', rotulo: 'Auditoria', icone: ScrollText, perm: PERMISSOES.VISUALIZAR_LOGS_AUDITORIA },
    ],
  },
];

import { calcularValorFixo, calcularPercentual, aplicarPagamento, recalcularSaldoLocacao } from '../src/calculo';
import { periodosDecorridos, vencidaPercentual, vencidaValorFixo, proximaDataPeriodo } from '../src/datas';

const dias = (n: number) => {
  const base = new Date('2025-01-01T12:00:00-03:00');
  return new Date(base.getTime() + n * 86_400_000);
};

describe('VALOR_FIXO', () => {
  test('A — cobrança cheia: 20 dias, semanal => 3 períodos, saldo zera', () => {
    const r = calcularValorFixo({
      valorFixo: 150, frequencia: 'SEMANAL',
      dataReferencia: dias(0), hoje: dias(20), saldoAnterior: 30,
    });
    expect(r.periodos).toBe(3);
    expect(r.valorLiquidoBase.toFixed(2)).toBe('450.00');
    expect(r.valorLiquidoFinal.toFixed(2)).toBe('480.00');
    const p = aplicarPagamento('VALOR_FIXO', r.valorLiquidoFinal, 480);
    expect(p.novoSaldo.toFixed(2)).toBe('0.00');
  });

  test('B — pagamento parcial deixa saldo de 80,00', () => {
    const r = calcularValorFixo({
      valorFixo: 150, frequencia: 'SEMANAL',
      dataReferencia: dias(0), hoje: dias(20), saldoAnterior: 30,
    });
    const p = aplicarPagamento('VALOR_FIXO', r.valorLiquidoFinal, 400);
    expect(p.novoSaldo.toFixed(2)).toBe('80.00');
  });

  test('G — haver maior que a cobrança gera líquido negativo', () => {
    const r = calcularValorFixo({
      valorFixo: 50, frequencia: 'MENSAL',
      dataReferencia: dias(0), hoje: dias(30), saldoAnterior: -80,
    });
    expect(r.valorLiquidoFinal.toFixed(2)).toBe('-30.00');
  });
});

describe('PERCENTUAL_A_RECEBER', () => {
  test('C — desconto de partidas + desconto no valor + haver anterior', () => {
    const r = calcularPercentual({
      regra: 'PERCENTUAL_A_RECEBER',
      contadorAnterior: 1000, contadorAtual: 1150,
      valorPartida: 1, percentual: 30,
      descontoPartidas: 10, descontoValorReceber: 2, saldoAnterior: -5,
    });
    expect(r.partidasConsideradas).toBe(140);
    expect(r.valorBruto!.toFixed(2)).toBe('140.00');
    expect(r.valorPercentual!.toFixed(2)).toBe('42.00');
    expect(r.valorLiquidoBase.toFixed(2)).toBe('40.00');
    expect(r.valorLiquidoFinal.toFixed(2)).toBe('35.00');
  });

  test('E — arredondamento HALF_UP na taxa', () => {
    const r = calcularPercentual({
      regra: 'PERCENTUAL_A_RECEBER',
      contadorAnterior: 0, contadorAtual: 3,
      valorPartida: 0.33, percentual: 33.33,
    });
    expect(r.valorBruto!.toFixed(2)).toBe('0.99');     // 3 * 0.33
    expect(r.valorPercentual!.toFixed(2)).toBe('0.33'); // 0.99 * 33.33% = 0.329967 -> 0.33
  });
});

describe('PERCENTUAL_A_PAGAR', () => {
  test('D — pagamento menor dispara alerta e gera saldo remanescente', () => {
    const r = calcularPercentual({
      regra: 'PERCENTUAL_A_PAGAR',
      contadorAnterior: 200, contadorAtual: 260,
      valorPartida: 2.5, percentual: 40,
    });
    expect(r.valorBruto!.toFixed(2)).toBe('150.00');
    expect(r.valorLiquidoFinal.toFixed(2)).toBe('60.00');
    const p = aplicarPagamento('PERCENTUAL_A_PAGAR', r.valorLiquidoFinal, 50);
    expect(p.novoSaldo.toFixed(2)).toBe('10.00');
    expect(p.alertaPagamentoInferior).toBe(true);
  });
});

describe('contador', () => {
  test('lança erro se atual < anterior sem marcar reinício', () => {
    expect(() => calcularPercentual({
      regra: 'PERCENTUAL_A_RECEBER',
      contadorAnterior: 500, contadorAtual: 30, valorPartida: 1, percentual: 30,
    })).toThrow();
  });

  test('contador reiniciado usa o atual como total do novo ciclo', () => {
    const r = calcularPercentual({
      regra: 'PERCENTUAL_A_RECEBER',
      contadorAnterior: 500, contadorAtual: 30, contadorReiniciado: true,
      valorPartida: 1, percentual: 30,
    });
    expect(r.partidasJogadas).toBe(30);
  });
});

describe('saldo derivado (append-only)', () => {
  test('recalcula a partir do histórico (Σ base − Σ pago), ignorando LWW', () => {
    // bases: 450 (período 1) + 60 (período 2) = 510 devido; pagamentos 450 + 50 = 500
    const saldo = recalcularSaldoLocacao([450, 60], [450, 50]);
    expect(saldo.toFixed(2)).toBe('10.00');
  });
});

const dia = (iso: string) => new Date(iso + 'T12:00:00-03:00');

describe('MENSAL — mês-calendário e confirmação de período extra', () => {
  test('cobrou 15/jan, hoje 20/jan => 1 período, sem confirmação', () => {
    const r = calcularValorFixo({
      valorFixo: 100, frequencia: 'MENSAL',
      dataReferencia: dia('2025-01-15'), hoje: dia('2025-01-20'),
    });
    expect(r.periodos).toBe(1);
    expect(r.requerConfirmacaoPeriodoExtra).toBe(false);
    expect(r.valorLiquidoFinal.toFixed(2)).toBe('100.00');
    expect(r.dataProximoPeriodo).toBe('2025-02-15');
  });

  test('hoje 14/fev (antes do dia) ainda é 1 período', () => {
    expect(periodosDecorridos('MENSAL', dia('2025-01-15'), dia('2025-02-14'))).toBe(1);
  });

  test('hoje 15/fev cruzou o mês => 2 períodos, pede confirmação', () => {
    const r = calcularValorFixo({
      valorFixo: 100, frequencia: 'MENSAL',
      dataReferencia: dia('2025-01-15'), hoje: dia('2025-02-15'),
    });
    expect(r.periodos).toBe(2);
    expect(r.requerConfirmacaoPeriodoExtra).toBe(true);
    expect(r.valorLiquidoFinal.toFixed(2)).toBe('200.00');
  });

  test('fim de mês: 31/jan -> aniversário cai em 28/fev', () => {
    expect(periodosDecorridos('MENSAL', dia('2025-01-31'), dia('2025-02-27'))).toBe(1);
    expect(periodosDecorridos('MENSAL', dia('2025-01-31'), dia('2025-02-28'))).toBe(2);
    expect(proximaDataPeriodo('MENSAL', dia('2025-01-31'), 1)).toBe('2025-02-28');
  });
});

describe('Atraso (notificações)', () => {
  test('percentual: vencido após X dias da última cobrança', () => {
    expect(vencidaPercentual(dia('2025-01-01'), dia('2025-01-06'), 7)).toBe(false);
    expect(vencidaPercentual(dia('2025-01-01'), dia('2025-01-09'), 7)).toBe(true);
  });

  test('valor fixo: vencido quando cruza a data do próximo período', () => {
    expect(vencidaValorFixo('MENSAL', dia('2025-01-15'), dia('2025-02-14'))).toBe(false);
    expect(vencidaValorFixo('MENSAL', dia('2025-01-15'), dia('2025-02-15'))).toBe(true);
  });
});

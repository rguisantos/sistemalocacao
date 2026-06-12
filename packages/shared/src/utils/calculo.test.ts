// packages/shared/src/utils/calculo.test.ts
import { describe, it, expect } from 'vitest';
import {
  calcularValorFixo,
  calcularPercentual,
  calcularSaldoResultante,
  determinarStatusPagamento,
} from './calculo';

describe('calcularValorFixo', () => {
  it('cobra 1 período quando dentro da frequência', () => {
    const r = calcularValorFixo({
      frequencia: 'MENSAL',
      valorFixo: '300.00',
      dataReferencia: new Date('2026-05-25'),
      dataAtual: new Date('2026-06-04'), // 10 dias
    });
    expect(r.diasDecorridos).toBe(10);
    expect(r.periodos).toBe(1);
    expect(r.valorLiquidoFinal).toBe('300.00');
  });

  it('cobra 2 períodos com 40 dias de atraso (mensal)', () => {
    const r = calcularValorFixo({
      frequencia: 'MENSAL',
      valorFixo: '300.00',
      dataReferencia: new Date('2026-04-25'),
      dataAtual: new Date('2026-06-04'), // 40 dias
    });
    expect(r.periodos).toBe(2);
    expect(r.valorBruto).toBe('600.00');
  });

  it('soma acréscimo e saldo devedor anterior', () => {
    const r = calcularValorFixo({
      frequencia: 'SEMANAL',
      valorFixo: '100.00',
      dataReferencia: new Date('2026-06-01'),
      dataAtual: new Date('2026-06-05'),
      acrescimo: '20.00',
      saldoDevedorAnterior: '50.00',
    });
    expect(r.valorLiquidoFinal).toBe('170.00');
  });

  it('subtrai haver (saldo negativo)', () => {
    const r = calcularValorFixo({
      frequencia: 'SEMANAL',
      valorFixo: '100.00',
      dataReferencia: new Date('2026-06-01'),
      dataAtual: new Date('2026-06-05'),
      saldoDevedorAnterior: '-10.00',
    });
    expect(r.valorLiquidoFinal).toBe('90.00');
  });
});

describe('calcularPercentual', () => {
  it('percentual a receber: fluxo completo do spec', () => {
    // contador 1000 -> 1200 = 200 partidas, desconto 20 = 180
    // bruto = 180 * 2.00 = 360; percentual 50% = 180
    // desconto valor 30 -> base 150; saldo anterior -10 (haver) -> 140
    const r = calcularPercentual({
      regra: 'PERCENTUAL_A_RECEBER',
      contadorAnterior: 1000,
      contadorAtual: 1200,
      descontoPartidas: 20,
      valorPartida: '2.00',
      percentual: '0.5',
      descontoValorReceber: '30.00',
      saldoDevedorAnterior: '-10.00',
    });
    expect(r.partidasJogadas).toBe(200);
    expect(r.partidasConsideradas).toBe(180);
    expect(r.valorBruto).toBe('360.00');
    expect(r.valorPercentual).toBe('180.00');
    expect(r.valorLiquidoBase).toBe('150.00');
    expect(r.valorLiquidoFinal).toBe('140.00');
    expect(r.erros).toHaveLength(0);
  });

  it('percentual a pagar ignora desconto de valor a receber', () => {
    const r = calcularPercentual({
      regra: 'PERCENTUAL_A_PAGAR',
      contadorAnterior: 0,
      contadorAtual: 100,
      valorPartida: '1.00',
      percentual: '0.4',
      descontoValorReceber: '999.00', // deve ser ignorado
    });
    expect(r.descontoValorReceber).toBe('0.00');
    expect(r.valorLiquidoFinal).toBe('40.00');
  });

  it('acrescimo entra no valor bruto antes do percentual', () => {
    const r = calcularPercentual({
      regra: 'PERCENTUAL_A_RECEBER',
      contadorAnterior: 0,
      contadorAtual: 100,
      valorPartida: '1.00',
      percentual: '0.5',
      acrescimo: '100.00',
    });
    expect(r.valorBruto).toBe('200.00');
    expect(r.valorPercentual).toBe('100.00');
  });

  it('detecta contador regredindo', () => {
    const r = calcularPercentual({
      regra: 'PERCENTUAL_A_RECEBER',
      contadorAnterior: 500,
      contadorAtual: 400,
      valorPartida: '1.00',
      percentual: '0.5',
    });
    expect(r.erros.length).toBeGreaterThan(0);
    expect(r.partidasJogadas).toBe(0);
  });

  it('precisão decimal: sem erros de float', () => {
    const r = calcularPercentual({
      regra: 'PERCENTUAL_A_RECEBER',
      contadorAnterior: 0,
      contadorAtual: 3,
      valorPartida: '0.10',
      percentual: '0.3',
    });
    // 3 * 0.10 = 0.30; 0.30 * 0.3 = 0.09 (float daria 0.089999...)
    expect(r.valorPercentual).toBe('0.09');
  });
});

describe('calcularSaldoResultante', () => {
  it('cliente paga a mais → haver (exemplo do spec)', () => {
    const { saldoResultante } = calcularSaldoResultante('PERCENTUAL_A_RECEBER', '100.00', '110.00');
    expect(saldoResultante).toBe('-10.00');
  });

  it('cliente paga parcial → saldo devedor', () => {
    const { saldoResultante } = calcularSaldoResultante('VALOR_FIXO', '300.00', '200.00');
    expect(saldoResultante).toBe('100.00');
  });

  it('percentual a pagar: empresa paga menos → alerta e haver do cliente', () => {
    const { saldoResultante, alerta } = calcularSaldoResultante(
      'PERCENTUAL_A_PAGAR',
      '100.00',
      '80.00'
    );
    expect(saldoResultante).toBe('-20.00'); // empresa deve 20 ao cliente
    expect(alerta).toBeDefined();
  });
});

describe('determinarStatusPagamento', () => {
  it('pago integral', () => expect(determinarStatusPagamento('100.00', '100.00')).toBe('PAGO'));
  it('parcial', () => expect(determinarStatusPagamento('100.00', '50.00')).toBe('PARCIAL'));
  it('pendente', () => expect(determinarStatusPagamento('100.00', '0')).toBe('PENDENTE'));
});

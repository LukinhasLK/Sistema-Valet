import { Socio } from '../models';
import {
  calcLiquidoCartao,
  calcResultado,
  calcSaldoFinal,
  calcTaxaDescontada,
  calcTotalBruto,
  calcTotalCarros,
  calcTotalDespesas,
  calcTotalDiarias,
  dividirEntreSocios,
  round2,
} from './calc';

describe('calc', () => {
  it('arredonda para centavos', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('calcula total de carros sem ficar negativo', () => {
    expect(calcTotalCarros(100, 150, 5)).toBe(45);
    expect(calcTotalCarros(100, 90, 0)).toBe(0);
    expect(calcTotalCarros(NaN, 10, NaN)).toBe(10);
  });

  it('calcula taxa e líquido do cartão', () => {
    expect(calcTaxaDescontada(1000, 2)).toBe(20);
    expect(calcLiquidoCartao(1000, 2)).toBe(980);
    expect(calcLiquidoCartao(0, 2)).toBe(0);
  });

  it('soma diárias e despesas adicionais', () => {
    expect(calcTotalDiarias([{ manobristaId: 1, diaria: 80 }, { manobristaId: 2, diaria: 90.5 }])).toBe(170.5);
    expect(calcTotalDespesas([{ descricao: 'Gelo', valor: 12.3 }, { descricao: 'Água', valor: 7.7 }])).toBe(20);
    expect(calcTotalDiarias([])).toBe(0);
  });

  it('calcula saldo final da ficha', () => {
    const saldo = calcSaldoFinal({
      valorDinheiro: 500,
      valorCartao: 1000,
      taxaMaquininha: 2,
      manobristas: [{ manobristaId: 1, diaria: 80 }, { manobristaId: 2, diaria: 80 }],
      despesasAdicionais: [{ descricao: 'Gelo', valor: 20 }],
    });
    expect(saldo).toBe(500 + 980 - 160 - 20);
  });

  it('calcula bruto e resultado com despesas fixas', () => {
    expect(calcTotalBruto(500, 1000)).toBe(1500);
    expect(calcResultado(10000, 6500)).toBe(3500);
    expect(calcResultado(1000, 1500)).toBe(-500);
  });

  it('divide o saldo só entre sócios da unidade', () => {
    const socios: Socio[] = [
      { id: 1, nome: 'Ana', percentuais: [{ unidadeId: 1, percentual: 60 }, { unidadeId: 2, percentual: 100 }] },
      { id: 2, nome: 'Bia', percentuais: [{ unidadeId: 1, percentual: 40 }] },
    ];

    expect(dividirEntreSocios(1000, socios, 1)).toEqual([
      { nome: 'Ana', percentual: 60, valor: 600 },
      { nome: 'Bia', percentual: 40, valor: 400 },
    ]);
    expect(dividirEntreSocios(1000, socios, 2).map((p) => p.nome)).toEqual(['Ana']);
    expect(dividirEntreSocios(1000, socios, 3)).toEqual([]);
  });
});

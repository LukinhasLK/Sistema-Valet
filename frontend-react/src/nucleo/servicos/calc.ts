import { DespesaAdicional, Ficha, ManobristaFicha, Socio } from '../modelos';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Total real de carros = ficha fim − ficha início − canceladas (nunca negativo). */
export function calcTotalCarros(inicio: number, fim: number, canceladas: number): number {
  return Math.max(0, (fim || 0) - (inicio || 0) - (canceladas || 0));
}

/** Valor retido pela maquininha. */
export function calcTaxaDescontada(valorCartao: number, taxaPercentual: number): number {
  return round2((valorCartao || 0) * ((taxaPercentual || 0) / 100));
}

/** Valor do cartão já líquido da taxa. */
export function calcLiquidoCartao(valorCartao: number, taxaPercentual: number): number {
  return round2((valorCartao || 0) - calcTaxaDescontada(valorCartao, taxaPercentual));
}

export function calcTotalDiarias(manobristas: ManobristaFicha[]): number {
  return round2((manobristas ?? []).reduce((total, m) => total + (m.diaria || 0), 0));
}

export function calcTotalDespesas(despesas: DespesaAdicional[]): number {
  return round2((despesas ?? []).reduce((total, d) => total + (d.valor || 0), 0));
}

/** Saldo final = dinheiro + Pix + cartão líquido − diárias − despesas adicionais. */
export function calcSaldoFinal(input: {
  valorDinheiro: number;
  valorCartao: number;
  valorPix?: number;
  taxaMaquininha: number;
  manobristas: ManobristaFicha[];
  despesasAdicionais: DespesaAdicional[];
}): number {
  return round2(
    (input.valorDinheiro || 0) + (input.valorPix || 0) +
      calcLiquidoCartao(input.valorCartao, input.taxaMaquininha) -
      calcTotalDiarias(input.manobristas) -
      calcTotalDespesas(input.despesasAdicionais)
  );
}

/** Faturamento bruto da ficha (dinheiro + cartão + Pix, antes da taxa). */
export function calcTotalBruto(valorDinheiro: number, valorCartao: number, valorPix = 0): number {
  return round2((valorDinheiro || 0) + (valorCartao || 0) + valorPix);
}

export interface ParteSocio {
  nome: string;
  percentual: number;
  valor: number;
}

/** Rateia um saldo entre os sócios que têm participação na unidade informada. */
export function dividirEntreSocios(saldo: number, socios: Socio[], unidadeId: number): ParteSocio[] {
  return socios
    .map((socio) => {
      const participacao = socio.percentuais.find((p) => p.unidadeId === unidadeId);
      return participacao
        ? { nome: socio.nome, percentual: participacao.percentual, valor: round2(saldo * (participacao.percentual / 100)) }
        : null;
    })
    .filter((parte): parte is ParteSocio => parte !== null);
}

/** Resultado do período: líquido das fichas menos as despesas fixas (aluguel, seguro...). */
export function calcResultado(liquidoFichas: number, despesasFixas: number): number {
  return round2((liquidoFichas || 0) - (despesasFixas || 0));
}

/** Despesas do dia na visão de relatório: tudo que separa o bruto do líquido. */
export function despesasDaFicha(ficha: Ficha): number {
  return round2(ficha.totalBruto - ficha.totalLiquido);
}

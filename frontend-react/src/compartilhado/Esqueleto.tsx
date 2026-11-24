import { CSSProperties } from 'react';

/** Bloco de carregamento com brilho suave (sem brilho quando "reduzir movimento" está ligado). */
export function Esqueleto({ largura = '100%', altura = 14, raio, style }: { largura?: number | string; altura?: number; raio?: number; style?: CSSProperties }) {
  return <span className="pf-skeleton" aria-hidden="true" style={{ width: largura, height: altura, borderRadius: raio, ...style }} />;
}

/** Linhas de tabela/lista enquanto os dados chegam. */
export function EsqueletoLista({ linhas = 5, rotulo = 'Carregando…' }: { linhas?: number; rotulo?: string }) {
  return (
    <div className="pf-card" role="status" aria-label={rotulo} style={{ padding: '6px 0' }}>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', borderTop: i ? '1px solid var(--pf-border)' : undefined }}>
          <Esqueleto largura={14} altura={14} raio={7} />
          <Esqueleto largura={`${28 + ((i * 17) % 30)}%`} />
          <Esqueleto largura={70} style={{ marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  );
}

/** Quatro indicadores enquanto os números chegam. */
export function EsqueletoKpis({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <section className="pf-grid-kpi" role="status" aria-label="Carregando indicadores">
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className="pf-card" style={{ padding: '18px 20px', minHeight: 100, display: 'grid', gap: 12, alignContent: 'center' }}>
          <Esqueleto largura="45%" altura={11} />
          <Esqueleto largura="70%" altura={24} />
        </div>
      ))}
    </section>
  );
}

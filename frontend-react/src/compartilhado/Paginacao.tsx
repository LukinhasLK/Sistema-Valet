import { useEffect, useMemo, useState } from 'react';

const TAMANHO = 25;

/** Divide a lista em páginas de 25; volta à primeira página quando a lista muda. */
export function usePaginar<T>(itens: T[]) {
  const [pagina, setPagina] = useState(0);
  useEffect(() => setPagina(0), [itens]);
  const visiveis = useMemo(() => itens.slice(pagina * TAMANHO, (pagina + 1) * TAMANHO), [itens, pagina]);
  return { pagina, setPagina, visiveis, paginas: Math.ceil(itens.length / TAMANHO) };
}

export function Paginacao({ pagina, paginas, aoSelecionar }: { pagina: number; paginas: number; aoSelecionar: (p: number) => void }) {
  if (paginas <= 1) return null;
  return (
    <pf-paginacao>
      <nav aria-label="Paginação" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10, paddingBlock: 12 }}>
        <button type="button" className="pf-btn pf-btn--ghost" disabled={pagina === 0} onClick={() => aoSelecionar(pagina - 1)}>Anterior</button>
        <span aria-live="polite">Página {pagina + 1} de {paginas}</span>
        <button type="button" className="pf-btn pf-btn--ghost" disabled={pagina + 1 >= paginas} onClick={() => aoSelecionar(pagina + 1)}>Próxima</button>
      </nav>
    </pf-paginacao>
  );
}

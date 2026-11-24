import { ReactNode, useLayoutEffect, useRef } from 'react';
import { entrada, saida } from './movimento';
import { usePrenderFoco } from './usePrenderFoco';
import './modal.scss';

interface Props {
  titulo: string;
  largo?: boolean;
  aoFechar: () => void;
  /** Conteúdo do rodapé fixo (antigo `[pfModalFooter]`). */
  rodape?: ReactNode;
  children?: ReactNode;
}

export function Modal({ titulo, largo = false, aoFechar, rodape, children }: Props) {
  const fundo = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);
  const cancelarEntrada = useRef<() => void>();
  const cancelarSaida = useRef<() => void>();
  const fechando = useRef(false);
  const aoFecharAtual = useRef(aoFechar);
  aoFecharAtual.current = aoFechar;

  usePrenderFoco(painel, fechar);

  useLayoutEffect(() => {
    const cancelarFundo = entrada([fundo.current!], 0);
    const cancelarPainel = entrada([painel.current!]);
    cancelarEntrada.current = () => { cancelarFundo(); cancelarPainel(); };
    return () => {
      cancelarEntrada.current?.();
      cancelarSaida.current?.();
    };
  }, []);

  const solicitarFechamento = (evento?: { stopPropagation(): void }) => {
    evento?.stopPropagation();
    if (fechando.current) return;
    fechando.current = true;
    cancelarEntrada.current?.();
    cancelarSaida.current = saida(fundo.current!, painel.current!, () => aoFecharAtual.current());
  };

  return (
    <pf-modal>
      <div ref={fundo} className="backdrop" onClick={() => solicitarFechamento()}>
        <div
          ref={painel}
          className={`sheet${largo ? ' sheet--wide' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Escape') solicitarFechamento(e); }}
        >
          <header className="sheet__head">
            <h2 className="sheet__title">{titulo}</h2>
            <button ref={fechar} type="button" className="sheet__close" aria-label="Fechar" onClick={() => solicitarFechamento()}>×</button>
          </header>
          <div className="sheet__body">{children}</div>
          <footer className="sheet__footer">{rodape}</footer>
        </div>
      </div>
    </pf-modal>
  );
}

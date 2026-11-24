import { useRef } from 'react';
import { avisos, useAviso } from '../nucleo/estado/aviso';
import { useAparecer } from './useAparecer';
import './aviso.scss';

function Caixa({ tipo, texto }: { tipo: 'erro' | 'sucesso'; texto: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useAparecer(ref, 0);
  return (
    <div ref={ref} className={`aviso${tipo === 'erro' ? ' aviso--erro' : ''}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      <span>{texto}</span>
      <button type="button" className="aviso__fechar" aria-label="Fechar aviso" onClick={avisos.fechar}>×</button>
    </div>
  );
}

/** Aviso flutuante (toast) com o retorno das operações. */
export function Aviso() {
  const aviso = useAviso((s) => s.aviso);
  return <pf-aviso>{aviso && <Caixa key={`${aviso.tipo}${aviso.texto}`} {...aviso} />}</pf-aviso>;
}

import { AnimatePresence, motion } from 'motion/react';
import { avisos, useAviso } from '../nucleo/estado/aviso';
import { Icone } from './Icone';
import { TRANSICAO } from './movimento';
import './aviso.scss';

/** Aviso flutuante (toast) com o retorno das operações. */
export function Aviso() {
  const aviso = useAviso((s) => s.aviso);
  return (
    <pf-aviso>
      <AnimatePresence mode="wait">
        {aviso && (
          <motion.div
            key={`${aviso.tipo}${aviso.texto}`}
            className={`aviso${aviso.tipo === 'erro' ? ' aviso--erro' : ''}`}
            role={aviso.tipo === 'erro' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, transition: TRANSICAO.saida }}
            transition={TRANSICAO.mola}
          >
            <span className="aviso__icone"><Icone nome={aviso.tipo === 'erro' ? 'alerta' : 'sucesso'} tamanho={18} /></span>
            <span className="aviso__texto">{aviso.texto}</span>
            <button type="button" className="aviso__fechar" aria-label="Fechar aviso" onClick={avisos.fechar}>
              <Icone nome="fechar" tamanho={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </pf-aviso>
  );
}

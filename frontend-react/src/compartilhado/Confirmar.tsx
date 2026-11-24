import { Modal } from './Modal';
import './confirmar.scss';

interface Props {
  titulo?: string;
  mensagem: string;
  rotuloConfirmar?: string;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

export function Confirmar({ titulo = 'Confirmar exclusão', mensagem, rotuloConfirmar = 'Excluir', aoConfirmar, aoCancelar }: Props) {
  return (
    <pf-confirm>
      <Modal titulo={titulo} aoFechar={aoCancelar}>
        <p className="msg">{mensagem}</p>
        <div className="acoes">
          <button type="button" className="pf-btn pf-btn--ghost" onClick={aoCancelar}>Cancelar</button>
          <button type="button" className="pf-btn danger" onClick={aoConfirmar}>{rotuloConfirmar}</button>
        </div>
      </Modal>
    </pf-confirm>
  );
}

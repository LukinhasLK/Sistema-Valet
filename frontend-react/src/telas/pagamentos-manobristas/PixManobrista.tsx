import { useEffect, useState } from 'react';
import { useNivel } from '../../nucleo/estado/auth';
import { ErroHttp, mensagemDeErro } from '../../nucleo/servicos/api';
import { pagamentosServico, Pix, TipoPix } from '../../nucleo/servicos/pagamentos-manobristas';
import { CampoSelecao } from '../../compartilhado/CampoSelecao';
import './pix-manobrista.scss';

const TIPOS: Record<TipoPix, string> = {
  CPF: 'CPF', CNPJ: 'CNPJ', TELEFONE: 'Telefone celular', EMAIL: 'E-mail', ALEATORIA: 'Chave aleatória',
};
const OPCOES = Object.keys(TIPOS) as TipoPix[];

/** Chave Pix do manobrista: consulta mascarada, revelação auditada, cópia e cadastro (só proprietário). */
export function PixManobrista({ manobristaId }: { manobristaId: number }) {
  const nivel = useNivel();
  const [pix, setPix] = useState<Pix | null>(null);
  const [revelada, setRevelada] = useState('');
  const [erro, setErro] = useState('');
  const [feedback, setFeedback] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [tipo, setTipo] = useState<TipoPix>('CPF');
  const [chave, setChave] = useState('');

  useEffect(() => {
    let ativo = true;
    pagamentosServico.consultarPix(manobristaId)
      .then((p) => { if (ativo) setPix(p); })
      .catch((e) => { if (ativo && !(e instanceof ErroHttp && e.status === 404)) setErro(mensagemDeErro(e)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [manobristaId]);

  function ocultar() {
    setRevelada('');
    setFeedback('');
    setErro('');
  }
  function editar() {
    ocultar();
    setTipo(pix?.tipo ?? 'CPF');
    setEditando(true);
  }
  function cancelar() {
    setChave('');
    setErro('');
    setEditando(false);
  }

  async function executar(acao: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    setErro('');
    setFeedback('');
    try {
      await acao();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const salvar = () => {
    if (!chave.trim() || ocupado) return;
    void executar(async () => {
      setPix(await pagamentosServico.salvarPix(manobristaId, tipo, chave));
      cancelar();
      setFeedback('Chave Pix salva.');
    });
  };
  const revelar = () => void executar(async () => setRevelada((await pagamentosServico.revelarPix(manobristaId)).chave));
  async function copiar() {
    try {
      await navigator.clipboard.writeText(revelada);
      setFeedback('Chave copiada.');
    } catch {
      setFeedback('Selecione a chave completa e copie pelo teclado ou pelo menu do dispositivo.');
    }
  }

  return (
    <pf-pix-manobrista>
      <section className="pix" aria-label="Chave Pix">
        <h3>Chave Pix</h3>
        {erro && <p className="pf-error" role="alert">{erro}</p>}
        {carregando ? (
          <p role="status">Consultando chave Pix…</p>
        ) : (
          <>
            {pix ? (
              <>
                <p>{TIPOS[pix.tipo]} · <strong>{pix.chaveMascarada}</strong></p>
                {revelada && (
                  <div className="pf-field">
                    <label className="pf-label" htmlFor="pix-revelada">Chave completa</label>
                    <input className="pf-input" id="pix-revelada" readOnly value={revelada} onFocus={(e) => e.target.select()} />
                    <div className="acoes">
                      <button type="button" className="pf-btn pf-btn--ghost" onClick={copiar}>Copiar chave</button>
                      <button type="button" className="pf-btn pf-btn--ghost" onClick={ocultar}>Ocultar</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              !erro && <p>Nenhuma chave cadastrada.</p>
            )}
            <div className="acoes">
              {pix && !revelada && !editando && (
                <button type="button" className="pf-btn pf-btn--ghost" disabled={ocupado} onClick={revelar}>Consultar chave</button>
              )}
              {nivel === 'Proprietário' && !editando && (
                <button type="button" className="pf-btn pf-btn--ghost" disabled={ocupado} onClick={editar}>
                  {pix ? 'Atualizar chave' : 'Cadastrar chave'}
                </button>
              )}
            </div>
            {editando && (
              <>
                <div className="pf-field">
                  <label className="pf-label" htmlFor="pix-tipo">Tipo da chave</label>
                  <CampoSelecao className="pf-select" id="pix-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoPix)} disabled={ocupado}>
                    {OPCOES.map((opcao) => <option key={opcao} value={opcao}>{TIPOS[opcao]}</option>)}
                  </CampoSelecao>
                </div>
                <div className="pf-field">
                  <label className="pf-label" htmlFor="pix-chave">Nova chave</label>
                  <input id="pix-chave" className="pf-input" maxLength={254} autoComplete="off" spellCheck={false}
                    value={chave} onChange={(e) => setChave(e.target.value)} disabled={ocupado} />
                </div>
                <div className="acoes">
                  <button type="button" className="pf-btn pf-btn--ghost" onClick={cancelar} disabled={ocupado}>Cancelar edição</button>
                  <button type="button" className="pf-btn pf-btn--dark" onClick={salvar} disabled={ocupado || !chave.trim()}>Salvar chave</button>
                </div>
              </>
            )}
          </>
        )}
        <p role="status" className="feedback">{feedback}</p>
      </section>
    </pf-pix-manobrista>
  );
}

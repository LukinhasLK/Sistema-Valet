import { useEffect, useState } from 'react';
import { Confirmar } from './Confirmar';
import { dataHora } from './formatos';
import { Icone } from './Icone';
import { avisos } from '../nucleo/estado/aviso';
import { Modal } from './Modal';
import './agenda-google.scss';
import { calendarioServico, GOOGLE_ADICIONAR_POR_URL, LinkAgenda, urlDoLink } from '../nucleo/servicos/calendario';

type Pendente = 'gerar' | 'desativar' | null;

const TEXTO = 'Assine a agenda do Park Flash no Google Calendar e veja eventos e escalas no celular. As mudanças feitas aqui aparecem lá sozinhas, em algumas horas.';

/**
 * Ligação da agenda do Park Flash ao Google Calendar (o link .ics inclui eventos e escalas).
 * `cartao` é o cartão do Perfil; `painel` é só o conteúdo, para uso dentro de um diálogo.
 * O link completo só existe no momento em que é gerado (o servidor guarda apenas o hash).
 */
export function AgendaGoogle({ variante = 'cartao' }: { variante?: 'cartao' | 'painel' }) {
  const [situacao, setSituacao] = useState<LinkAgenda | null>(null);
  const [novoLink, setNovoLink] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState<Pendente>(null);

  useEffect(() => {
    let vivo = true;
    calendarioServico.consultar()
      .then((s) => { if (vivo) setSituacao(s); })
      .catch(() => { if (vivo) setSituacao({ ativo: false, criadoEm: null }); });
    return () => { vivo = false; };
  }, []);

  async function gerar() {
    setConfirmar(null);
    setOcupado(true);
    try {
      const gerado = await calendarioServico.gerar();
      setNovoLink(urlDoLink(gerado.token));
      setSituacao({ ativo: true, criadoEm: gerado.criadoEm });
    } catch (erro) {
      avisos.erro(erro, 'Não foi possível gerar o link da agenda.');
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setConfirmar(null);
    setOcupado(true);
    try {
      await calendarioServico.desativar();
      setNovoLink(null);
      setSituacao({ ativo: false, criadoEm: null });
      avisos.sucesso('Link desativado. A agenda some do Google Calendar na próxima atualização.');
    } catch (erro) {
      avisos.erro(erro, 'Não foi possível desativar o link.');
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    if (!novoLink) return;
    try {
      await navigator.clipboard.writeText(novoLink);
      avisos.sucesso('Link copiado.');
    } catch {
      avisos.erro(null, 'Não foi possível copiar. Selecione o link e copie manualmente.');
    }
  }

  const ativo = situacao?.ativo ?? false;

  const Raiz = variante === 'cartao' ? 'section' : 'div';
  return (
    <Raiz className={variante === 'cartao' ? 'pf-card perfil__card perfil__agenda' : 'perfil__agenda perfil__agenda--painel'}
      aria-labelledby={variante === 'cartao' ? 'perfil-agenda' : undefined} aria-busy={situacao === null}>
      {variante === 'cartao' && <span className="perfil__tour-icone"><Icone nome="eventos" tamanho={20} /></span>}
      <div className="perfil__tour-texto">
        {variante === 'cartao' && <h2 id="perfil-agenda" className="perfil__titulo">Google Calendar</h2>}
        <p>{TEXTO}</p>

        {novoLink ? (
          <div className="perfil__agenda-link">
            <label className="pf-label" htmlFor="perfil-agenda-url">Seu link de agenda</label>
            <div className="perfil__agenda-campo">
              <input id="perfil-agenda-url" type="text" readOnly value={novoLink} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm" onClick={copiar}>
                <Icone nome="copiar" tamanho={16} /> Copiar
              </button>
            </div>
            <p className="perfil__agenda-aviso" role="status">Copie agora: por segurança, este link não aparece de novo. Quem tiver o link vê a agenda, então não o compartilhe.</p>
            <ol className="perfil__agenda-passos">
              <li>Abra o Google Calendar pelo botão abaixo, no computador.</li>
              <li>Cole o link no campo “URL da agenda” e clique em “Adicionar agenda”.</li>
              <li>A agenda “Park Flash” aparece também no app do celular.</li>
            </ol>
            <div className="perfil__tour-acoes">
              <a className="pf-btn pf-btn--primary pf-btn--sm" href={GOOGLE_ADICIONAR_POR_URL} target="_blank" rel="noopener noreferrer">
                Abrir Google Calendar
              </a>
            </div>
          </div>
        ) : ativo ? (
          <p className="perfil__agenda-estado">
            Link ativo desde {dataHora(situacao?.criadoEm, 'dd/MM/yyyy HH:mm')}. Se perdeu o link, gere outro: o anterior para de funcionar.
          </p>
        ) : null}

        {situacao !== null && (
          <div className="perfil__tour-acoes">
            {!novoLink && (
              <button type="button" className={`pf-btn pf-btn--sm ${ativo ? 'pf-btn--ghost' : 'pf-btn--primary'}`} disabled={ocupado}
                onClick={() => (ativo ? setConfirmar('gerar') : gerar())}>
                {ativo ? 'Gerar novo link' : 'Gerar link da agenda'}
              </button>
            )}
            {ativo && (
              <button type="button" className="pf-btn pf-btn--ghost pf-btn--sm" disabled={ocupado} onClick={() => setConfirmar('desativar')}>
                Desativar link
              </button>
            )}
          </div>
        )}
      </div>

      {confirmar === 'gerar' && (
        <Confirmar titulo="Gerar novo link?" rotuloConfirmar="Gerar novo link"
          mensagem="O link atual para de funcionar. Onde ele estiver assinado, a agenda vai parar de atualizar até você adicionar o novo."
          aoConfirmar={gerar} aoCancelar={() => setConfirmar(null)} />
      )}
      {confirmar === 'desativar' && (
        <Confirmar titulo="Desativar o link da agenda?" rotuloConfirmar="Desativar"
          mensagem="O Google Calendar deixa de receber os eventos e as escalas. Você pode gerar um link novo quando quiser."
          aoConfirmar={desativar} aoCancelar={() => setConfirmar(null)} />
      )}
    </Raiz>
  );
}

/** Botão para os cabeçalhos de Eventos e Escalas: abre o mesmo conteúdo do cartão do Perfil num diálogo. */
export function AgendaGoogleBotao() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className="pf-btn pf-btn--ghost" onClick={() => setAberto(true)}>
        <Icone nome="eventos" tamanho={17} />
        Google Calendar
      </button>
      {aberto && (
        <Modal titulo="Google Calendar" aoFechar={() => setAberto(false)}>
          <AgendaGoogle variante="painel" />
        </Modal>
      )}
    </>
  );
}

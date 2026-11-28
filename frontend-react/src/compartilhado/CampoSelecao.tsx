import { Children, isValidElement, ReactElement, ReactNode, SelectHTMLAttributes, useLayoutEffect, useRef, useState } from 'react';
import { Seletor, OpcaoSeletor } from './Seletor';

type Props = SelectHTMLAttributes<HTMLSelectElement> & { children?: ReactNode };

interface OpcaoLida extends OpcaoSeletor<string> { desabilitada: boolean }

/** Junta o texto de um nó React (ex.: <option>{u.nome} (inativa)</option>). */
function texto(no: ReactNode): string {
  if (no === null || no === undefined || typeof no === 'boolean') return '';
  if (typeof no === 'string' || typeof no === 'number') return String(no);
  if (Array.isArray(no)) return no.map(texto).join('');
  if (isValidElement(no)) return texto((no.props as { children?: ReactNode }).children);
  return '';
}

/** Lê as <option> (inclusive dentro de fragmentos e listas). */
function lerOpcoes(filhos: ReactNode): OpcaoLida[] {
  const saida: OpcaoLida[] = [];
  Children.forEach(filhos, (filho) => {
    if (!isValidElement(filho)) return;
    const el = filho as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;
    if (el.type === 'option') {
      const rotulo = texto(el.props.children).trim();
      saida.push({ valor: String(el.props.value ?? rotulo), rotulo, desabilitada: !!el.props.disabled });
    } else if (el.props.children) {
      saida.push(...lerOpcoes(el.props.children));
    }
  });
  return saida;
}

/**
 * Substituto direto do `<select className="pf-select">`: mesma API (value, onChange, name, id,
 * required, disabled, aria-*). Um <select> nativo escondido continua sendo o campo real — o
 * formulário, a validação e o rótulo funcionam como antes — e o usuário vê a lista do Park Flash.
 */
export function CampoSelecao({ children, className = 'pf-select', value, onBlur, disabled, style, ...resto }: Props) {
  const nativo = useRef<HTMLSelectElement>(null);
  const [rotuloCampo, setRotuloCampo] = useState('');
  const opcoes = lerOpcoes(children);
  const valor = value === undefined || value === null ? '' : String(value);
  const atual = opcoes.find((o) => o.valor === valor);
  const visiveis = opcoes.filter((o) => !o.desabilitada || o.valor === valor);

  // Nome acessível: o <label for> do campo, o aria-label ou o placeholder.
  // Sem dependências de propósito (o rótulo pode mudar); valores iguais não re-renderizam.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = nativo.current;
    setRotuloCampo(el?.labels?.[0]?.textContent?.trim() || resto['aria-label'] || opcoes.find((o) => o.desabilitada)?.rotulo || 'Opções');
  });

  function escolher(novo: string) {
    const el = nativo.current;
    if (!el) return;
    // Mesmo caminho de uma escolha no menu nativo: o React recebe o onChange normalmente.
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, novo);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const classes = className.split(/\s+/).filter((c) => c !== 'pf-select').join(' ');
  return (
    <span className="pf-campo-selecao" style={style}>
      <select ref={nativo} {...resto} value={valor} disabled={disabled} tabIndex={-1} aria-hidden="true" className="pf-campo-selecao__nativo"
        onFocus={(e) => (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus()}>
        {children}
      </select>
      {disabled ? (
        <button type="button" className={`pf-select pf-campo-selecao__botao ${classes}`} disabled aria-label={`${rotuloCampo} ${atual?.rotulo ?? 'Selecione'}`.trim()}>
          <span className={atual?.desabilitada || !atual ? 'pf-campo-selecao__vazio' : undefined}>{atual?.rotulo ?? ''}</span>
        </button>
      ) : (
        <Seletor rotulo={rotuloCampo} valor={valor} opcoes={visiveis.filter((o) => !o.desabilitada)} aoMudar={escolher}
          className={`pf-select pf-campo-selecao__botao ${classes}`} invalido={classes.includes('ng-invalid')}
          nomeAcessivel={`${rotuloCampo} ${atual?.rotulo ?? 'Selecione'}`.trim()}
          aoSair={onBlur ? () => onBlur({ target: nativo.current, currentTarget: nativo.current } as unknown as React.FocusEvent<HTMLSelectElement>) : undefined}>
          <span className={atual?.desabilitada || !atual ? 'pf-campo-selecao__vazio' : undefined}>{atual?.rotulo ?? 'Selecione'}</span>
        </Seletor>
      )}
    </span>
  );
}

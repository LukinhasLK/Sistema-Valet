import { ChangeEvent, useCallback, useMemo, useState } from 'react';
import { aplicarMascara, TipoMascara } from './mascara';

type Erros<T> = Partial<Record<keyof T | '_form', string | boolean>>;

/**
 * Formulário com validação, no espírito dos Reactive Forms do Angular:
 * o erro de um campo só aparece depois que ele foi "tocado" (saiu do campo ou tentou salvar).
 */
export function useFormulario<T extends Record<string, unknown>>(inicial: T, validar: (valores: T) => Erros<T> = () => ({})) {
  const [valores, setValores] = useState<T>(inicial);
  const [tocados, setTocados] = useState<Partial<Record<keyof T, boolean>>>({});

  const erros = useMemo(() => {
    const todos = validar(valores);
    return Object.fromEntries(Object.entries(todos).filter(([, v]) => v)) as Erros<T>;
  }, [valores, validar]);
  const valido = Object.keys(erros).length === 0;

  const definir = useCallback(<K extends keyof T>(nome: K, valor: T[K]) => setValores((v) => ({ ...v, [nome]: valor })), []);
  const tocar = useCallback((nome: keyof T) => setTocados((t) => ({ ...t, [nome]: true })), []);
  const tocarTodos = () => setTocados(Object.fromEntries(Object.keys(valores).map((k) => [k, true])) as Record<keyof T, boolean>);
  const resetar = useCallback((novos: T) => {
    setValores(novos);
    setTocados({});
  }, []);

  /** Mostra o erro do campo? (inválido e tocado) */
  const invalido = (nome: keyof T) => !!tocados[nome] && !!erros[nome];
  const classe = (nome: keyof T, base = 'pf-input') => (invalido(nome) ? `${base} ng-invalid ng-touched` : base);

  /** Liga um input/select/textarea de texto ao campo. */
  const campo = (nome: keyof T, opcoes: { mascara?: TipoMascara } = {}) => ({
    name: String(nome),
    value: (valores[nome] ?? '') as string,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      definir(nome, (opcoes.mascara ? aplicarMascara(e.target.value, opcoes.mascara) : e.target.value) as T[keyof T]),
    onBlur: () => tocar(nome),
    // Para <select>, sobrescreva depois do spread: className={f.classe('x', 'pf-select')}.
    className: classe(nome),
  });

  /** Campo numérico: guarda number (ou null quando vazio), como o Angular com type="number". */
  const numero = (nome: keyof T) => ({
    name: String(nome),
    type: 'number' as const,
    value: valores[nome] === null || valores[nome] === undefined ? '' : String(valores[nome]),
    onChange: (e: ChangeEvent<HTMLInputElement>) =>
      definir(nome, (e.target.value === '' ? null : Number(e.target.value)) as T[keyof T]),
    onBlur: () => tocar(nome),
    className: classe(nome),
  });

  /** Caixa de marcação. */
  const marcador = (nome: keyof T) => ({
    name: String(nome),
    type: 'checkbox' as const,
    checked: !!valores[nome],
    onChange: (e: ChangeEvent<HTMLInputElement>) => definir(nome, e.target.checked as T[keyof T]),
  });

  return { valores, setValores, definir, erros, valido, tocados, tocar, tocarTodos, resetar, invalido, classe, campo, numero, marcador };
}

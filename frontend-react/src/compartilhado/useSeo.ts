import { useEffect } from 'react';

const ORIGEM = 'https://hitmanpark.com';

interface Seo {
  titulo: string;
  descricao: string;
  /** Caminho público da página (ex.: '/planos'); vira o canonical. */
  caminho: string;
  /** Padrão true. Com false: "noindex, nofollow". */
  indexar?: boolean;
}

/** Acha (ou cria) uma tag do <head> e devolve o valor anterior para restaurar. */
function definir(seletor: string, criar: () => HTMLElement, atributo: string, valor: string) {
  let el = document.head.querySelector<HTMLElement>(seletor);
  const criado = !el;
  if (!el) { el = criar(); document.head.appendChild(el); }
  const anterior = el.getAttribute(atributo);
  el.setAttribute(atributo, valor);
  return () => {
    if (criado) el.remove();
    else if (anterior === null) el.removeAttribute(atributo);
    else el.setAttribute(atributo, anterior);
  };
}

function tag(nome: string, atributos: Record<string, string>) {
  return () => {
    const el = document.createElement(nome);
    Object.entries(atributos).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };
}

/** Define título, descrição, canonical e robots da página; restaura o que havia ao sair (seguro no StrictMode). */
export function useSeo({ titulo, descricao, caminho, indexar = true }: Seo) {
  useEffect(() => {
    const tituloAntes = document.title;
    document.title = titulo;
    const desfazer = [
      definir('meta[name="description"]', tag('meta', { name: 'description' }), 'content', descricao),
      definir('link[rel="canonical"]', tag('link', { rel: 'canonical' }), 'href', ORIGEM + caminho),
      definir('meta[name="robots"]', tag('meta', { name: 'robots' }), 'content', indexar ? 'index, follow' : 'noindex, nofollow'),
    ];
    return () => {
      document.title = tituloAntes;
      desfazer.reverse().forEach((f) => f());
    };
  }, [titulo, descricao, caminho, indexar]);
}

/** Só impede a indexação (área logada), sem mexer em título, descrição nem canonical. */
export function useNoindex() {
  useEffect(() => definir('meta[name="robots"]', tag('meta', { name: 'robots' }), 'content', 'noindex, nofollow'), []);
}

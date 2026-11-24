import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * No servidor, o nginx tenta `$uri/` antes do index.html: uma pasta em public/ com o nome
 * de uma rota (ex.: public/login) faz /login responder 403 ao abrir o link direto.
 */
describe('arquivos públicos x rotas', () => {
  it('nenhuma pasta de public/ tem o nome de uma rota de primeiro nível', () => {
    const raiz = join(__dirname, '..', '..');
    const rotas = [...readFileSync(join(raiz, 'src', 'rotas.tsx'), 'utf8').matchAll(/path: '\/([a-z-]+)/g)].map((m) => m[1]);
    expect(rotas).toEqual(expect.arrayContaining(['login', 'conheca', 'app']));
    const pastas = readdirSync(join(raiz, 'public')).filter((n) => statSync(join(raiz, 'public', n)).isDirectory());
    expect(pastas.filter((p) => rotas.includes(p))).toEqual([]);
  });
});

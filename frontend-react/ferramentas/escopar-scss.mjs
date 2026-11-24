// Converte o SCSS de um componente Angular (encapsulado) em SCSS restrito à tag do componente.
//   node ferramentas/escopar-scss.mjs <origem.scss> <tag> <destino.scss>
// `:host` vira `&` dentro de `tag { ... }`; @keyframes ficam fora do bloco.
import { readFileSync, writeFileSync } from 'node:fs';

const [origem, tag, destino] = process.argv.slice(2);
let css = readFileSync(origem, 'utf8');
const keyframes = [];
css = css.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, (bloco) => { keyframes.push(bloco); return ''; });
if (css.includes('::ng-deep')) css = css.replaceAll('::ng-deep ', '');
css = css.replace(/:host\(([^)]*)\)/g, '&$1').replace(/:host/g, '&');
const saida = `/* Gerado de ${origem.replace(/^.*src\//, 'src/')} — escopado em <${tag}>. */\n${tag} {\n${css}\n}\n${keyframes.join('\n')}\n`;
writeFileSync(destino, saida);

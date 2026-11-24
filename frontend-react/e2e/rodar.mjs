// Testes de uso real (navegador de verdade) contra um ambiente de demonstração descartável.
//
//   npm run e2e                 # sobe backend de demonstração + front, roda os roteiros e desliga tudo
//   CHROME=/caminho/do/chrome   # se o Chrome não estiver em /Applications (macOS)
//   E2E_JAR=../backend/target/parkflash-api-0.1.0.jar  (padrão; gere com: cd backend && ./mvnw -q package -DskipTests)
//
// O backend roda com H2 em pasta temporária, dados de demonstração (db/demo) e push desligado.
// Nada é enviado para fora da máquina.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const front = resolve(aqui, '..');
const jar = resolve(front, process.env.E2E_JAR ?? '../backend/target/parkflash-api-0.1.0.jar');
const PORTA_API = Number(process.env.E2E_PORTA_API ?? 18092);
const PORTA_FRONT = Number(process.env.E2E_PORTA_FRONT ?? 4310);
const BASE = `http://localhost:${PORTA_FRONT}`;

if (!existsSync(jar)) {
  console.error(`Backend não encontrado em ${jar}. Gere com: cd backend && ./mvnw -q package -DskipTests`);
  process.exit(2);
}

const pasta = mkdtempSync(join(tmpdir(), 'parkflash-e2e-'));
const processos = [];
const iniciar = (cmd, args, opcoes) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opcoes });
  processos.push(p);
  return p;
};
const encerrar = () => {
  for (const p of processos) { try { p.kill('SIGTERM'); } catch { /* já saiu */ } }
  rmSync(pasta, { recursive: true, force: true });
};
process.on('exit', encerrar);
process.on('SIGINT', () => process.exit(130));

async function esperar(url, aceita, limiteMs = 90_000) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    try { if (aceita((await fetch(url)).status)) return; } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Tempo esgotado esperando ${url}`);
}

console.log('→ Subindo backend de demonstração…');
iniciar('java', ['-jar', jar, `--server.port=${PORTA_API}`], { cwd: pasta, env: { ...process.env, PUSH_ENVIAR: 'false' } });
await esperar(`http://127.0.0.1:${PORTA_API}/api/fichas`, (s) => s === 401);

console.log('→ Subindo front (Vite)…');
iniciar('npx', ['vite', '--port', String(PORTA_FRONT), '--strictPort'], { cwd: front, env: { ...process.env, API_ALVO: `http://127.0.0.1:${PORTA_API}` } });
await esperar(`${BASE}/login`, (s) => s === 200);

let falhas = 0;
for (const roteiro of ['fluxos-originais.mjs', 'fluxos-novos.mjs', 'acessibilidade.mjs']) {
  console.log(`\n=== ${roteiro} ===`);
  const saida = await new Promise((ok) => {
    const p = spawn(process.execPath, [join(aqui, roteiro), BASE], { stdio: ['ignore', 'pipe', 'inherit'] });
    let texto = '';
    p.stdout.on('data', (d) => { texto += d; process.stdout.write(d); });
    p.on('close', () => ok(texto));
  });
  const aprovados = (saida.match(/✅|✔/g) ?? []).length;
  const reprovados = (saida.match(/❌|✖/g) ?? []).length;
  falhas += reprovados + (aprovados === 0 ? 1 : 0);
  console.log(`→ ${aprovados} aprovados, ${reprovados} reprovados`);
}

console.log(falhas ? `\n✖ ${falhas} falha(s) nos testes de uso real.` : '\n✔ Todos os testes de uso real passaram.');
process.exit(falhas ? 1 : 0);

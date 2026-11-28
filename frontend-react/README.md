# Park Flash — Front end em React

Front end do Park Flash em **React 18 + TypeScript**, com as mesmas regras da versão Angular e a identidade visual nova (ver `docs/modernizacao-visual-relatorio.md`) (pasta `src/` na raiz do repositório). Ele usa a mesma API Spring Boot (`backend/`).

## Tecnologias

| Para quê | Biblioteca |
|---|---|
| Interface | React 18 (componentes de função e hooks) |
| Linguagem | TypeScript 5.7 (modo `strict`) |
| Build e servidor de desenvolvimento | Vite 5 |
| Rotas | React Router 6 (carregamento sob demanda de cada tela) |
| Estado global | Zustand (uma store por recurso: fichas, unidades, manobristas…) |
| Gráficos | Chart.js 4 |
| Animações | GSAP (sequências, landing) + Motion (presença de componentes); ambos respeitam "reduzir movimento" |
| Ícones e fontes | Lucide; Plus Jakarta Sans e Inter servidas pelo próprio site (@fontsource) |
| Qualidade | ESLint (typescript-eslint + regras de hooks) |
| Estilos | SCSS com design tokens (azul #186A9D, azul-marinho #10283F) em `estilos.scss` |
| Testes | Vitest + Testing Library (jsdom) |

## Como rodar

Pré-requisito: a API rodando em `http://localhost:8080` (veja o README da raiz).

```bash
cd frontend-react
npm install
npm run dev          # http://localhost:4200 (o Vite encaminha /api para a 8080)
```

Outros comandos:

```bash
npm test             # testes unitários (69)
npm run e2e          # testes de uso real + acessibilidade (sobe backend de demonstração e front sozinho)
npm run a11y -- URL  # só a auditoria de acessibilidade (axe, WCAG A/AA) contra um front já rodando
npm run lint         # ESLint
npm run typecheck    # TypeScript sem gerar arquivos
npm run build        # checa os tipos e gera dist/ para produção
npm run preview      # serve o build de produção localmente
```

Para apontar o proxy para outra porta da API: `API_ALVO=http://127.0.0.1:18082 npm run dev`.

## Estrutura

```
src/
├── main.tsx                 # entrada: confirma a sessão salva e monta o app
├── rotas.tsx                # rotas + proteção (login, sem login e por nível de acesso)
├── estilos.scss             # estilos globais e design tokens
├── nucleo/
│   ├── modelos/             # tipos: Ficha, Manobrista, Unidade, Usuario…
│   ├── servicos/            # API (fetch + token), cálculos, períodos, permissões, relatórios, pagamentos…
│   └── estado/              # stores Zustand: auth, fichas, despesas, unidades, sócios, avisos, layout
├── compartilhado/           # componentes e hooks reutilizáveis
│   ├── Modal, Confirmar, Calendario, Grafico, CartaoKpi, CabecalhoPagina, Paginacao, Icone, Logo, Aviso
│   ├── useFormulario        # formulários com validação ("tocado", erros, máscaras, números)
│   ├── useConsulta          # busca na API que recomeça quando os filtros mudam (cancela a anterior)
│   ├── usePrenderFoco       # mantém o foco do teclado dentro de modais
│   └── formatos, mascara    # moeda, datas, CPF, telefone, e-mail
├── layout/                  # menu lateral (desktop), barra inferior (celular), layout das telas
└── telas/                   # uma pasta por tela: login, dashboard, fichas, relatórios, pagamentos…
```

## Decisões de projeto

- **Regras de negócio sem framework.** Cálculos (`calc.ts`), períodos (`periodo.ts`) e permissões (`permissoes.ts`) são funções puras de TypeScript: são as mesmas da versão Angular e são testadas isoladamente.
- **O servidor é a fonte da verdade.** O front calcula só a prévia (saldo da ficha enquanto digita); a API recalcula e valida tudo, inclusive as permissões.
- **Estilos encapsulados por componente.** Cada componente usa como raiz um elemento com o nome do componente (`<pf-sidebar>`, `<pf-modal>`…) e o seu SCSS fica restrito a ele. É o mesmo encapsulamento do Angular, sem precisar renomear classes.
- **Gráficos atualizados no lugar.** Quando os dados chegam em partes, o gráfico existente é atualizado em vez de recriado, então a animação não recomeça.
- **Acessibilidade.** Modais prendem o foco e fecham com Esc, o calendário funciona pelo teclado e os avisos usam `role="status"` ou `role="alert"`.

## Testes

- **Unitários** (`npm test`): cálculos, períodos, permissões, máscaras, fichas (API simulada), login e sessão (token, 401), formulário e gráfico.
- **De uso real** (feitos durante a migração, com navegador): lançar e enviar ficha, despesas, manobristas com máscara, reconhecer e pagar diária, calendário, permissões de gerente e operador, menu do celular e logout. Todos passaram no build de produção.
- **Visual:** prints de todas as telas, comparados pixel a pixel com a versão Angular, no desktop e no celular.

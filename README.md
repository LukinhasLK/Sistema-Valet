# ValetGest

Sistema de gestão financeira para serviços de manobrista/valet — controla fichas diárias, pagamento de manobristas, despesas, divisão de lucro entre sócios e relatórios mensais (PDF/Excel).

Duas partes neste repositório:

- **`backend/`** — API REST em Java 17 + Spring Boot
- **`frontend/`** — SPA em React + Vite + Tailwind

## Como rodar

Precisa de dois terminais abertos.

### Terminal 1 — Backend

```bash
cd backend
./mvnw spring-boot:run
```

Sobe em `http://localhost:8080`. Por padrão usa o banco H2 em memória e popula usuários/unidades/manobristas de teste ao iniciar (veja `DadosIniciais`).

> O `application.properties` também traz uma configuração de PostgreSQL para produção — veja a seção **Segurança** abaixo antes de subir isso para um repositório público.

### Terminal 2 — Frontend

```bash
cd frontend
npm install   # só na primeira vez
npm run dev
```

Abre em `http://localhost:3000`. O Vite faz proxy de `/api/*` para `localhost:8080`.

## Fluxo de uso

1. Login como **Dono**
2. Cadastra **Unidades** (locais onde o valet trabalha)
3. Cadastra **Manobristas** e **Sócios**
4. Cria **Fichas diárias** (uma por dia/unidade): valor inicial/final, quantidade de manobras, lançamentos por manobrista, taxa de cartão e despesas
5. O sistema calcula o **valor líquido** automaticamente
6. Em **Relatórios**, consulta o resumo mensal e exporta em PDF/Excel; em **Divisão de Lucro**, reparte o resultado entre os sócios

## Estrutura

```
backend/src/main/java/com/valetgest/
├── config/       Segurança, CORS, dados iniciais de desenvolvimento
├── controller/    Endpoints REST
├── dto/           Objetos de request/response
├── entity/        Entidades JPA
├── enums/
├── exception/     Handler global de erros
├── repository/    Spring Data JPA
├── security/      JWT (geração/validação/filtro)
└── service/       Regras de negócio

frontend/src/
├── components/    Layout, PrivateRoute, Toast, ConfirmModal
├── context/       AuthContext (estado global de login)
├── pages/         Login, Dashboard, Fichas, Relatórios, Manobristas,
│                  Unidades, Sócios, Divisão de Lucro, Usuários, Despesas
├── services/      Cliente Axios (api.js)
└── utils/         Formatação (moeda, data)
```

## Stack técnica

**Backend:** Java 17 · Spring Boot 3.3 (Web, Data JPA, Security, Validation) · JWT (jjwt) · H2 (dev) / PostgreSQL (prod) · Lombok · Apache POI (Excel) · iText 7 (PDF) · JUnit 5 + Mockito

**Frontend:** React 18 · Vite 5 · React Router 6 · Axios · Tailwind CSS · GSAP (animações) · ECharts (gráficos) · Lucide React (ícones) · PWA (vite-plugin-pwa)

## Segurança — atenção antes de publicar

- `backend/src/main/resources/application.properties` contém **usuário, senha de banco PostgreSQL e o segredo JWT em texto puro**. Adicionei um `.gitignore`, mas esse arquivo **não estava ignorado até agora** — confirme que ele nunca foi commitado (`git log --all -- backend/src/main/resources/application.properties`) e, se já tiver subido em algum push, troque a senha do banco e o `jwt.secret` imediatamente. O ideal é mover esses valores para variáveis de ambiente (`${DB_PASSWORD}`, `${JWT_SECRET}`) e manter só um `application-example.properties` versionado.
- Não há autorização por papel (`DONO` x `GERENTE`) na maior parte dos endpoints — qualquer usuário autenticado consegue criar/editar usuários, unidades e sócios pela API, mesmo que a tela esconda esses menus para o gerente. Ver detalhes na avaliação de código.

## Próximos passos (sugestões)

- Restringir endpoints administrativos a `DONO` (`@PreAuthorize` ou checagem manual, como já existe em `FichaService`)
- Externalizar credenciais/segredos do `application.properties`
- Permitir editar fichas já criadas (hoje só cria e exclui)
- Adicionar CI (build + testes) e cobertura de testes no frontend
- Deploy (Railway, Render, VPS) com PostgreSQL

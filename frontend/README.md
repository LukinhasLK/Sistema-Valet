# ValetGest — Frontend

Interface web do sistema, feita em **React + Vite + Tailwind**.

## Como rodar

### Pré-requisitos
- Node.js 18+ instalado
- O backend Spring Boot rodando em `http://localhost:8080`

### Passos

```bash
cd valetgest-frontend

# Instalar dependências (só na primeira vez)
npm install

# Rodar
npm run dev
```

Abre em `http://localhost:3000`.

### Build de produção

```bash
npm run build
```

Gera os arquivos otimizados em `dist/`.

## Login

Os mesmos usuários do backend:

| Tipo    | Email                    | Senha   |
|---------|--------------------------|---------|
| Dono    | dono@valetgest.com       | 123456  |
| Gerente | gerente1@valetgest.com   | 123456  |

## Telas

- **Login** — autenticação com JWT
- **Dashboard** — resumo do mês + fichas recentes
- **Fichas** — listagem
- **Nova ficha** — formulário com cálculo do líquido em tempo real
- **Detalhe da ficha** — vê tudo de uma ficha
- **Relatórios** — mensal + exportar PDF/Excel
- **Manobristas** — CRUD
- **Unidades** — CRUD (só dono)

## Estrutura

```
src/
├── App.jsx                     ← Rotas
├── main.jsx                    ← Entry point
├── index.css                   ← Tailwind + estilos globais
├── components/
│   ├── Layout.jsx              ← Sidebar + área de conteúdo
│   └── PrivateRoute.jsx        ← Proteção de rotas
├── context/
│   └── AuthContext.jsx         ← Estado global de autenticação
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── ListaFichas.jsx
│   ├── NovaFicha.jsx           ← Mais importante - cálculos em tempo real
│   ├── DetalheFicha.jsx
│   ├── Relatorios.jsx
│   ├── Manobristas.jsx
│   └── Unidades.jsx
├── services/
│   └── api.js                  ← Axios configurado com JWT
└── utils/
    └── format.js               ← Formatação BRL, datas, etc
```

## Conceitos React usados

- **useState** — estado local de cada componente
- **useEffect** — chamadas de API ao carregar a página
- **useMemo** — cálculo do valor líquido em tempo real (na NovaFicha)
- **useContext** — autenticação acessível em qualquer componente
- **react-router-dom** — navegação entre páginas (SPA)
- **Componentes filhos** — Card, Linha, ResumoItem para evitar repetição

## Como o frontend conversa com o backend

1. Login → `POST /api/auth/login` → recebe JWT
2. JWT é guardado no `localStorage`
3. Axios injeta o token em todas as próximas chamadas (interceptor)
4. Se o backend retornar 401, desloga automaticamente
5. Vite faz proxy `/api/*` → `localhost:8080` (sem CORS no dev)

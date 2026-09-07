# ValetGest — Sistema completo

Sistema de gestão financeira para serviço de manobrista/valet.

Esse repositório tem duas partes:

- **`backend/`** — API REST em Spring Boot (Java)
- **`frontend/`** — interface web em React + Vite + Tailwind

## Como rodar tudo

Você precisa de **dois terminais abertos**.

### Terminal 1 — Backend

```bash
cd backend
./mvnw spring-boot:run
```

Sobe em `http://localhost:8080`. Já vem com banco H2 (em memória) e dados de teste.

### Terminal 2 — Frontend

```bash
cd frontend
npm install   # só na primeira vez
npm run dev
```

Abre em `http://localhost:3000`.

## Login

| Tipo    | Email                    | Senha   |
|---------|--------------------------|---------|
| Dono    | dono@valetgest.com       | 123456  |
| Gerente | gerente1@valetgest.com   | 123456  |

## O que cada parte faz

### Backend (Spring Boot)

- API REST completa com JWT
- 35+ arquivos Java organizados em camadas (entity → repository → service → controller)
- Banco H2 (dev) e PostgreSQL (prod) configurados
- Geração de PDF (iText) e Excel (Apache POI)
- Testes unitários com JUnit 5 + Mockito
- Veja `backend/README.md` para detalhes

### Frontend (React)

- 8 páginas completas (login, dashboard, fichas, relatórios, etc)
- Login com JWT e proteção de rotas
- Cálculo do valor líquido em tempo real
- Download de PDF e Excel direto da tela
- Tailwind para estilização
- Veja `frontend/README.md` para detalhes

## Fluxo de uso

1. Faz login como **Dono**
2. Cadastra **Unidades** (locais onde o valet trabalha)
3. Cadastra **Manobristas** (funcionários)
4. Cria **Fichas diárias** (uma por dia/unidade):
   - Valor inicial e final do caixa
   - Quantidade de manobras
   - Quais manobristas trabalharam e quanto cada um recebeu
   - Taxa do cartão e despesas
5. O sistema **calcula o valor líquido automaticamente**
6. No fim do mês, vai em **Relatórios** e gera o PDF/Excel

## Próximos passos (sugestões)

- Trocar H2 por PostgreSQL e fazer deploy (Railway, Render, VPS)
- Adicionar gráficos no dashboard (recharts)
- Permitir editar fichas (hoje só cria e exclui)
- Notificações por email/WhatsApp ao final do mês
- App mobile com React Native

## Stack técnica

**Backend:**
- Java 17
- Spring Boot 3.3
- Spring Security + JWT
- Spring Data JPA
- H2 / PostgreSQL
- Lombok
- Apache POI (Excel)
- iText (PDF)
- JUnit 5 + Mockito (testes)

**Frontend:**
- React 18
- Vite
- React Router
- Axios
- Tailwind CSS
- Lucide Icons
# Sistema-Valet

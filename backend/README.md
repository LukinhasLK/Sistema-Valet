# ValetGest — Sistema de Gestão de Manobristas

Sistema completo de gestão financeira para serviços de manobrista/valet.

## O que ele faz

- Registra fichas diárias por unidade (valor inicial e final, quantidade de manobras)
- Calcula automaticamente o pagamento dos manobristas (3 modalidades diferentes)
- Aplica taxa de cartão sobre o valor recebido em cartão
- Lança despesas variáveis do dia
- Calcula o **valor líquido** automaticamente
- Gera relatórios mensais detalhados por unidade ou geral
- Login com JWT (dono vê tudo, gerente vê só a unidade dele)

## Como rodar

### Pré-requisitos
- Java 17 ou superior
- Maven 3.6+

### Passo a passo

```bash
# Entrar na pasta do projeto
cd valetgest

# Rodar a aplicação
./mvnw spring-boot:run
```

A aplicação sobe em `http://localhost:8080`.

O console do banco H2 fica em `http://localhost:8080/h2-console`
(usuário: `sa`, senha: vazia, JDBC URL: `jdbc:h2:mem:valetgest`).

## Usuários de teste

Já vem com dois usuários cadastrados:

| Tipo    | Email                    | Senha   |
|---------|--------------------------|---------|
| Dono    | dono@valetgest.com       | 123456  |
| Gerente | gerente1@valetgest.com   | 123456  |

## Endpoints da API

### Autenticação (público)
- `POST /api/auth/login` — fazer login

### Unidades (autenticado)
- `GET    /api/unidades` — listar
- `POST   /api/unidades` — criar
- `PUT    /api/unidades/{id}` — atualizar
- `DELETE /api/unidades/{id}` — desativar

### Manobristas (autenticado)
- `GET    /api/manobristas`
- `POST   /api/manobristas`
- `PUT    /api/manobristas/{id}`
- `DELETE /api/manobristas/{id}`

### Fichas (autenticado)
- `GET    /api/fichas` — listar (gerente vê só da sua unidade)
- `POST   /api/fichas` — criar
- `GET    /api/fichas/{id}` — detalhe
- `DELETE /api/fichas/{id}` — apagar

### Relatórios (autenticado)
- `GET /api/relatorios/mensal?mes=4&ano=2026&unidadeId=1`

## Como testar a API

### 1. Fazer login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dono@valetgest.com","senha":"123456"}'
```

A resposta vai trazer um `token`. Copie esse token para usar nos próximos requests.

### 2. Criar uma ficha
```bash
curl -X POST http://localhost:8080/api/fichas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "dataFicha": "2026-04-28",
    "unidadeId": 1,
    "valorInicial": 0,
    "valorFinal": 800,
    "quantidadeManobras": 50,
    "porcentagemCartao": 3.5,
    "valorEmCartao": 500,
    "lancamentos": [
      {
        "manobristaId": 1,
        "tipoPagamento": "VALOR_FIXO_POR_MANOBRA",
        "quantidadeManobras": 25,
        "valorPorManobra": 5,
        "valorPago": 125
      },
      {
        "manobristaId": 2,
        "tipoPagamento": "PORCENTAGEM",
        "porcentagem": 20,
        "valorPago": 160
      }
    ],
    "despesas": [
      {"descricao": "Lanche dos manobristas", "valor": 30},
      {"descricao": "Combustível", "valor": 50}
    ],
    "observacoes": "Movimento bom hoje"
  }'
```

A resposta já vem com tudo calculado:
- `totalBruto`: 800
- `totalPagoManobristas`: 285
- `taxaCartao`: 17,50 (3.5% de 500)
- `totalDespesas`: 80
- **`valorLiquido`: 417,50** ← é isso que você queria!

### 3. Tirar relatório do mês
```bash
curl "http://localhost:8080/api/relatorios/mensal?mes=4&ano=2026&unidadeId=1" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## Estrutura do projeto

```
src/main/java/com/valetgest/
├── ValetGestApplication.java   ← Classe principal
├── config/                      ← Configurações (segurança, dados iniciais)
├── controller/                  ← Endpoints da API
├── dto/                         ← Objetos de transporte (request/response)
├── entity/                      ← Entidades (tabelas do banco)
├── enums/                       ← Tipos fixos
├── exception/                   ← Tratamento de erros
├── repository/                  ← Acesso ao banco
├── security/                    ← JWT
└── service/                     ← Regras de negócio
```

## Próximos passos

Esse é o backend. Para deixar o sistema completo, ainda falta:

1. **Frontend (React)** — telas de login, fichas, relatórios
2. **Geração de PDF** — usando iText (já está nas dependências)
3. **Geração de Excel** — usando Apache POI (já está nas dependências)
4. **Trocar H2 por PostgreSQL** — para ter persistência real (a config já está no `application.properties`, é só descomentar)
5. **Deploy** — Railway, Render, ou um VPS

Me chama que a gente continua! 🚀

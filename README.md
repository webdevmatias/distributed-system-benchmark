# Distributed System Benchmark

Sistema distribuído desenvolvido para medição de desempenho e comparação com resultados obtidos através do Mercury, uma ferramenta de modelagem e avaliação de desempenho baseada em Redes de Petri Estocásticas.

## Objetivo

Implementar um ambiente distribuído real para coleta de métricas experimentais e comparar os resultados observados com as predições geradas por modelos construídos no Mercury.

O estudo busca analisar métricas como:

- Latência
- Throughput
- Tempo em fila
- Taxa de erro
- Tempo de resposta dos serviços

e verificar a aderência entre os resultados empíricos e os resultados previstos pelo modelo analítico.

## Tecnologias Utilizadas

| Tecnologia | Finalidade                                |
| ---------- | ----------------------------------------- |
| Node.js    | Implementação dos microsserviços          |
| Express    | APIs HTTP                                 |
| RabbitMQ   | Comunicação assíncrona                    |
| SQLite     | Persistência                              |
| Docker     | Containerização                           |
| JMeter     | Geração de carga                          |
| Mercury    | Modelagem com Redes de Petri Estocásticas |
|            |                                           |

## Contexto Acadêmico

O projeto foi desenvolvido para apoiar estudos de avaliação de desempenho de sistemas distribuídos. Os resultados experimentais obtidos através da execução do sistema serão comparados com modelos construídos no Mercury, permitindo analisar a precisão das estimativas geradas por Redes de Petri Estocásticas em diferentes cenários de carga e latência.

## Como Executar

### Pré-requisitos

- Docker
- Docker Compose

### Inicialização do Ambiente

```bash
docker compose up --build
```

Para executar em segundo plano:

```bash
docker compose up -d --build
```

Para encerrar os containers:

```bash
docker compose down
```

---

## Validação Manual

### Verificação de Saúde

```bash
curl http://localhost:3000/health
```

### Criação de Pedido

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"productId":1}'
```

### Consulta de Métricas

```bash
curl http://localhost:3000/metrics
curl http://localhost:3001/metrics
curl http://localhost:3002/metrics
curl http://localhost:3003/metrics
```

### Consulta de Pagamentos Processados

```bash
curl http://localhost:3003/payments
```

---

## Interface de Administração do RabbitMQ

Após a inicialização dos containers, a interface de gerenciamento do RabbitMQ estará disponível em:

```text
http://localhost:15672
```

Credenciais padrão:

```text
Usuário: guest
Senha: guest
```

A interface permite acompanhar:

- Filas ativas
- Taxa de mensagens
- Throughput
- Consumidores conectados
- Utilização de recursos do broker

---

## Configuração de Latências

O sistema permite a inserção de atrasos artificiais para simular diferentes cenários de carga e comunicação distribuída.

As variáveis podem ser alteradas diretamente no arquivo `docker-compose.yml`.

| Variável          | Padrão | Descrição                               |
| ----------------- | ------ | --------------------------------------- |
| GATEWAY_DELAY_MS  | 0      | Latência artificial do Gateway          |
| ORDERS_DELAY_MS   | 0      | Latência artificial do Orders Service   |
| PRODUCTS_DELAY_MS | 0      | Latência artificial do Products Service |
| PAYMENTS_DELAY_MS | 0      | Latência artificial do Payments Service |

### Exemplo

```yaml
environment:
  GATEWAY_DELAY_MS: 50
  ORDERS_DELAY_MS: 100
  PRODUCTS_DELAY_MS: 150
  PAYMENTS_DELAY_MS: 200
```

Essas configurações permitem reproduzir cenários utilizados na modelagem por Redes de Petri Estocásticas e avaliar o impacto da latência no desempenho global do sistema.

---

## Testes de Carga com JMeter

O JMeter é utilizado para geração de carga e coleta de métricas experimentais.

### Configuração Básica

1. Criar um **Thread Group**
2. Definir:
   - Número de usuários virtuais
   - Ramp-up
   - Quantidade de iterações

3. Adicionar um **HTTP Request**

```text
Method: POST
URL: http://localhost:3000/api/orders
```

Body:

```json
{
  "productId": 1
}
```

Header:

```text
Content-Type: application/json
```

### Relatórios Recomendados

- Summary Report
- Aggregate Report
- Response Time Graph
- Throughput Graph

### Métricas Coletadas pelo JMeter

- Tempo médio de resposta
- Throughput
- Percentis
- Taxa de erro
- Requisições por segundo

Os resultados podem ser exportados em CSV para posterior comparação com os resultados obtidos através do Mercury.

---

## Métricas Coletadas pelo Sistema

Cada microsserviço disponibiliza um endpoint:

```http
GET /metrics
```

Exemplo de resposta:

```json
{
  "requests": 0,
  "avgLatency": 0,
  "minLatency": 0,
  "maxLatency": 0,
  "errors": 0
}
```

### Significado das Métricas

| Campo      | Descrição                        |
| ---------- | -------------------------------- |
| requests   | Total de requisições processadas |
| avgLatency | Latência média observada         |
| minLatency | Menor latência registrada        |
| maxLatency | Maior latência registrada        |
| errors     | Quantidade de erros registrados  |

---

## Endpoints Disponíveis

| Endpoint               | Descrição                              |
| ---------------------- | -------------------------------------- |
| GET /health            | Verificação de saúde do serviço        |
| GET /metrics           | Métricas internas do serviço           |
| POST /api/orders       | Criação de pedidos                     |
| GET /payments          | Pagamentos processados e tempo em fila |
| http://localhost:15672 | Interface administrativa do RabbitMQ   |

---

## Comparação com o Mercury

Os experimentos realizados neste ambiente têm como objetivo comparar métricas observadas em execução real com resultados obtidos por modelos de Redes de Petri Estocásticas desenvolvidos no Mercury.

A comparação considera principalmente:

- Tempo médio de resposta
- Throughput
- Tempo de espera em fila
- Utilização dos recursos
- Impacto de diferentes níveis de carga
- Impacto de latências artificiais

Essa análise permite avaliar a precisão dos modelos analíticos na representação do comportamento de sistemas distribuídos reais.

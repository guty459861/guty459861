# Aula 16 · Testes de carga e desempenho com JMeter

Este pacote tem tudo o que vocês precisam para a prática da Aula 16.
Siga o **guia da prática** (link enviado pela professora): ele explica cada passo com detalhes.

## O que tem aqui

| Pasta / arquivo | Para que serve |
|---|---|
| `api/server.js` | A API do Mini Chamados, que será **testada**. Feita só com Node.js, sem nada para instalar. |
| `jmeter/plano-inicial.jmx` | Plano de teste do JMeter já começado: 1 requisição e 3 relatórios. Vocês vão completar. |
| `resultados/planilha-resultados.csv` | Planilha para anotar os números de cada cenário. Abre no Excel ou no Google Planilhas. |
| `plano-b/carga.js` | Só use se o JMeter não funcionar no seu computador. Faz o mesmo teste pelo terminal. |

## Requisito de desempenho que vamos verificar

> **RNF-01** · Com até **20 usuários simultâneos**, cada rota da API deve responder com
> **tempo no percentil 90 de no máximo 800 ms** e **taxa de erro de no máximo 1%**.

## Passo 1 · Ligar a API

1. Abra a pasta `aula16-jmeter` no VS Code.
2. Abra o terminal (**Terminal › Novo Terminal**) e rode:

```
cd api
node server.js
```

3. Deve aparecer: `API do Mini Chamados rodando na porta 3333`.
4. Abra **http://localhost:3333** no navegador. É o painel de monitoramento.
5. **Deixe esse terminal aberto** durante toda a aula. Se fechar, a API desliga.

## Passo 2 · Instalar o JMeter

1. O JMeter precisa do **Java 8 ou mais recente** (recomendado: 17). Teste no terminal: `java -version`.
   - Se não tiver, instale o **JDK 17** (Adoptium Temurin: adoptium.net) e feche e abra o terminal.
2. Baixe o JMeter em **jmeter.apache.org › Download Releases**: arquivo **apache-jmeter-5.6.3.zip** (seção *Binaries*).
3. Descompacte, por exemplo, em `C:\jmeter`.
4. Abra o JMeter:
   - Windows: clique duas vezes em `C:\jmeter\apache-jmeter-5.6.3\bin\jmeter.bat`
   - Linux/macOS: `./apache-jmeter-5.6.3/bin/jmeter.sh`
5. No JMeter: **File › Open** e escolha `jmeter/plano-inicial.jmx`.

## Passo 3 · Rodar o relatório em HTML (modo terminal)

Depois de montar e salvar o plano, rode no terminal **dentro da pasta `bin` do JMeter**:

```
jmeter -n -t CAMINHO\plano-inicial.jmx -l resultados.jtl -e -o relatorio-c3
```

- `-n` roda sem janela (mais leve e mais preciso)
- `-t` é o plano de teste
- `-l` é o arquivo com todas as amostras
- `-e -o` gera o relatório HTML na pasta indicada (a pasta não pode existir antes)

Abra `relatorio-c3/index.html` no navegador.

## Plano B (sem JMeter)

Com a API ligada, em **outro** terminal:

```
cd plano-b
node carga.js 1 10 1     (cenário C1: 1 usuário)
node carga.js 10 10 5    (cenário C2: 10 usuários)
node carga.js 20 10 5    (cenário C3: 20 usuários)
```

## Problemas comuns

| Problema | Solução |
|---|---|
| `java não é reconhecido` | Instale o JDK e feche e abra o terminal. |
| `EADDRINUSE: address already in use :::3333` | A API já está ligada em outro terminal. Use esse ou feche-o. |
| JMeter mostra `Connection refused` | A API está desligada. Volte ao Passo 1. |
| Todos os POST dão erro 415 | Falta o **HTTP Header Manager** com `Content-Type: application/json`. |
| `relatorio-c3 is not empty` | Apague a pasta do relatório anterior ou use outro nome. |

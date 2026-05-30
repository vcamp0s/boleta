# Boleta · Controle Financeiro

PWA (app web instalável) de controle financeiro pessoal. Tema escuro futurista com
detalhes em azul/neon. **Todos os dados ficam só no seu dispositivo** (localStorage) —
sem servidor, sem nuvem, sem cadastro. Acesso protegido por PIN de 4 dígitos.

## Funcionalidades

- **Entradas semanais** (segunda a domingo), separadas em **Boleta Principal** e **Patrocinadores**.
- **Despesas fixas** configuráveis (ex: Aluguel, Prebenda), com **reajuste anual** por % —
  cada ano guarda seu próprio valor, preservando o histórico.
- **Contas variáveis** por mês (ex: Luz, Água), com entrada manual.
- **Resumo mensal** com saldo automático (Entradas − Saídas), em **verde** (positivo) ou **vermelho** (negativo).
- **Histórico** comparativo de saldos por mês e por ano.
- **Exportar para o WhatsApp**: copia um resumo formatado pronto para colar.
- **Backup/restauração em arquivo `.json`** (aba Histórico): exporte para guardar ou levar
  para outro aparelho; ao restaurar, o PIN do aparelho atual é mantido.
- **PIN numérico de 4 dígitos** (guardado como hash, não em texto puro).

## Como rodar

O PWA precisa ser servido por http (o service worker não funciona abrindo o arquivo direto).

```sh
node tools/serve.js
```

Depois abra **http://localhost:8080** no navegador. No celular/Chrome, use
"Adicionar à tela inicial" para instalar como app.

## Estrutura

```
index.html              # telas: bloqueio + app (resumo, entradas, despesas, histórico)
css/styles.css          # tema escuro neon
js/utils.js             # datas, semanas, moeda BR, hash do PIN
js/store.js             # estado + persistência (localStorage)
js/app.js               # interface, navegação, eventos, export
manifest.webmanifest    # PWA
sw.js                   # cache offline
icons/icon-192/512.png  # logo do app (ícone do dispositivo)
icons/company.png       # logo da empresa (tela de bloqueio e topo)
tools/serve.js          # servidor local de desenvolvimento
```

## Observação sobre segurança

O PIN protege o acesso casual e os dados ficam apenas no navegador deste dispositivo.
Não é criptografia forte — é a proteção adequada para um app pessoal local. Se limpar os
dados do navegador, os lançamentos são apagados.

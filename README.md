# Collection Store — Vitrine Interativa & Painel Administrativo (Showcase)

> **"Um problema, uma solução digital"** — Landing page de catálogo multimarcas com seleção interativa de itens, geração automática de formulário em background, redirecionamento formatado para WhatsApp e painel administrativo com autenticação na borda.

*(Versão pública demonstrativa: dados sensíveis, número real de WhatsApp e endpoints de publicação automática no repositório foram omitidos por segurança).*

## O Problema e a Solução

- **Dor original:** atendimento pelo WhatsApp com catálogo espalhado em fotos avulsas, exigindo que clientes digitassem manualmente marca, tamanho, volumetria ou modelo — causando demora e erros nos pedidos.
- **Solução digital:** vitrine leve em **HTML5, CSS3 e JavaScript puro** (sem dependências pesadas ou banco de dados mensal) que monta um formulário estruturado em background conforme o cliente seleciona os itens e já preenche a mensagem pronta na caixa do WhatsApp ao finalizar.

## Funcionalidades Principais

- **10 Departamentos curados:** DeMillus, Romance, Dicorpo, Perfumes Importados Originais, Roupas Fitness, Marca Própria Collection Store, Acessórios, Bolsas, Sexshop Discreto e iPhones Novos/Seminovos.
- **Seleção de variações em tempo real:** troca dinâmica de preço conforme tamanho, volumetria (`ml`), capacidade ou condição do item.
- **Formulário gerado em background:** sincronização em tempo real de inputs ocultos e prévia ao vivo da mensagem do pedido.
- **Painel Administrativo (`/painel/`):** cadastro, edição, duplicação, pausa e compressão de imagens via `<canvas>` no navegador (em modo demonstração / exportação JSON neste repositório público).
- **Autenticação na Borda (`functions/`):** proteção via middleware Edge com tela de login própria e sessão assinada por **HMAC-SHA256** em cookie `HttpOnly`.

## Estrutura

- `public/` — Vitrine pública (`index.html`, `css/styles.css`, `js/`, `data/catalog.json`, `assets/`) e interface do painel (`painel/`).
- `functions/` — Middleware de autenticação na borda (`_shared/auth.js` e `painel/_middleware.js`).

## Como Executar Localmente

1. Ajuste o número de WhatsApp demonstrativo em `public/js/config.js` (`whatsappNumber`), se desejar testar com seu aparelho.
2. Sirva a pasta `public/`:
   ```bash
   python -m http.server 8787 --bind 127.0.0.1 --directory public
   ```
3. Acesse `http://127.0.0.1:8787/` para a vitrine e `http://127.0.0.1:8787/painel/` para visualizar o painel em modo demonstração.

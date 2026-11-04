# 0002. Hospedagem no GitHub Pages, com o repositório público

- Status: Aceita
- Data: 2026-11-04
- Questão: onde hospedar o app (item 3 do preparo)

## Contexto

O app é estático: roda inteiro no navegador e salva os dados localmente
([0003](0003-app-so-local-na-v1.md)), sem backend. O código já está no GitHub. Num repositório
privado do plano Free, o GitHub Pages não está disponível.

## Decisão

Publicar o build estático do Vite no GitHub Pages. O repositório passa a ser público.

## Alternativas consideradas

- **Vercel ou Netlify** — plano grátis, preview por PR e funciona com repo privado, mas exige mais
  uma conta e uma integração.
- **Manter o repo privado com GitHub Pro** — custo mensal só para hospedar um site estático.

## Consequências

- Tudo fica no GitHub: código, CI e publicação.
- Não há preview por PR: o teste de cada task é local.
- Com o repositório público, os rulesets passam a estar disponíveis no plano Free; o
  `./scripts/bootstrap.sh` pode proteger a `main`, o que falhou com o repositório privado.
- O build precisa respeitar o caminho base do Pages (`/<repo>/`) se não houver domínio próprio.

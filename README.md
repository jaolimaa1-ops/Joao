# Órbita — Painel Mercado Livre

Primeira versão de aplicativo web em português, responsivo, com dashboard, produtos, anúncios, vendas e consulta de reclamações relacionadas a devoluções.

## Executar

Requer Node.js 22 ou superior. Não utiliza dependências externas.

```sh
cd /workspace/Joao
npm start
```

Sem credenciais, apresenta dados fictícios explicitamente identificados. Os períodos de 7, 30 e 90 dias alteram os dados e o gráfico.

## Conectar uma conta real

Cadastre sua aplicação no portal oficial de desenvolvedores do Mercado Livre. Configure a URL de retorno cadastrada, exatamente igual a `ML_REDIRECT_URI`. Use HTTPS em uma implantação acessível externamente. Copie `.env.example` para `.env` e preencha as variáveis **localmente**, nunca no chat ou em commits:

- `ML_CLIENT_ID`: identificador da aplicação.
- `ML_CLIENT_SECRET`: segredo da aplicação, apenas no servidor.
- `ML_REDIRECT_URI`: URL pública do callback `/auth/callback`.
- `APP_URL`: origem pública do aplicativo.

Clique em Conectar Mercado Livre e autorize a conta no site oficial. Tokens ficam na memória do servidor; reiniciar exige reconexão. OAuth usa estado aleatório, cookie HttpOnly e refresh token. Não há armazenamento persistente nem suporte a múltiplos servidores.

## Limites desta versão

A integração usa os endpoints de conta, anúncios, pedidos, visitas e reclamações. A primeira consulta carrega até 50 pedidos e 50 anúncios. Receita e ranking usam somente pedidos pagos carregados e valores brutos em BRL; não descontam taxas, frete, impostos ou reembolsos. Produtos são apresentados a partir dos anúncios, sem cadastro independente de estoque. Reclamações não equivalem a devoluções confirmadas; logística e reembolsos detalhados ainda precisam de implementação.

As consultas reais precisam de validação com uma conta autorizada e permissões adequadas. A versão não está pronta para produção: faltam paginação completa, banco de dados, sincronização por notificações, autenticação própria, proteção contra abuso e testes de integração com a API. Não publique uma instância de produção antes dessas etapas.

## Validar

```sh
npm test
```

Os testes verificam HTTP, arquivos da interface e proteções sem credenciais. Não substituem uma conexão real ao Mercado Livre.

## Publicar com endereço gratuito no Render

1. Acesse https://dashboard.render.com/ e entre com GitHub.
2. Selecione **New > Blueprint**, conecte `jaolimaa1-ops/Joao` e escolha a branch `main`.
3. O arquivo `render.yaml` configura um Web Service no plano **Free**, executa os testes e inicia o servidor. Confira que o plano selecionado é gratuito antes de criar.
4. Após a implantação, abra a URL HTTPS exibida pelo Render. O endereço será atribuído pelo provedor; o nome pode variar conforme disponibilidade.

A primeira publicação funciona em modo demonstração, sem configurar credenciais. O servidor usa automaticamente `RENDER_EXTERNAL_URL` como origem pública. Para habilitar OAuth, cadastre essa origem seguida de `/auth/callback` no Mercado Livre e configure `ML_CLIENT_ID`, `ML_CLIENT_SECRET` e `ML_REDIRECT_URI` no painel seguro do Render. Não exponha segredos no repositório.

O serviço gratuito pode suspender por inatividade e demorar para responder ao primeiro acesso. Como as sessões ficam em memória, reinícios exigem reconectar a conta. Confirme as condições atuais do plano no Render. Publicar o ambiente Codex não publica este site na internet.

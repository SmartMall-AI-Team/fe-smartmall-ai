# SmartMall AI Frontend

Protótipo de interface para acompanhar ocorrências, revisar sugestões de IA, distribuir tarefas e consultar equipamentos do shopping.

## Executar localmente

Requisitos: Node.js 20.19+ ou 22.12+.

```bash
npm ci
```

Configure `VITE_API_BASE_URL` no arquivo `.env.local`. O padrão do `.env.example` é `http://localhost:8000/api/v1`.

```bash
npm run dev
```

Para gerar os arquivos de publicação:

```bash
npm run build
npm run preview
```

## O que está incluído

- Tela de entrada demonstrativa com layout mobile-first e alternância entre tema claro e escuro.
- Painel com indicadores, distribuição por prioridade, fila de atenção e tarefas próximas.
- Lista de ocorrências com busca e filtros rápidos de críticas, atrasadas, abertas e em andamento; exibe o primeiro prazo de tarefa não concluída.
- Abertura de ocorrência sem exigir uma data do solicitante.
- Detalhe com histórico, análise de IA, revisão humana, encaminhamento e criação de tarefa com prazo.
- Tarefas para operação e equipe técnica, com atualização rápida de status.
- Consulta e cadastro de equipamentos.
- Registro manual de mensagem de rádio para revisão e confirmação de status.
- Seletor de perfil demonstrativo para navegar pelas áreas de gestão, operação, técnico e lojista.
- Preferência de tema salva neste navegador e, quando não há escolha anterior, baseada na configuração do sistema.

## Triagem e verificação

Categoria, prioridade, equipe e recomendação podem ser salvas manualmente, inclusive quando a IA falha. Solicitar análise apenas registra sugestões: use **Usar sugestões no formulário** para copiá-las, ajuste os campos e selecione **Confirmar revisão**. Ao reabrir o detalhe, o formulário mostra os valores efetivamente salvos. A indicação de simulação permanece visível e é possível solicitar nova análise.

```bash
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes exigem o backend em `http://127.0.0.1:8000`, com migrações aplicadas, `CORS_ORIGINS=http://localhost:5173` e `AI_SIMULATION=true`. Use um banco exclusivo para testes: os cenários criam registros fictícios e não os removem. `E2E_API_URL` permite apontar os testes e o servidor Vite de testes para outra API; mantenha a porta 5173 livre. O backend continua responsável por manter a chave da IA fora do navegador.

Foram aprovados 12 cenários de navegador: seis fluxos em desktop e celular com Chromium, usando FastAPI e PostgreSQL reais. Cobrem falha controlada de IA com classificação manual, análise explicitamente simulada e revisão persistida, tarefa com prazo e status, bloqueio de encerramento prematuro, histórico, dashboard, equipamento vinculado, recarga do perfil técnico, recuperação de conexão e código de acesso validado no servidor/removido ao sair. A falha de IA e a queda de rede são induzidas no navegador; não representam chamada real ao provedor. O GitHub Actions repete build e testes contra uma revisão fixada do backend.

Para testar o ambiente protegido, defina `E2E_ACCESS_TOKEN` com o mesmo código configurado no backend; o servidor Vite de testes habilita a entrada desse código. Sem essa variável, o cenário de acesso é omitido e os demais continuam disponíveis para o backend local sem proteção. Use códigos exclusivos de teste; traces de falhas podem conter cabeçalhos de requisição.

Filtros completos de categoria/equipamento/local, edição de responsável/prazo de tarefa, autenticação real, teste com usuários e publicação permanecem como trabalho futuro. O build ainda emite aviso de tamanho do bundle; a aplicação compila, mas a divisão do código pode ser melhorada.

## Limites da demonstração

Os perfis são demonstrativos: escolha uma conta fictícia na tela de login. Cada conta abre a área correspondente ao perfil. A troca de perfil no canto inferior esquerdo continua disponível depois da entrada. Essas senhas fictícias são verificadas apenas no frontend, não são enviadas ao backend e não protegem dados. A API permite proteger o ambiente com um código compartilhado separado, sem autenticação ou permissões individuais.

No deploy protegido, `VITE_DEMO_ACCESS_REQUIRED=true` acrescenta o campo **Código de acesso ao ambiente**. Ele é validado pelo backend antes de entrar, enviado no cabeçalho Authorization das chamadas à API e mantido somente na sessão desta aba; sair o remove. Esse código é separado das senhas fictícias e não deve ser colocado em variáveis de build. Os perfis continuam sem autorização individual.

## Vercel

`vercel.json` fixa o preset Vite, instalação `npm ci`, build `npm run build` e saída `dist`. Configure Node.js 24 e as variáveis públicas `VITE_API_BASE_URL=https://<api>/api/v1` e `VITE_DEMO_ACCESS_REQUIRED=true`. O backend precisa permitir a origem HTTPS desse frontend em `CORS_ORIGINS`. Conecte o repositório do frontend, com a raiz do próprio repositório; HACKRUN não é um monorepo publicado. Acompanhe o estado real da publicação no [guia de deploy](https://github.com/SmartMall-AI/docs-smartmall-ai/blob/main/deploy.md).

Contas de teste: `marina` / `marina123` (administração), `operacao` / `operacao123` (operação), `joao` / `joao123` (técnico), `ana` / `ana123` (Loja Zara) e `carlos` / `carlos123` (Livraria). Use somente esses dados fictícios.

A tela de rádio não captura áudio nem transcreve automaticamente. Ela simula a anotação manual e guarda o texto localmente neste navegador; apenas a mudança de status da tarefa é enviada à API. A API também não oferece um campo de prazo na ocorrência; prazos são definidos nas tarefas.

Os dados operacionais vêm da API e não são substituídos por exemplos locais quando ela está indisponível. Para a experiência completa, execute o backend e configure `VITE_API_BASE_URL`.

## API e documentação

- [Contrato da API](https://github.com/SmartMall-AI/docs-smartmall-ai/blob/main/contrato-api.md)
- [Backend](https://github.com/SmartMall-AI/be-smartmall-ai)
- [Contribuição e revisão](CONTRIBUTING.md)

Não coloque chaves do provedor de IA no frontend ou em variáveis `VITE_`: esses valores ficam visíveis no navegador.

# SmartMall AI Frontend

Protótipo de interface para acompanhar ocorrências, revisar sugestões de IA, distribuir tarefas e consultar equipamentos do shopping.

## Executar localmente

Requisitos: Node.js 20.19+ ou 22.12+.

```bash
npm install
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
- Lista de ocorrências com busca, filtros por prioridade, status e atrasos.
- Abertura de ocorrência sem exigir uma data do solicitante.
- Detalhe com histórico, análise de IA, revisão humana, encaminhamento e criação de tarefa com prazo.
- Tarefas para operação e equipe técnica, com atualização rápida de status.
- Consulta e cadastro de equipamentos.
- Registro manual de mensagem de rádio para revisão e confirmação de status.
- Seletor de perfil demonstrativo para navegar pelas áreas de gestão, operação, técnico e lojista.
- Preferência de tema salva neste navegador e, quando não há escolha anterior, baseada na configuração do sistema.

## Limites da demonstração

O acesso é demonstrativo: escolha uma conta fictícia na tela de login. Cada conta abre a área correspondente ao perfil. A troca de perfil no canto inferior esquerdo continua disponível depois da entrada. As credenciais são verificadas apenas no frontend, não são enviadas ao backend e não protegem dados. A API documentada ainda não implementa autenticação nem controle de permissões.

Contas de teste: `marina` / `marina123` (administração), `operacao` / `operacao123` (operação), `joao` / `joao123` (técnico), `ana` / `ana123` (Loja Zara) e `carlos` / `carlos123` (Livraria). Use somente esses dados fictícios.

A tela de rádio não captura áudio nem transcreve automaticamente. Ela simula a anotação manual e guarda o texto localmente neste navegador; apenas a mudança de status da tarefa é enviada à API. A API também não oferece um campo de prazo na ocorrência; prazos são definidos nas tarefas.

Os dados operacionais vêm da API e não são substituídos por exemplos locais quando ela está indisponível. Para a experiência completa, execute o backend e configure `VITE_API_BASE_URL`.

## API e documentação

- [Contrato da API](https://github.com/SmartMall-AI/docs-smartmall-ai/blob/main/contrato-api.md)
- [Backend](https://github.com/SmartMall-AI/be-smartmall-ai)
- [Contribuição e revisão](CONTRIBUTING.md)

Não coloque chaves do provedor de IA no frontend ou em variáveis `VITE_`: esses valores ficam visíveis no navegador.

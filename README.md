# SmartMall AI Frontend

Interface para registrar ocorrências, revisar sugestões de IA, atribuir tarefas e acompanhar a operação do shopping.

**Estado:** estrutura inicial; as telas e a integração ainda precisam ser implementadas. Não há aplicação executável neste repositório.

## Tecnologias previstas

React, TypeScript, Vite, Tailwind CSS, shadcn/ui e Recharts, conforme o planejamento técnico. As versões serão definidas e fixadas na implementação.

## Organização

```text
src/
  components/ componentes reutilizáveis
  pages/      telas e navegação
  services/   cliente HTTP e acesso à API
  hooks/      lógica compartilhada da interface
  types/      tipos alinhados ao contrato da API
```

Os diretórios estão reservados para a implementação. Não existem componentes funcionais ainda.

## Telas previstas

| Tela | Fluxo principal |
| --- | --- |
| Dashboard | Consultar indicadores e pendências |
| Ocorrências | Listar e filtrar registros |
| Nova ocorrência | Informar título, descrição e local |
| Detalhe da ocorrência | Solicitar análise, revisar sugestões e encaminhar |
| Tarefas | Atribuir responsável, definir prazo e atualizar status |
| Equipamentos | Consultar cadastro e situação operacional |

## Integração

O repositório [docs-smartmall-ai](https://github.com/SmartMall-AI/docs-smartmall-ai) mantém [contrato-api.md](https://github.com/SmartMall-AI/docs-smartmall-ai/blob/main/contrato-api.md). Todas as chamadas devem passar pelo cliente em `src/services/` quando ele for implementado.

A API fica em [be-smartmall-ai](https://github.com/SmartMall-AI/be-smartmall-ai).

`.env.example` propõe `VITE_API_BASE_URL` para o endereço da API. Variáveis com prefixo `VITE_` ficam expostas no frontend; não colocar chaves do provedor de IA nelas.

## Comportamento esperado

- Exibir estados de carregamento, falha e listas vazias.
- Confirmar cadastro somente após resposta de sucesso da API.
- Preservar a ocorrência quando a análise estiver indisponível.
- Identificar sugestões de IA e qualquer simulação demonstrativa.
- Permitir revisão das sugestões antes da aplicação.
- Adaptar a navegação e os formulários para telas menores.

Acrescentar instruções de instalação e execução quando a aplicação for criada.

## Liderança e contribuição

[@geraldojoao](https://github.com/geraldojoao) lidera o projeto e coordena a revisão e a integração das alterações. Trabalhe em uma branch e abra um pull request para `main`, conforme [CONTRIBUTING.md](CONTRIBUTING.md).

Para conhecer a proposta e consultar as evidências, veja o [roteiro para a banca](https://github.com/SmartMall-AI/docs-smartmall-ai/blob/main/avaliacao.md).

import { test as base, expect, type Page } from '@playwright/test';

const apiUrl = process.env.E2E_API_URL || 'http://127.0.0.1:8000/api/v1';
const accessCode = process.env.E2E_ACCESS_TOKEN || '';
const test = base.extend({
  request: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      extraHTTPHeaders: accessCode ? { Authorization: `Bearer ${accessCode}` } : {},
    });
    try { await use(context); } finally { await context.dispose(); }
  },
});

async function login(page: Page, username = 'marina', password = 'marina123') {
  await page.goto('/');
  await page.getByLabel('Usuário fictício').fill(username);
  await page.getByLabel('Senha fictícia', { exact: true }).fill(password);
  if (accessCode) await page.getByLabel('Código de acesso ao ambiente').fill(accessCode);
  await page.getByRole('button', { name: 'Entrar na demonstração' }).click();
  await expect(page.locator('.connection-state')).toHaveText('Conectado à API');
}

async function navigate(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation').getByRole('button', { name: new RegExp(`^${name}(?:\\s*\\d+)?$`) }).click();
}

async function createOccurrence(page: Page, title: string) {
  await navigate(page, 'Nova ocorrência');
  await page.getByLabel('Título do problema').fill(title);
  await page.getByLabel('Descrição').fill('Relato fictício para verificação de integração.');
  await page.getByLabel('Local', { exact: false }).first().fill('Praça fictícia');
  await page.getByRole('button', { name: 'Enviar ocorrência' }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

test('falha da IA preserva o registro e permite classificação manual', async ({ page, request }) => {
  const title = `Falha fictícia ${crypto.randomUUID()}`;
  await login(page);
  await createOccurrence(page, title);
  await page.route('**/occurrences/*/analyze', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'IA indisponível para este teste.' }) }));
  await page.getByRole('button', { name: 'Solicitar análise', exact: true }).click();
  await expect(page.getByText('IA indisponível para este teste.')).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByLabel('Categoria final').selectOption('electrical');
  await page.getByLabel('Prioridade final').selectOption('high');
  await page.getByLabel('Equipe indicada').fill('Equipe fictícia manual');
  await page.getByLabel('Recomendação').fill('Inspeção fictícia manual.');
  await page.getByRole('button', { name: 'Salvar classificação manual' }).click();
  await expect(page.getByText('Classificação manual salva.')).toBeVisible();
  await page.reload();
  await navigate(page, 'Ocorrências');
  await page.getByRole('button', { name: title, exact: true }).click();
  await expect(page.getByLabel('Categoria final')).toHaveValue('electrical');
  await expect(page.getByLabel('Prioridade final')).toHaveValue('high');
  const response = await request.get(`${apiUrl}/occurrences`);
  const saved = (await response.json()).find((item: { title: string }) => item.title === title);
  expect(saved.ai_analysis).toBeNull();
  expect(saved.ai_reviewed_at).toBeNull();
  expect(saved.assigned_team).toBe('Equipe fictícia manual');
});

test('revisão humana, tarefa, prazo, histórico e dashboard persistem na API', async ({ page, request }) => {
  const title = `Fluxo fictício ${crypto.randomUUID()}`;
  const technician = await request.post(`${apiUrl}/users`, { data: { name: `Técnico fictício ${crypto.randomUUID()}` } });
  expect(technician.status()).toBe(201);
  const user = await technician.json();
  await login(page);
  await createOccurrence(page, title);
  await page.getByRole('button', { name: 'Solicitar análise', exact: true }).click();
  await expect(page.getByText('Resultado de simulação', { exact: true })).toBeVisible();
  // A sugestão não substitui a classificação nem preenche o formulário sem ação explícita.
  await expect(page.getByLabel('Prioridade final')).toHaveValue('untriaged');
  await page.getByRole('button', { name: 'Usar sugestões no formulário' }).click();
  await page.getByLabel('Prioridade final').selectOption('critical');
  await page.getByLabel('Categoria final').selectOption('cleaning');
  await page.getByLabel('Equipe indicada').fill('Equipe fictícia escolhida');
  await page.getByLabel('Recomendação').fill('Decisão humana fictícia.');
  await page.getByRole('button', { name: 'Confirmar revisão' }).click();
  await expect(page.getByText('Revisão da sugestão registrada.')).toBeVisible();
  await navigate(page, 'Ocorrências');
  await page.getByRole('button', { name: title, exact: true }).click();
  await expect(page.getByLabel('Prioridade final')).toHaveValue('critical');
  await expect(page.getByLabel('Categoria final')).toHaveValue('cleaning');
  await expect(page.getByLabel('Equipe indicada')).toHaveValue('Equipe fictícia escolhida');
  await expect(page.getByLabel('Recomendação')).toHaveValue('Decisão humana fictícia.');
  const taskTitle = `Inspeção fictícia ${crypto.randomUUID()}`;
  await page.getByText('Atribuir nova tarefa', { exact: true }).click();
  await page.getByLabel('Atividade', { exact: false }).fill(taskTitle);
  await page.getByLabel('Responsável', { exact: false }).selectOption(user.id);
  const deadline = new Date(Date.now() + 86400000);
  const localDeadline = new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await page.getByLabel('Prazo limite').fill(localDeadline);
  await page.getByRole('button', { name: 'Criar e atribuir' }).click();
  await expect(page.getByText('Tarefa criada e atribuída.')).toBeVisible();
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('resolved');
  await expect(page.locator('.notice-error')).toContainText(/tarefas/i);
  await navigate(page, 'Ocorrências');
  const occurrenceRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: title, exact: true }) });
  await expect(occurrenceRow.getByRole('cell').nth(5)).not.toHaveText('—');
  await navigate(page, 'Tarefas');
  const taskRow = page.getByRole('row').filter({ hasText: taskTitle });
  await taskRow.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect(taskRow.locator('.badge')).toHaveText('Em andamento');
  page.once('dialog', dialog => dialog.accept());
  await taskRow.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(taskRow.locator('.badge')).toHaveText('Concluída');
  await taskRow.getByRole('button', { name: title, exact: true }).click();
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('resolved');
  await expect(page.locator('.detail-badges')).toContainText('Resolvida');
  await expect(page.locator('.timeline')).toContainText('Sugestão revisada');
  await expect(page.locator('.timeline')).toContainText('Status da tarefa atualizado');
  const summary = await (await request.get(`${apiUrl}/dashboard/summary`)).json();
  await navigate(page, 'Visão geral');
  await expect(page.locator('.metric-card').filter({ hasText: 'Ocorrências registradas' }).locator('.metric-value')).toHaveText(String(summary.occurrences_total));
  await expect(page.locator('.metric-card').filter({ hasText: 'Tarefas pendentes' }).locator('.metric-value')).toHaveText(String(summary.tasks_pending));
  const occurrence = (await (await request.get(`${apiUrl}/occurrences`)).json()).find((item: { title: string }) => item.title === title);
  expect(occurrence.ai_reviewed_at).toBeTruthy();
  expect(occurrence.priority).toBe('critical');
  expect(occurrence.status).toBe('resolved');
});

test('perfil técnico continua navegável após recarregar', async ({ page }) => {
  await login(page, 'joao', 'joao123');
  await expect(page.getByRole('heading', { name: 'Minhas tarefas', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Minhas tarefas', exact: true })).toBeVisible();
});

test('equipamento cadastrado na interface pode ser vinculado a uma ocorrência', async ({ page, request }) => {
  const name = `Equipamento fictício ${crypto.randomUUID()}`;
  await login(page);
  await navigate(page, 'Equipamentos');
  await page.getByRole('button', { name: 'Cadastrar equipamento', exact: true }).first().click();
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByLabel('Tipo', { exact: true }).fill('Climatização');
  await page.getByLabel('Localização', { exact: true }).fill('Praça fictícia');
  await page.getByRole('button', { name: 'Salvar equipamento', exact: true }).click();
  await expect(page.getByText('Equipamento cadastrado.', { exact: true })).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  const equipment = (await (await request.get(`${apiUrl}/equipment`)).json()).find((item: { name: string }) => item.name === name);
  await navigate(page, 'Nova ocorrência');
  await page.getByLabel('Equipamento', { exact: false }).selectOption(equipment.id);
  const title = `Vínculo fictício ${crypto.randomUUID()}`;
  await page.getByLabel('Título do problema').fill(title);
  await page.getByLabel('Descrição').fill('Registro fictício vinculado ao equipamento.');
  await page.getByLabel('Local', { exact: false }).first().fill('Praça fictícia');
  await page.getByRole('button', { name: 'Enviar ocorrência' }).click();
  await expect(page.locator('.detail-meta')).toContainText(name);
  await page.reload();
  await navigate(page, 'Ocorrências');
  await page.getByRole('button', { name: title, exact: true }).click();
  await expect(page.locator('.detail-meta')).toContainText(name);
});

test('API indisponível mostra erro e permite recuperar os dados', async ({ page }) => {
  await login(page);
  await page.route(`${apiUrl}/**`, route => route.abort());
  await page.reload();
  await expect(page.locator('.api-alert')).toBeVisible();
  await expect(page.locator('.metric-card').filter({ hasText: 'Ocorrências registradas' }).locator('.metric-value')).toHaveText('—');
  await page.unroute(`${apiUrl}/**`);
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('.api-alert')).toHaveCount(0);
  await expect(page.locator('.connection-state')).toHaveText('Conectado à API');
});

test('código privado é validado pelo servidor e removido ao sair', async ({ page }) => {
  test.skip(!accessCode, 'Requer API configurada com DEMO_ACCESS_TOKEN.');
  await page.goto('/');
  await page.getByLabel('Usuário fictício').fill('marina');
  await page.getByLabel('Senha fictícia', { exact: true }).fill('marina123');
  await page.getByLabel('Código de acesso ao ambiente').fill('codigo-incorreto');
  await page.getByRole('button', { name: 'Entrar na demonstração' }).click();
  await expect(page.getByRole('alert')).toContainText('Código de acesso ausente ou inválido.');
  await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
  await page.getByLabel('Código de acesso ao ambiente').fill(accessCode);
  await page.getByRole('button', { name: 'Entrar na demonstração' }).click();
  await expect(page.locator('.connection-state')).toHaveText('Conectado à API');
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Sair da demonstração' }).click();
  await expect(page.getByLabel('Código de acesso ao ambiente')).toHaveValue('');
  expect(await page.evaluate(() => sessionStorage.getItem('sm-demo-access'))).toBeNull();
});

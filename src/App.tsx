import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight, ArrowUpRight,
  Building2, CalendarDays, Check, ChevronDown, Clock3, ClipboardList, Eye, EyeOff, FileText, LogOut,
  LayoutDashboard, ListFilter, LoaderCircle, MapPin, Menu, Plus, Radio,
  Search, Settings2, ShieldCheck, Sparkles, Store, Sun, Moon, Wrench, X,
} from 'lucide-react';
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip,
} from 'recharts';
import { api, DEMO_ACCESS_REQUIRED, demoAccess } from './services/api';
import type { FormEvent } from 'react';
import type {
  Category, DashboardSummary, Equipment, HistoryEvent, Occurrence,
  OccurrenceStatus, Priority, Task, TaskStatus, User,
} from './types/api';

type Role = 'manager' | 'operator' | 'technician' | 'tenant';
type Theme = 'light' | 'dark';
type Page = 'dashboard' | 'occurrences' | 'new' | 'detail' | 'tasks' | 'equipment' | 'radio';
type DemoAccount = { username: string; password: string; label: string; role: Role; tenantName?: string; technicianName?: string };

const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'marina', password: 'marina123', label: 'Marina Costa · Administradora', role: 'manager' },
  { username: 'operacao', password: 'operacao123', label: 'Equipe operacional', role: 'operator' },
  { username: 'joao', password: 'joao123', label: 'João Silva · Técnico', role: 'technician', technicianName: 'João Silva' },
  { username: 'ana', password: 'ana123', label: 'Ana Souza · Loja Zara', role: 'tenant', tenantName: 'Ana Souza · Loja Zara' },
  { username: 'carlos', password: 'carlos123', label: 'Carlos Lima · Livraria', role: 'tenant', tenantName: 'Carlos Lima · Livraria' },
];

const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low', 'untriaged'];
const CHART_COLORS = ['#c94d3f', '#e38a44', '#d9b552', '#5a9b7b', '#9ba3ae'];
const PRIORITY_LABEL: Record<Priority, string> = { critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa', untriaged: 'Triagem' };
const STATUS_LABEL: Record<OccurrenceStatus, string> = { open: 'Aberta', in_progress: 'Em andamento', resolved: 'Resolvida' };
const TASK_LABEL: Record<TaskStatus, string> = { pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída' };
const CATEGORY_LABEL: Record<Category, string> = { hvac: 'Climatização', electrical: 'Elétrica', plumbing: 'Hidráulica', cleaning: 'Limpeza', other: 'Outros' };
const CATEGORY_DOT: Record<Category, string> = { hvac: 'blue', electrical: 'amber', plumbing: 'cyan', cleaning: 'green', other: 'gray' };

function asDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function isOverdue(task: Task) {
  return Boolean(task.due_at && task.status !== 'completed' && new Date(task.due_at).getTime() < Date.now());
}

function suggestedResponsibility(location: string) {
  const sharedArea = /corredor|praça|banheiro|escada|estacionamento|área comum/i.test(location);
  return sharedArea ? 'Possível área comum: responsabilidade do shopping a confirmar.' : 'Área privativa: confirmar responsabilidade no contrato.';
}

function inferRadioStatus(text: string): TaskStatus | null {
  const value = text.toLocaleLowerCase('pt-BR');
  if (/conclu|finaliz|resolvid|termin/.test(value)) return 'completed';
  if (/inici|começ|no local|atendendo|em atendimento/.test(value)) return 'in_progress';
  if (/aguardando|pendente|não iniciou/.test(value)) return 'pending';
  return null;
}

function App() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem('sm-demo-auth-v2') === 'true' && (!DEMO_ACCESS_REQUIRED || Boolean(demoAccess.get())));
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('sm-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [page, setPage] = useState<Page>(() => sessionStorage.getItem('sm-demo-role') === 'technician' ? 'tasks' : sessionStorage.getItem('sm-demo-role') === 'tenant' ? 'occurrences' : 'dashboard');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(() => (sessionStorage.getItem('sm-demo-role') as Role) || 'manager');
  const [tenantName, setTenantName] = useState(() => sessionStorage.getItem('sm-tenant-name') || 'Ana Souza · Loja Zara');
  const [technicianId, setTechnicianId] = useState(() => sessionStorage.getItem('sm-technician-id') || '');
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [toast, setToast] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setApiError('');
    const [summaryResult, occurrenceResult, taskResult, equipmentResult, usersResult] = await Promise.allSettled([
      api.summary(), api.occurrences(), api.tasks(), api.equipment(), api.users('technician'),
    ]);
    const failures: string[] = [];
    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value); else failures.push(summaryResult.reason.message);
    if (occurrenceResult.status === 'fulfilled') setOccurrences(occurrenceResult.value); else failures.push(occurrenceResult.reason.message);
    if (taskResult.status === 'fulfilled') setTasks(taskResult.value); else failures.push(taskResult.reason.message);
    if (equipmentResult.status === 'fulfilled') setEquipment(equipmentResult.value); else failures.push(equipmentResult.reason.message);
    if (usersResult.status === 'fulfilled') {
      const active = usersResult.value.filter(user => user.is_active);
      setTechnicians(active);
      if (!technicianId && active[0]) {
        const preferredName = sessionStorage.getItem('sm-demo-technician-name');
        const preferred = active.find(person => person.name.toLocaleLowerCase('pt-BR') === preferredName?.toLocaleLowerCase('pt-BR'));
        const selected = preferred || active[0];
        setTechnicianId(selected.id);
        sessionStorage.setItem('sm-technician-id', selected.id);
      }
    } else failures.push(usersResult.reason.message);
    if (failures.length) setApiError(failures[0]);
    setLoading(false);
  }, [technicianId]);

  useEffect(() => { if (authenticated) void refresh(); }, [authenticated, refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('sm-theme', theme);
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const go = (next: Page, id?: string) => {
    setPage(next);
    setSelectedId(id || null);
    setMobileOpen(false);
  };
  const updateRole = (next: Role) => {
    setRole(next);
    sessionStorage.setItem('sm-demo-role', next);
    if (next === 'technician') go('tasks');
    else if (next === 'tenant') go('occurrences');
    else go('dashboard');
  };
  const signInToDemo = (account: DemoAccount) => {
    setRole(account.role);
    sessionStorage.setItem('sm-demo-role', account.role);
    sessionStorage.removeItem('sm-technician-id');
    setTechnicianId('');
    if (account.tenantName) {
      setTenantName(account.tenantName);
      sessionStorage.setItem('sm-tenant-name', account.tenantName);
    }
    if (account.technicianName) sessionStorage.setItem('sm-demo-technician-name', account.technicianName);
    else sessionStorage.removeItem('sm-demo-technician-name');
    setSelectedId(null);
    setPage(account.role === 'technician' ? 'tasks' : account.role === 'tenant' ? 'occurrences' : 'dashboard');
    sessionStorage.setItem('sm-demo-auth-v2', 'true');
    setAuthenticated(true);
  };
  const updateTechnician = (id: string) => {
    setTechnicianId(id);
    sessionStorage.setItem('sm-technician-id', id);
  };
  const saveTenantCreated = (id: string) => {
    const key = `sm-created:${tenantName}`;
    const ids = JSON.parse(localStorage.getItem(key) || '[]') as string[];
    localStorage.setItem(key, JSON.stringify([...new Set([...ids, id])]));
  };

  const isAdmin = role === 'manager' || role === 'operator';
  const currentTechnician = technicians.find(person => person.id === technicianId);
  const visibleOccurrences = useMemo(() => {
    if (role !== 'tenant') return occurrences;
    const owned = new Set<string>(JSON.parse(localStorage.getItem(`sm-created:${tenantName}`) || '[]'));
    return occurrences.filter(item => owned.has(item.id));
  }, [occurrences, role, tenantName]);
  const overdueOccurrenceIds = useMemo(() => new Set(tasks.filter(isOverdue).map(task => task.occurrence_id)), [tasks]);

  const completeAction = async (action: () => Promise<unknown>, message: string, next: Page = page) => {
    try {
      await action();
      await refresh();
      setToast(message);
      setPage(next);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'A ação não foi concluída.');
    }
  };

  const roleLabel = role === 'tenant' ? 'Lojista' : role === 'technician' ? 'Técnico' : role === 'operator' ? 'Operação' : 'Administração';
  const userLabel = role === 'tenant' ? tenantName : role === 'technician' ? (currentTechnician?.name || 'Técnico') : role === 'operator' ? 'Equipe operacional' : 'Marina Costa';

  if (!authenticated) {
    return <LoginPage theme={theme} onToggleTheme={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} onContinue={signInToDemo} />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark">S</div><div><strong>smartmall</strong><span>OPERAÇÕES</span></div><button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={18} /></button></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav">
          {isAdmin && <>
            <NavButton active={page === 'dashboard'} onClick={() => go('dashboard')} icon={<LayoutDashboard size={18} />} label="Visão geral" />
            <NavButton active={page === 'occurrences'} onClick={() => go('occurrences')} icon={<ClipboardList size={18} />} label="Ocorrências" count={summary?.occurrences_total} />
            <NavButton active={page === 'tasks'} onClick={() => go('tasks')} icon={<Wrench size={18} />} label="Tarefas" count={summary?.tasks_pending} />
            <NavButton active={page === 'equipment'} onClick={() => go('equipment')} icon={<Building2 size={18} />} label="Equipamentos" />
            <NavButton active={page === 'radio'} onClick={() => go('radio')} icon={<Radio size={18} />} label="Registro do rádio" />
          </>}
          {role === 'tenant' && <>
            <NavButton active={page === 'occurrences'} onClick={() => go('occurrences')} icon={<ClipboardList size={18} />} label="Meus chamados" />
            <NavButton active={page === 'new'} onClick={() => go('new')} icon={<Plus size={18} />} label="Abrir chamado" />
          </>}
          {role === 'technician' && <NavButton active={page === 'tasks'} onClick={() => go('tasks')} icon={<Wrench size={18} />} label="Minhas tarefas" count={tasks.filter(task => task.assigned_to === technicianId && task.status !== 'completed').length} />}
          {isAdmin && <button className="sidebar-cta" onClick={() => go('new')}><Plus size={17} /> Nova ocorrência</button>}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-tag"><span className="demo-dot" /> AMBIENTE DE DEMONSTRAÇÃO</div>
          <label className="small-label" htmlFor="role-select">Acessar como</label>
          <select id="role-select" className="sidebar-select" value={role} onChange={event => updateRole(event.target.value as Role)}>
            <option value="manager">Marina Costa · Administradora</option>
            <option value="operator">Equipe operacional</option>
            <option value="technician">Técnico</option>
            <option value="tenant">Lojista</option>
          </select>
          {role === 'tenant' && <select className="sidebar-select user-select" aria-label="Selecionar lojista" value={tenantName} onChange={event => { setTenantName(event.target.value); sessionStorage.setItem('sm-tenant-name', event.target.value); }}><option>Ana Souza · Loja Zara</option><option>Carlos Lima · Livraria</option></select>}
          {role === 'technician' && <select className="sidebar-select user-select" aria-label="Selecionar técnico" value={technicianId} onChange={event => updateTechnician(event.target.value)}>{technicians.length ? technicians.map(person => <option key={person.id} value={person.id}>{person.name}</option>) : <option value="">Nenhum técnico cadastrado</option>}</select>}
          <div className="sidebar-user"><div className="avatar">{userLabel.slice(0, 1).toLocaleUpperCase('pt-BR')}</div><div><strong>{userLabel}</strong><span>{roleLabel}</span></div><ChevronDown size={15} /></div>
          <p className="demo-note">Os perfis apenas mudam a navegação. A API ainda não implementa autenticação nem permissões.</p>
          <button className="demo-logout" onClick={() => { sessionStorage.removeItem('sm-demo-auth-v2'); demoAccess.clear(); setAuthenticated(false); }}><LogOut size={14} /> Sair da demonstração</button>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />}
      <main className="main-area">
        <header className="topbar"><button className="icon-button menu-trigger" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button><div className="breadcrumbs"><span>Shopping</span><i>/</i><strong>{pageTitle(page, role)}</strong></div><button className="theme-toggle" onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span></button><div className="topbar-right"><span className="connection-state"><span className={`connection-dot ${apiError ? 'offline' : ''}`} />{apiError ? 'API indisponível' : loading ? 'Conectando' : 'Conectado à API'}</span><div className="top-avatar">{userLabel.slice(0, 1).toLocaleUpperCase('pt-BR')}</div><strong>{userLabel}</strong></div></header>
        {apiError && <div className="api-alert"><AlertCircle size={18} /><div><strong>Não foi possível atualizar os dados</strong><span>{apiError} Confira VITE_API_BASE_URL e se o backend está em execução.</span></div><button className="button button-secondary button-small" onClick={() => void refresh()}>Tentar novamente</button></div>}
        <div className="page-content">
          {page === 'dashboard' && isAdmin && <DashboardPage summary={summary} occurrences={occurrences} tasks={tasks} overdueIds={overdueOccurrenceIds} loading={loading} onOpen={id => go('detail', id)} onAll={() => go('occurrences')} onTasks={() => go('tasks')} />}
          {page === 'occurrences' && <OccurrencesPage occurrences={visibleOccurrences} tasks={tasks} role={role} overdueIds={overdueOccurrenceIds} loading={loading} onOpen={id => go('detail', id)} onNew={() => go('new')} />}
          {page === 'new' && <NewOccurrencePage equipment={equipment} role={role} onCancel={() => go(role === 'tenant' ? 'occurrences' : 'dashboard')} onCreated={async occurrence => { if (role === 'tenant') saveTenantCreated(occurrence.id); await refresh(); setToast('Ocorrência registrada.'); go('detail', occurrence.id); }} />}
          {page === 'detail' && selectedId && <OccurrenceDetailPage id={selectedId} role={role} technicians={technicians} equipment={equipment} onBack={() => go(role === 'tenant' ? 'occurrences' : 'occurrences')} onChange={async message => { await refresh(); setToast(message); }} />}
          {page === 'tasks' && <TasksPage tasks={role === 'technician' ? tasks.filter(task => task.assigned_to === technicianId) : tasks} occurrences={occurrences} role={role} technicianId={technicianId} onOpen={id => go('detail', id)} onUpdate={(task, status) => completeAction(() => api.patchTask(task.id, { status }), `Tarefa atualizada: ${TASK_LABEL[status]}.`, 'tasks')} />}
          {page === 'equipment' && isAdmin && <EquipmentPage equipment={equipment} onCreated={async () => { await refresh(); setToast('Equipamento cadastrado.'); }} />}
          {page === 'radio' && isAdmin && <RadioPage tasks={tasks.filter(task => task.status !== 'completed')} occurrences={occurrences} onConfirm={(task, status, transcript) => completeAction(async () => { await api.patchTask(task.id, { status }); const key = 'sm-radio-transcripts'; const records = JSON.parse(localStorage.getItem(key) || '[]') as Array<{ task_id: string; text: string; at: string }>; localStorage.setItem(key, JSON.stringify([{ task_id: task.id, text: transcript, at: new Date().toISOString() }, ...records].slice(0, 30))); }, `Status confirmado. Transcrição mantida neste navegador.`, 'radio')} />}
        </div>
      </main>
      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    </div>
  );
}

function LoginPage({ theme, onToggleTheme, onContinue }: { theme: Theme; onToggleTheme: () => void; onContinue: (account: DemoAccount) => void }) {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [checkingAccess, setCheckingAccess] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user.trim() || !password) {
      setError('Preencha usuário e senha para continuar.');
      return;
    }
    const account = DEMO_ACCOUNTS.find(candidate => candidate.username === user.trim().toLocaleLowerCase('pt-BR') && candidate.password === password);
    if (!account) {
      setError('Usuário ou senha incorretos. Escolha uma das contas fictícias para teste.');
      return;
    }
    setError('');
    if (DEMO_ACCESS_REQUIRED) {
      if (!accessCode.trim()) {
        setError('Informe o código privado fornecido pela organização.');
        return;
      }
      setCheckingAccess(true);
      try {
        await api.access(accessCode.trim());
        demoAccess.set(accessCode.trim());
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Não foi possível validar o acesso.');
        return;
      } finally {
        setCheckingAccess(false);
      }
    }
    onContinue(account);
  };

  return (
    <main className="login-screen">
      <button type="button" className="login-theme-toggle" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}<span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span></button>
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand"><img className="login-logo" src={`/images/smartmall-logo-${theme}.jpeg`} alt="Smart Mall" /></div>
        <p className="login-eyebrow">GESTÃO DE OPERAÇÕES</p>
        <h1 id="login-title">Acesse sua conta</h1>
        <p className="login-subtitle">Entre para acompanhar as operações do shopping.</p>
        <div className="login-demo-notice"><ShieldCheck size={16} /><span>Ambiente de demonstração. O perfil define a tela inicial.</span></div>
        <form className="login-form" onSubmit={submit}>
          {DEMO_ACCESS_REQUIRED && <label className="login-field"><span>Código de acesso ao ambiente</span><input type="password" required autoComplete="off" value={accessCode} onChange={event => { setAccessCode(event.target.value); setError(''); }} placeholder="Código privado da demonstração" /><small>Fornecido pela organização. Os perfis abaixo continuam sendo fictícios.</small></label>}
          <label className="login-field"><span>Usuário fictício</span><input value={user} onChange={event => { setUser(event.target.value); setError(''); }} autoComplete="username" placeholder="Digite o usuário de teste" /></label>
          <label className="login-field"><span>Senha fictícia</span><span className="login-password-wrap"><input type={passwordVisible ? 'text' : 'password'} value={password} onChange={event => { setPassword(event.target.value); setError(''); }} autoComplete="current-password" placeholder="Digite uma senha de demonstração" /><button type="button" className="login-password-toggle" onClick={() => setPasswordVisible(value => !value)} aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
          <p className="login-demo-copy">Somente as contas fictícias abaixo funcionam. Os dados ficam no navegador e não são enviados ao backend.</p>
          <details className="login-demo-accounts"><summary>Ver contas fictícias para teste</summary><div className="login-account-list">{DEMO_ACCOUNTS.map(account => <button type="button" key={account.username} onClick={() => { setUser(account.username); setPassword(account.password); setError(''); }}><strong>{account.label}</strong><span>Usuário: {account.username} · Senha: {account.password}</span></button>)}</div></details>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={checkingAccess}>{checkingAccess ? 'Validando acesso…' : 'Entrar na demonstração'} <ArrowRight size={16} /></button>
        </form>
        <p className="login-footer">A autenticação real será conectada ao backend quando estiver disponível. Após entrar, você ainda pode trocar o perfil no canto inferior esquerdo.</p>
      </section>
    </main>
  );
}

function pageTitle(page: Page, role: Role) {
  const titles: Record<Page, string> = { dashboard: 'Visão geral', occurrences: role === 'tenant' ? 'Meus chamados' : 'Ocorrências', new: 'Nova ocorrência', detail: 'Detalhe da ocorrência', tasks: role === 'technician' ? 'Minhas tarefas' : 'Tarefas', equipment: 'Equipamentos', radio: 'Registro do rádio' };
  return titles[page];
}

function NavButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count ? <small>{count}</small> : null}</button>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function MetricCard({ label, value, note, icon, tone = 'blue', delta }: { label: string; value: number | string; note: string; icon: React.ReactNode; tone?: string; delta?: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><div className="metric-value">{value}</div><div className="metric-note">{delta && <span className="metric-delta">{delta}</span>}{note}</div></article>;
}

function PriorityBadge({ value }: { value: Priority }) {
  return <span className={`badge priority-${value}`}><span className="badge-dot" />{PRIORITY_LABEL[value]}</span>;
}

function StatusBadge({ value }: { value: OccurrenceStatus }) {
  return <span className={`badge status-${value}`}><span className="badge-dot" />{STATUS_LABEL[value]}</span>;
}

function TaskBadge({ value }: { value: TaskStatus }) {
  return <span className={`badge task-${value}`}><span className="badge-dot" />{TASK_LABEL[value]}</span>;
}

function CategoryPill({ value }: { value: Category | null }) {
  if (!value) return <span className="muted">Sem categoria</span>;
  return <span className="category-label"><span className={`category-dot ${CATEGORY_DOT[value]}`} />{CATEGORY_LABEL[value]}</span>;
}

function DashboardPage({ summary, occurrences, tasks, overdueIds, loading, onOpen, onAll, onTasks }: {
  summary: DashboardSummary | null; occurrences: Occurrence[]; tasks: Task[]; overdueIds: Set<string>; loading: boolean; onOpen: (id: string) => void; onAll: () => void; onTasks: () => void;
}) {
  const critical = occurrences.filter(item => item.priority === 'critical' && item.status !== 'resolved');
  const agenda = tasks.filter(task => task.due_at && task.status !== 'completed' && new Date(task.due_at) >= new Date() && new Date(task.due_at) <= new Date(Date.now() + 7 * 86400000)).sort((a, b) => (a.due_at || '').localeCompare(b.due_at || '')).slice(0, 5);
  const chartData = PRIORITIES.map(priority => ({ name: PRIORITY_LABEL[priority], value: summary?.occurrences_by_priority?.[priority] || 0 }));
  const weekLabels = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(); day.setDate(day.getDate() + index);
    return { key: day.toISOString().slice(0, 10), label: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(day), count: tasks.filter(task => task.due_at?.slice(0, 10) === day.toISOString().slice(0, 10) && task.status !== 'completed').length };
  });
  return <>
    <PageHeading eyebrow="CENTRO DE OPERAÇÕES" title="Visão geral" description="Acompanhe chamados, prazos e atividades da equipe." action={<button className="button button-primary" onClick={onAll}><ListFilter size={16} />Ver ocorrências</button>} />
    {loading && <div className="loading-line"><LoaderCircle className="spin" size={16} /> Atualizando indicadores…</div>}
    <section className="metric-grid">
      <MetricCard label="Ocorrências registradas" value={summary?.occurrences_total ?? '—'} note="no sistema" icon={<ClipboardList size={18} />} tone="blue" />
      <MetricCard label="Em andamento" value={summary?.occurrences_by_status?.in_progress ?? '—'} note="com atendimento iniciado" icon={<Activity size={18} />} tone="orange" />
      <MetricCard label="Prioridade crítica" value={summary?.occurrences_by_priority?.critical ?? '—'} note="exigem atenção" icon={<AlertTriangle size={18} />} tone="red" />
      <MetricCard label="Tarefas pendentes" value={summary?.tasks_pending ?? '—'} note="aguardando conclusão" icon={<Wrench size={18} />} tone="green" />
    </section>
    <section className="dashboard-grid">
      <article className="panel chart-panel"><PanelHeader title="Ocorrências por prioridade" detail="Distribuição atual" /><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={66} outerRadius={92} paddingAngle={3} stroke="none">{chartData.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index]} />)}</Pie><Tooltip formatter={(value) => [`${value} ocorrências`, 'Total']} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{summary?.occurrences_total ?? '—'}</strong><span>chamados</span></div></div><div className="legend-list">{chartData.map((item, index) => <div key={item.name}><span style={{ backgroundColor: CHART_COLORS[index] }} />{item.name}<strong>{item.value}</strong></div>)}</div></article>
      <article className="panel attention-panel"><PanelHeader title="Fila de atenção" detail="Críticas em aberto" action={<button className="text-button" onClick={onAll}>Ver todas <ArrowRight size={14} /></button>} />
        {critical.length ? critical.slice(0, 4).map(item => <button key={item.id} className={`attention-row ${overdueIds.has(item.id) ? 'overdue' : ''}`} onClick={() => onOpen(item.id)}><span className="attention-priority">!</span><span className="attention-copy"><strong>{item.title}</strong><small><MapPin size={12} />{item.location}</small></span>{overdueIds.has(item.id) && <span className="late-label">Atrasada</span>}<ArrowRight size={15} /></button>) : <EmptyState title="Nenhuma ocorrência crítica" detail="A fila de atenção está vazia." />}
      </article>
      <article className="panel schedule-panel"><PanelHeader title="Agenda operacional" detail="Próximos 7 dias" action={<button className="text-button" onClick={onTasks}>Tarefas <ArrowRight size={14} /></button>} /><div className="week-strip">{weekLabels.map(day => <div key={day.key} className={day.count ? 'has-events' : ''}><span>{day.label}</span><strong>{day.key.slice(-2)}</strong><i>{day.count || '·'}</i></div>)}</div><div className="agenda-list">{agenda.length ? agenda.map(task => <div key={task.id} className="agenda-item"><span className="agenda-time">{asDate(task.due_at)}</span><div><strong>{task.title}</strong><small>{occurrences.find(item => item.id === task.occurrence_id)?.title || 'Ocorrência'}</small></div></div>) : <p className="muted empty-inline">Sem tarefas com prazo nesta semana.</p>}</div></article>
      <article className="panel status-panel"><PanelHeader title="Estado dos equipamentos" detail="Resumo operacional" action={<span className="subtle-link"><Settings2 size={14} />Inventário</span>} /><div className="equipment-summary"><div><span className="equipment-status-dot green" /><span>Operacionais</span><strong>{summary?.equipment_by_status?.operational ?? '—'}</strong></div><div><span className="equipment-status-dot amber" /><span>Em manutenção</span><strong>{summary?.equipment_by_status?.maintenance ?? '—'}</strong></div><div><span className="equipment-status-dot red" /><span>Fora de serviço</span><strong>{summary?.equipment_by_status?.out_of_service ?? '—'}</strong></div></div><div className="status-footer"><ShieldCheck size={15} />Indicadores atualizados diretamente pela API</div></article>
    </section>
  </>;
}

function PanelHeader({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="panel-header"><div><h2>{title}</h2>{detail && <span>{detail}</span>}</div>{action}</div>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><FileText size={21} /></div><strong>{title}</strong><p>{detail}</p>{action}</div>;
}

function OccurrencesPage({ occurrences, tasks, role, overdueIds, loading, onOpen, onNew }: { occurrences: Occurrence[]; tasks: Task[]; role: Role; overdueIds: Set<string>; loading: boolean; onOpen: (id: string) => void; onNew: () => void }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const deadlines = new Map<string, string>();
  for (const task of tasks) {
    if (!task.due_at || task.status === 'completed') continue;
    const current = deadlines.get(task.occurrence_id);
    if (!current || new Date(task.due_at) < new Date(current)) deadlines.set(task.occurrence_id, task.due_at);
  }
  const filtered = occurrences.filter(item => {
    const termMatches = `${item.title} ${item.location} ${item.description}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
    const filterMatches = filter === 'all' || (filter === 'critical' && item.priority === 'critical') || (filter === 'overdue' && overdueIds.has(item.id)) || (filter === item.status);
    return termMatches && filterMatches;
  });
  return <>
    <PageHeading eyebrow={role === 'tenant' ? 'PORTAL DO LOJISTA' : 'OPERAÇÃO'} title={role === 'tenant' ? 'Meus chamados' : 'Ocorrências'} description={role === 'tenant' ? 'Acompanhe os registros feitos neste navegador de demonstração.' : 'Pesquise, filtre e acompanhe os registros da operação.'} action={<button className="button button-primary" onClick={onNew}><Plus size={16} />Nova ocorrência</button>} />
    {role === 'tenant' && <div className="notice notice-info"><Store size={17} /><span>O backend ainda não associa chamados a usuários autenticados. Esta visão filtra os chamados abertos neste navegador.</span></div>}
    <section className="panel list-panel">
      <div className="list-toolbar"><div className="quick-filters">{[['all', 'Todas'], ['critical', 'Críticas'], ['overdue', 'Atrasadas'], ['open', 'Abertas'], ['in_progress', 'Em andamento']].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`filter-chip ${filter === value ? 'selected' : ''}`}>{label}{value === 'overdue' && <span>{overdueIds.size}</span>}</button>)}</div><label className="search-box"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar chamado ou local" /></label></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Chamado</th><th>Categoria</th><th>Prioridade</th><th>Status</th><th>Abertura</th><th>Prazo de tarefa</th><th /></tr></thead><tbody>
        {filtered.map(item => <tr key={item.id} className={overdueIds.has(item.id) ? 'row-overdue' : ''}><td><button className="row-title" onClick={() => onOpen(item.id)}>{item.title}</button><span className="cell-sub"><MapPin size={12} />{item.location}</span></td><td><CategoryPill value={item.category} /></td><td><PriorityBadge value={item.priority} /></td><td><StatusBadge value={item.status} /></td><td>{asDate(item.created_at)}</td><td>{overdueIds.has(item.id) ? <span className="late-text">Prazo vencido</span> : <span className="muted">{deadlines.has(item.id) ? asDate(deadlines.get(item.id)) : '—'}</span>}</td><td><button className="row-open" onClick={() => onOpen(item.id)} aria-label={`Abrir ${item.title}`}><ArrowRight size={16} /></button></td></tr>)}
      </tbody></table></div>
      {!filtered.length && <EmptyState title={loading ? 'Carregando ocorrências' : 'Nenhuma ocorrência encontrada'} detail={loading ? 'Buscando dados do backend.' : role === 'tenant' ? 'Os chamados que você abrir neste navegador aparecerão aqui.' : 'Tente ajustar os filtros ou registre um novo chamado.'} action={!loading ? <button className="button button-secondary" onClick={onNew}><Plus size={15} />Registrar ocorrência</button> : null} />}
      <div className="table-footer">Exibindo {filtered.length} de {occurrences.length} ocorrências</div>
    </section>
  </>;
}

function NewOccurrencePage({ equipment, role, onCancel, onCreated }: { equipment: Equipment[]; role: Role; onCancel: () => void; onCreated: (item: Occurrence) => Promise<void> }) {
  const [form, setForm] = useState({ title: '', description: '', location: '', category: 'other' as Category, equipment_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const created = await api.createOccurrence({ title: form.title, description: form.description, location: form.location, category: form.category, equipment_id: form.equipment_id || null });
      await onCreated(created);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível registrar o chamado.'); }
    finally { setSaving(false); }
  };
  return <>
    <PageHeading eyebrow={role === 'tenant' ? 'PORTAL DO LOJISTA' : 'NOVO REGISTRO'} title="Abrir ocorrência" description="Conte o que aconteceu. A operação fará a triagem e definirá o encaminhamento." />
    <div className="form-layout"><form className="panel form-panel" onSubmit={submit}>
      {error && <div className="notice notice-error"><AlertCircle size={17} />{error}</div>}
      <div className="form-section-title"><span>01</span><div><strong>Informações do chamado</strong><small>Campos com asterisco são obrigatórios</small></div></div>
      <label className="field"><span>Título do problema <b>*</b></span><input required maxLength={240} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Ar-condicionado sem refrigeração" /></label>
      <div className="field-grid"><label className="field"><span>Localização <b>*</b></span><input required maxLength={240} value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} placeholder="Ex.: Piso 2, loja 14" /></label><label className="field"><span>Categoria</span><select value={form.category} onChange={event => setForm({ ...form, category: event.target.value as Category })}>{Object.entries(CATEGORY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      <label className="field"><span>Descrição detalhada <b>*</b></span><textarea required maxLength={5000} rows={5} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Descreva o problema e qualquer informação que ajude a equipe…" /><small>{form.description.length}/5000 caracteres</small></label>
      <label className="field"><span>Equipamento relacionado <small>(opcional)</small></span><select value={form.equipment_id} onChange={event => setForm({ ...form, equipment_id: event.target.value })}><option value="">Nenhum equipamento selecionado</option>{equipment.map(item => <option key={item.id} value={item.id}>{item.name} · {item.location}</option>)}</select></label>
      <div className="form-note"><Clock3 size={16} /><span>A data de abertura é registrada automaticamente. O chamado segue para triagem sem pedir ao lojista um prazo de atendimento.</span></div>
      <div className="form-actions"><button type="button" className="button button-ghost" onClick={onCancel}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}{saving ? 'Registrando…' : 'Enviar ocorrência'}</button></div>
    </form><aside className="side-note panel"><div className="side-note-icon"><ShieldCheck size={19} /></div><strong>Uma equipe revisará o chamado</strong><p>A categoria ajuda na triagem inicial. A prioridade e o prazo são definidos pela operação depois de analisar o contexto.</p><div className="responsibility-note"><small>RESPONSABILIDADE</small><span>{suggestedResponsibility(form.location)}</span><em>Indicação ilustrativa. O sistema não consulta contratos de locação.</em></div></aside></div>
  </>;
}

function OccurrenceDetailPage({ id, role, technicians, equipment, onBack, onChange }: { id: string; role: Role; technicians: User[]; equipment: Equipment[]; onBack: () => void; onChange: (message: string) => Promise<void> }) {
  const [item, setItem] = useState<Occurrence | null>(null);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', details: '', assigned_to: '', due_at: '' });
  const [savingTask, setSavingTask] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [chosenPriority, setChosenPriority] = useState<Priority>('untriaged');
  const [chosenCategory, setChosenCategory] = useState<Category | ''>('');
  const [chosenTeam, setChosenTeam] = useState('');
  const [chosenRecommendation, setChosenRecommendation] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const isAdmin = role === 'manager' || role === 'operator';

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [detail, history] = await Promise.all([api.occurrence(id), api.history(id)]);
      setItem(detail); setEvents(history);
      setChosenPriority(detail.priority);
      setChosenCategory(detail.category || '');
      setChosenTeam(detail.assigned_team || '');
      setChosenRecommendation(detail.recommendation || '');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível abrir a ocorrência.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const runAnalysis = async () => {
    setAnalyzing(true); setError('');
    try { await api.analyze(id); await load(); await onChange('Análise concluída. Revise a sugestão antes de aplicar.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'A análise está indisponível. A ocorrência continua salva.'); }
    finally { setAnalyzing(false); }
  };
  const saveReview = async (confirmAiReview: boolean) => {
    if (!item) return;
    setSavingReview(true); setError('');
    try {
      await api.patchOccurrence(id, { category: chosenCategory || null, priority: chosenPriority, assigned_team: chosenTeam.trim() || null, recommendation: chosenRecommendation.trim() || null, ...(confirmAiReview ? { confirm_ai_review: true } : {}) });
      await load(); await onChange(confirmAiReview ? 'Revisão da sugestão registrada.' : 'Classificação manual salva.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível salvar a revisão.'); }
    finally { setSavingReview(false); }
  };
  const saveTask = async (event: React.FormEvent) => {
    event.preventDefault(); if (!item) return;
    setSavingTask(true); setTaskError('');
    try {
      await api.createTask({ occurrence_id: item.id, title: taskForm.title, details: taskForm.details || undefined, assigned_to: taskForm.assigned_to, due_at: new Date(taskForm.due_at).toISOString() });
      setTaskForm({ title: '', details: '', assigned_to: '', due_at: '' }); await load(); await onChange('Tarefa criada e atribuída.');
    } catch (failure) { setTaskError(failure instanceof Error ? failure.message : 'Não foi possível atribuir a tarefa.'); }
    finally { setSavingTask(false); }
  };
  const changePriority = async (value: Priority) => {
    setError('');
    try { await api.patchOccurrence(id, { priority: value }); await load(); await onChange('Prioridade atualizada.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível alterar a prioridade.'); }
  };
  if (loading) return <div className="page-loading"><LoaderCircle className="spin" />Carregando ocorrência…</div>;
  if (!item) return <div className="page-error"><AlertCircle />{error || 'Ocorrência não encontrada.'}<button className="button button-secondary" onClick={onBack}>Voltar</button></div>;
  const tasks = item.tasks || [];
  const relatedEquipment = equipment.find(entry => entry.id === item.equipment_id);
  const canEdit = isAdmin;
  return <>
    <button className="back-link" onClick={onBack}>← Voltar para ocorrências</button>
    <div className="detail-heading"><div><div className="eyebrow">OCORRÊNCIA · {item.id.slice(0, 8).toUpperCase()}</div><h1>{item.title}</h1><div className="detail-meta"><span><MapPin size={14} />{item.location}</span><span><CalendarDays size={14} />Aberta em {asDate(item.created_at)}</span>{relatedEquipment && <span><Building2 size={14} />{relatedEquipment.name}</span>}</div></div><div className="detail-badges"><PriorityBadge value={item.priority} /><StatusBadge value={item.status} /></div></div>
    {error && <div className="notice notice-error"><AlertCircle size={16} />{error}</div>}
    <div className="detail-grid"><div className="detail-main">
      <section className="panel detail-card"><PanelHeader title="Descrição do problema" detail={item.category ? CATEGORY_LABEL[item.category] : 'Categoria não definida'} /><p className="description-text">{item.description}</p></section>
      <section className="panel detail-card"><PanelHeader title="Tarefas vinculadas" detail={`${tasks.length} atividades`} />
        {tasks.length ? <div className="task-card-list">{tasks.map(task => <div className={`task-card ${new Date(task.due_at || '').getTime() < Date.now() && task.status !== 'completed' ? 'task-late' : ''}`} key={task.id}><div className="task-symbol"><Wrench size={17} /></div><div className="task-card-copy"><strong>{task.title}</strong><small>{technicians.find(person => person.id === task.assigned_to)?.name || 'Responsável atribuído'} · Prazo {asDate(task.due_at)}</small></div><TaskBadge value={task.status} /></div>)}</div> : <EmptyState title="Ainda não há tarefas" detail="Após revisar a ocorrência, crie e atribua a atividade à equipe responsável." />}
        {canEdit && <details className="task-create"><summary><Plus size={16} />Atribuir nova tarefa</summary><form onSubmit={saveTask} className="task-form"><label className="field"><span>Atividade <b>*</b></span><input required maxLength={240} value={taskForm.title} onChange={event => setTaskForm({ ...taskForm, title: event.target.value })} placeholder="Ex.: Inspecionar o equipamento" /></label><div className="field-grid"><label className="field"><span>Responsável <b>*</b></span><select required value={taskForm.assigned_to} onChange={event => setTaskForm({ ...taskForm, assigned_to: event.target.value })}><option value="">Selecionar técnico</option>{technicians.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label className="field"><span>Prazo limite <b>*</b></span><input required type="datetime-local" value={taskForm.due_at} onChange={event => setTaskForm({ ...taskForm, due_at: event.target.value })} /></label></div><label className="field"><span>Orientações <small>(opcional)</small></span><textarea rows={3} maxLength={5000} value={taskForm.details} onChange={event => setTaskForm({ ...taskForm, details: event.target.value })} /></label>{taskError && <div className="inline-error">{taskError}</div>}<button className="button button-primary" disabled={savingTask || !technicians.length}>{savingTask ? 'Salvando…' : 'Criar e atribuir'}</button>{!technicians.length && <small className="muted">Cadastre técnicos pelo backend antes de atribuir tarefas.</small>}</form></details>}
      </section>
      <section className="panel detail-card"><PanelHeader title="Histórico da ocorrência" detail="Atividades registradas pela API" />{events.length ? <ol className="timeline">{events.map(event => <li key={event.id}><span className="timeline-marker" /><div className="timeline-content"><small>{asDate(event.created_at)}</small><strong>{historyLabel(event)}</strong><p>{eventDescription(event)}</p></div></li>)}</ol> : <EmptyState title="Sem atividades no histórico" detail="As alterações feitas no sistema aparecerão aqui." />}</section>
    </div><aside className="detail-side">
      <section className="panel ai-card"><div className="ai-card-head"><span className="ai-icon"><Sparkles size={17} /></span><div><strong>Análise de IA</strong><small>Apoio à triagem</small></div></div>
        {item.ai_analysis ? <>
          <div className={`analysis-source ${item.ai_analysis.is_simulation ? 'simulated' : ''}`}><span className="source-dot" />{item.ai_analysis.is_simulation ? 'Resultado de simulação' : 'Resposta do modelo'}</div>
          <div className="suggestion-block"><small>PRIORIDADE SUGERIDA</small><PriorityBadge value={item.ai_analysis.suggested_priority} /></div>
          <p className="ai-rationale">{item.ai_analysis.rationale}</p>
          <p className="ai-rationale">{CATEGORY_LABEL[item.ai_analysis.category]} · {item.ai_analysis.suggested_team}</p>
          <p className="ai-rationale">{item.ai_analysis.recommendation}</p>
          {item.ai_reviewed_at && <p className="muted">Revisão registrada em {asDate(item.ai_reviewed_at)}</p>}
          {canEdit && <button className="button button-secondary button-full" disabled={savingReview || analyzing} onClick={() => {
            const suggestion = item.ai_analysis!;
            setChosenCategory(suggestion.category); setChosenPriority(suggestion.suggested_priority);
            setChosenTeam(suggestion.suggested_team); setChosenRecommendation(suggestion.recommendation);
          }}>Usar sugestões no formulário</button>}
        </> : <p className="ai-empty">A ocorrência está salva. Você pode classificá-la manualmente ou solicitar apoio da IA.</p>}
        {canEdit && <button className="button button-ai button-full" onClick={runAnalysis} disabled={analyzing || savingReview}>{analyzing ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{analyzing ? 'Analisando…' : item.ai_analysis ? 'Solicitar nova análise' : 'Solicitar análise'}</button>}
        <div className="field compact-field"><label htmlFor="review-category">Categoria final</label><select id="review-category" value={chosenCategory} disabled={!canEdit || savingReview || analyzing} onChange={event => setChosenCategory(event.target.value as Category | '')}><option value="">Sem categoria</option>{Object.entries(CATEGORY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className="field compact-field"><label htmlFor="review-priority">Prioridade final</label><select id="review-priority" value={chosenPriority} disabled={!canEdit || savingReview || analyzing} onChange={event => setChosenPriority(event.target.value as Priority)}>{PRIORITIES.map(value => <option key={value} value={value}>{PRIORITY_LABEL[value]}</option>)}</select></div>
        <div className="field compact-field"><label htmlFor="review-team">Equipe indicada</label><input id="review-team" maxLength={240} value={chosenTeam} disabled={!canEdit || savingReview || analyzing} onChange={event => setChosenTeam(event.target.value)} /></div>
        <div className="field compact-field"><label htmlFor="review-rec">Recomendação</label><textarea id="review-rec" maxLength={5000} rows={3} value={chosenRecommendation} disabled={!canEdit || savingReview || analyzing} onChange={event => setChosenRecommendation(event.target.value)} /></div>
        {canEdit && <>
          <button className="button button-secondary button-full" disabled={savingReview || analyzing} onClick={() => void saveReview(false)}>Salvar classificação manual</button>
          {item.ai_analysis && <button className="button button-primary button-full" disabled={savingReview || analyzing} onClick={() => void saveReview(true)}>Confirmar revisão</button>}
        </>}
        <div className="human-review-note"><ShieldCheck size={15} /><span>A sugestão não altera a tarefa nem substitui a decisão da equipe.</span></div>
      </section>
      <section className="panel compact-status"><PanelHeader title="Classificação atual" /><div className="field compact-field"><label htmlFor="priority-current">Prioridade</label><select id="priority-current" disabled={!canEdit} value={item.priority} onChange={event => void changePriority(event.target.value as Priority)}>{PRIORITIES.map(value => <option key={value} value={value}>{PRIORITY_LABEL[value]}</option>)}</select></div>{canEdit && <label className="field compact-field"><span>Status</span><select value={item.status} onChange={async event => { try { await api.patchOccurrence(item.id, { status: event.target.value }); await onChange('Status da ocorrência atualizado.'); await load(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível atualizar o status.'); } }}><option value="open">Aberta</option><option value="in_progress">Em andamento</option><option value="resolved">Resolvida</option></select></label>}<div className="lease-note"><small>RESPONSABILIDADE ILUSTRATIVA</small><p>{suggestedResponsibility(item.location)}</p><span>Sem leitura de contrato ou decisão automática.</span></div></section>
    </aside></div>
  </>;
}

function historyLabel(event: HistoryEvent) {
  const labels: Record<string, string> = { occurrence_created: 'Chamado aberto', occurrence_updated: 'Ocorrência atualizada', occurrence_status_changed: 'Status da ocorrência alterado', task_created: 'Tarefa atribuída', task_updated: 'Tarefa atualizada', task_status_changed: 'Status da tarefa atualizado', ai_analyzed: 'Análise de IA concluída', ai_reviewed: 'Sugestão revisada' };
  return labels[event.event_type] || event.event_type.replaceAll('_', ' ');
}
function eventDescription(event: HistoryEvent) {
  if (event.details?.title) return String(event.details.title);
  if (event.previous_status || event.new_status) return `${event.previous_status || '—'} → ${event.new_status || '—'}`;
  if (event.details && Object.keys(event.details).length) return Object.values(event.details).map(String).join(' · ');
  return 'Registro adicionado ao histórico.';
}

function TasksPage({ tasks, occurrences, role, technicianId, onOpen, onUpdate }: { tasks: Task[]; occurrences: Occurrence[]; role: Role; technicianId: string; onOpen: (id: string) => void; onUpdate: (task: Task, status: TaskStatus) => void }) {
  const [filter, setFilter] = useState('all');
  const filtered = tasks.filter(task => filter === 'all' || (filter === 'late' ? isOverdue(task) : task.status === filter)).sort((a, b) => (a.due_at || '').localeCompare(b.due_at || ''));
  return <>
    <PageHeading eyebrow={role === 'technician' ? 'MINHA FILA' : 'EXECUÇÃO'} title={role === 'technician' ? 'Minhas tarefas' : 'Tarefas operacionais'} description={role === 'technician' ? 'Ações rápidas para acompanhar o atendimento.' : 'Atribuições, prazos e andamento da equipe.'} />
    <section className="panel list-panel"><div className="list-toolbar"><div className="quick-filters">{[['all', 'Todas'], ['pending', 'Pendentes'], ['in_progress', 'Em andamento'], ['late', 'Atrasadas']].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`filter-chip ${filter === value ? 'selected' : ''}`}>{label}</button>)}</div><span className="muted">{filtered.length} tarefas</span></div>
      {filtered.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Atividade</th><th>Ocorrência</th><th>Responsável</th><th>Prazo</th><th>Status</th><th>Ação rápida</th></tr></thead><tbody>{filtered.map(task => { const occurrence = occurrences.find(item => item.id === task.occurrence_id); return <tr key={task.id} className={isOverdue(task) ? 'row-overdue' : ''}><td><strong>{task.title}</strong>{task.details && <span className="cell-sub">{task.details}</span>}</td><td><button className="row-title" onClick={() => occurrence && onOpen(occurrence.id)}>{occurrence?.title || 'Abrir ocorrência'}</button><span className="cell-sub"><MapPin size={12} />{occurrence?.location || 'Local não disponível'}</span></td><td>{technicianId && task.assigned_to === technicianId && role === 'technician' ? 'Atribuída a você' : 'Técnico atribuído'}</td><td className={isOverdue(task) ? 'late-text' : ''}>{asDate(task.due_at)}{isOverdue(task) && <span className="cell-sub late-text">Prazo vencido</span>}</td><td><TaskBadge value={task.status} /></td><td><div className="quick-actions">{task.status === 'pending' && <button className="button button-small button-secondary" onClick={() => onUpdate(task, 'in_progress')}>Iniciar</button>}{task.status === 'in_progress' && <button className="button button-small button-success" onClick={() => { if (window.confirm('Confirmar conclusão desta tarefa?')) onUpdate(task, 'completed'); }}>Concluir</button>}{task.status === 'completed' && <button className="text-button" onClick={() => onUpdate(task, 'in_progress')}>Reabrir</button>}</div></td></tr>; })}</tbody></table></div> : <EmptyState title="Nenhuma tarefa nesta lista" detail="As tarefas atribuídas e seus prazos aparecem aqui." />}
    </section>
  </>;
}

function EquipmentPage({ equipment, onCreated }: { equipment: Equipment[]; onCreated: () => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: '', location: '', operational_status: 'operational' as Equipment['operational_status'] });
  const [error, setError] = useState('');
  const save = async (event: React.FormEvent) => { event.preventDefault(); setError(''); try { await api.createEquipment(form); await onCreated(); setShowForm(false); setForm({ name: '', type: '', location: '', operational_status: 'operational' }); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível cadastrar o equipamento.'); } };
  return <>
    <PageHeading eyebrow="ATIVOS" title="Equipamentos" description="Consulte os equipamentos e sua situação operacional." action={<button className="button button-primary" onClick={() => setShowForm(value => !value)}><Plus size={16} />Cadastrar equipamento</button>} />
    {showForm && <form className="panel equipment-form" onSubmit={save}><div className="form-section-title"><span>NOVO</span><div><strong>Cadastro de equipamento</strong></div></div><div className="field-grid"><label className="field"><span>Nome</span><input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>Tipo</span><input required value={form.type} onChange={event => setForm({ ...form, type: event.target.value })} /></label><label className="field"><span>Localização</span><input required value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} /></label><label className="field"><span>Situação</span><select value={form.operational_status} onChange={event => setForm({ ...form, operational_status: event.target.value as Equipment['operational_status'] })}><option value="operational">Operacional</option><option value="maintenance">Em manutenção</option><option value="out_of_service">Fora de serviço</option></select></label></div>{error && <div className="inline-error">{error}</div>}<div className="form-actions"><button type="button" className="button button-ghost" onClick={() => setShowForm(false)}>Cancelar</button><button className="button button-primary">Salvar equipamento</button></div></form>}
    {equipment.length ? <div className="equipment-grid">{equipment.map(item => <article className="panel equipment-card" key={item.id}><div className="equipment-card-icon"><Building2 size={20} /></div><div className="equipment-card-title"><strong>{item.name}</strong><small>{item.type}</small></div><span className={`equipment-pill ${item.operational_status}`}>{item.operational_status === 'operational' ? 'Operacional' : item.operational_status === 'maintenance' ? 'Em manutenção' : 'Fora de serviço'}</span><div className="equipment-card-location"><MapPin size={14} />{item.location}</div><div className="equipment-card-foot">Código {item.id.slice(0, 8).toUpperCase()} <ArrowUpRight size={14} /></div></article>)}</div> : <div className="panel"><EmptyState title="Nenhum equipamento cadastrado" detail="Cadastre equipamentos para vinculá-los às ocorrências." action={<button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={15} />Cadastrar equipamento</button>} /></div>}
  </>;
}

function RadioPage({ tasks, occurrences, onConfirm }: { tasks: Task[]; occurrences: Occurrence[]; onConfirm: (task: Task, status: TaskStatus, transcript: string) => void }) {
  const [taskId, setTaskId] = useState('');
  const [transcript, setTranscript] = useState('');
  const [review, setReview] = useState<{ task: Task; transcript: string; suggested: TaskStatus | null } | null>(null);
  const [status, setStatus] = useState<TaskStatus>('pending');
  const available = tasks.filter(task => task.status !== 'completed');
  const startReview = (event: React.FormEvent) => { event.preventDefault(); const task = available.find(value => value.id === taskId); if (!task) return; const suggested = inferRadioStatus(transcript); setReview({ task, transcript, suggested }); setStatus(suggested || task.status); };
  if (review) {
    const occurrence = occurrences.find(item => item.id === review.task.occurrence_id);
    return <><button className="back-link" onClick={() => setReview(null)}>← Voltar ao registro</button><PageHeading eyebrow="CONFIRMAÇÃO HUMANA" title="Revisar mensagem recebida" description="Confira a transcrição e escolha o status que deve ser registrado." /><section className="panel radio-review"><div className="radio-transcript"><small>MENSAGEM ANOTADA PELA CENTRAL</small><p>{review.transcript}</p></div><div className="review-task"><span>Tarefa</span><strong>{review.task.title}</strong><small>{occurrence?.title || 'Ocorrência'} · {occurrence?.location || 'Local'}</small></div>{review.suggested ? <div className="notice notice-info"><Activity size={17} />Sugestão identificada: <strong>{TASK_LABEL[review.suggested]}</strong></div> : <div className="notice notice-warning"><AlertTriangle size={17} />Não foi possível inferir um status com segurança. Escolha manualmente.</div>}<label className="field"><span>Status a registrar</span><select value={status} onChange={event => setStatus(event.target.value as TaskStatus)}><option value="pending">Pendente</option><option value="in_progress">Em andamento</option><option value="completed">Concluída</option></select></label><div className="form-actions"><button className="button button-ghost" onClick={() => setReview(null)}>Voltar</button><button className="button button-primary" onClick={() => onConfirm(review.task, status, review.transcript)}>Confirmar atualização</button></div><p className="muted radio-disclaimer">A API registra a mudança de status. A transcrição fica guardada apenas neste navegador, pois o contrato atual não tem um campo de observação para mensagens de rádio.</p></section></>;
  }
  return <><PageHeading eyebrow="CENTRAL OPERACIONAL" title="Registro do rádio" description="Registre o que a central ouviu e revise a atualização antes de sincronizar o status." />
    <div className="radio-layout"><form className="panel radio-form" onSubmit={startReview}><div className="form-section-title"><span>01</span><div><strong>Mensagem recebida</strong><small>Esta tela simula o processo de transcrição.</small></div></div><label className="field"><span>Tarefa relacionada</span><select required value={taskId} onChange={event => setTaskId(event.target.value)}><option value="">Selecione uma tarefa em aberto</option>{available.map(task => <option key={task.id} value={task.id}>{task.title} — {occurrences.find(item => item.id === task.occurrence_id)?.title || 'Ocorrência'}</option>)}</select></label><label className="field"><span>Transcrição ou mensagem anotada</span><textarea required rows={5} value={transcript} onChange={event => setTranscript(event.target.value)} placeholder="Ex.: Chamado 104, técnico chegou ao local e iniciou o atendimento." /><small>O protótipo não captura o áudio do rádio nem faz reconhecimento de fala automático.</small></label><button className="button button-primary" disabled={!available.length}>Preparar revisão <ArrowRight size={16} /></button>{!available.length && <p className="muted">Não há tarefas abertas para atualizar.</p>}</form><aside className="panel radio-steps"><div className="radio-step-icon"><Radio size={20} /></div><h2>Fluxo com confirmação</h2><ol><li><span>1</span> A central seleciona a tarefa e anota a mensagem.</li><li><span>2</span> Regras simples sugerem um status.</li><li><span>3</span> Uma pessoa confere a transcrição e confirma.</li><li><span>4</span> O status atualizado é enviado à API.</li></ol><div className="notice notice-warning"><AlertTriangle size={16} /><span>Sem integração de áudio nesta versão. O texto é digitado manualmente e a transcrição não é enviada para o backend.</span></div></aside></div>
  </>;
}

export default App;

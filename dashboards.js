/**
 * DASHBOARDS.JS — Módulo: Dashboards dos Clientes
 * Padrão: script global. Sem import/export.
 * Depende de: supabaseClient, allClientes, loadAllClientes,
 *             openModal, showToast, formatCurrency (admin.js)
 */

let chartDonut = null;
let chartBar   = null;

const CATEGORIAS_ESSENCIAL = [
  'habitação', 'agua', 'água', 'internet', 'energia',
  'transporte público', 'alimentação', 'saúde',
  'plano de saúde', 'medicamentos', 'educação'
];

function initDashboards() {
  window.addEventListener('section:change', ({ detail }) => {
    if (detail.section === 'dashboards') renderDashboards();
  });
  renderDashboards();
}

async function renderDashboards() {
  const grid = document.getElementById('dashboards-grid');
  if (!grid) return;
  grid.innerHTML = '<p class="empty-state">Carregando...</p>';

  if (!allClientes.length) await loadAllClientes();

  if (!allClientes.length) {
    grid.innerHTML = '<p class="empty-state">Nenhum cliente cadastrado.</p>';
    return;
  }

  grid.innerHTML = allClientes.map(c => `
    <div class="card">
      <div>
        <p class="card-name">${c.nome}</p>
        <p class="card-sub">${c.email || 'Sem email'}</p>
      </div>
      <div class="card-actions" style="margin-top:auto;">
        <button class="btn-card ver-dashboard" data-id="${c.id}" data-nome="${c.nome}">
          📊 Ver Dashboard
        </button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.btn-card.ver-dashboard').forEach(btn => {
    btn.addEventListener('click', () => abrirDashboard(btn.dataset.id, btn.dataset.nome));
  });
}

async function abrirDashboard(clienteId, nome) {
  document.getElementById('modal-dashboard-title').textContent = `📊 Dashboard: ${nome}`;
  ['kpi-sobrevivencia','kpi-estilo','kpi-passiva','kpi-cobertura'].forEach(id => {
    document.getElementById(id).textContent = '...';
  });
  openModal('modal-dashboard');

  if (chartDonut) { chartDonut.destroy(); chartDonut = null; }
  if (chartBar)   { chartBar.destroy();   chartBar   = null; }

  const { data: transacoes, error } = await supabaseClient
    .from('transacoes')
    .select('valor, tipo, categoria, descricao, data')
    .eq('cliente_id', clienteId)
    .order('data', { ascending: false });

  if (error) { showToast('Erro ao carregar dados: ' + error.message, 'error'); return; }
  calcularEExibir(transacoes || []);
}

function calcularEExibir(transacoes) {
  const receitas = transacoes.filter(t => t.tipo === 'receita');
  const despesas = transacoes.filter(t => t.tipo === 'despesa');

  const totalReceita = receitas.reduce((s, t) => s + Math.abs(t.valor), 0);
  const totalDespesa = despesas.reduce((s, t) => s + Math.abs(t.valor), 0);

  const rendaPassiva = receitas
    .filter(t => /passiva|dividend|aluguel|investimento/i.test(t.categoria || ''))
    .reduce((s, t) => s + Math.abs(t.valor), 0);

  const custoSobrevivencia = despesas
    .filter(t => CATEGORIAS_ESSENCIAL.some(cat => (t.categoria || '').toLowerCase().includes(cat)))
    .reduce((s, t) => s + Math.abs(t.valor), 0);

  const estiloDeVida = Math.max(0, totalDespesa - custoSobrevivencia);
  const cobertura    = custoSobrevivencia > 0
    ? Math.min(100, (rendaPassiva / custoSobrevivencia) * 100)
    : 0;

  document.getElementById('kpi-sobrevivencia').textContent = formatCurrency(custoSobrevivencia);
  document.getElementById('kpi-estilo').textContent        = formatCurrency(estiloDeVida);
  document.getElementById('kpi-passiva').textContent       = formatCurrency(rendaPassiva);
  document.getElementById('kpi-cobertura').textContent     = cobertura.toFixed(1) + '%';

  renderDonut(custoSobrevivencia, estiloDeVida);

  const categoriaMap = {};
  despesas.forEach(t => {
    const cat = t.categoria || 'Outros';
    categoriaMap[cat] = (categoriaMap[cat] || 0) + Math.abs(t.valor);
  });
  const topCats = Object.entries(categoriaMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  renderBarChart(topCats);

  renderAnalise(totalReceita, totalDespesa, rendaPassiva, custoSobrevivencia, estiloDeVida, transacoes.length);
}

function renderDonut(essencial, estiloVida) {
  const ctx = document.getElementById('chart-donut');
  if (!ctx) return;
  chartDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Essencial', 'Estilo de Vida'],
      datasets: [{ data: [essencial || 0.001, estiloVida || 0.001],
        backgroundColor: ['#ff6384', '#f5d623'], borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#6b9e84', font: { size: 11 }, padding: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.parsed)}` } }
      }
    }
  });
}

function renderBarChart(topCats) {
  const ctx = document.getElementById('chart-bar');
  if (!ctx) return;
  chartBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topCats.map(([cat]) => cat),
      datasets: [{ label: 'Valor (R$)', data: topCats.map(([,val]) => val),
        backgroundColor: '#4263eb', borderRadius: 4, borderSkipped: false }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#6b9e84', font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.parsed.x)}` } }
      },
      scales: {
        x: { ticks: { color: '#3d6352', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#6b9e84', font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

function renderAnalise(totalReceita, totalDespesa, rendaPassiva, custoSobrevivencia, estiloDeVida, totalTransacoes) {
  const grid = document.getElementById('analise-grid');
  if (!grid) return;
  const saldo        = totalReceita - totalDespesa;
  const rendaAtiva   = totalReceita - rendaPassiva;
  const taxaEconomia = totalReceita > 0 ? ((saldo / totalReceita) * 100).toFixed(1) : 0;

  const items = [
    { label: 'Renda Ativa',      value: formatCurrency(rendaAtiva),         color: '#00f5a0' },
    { label: 'Renda Passiva',    value: formatCurrency(rendaPassiva),        color: '#00f5a0' },
    { label: 'Renda Total',      value: formatCurrency(totalReceita),        color: '#00f5a0' },
    { label: 'Custo Essencial',  value: formatCurrency(custoSobrevivencia),  color: '#f5d623' },
    { label: 'Estilo de Vida',   value: formatCurrency(estiloDeVida),        color: '#ff6384' },
    { label: 'Despesa Total',    value: formatCurrency(totalDespesa),        color: '#ff4d6d' },
    { label: 'Saldo',            value: formatCurrency(saldo),               color: saldo >= 0 ? '#00f5a0' : '#ff4d6d' },
    { label: 'Taxa de Poupança', value: taxaEconomia + '%',                  color: '#7b96ff' },
    { label: 'Transações',       value: totalTransacoes,                     color: '#6b9e84' },
  ];

  grid.innerHTML = items.map(item => `
    <div class="analise-item">
      <span class="analise-item-label">${item.label}</span>
      <span class="analise-item-value" style="color:${item.color}">${item.value}</span>
    </div>
  `).join('');
}

console.log('✅ dashboards.js carregado');
// ============================================================
// clientes.js — Módulo: Meus Clientes
// ============================================================

import { supabase } from './config.js';
import {
  openModal, closeModal, showToast,
  loadAllClientes, allClientes, currentAdmin
} from './admin.js';

let clienteEmEdicao = null;
let clienteComentarioId = null;

export function initClientes() {
  // Botão Adicionar Cliente
  document.getElementById('btn-add-cliente').addEventListener('click', () => {
    abrirModalCliente(null);
  });

  // Botão Salvar (modal)
  document.getElementById('btn-salvar-cliente').addEventListener('click', salvarCliente);

  // Máscara CPF
  document.getElementById('cliente-cpf').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    e.target.value = v;
  });

  // Máscara Telefone
  document.getElementById('cliente-telefone').addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/(\d{2})(\d)/, '($1) $2')
         .replace(/(\d{5})(\d)/, '$1-$2');
    e.target.value = v;
  });

  // Botão Salvar Comentário
  document.getElementById('btn-salvar-comentario').addEventListener('click', salvarComentario);

  // Recarrega ao mudar de secção
  window.addEventListener('section:change', ({ detail }) => {
    if (detail.section === 'clientes') renderClientes();
  });

  // Render inicial
  renderClientes();
}

// ── Renderiza grid de clientes ────────────────────────────────
async function renderClientes() {
  const grid = document.getElementById('clientes-grid');
  grid.innerHTML = '<p class="empty-state">Carregando...</p>';

  await loadAllClientes();

  if (!allClientes.length) {
    grid.innerHTML = '<p class="empty-state">Nenhum cliente cadastrado. Clique em + Adicionar Cliente.</p>';
    return;
  }

  grid.innerHTML = allClientes.map(c => `
    <div class="card">
      <div>
        <p class="card-name">${c.nome}</p>
        <p class="card-sub">${c.email || 'Sem email'}</p>
      </div>
      <div class="card-link-row">
        <span class="card-link-text">${window.location.origin}/dashboard.html?cliente=${c.id}</span>
        <button class="btn-copy" data-copy="${window.location.origin}/dashboard.html?cliente=${c.id}">Copiar</button>
      </div>
      <div class="card-actions">
        <button class="btn-card editar" data-id="${c.id}">✏️ Editar</button>
        <button class="btn-card comentarios" data-id="${c.id}" data-nome="${c.nome}">💬 Comentários</button>
      </div>
      <div class="card-actions">
        <button class="btn-card deletar" data-id="${c.id}" data-nome="${c.nome}">🗑️ Deletar</button>
      </div>
    </div>
  `).join('');

  // Eventos dos botões dentro do grid
  grid.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.copy)
        .then(() => showToast('Link copiado!'))
        .catch(() => showToast('Erro ao copiar', 'error'));
    });
  });

  grid.querySelectorAll('.btn-card.editar').forEach(btn => {
    btn.addEventListener('click', () => {
      const cliente = allClientes.find(c => c.id === btn.dataset.id);
      if (cliente) abrirModalCliente(cliente);
    });
  });

  grid.querySelectorAll('.btn-card.comentarios').forEach(btn => {
    btn.addEventListener('click', () => {
      abrirModalComentarios(btn.dataset.id, btn.dataset.nome);
    });
  });

  grid.querySelectorAll('.btn-card.deletar').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmarDeletar(btn.dataset.id, btn.dataset.nome);
    });
  });
}

// ── Abre modal de cliente (add ou editar) ─────────────────────
function abrirModalCliente(cliente) {
  clienteEmEdicao = cliente;

  document.getElementById('modal-cliente-title').textContent =
    cliente ? '✏️ Editar Cliente' : '📋 Adicionar Cliente';

  document.getElementById('cliente-id').value        = cliente?.id       || '';
  document.getElementById('cliente-nome').value      = cliente?.nome     || '';
  document.getElementById('cliente-email').value     = cliente?.email    || '';
  document.getElementById('cliente-cpf').value       = cliente?.cpf      || '';
  document.getElementById('cliente-telefone').value  = cliente?.telefone || '';

  openModal('modal-cliente');
}

// ── Salva cliente (insert ou update) ─────────────────────────
async function salvarCliente() {
  const nome      = document.getElementById('cliente-nome').value.trim();
  const email     = document.getElementById('cliente-email').value.trim();
  const cpf       = document.getElementById('cliente-cpf').value.trim();
  const telefone  = document.getElementById('cliente-telefone').value.trim();
  const clienteId = document.getElementById('cliente-id').value;

  if (!nome) { showToast('Informe o nome do cliente.', 'error'); return; }

  const payload = {
    nome,
    email:     email     || null,
    cpf:       cpf       || null,
    telefone:  telefone  || null,
    admin_id:  currentAdmin.id,
  };

  let error;

  if (clienteId) {
    ({ error } = await supabase.from('clientes').update(payload).eq('id', clienteId));
  } else {
    ({ error } = await supabase.from('clientes').insert(payload));
  }

  if (error) {
    showToast('Erro ao salvar cliente: ' + error.message, 'error');
    return;
  }

  showToast(clienteId ? 'Cliente atualizado!' : 'Cliente adicionado!');
  closeModal('modal-cliente');
  renderClientes();
}

// ── Deletar cliente ───────────────────────────────────────────
async function confirmarDeletar(id, nome) {
  if (!confirm(`Tem certeza que deseja deletar o cliente "${nome}"? Esta ação não pode ser desfeita.`)) return;

  const { error } = await supabase.from('clientes').delete().eq('id', id);

  if (error) {
    showToast('Erro ao deletar: ' + error.message, 'error');
    return;
  }

  showToast('Cliente removido.');
  renderClientes();
}

// ── Comentários ───────────────────────────────────────────────
async function abrirModalComentarios(clienteId, nome) {
  clienteComentarioId = clienteId;
  document.getElementById('modal-comentarios-title').textContent = `💬 Comentários — ${nome}`;
  document.getElementById('novo-comentario').value = '';

  await carregarComentarios(clienteId);
  openModal('modal-comentarios');
}

async function carregarComentarios(clienteId) {
  const lista = document.getElementById('comentarios-list');
  lista.innerHTML = '<p class="empty-state">Carregando...</p>';

  const { data, error } = await supabase
    .from('comentarios_clientes')
    .select('texto, criado_em')
    .eq('cliente_id', clienteId)
    .order('criado_em', { ascending: false });

  if (error || !data?.length) {
    lista.innerHTML = '<p class="empty-state">Nenhum comentário ainda.</p>';
    return;
  }

  lista.innerHTML = data.map(c => `
    <div class="comentario-item">
      <p class="comentario-data">${formatDate(c.criado_em)}</p>
      <p class="comentario-texto">${c.texto}</p>
    </div>
  `).join('');
}

async function salvarComentario() {
  const texto = document.getElementById('novo-comentario').value.trim();
  if (!texto) { showToast('Escreva um comentário antes de enviar.', 'error'); return; }

  const { error } = await supabase.from('comentarios_clientes').insert({
    cliente_id: clienteComentarioId,
    admin_id:   currentAdmin.id,
    texto,
  });

  if (error) { showToast('Erro ao enviar: ' + error.message, 'error'); return; }

  document.getElementById('novo-comentario').value = '';
  showToast('Comentário enviado!');
  await carregarComentarios(clienteComentarioId);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

import { getContacts } from './db.js';

export let contacts = [];

export async function initContactsViewer() {
  await loadContacts();
  document.addEventListener('dbChange', loadContacts);
}

export async function loadContacts() {
  contacts = await getContacts();
  renderContacts();
}

function renderContacts() {
  const tbody = document.getElementById('contactsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  contacts.forEach(c => {
    const tr = document.createElement('tr');
    const name = c.name || '';
    tr.innerHTML = `<td>${c.index}</td><td>${c.number}</td><td>${name}</td>`;
    tbody.appendChild(tr);
  });
}

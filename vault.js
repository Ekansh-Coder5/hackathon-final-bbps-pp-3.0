const state = {
  account: null,
  vault: {},
  selected: new Set(),
  revealed: new Set(),
  revealAll: false,
  creating: false
};

const $ = (id) => document.getElementById(id);

const TYPE_LABELS = {
  PER: 'Name', NAME: 'Name', GIVEN_NAME: 'First name', SURNAME: 'Last name', EMAIL: 'Email',
  PHONE: 'Phone', ADDRESS: 'Address', IP: 'IP address', CREDIT_CARD: 'Credit card',
  BANK_ACCOUNT: 'Bank account', DATE_OF_BIRTH: 'Date of birth', GOVERNMENT_ID: 'Government ID',
  PASSPORT: 'Passport', DRIVERS_LICENSE: 'Driver license', PASSWORD: 'Password',
  USERNAME: 'Username', AADHAAR: 'Aadhaar', PAN: 'PAN', UPI_ID: 'UPI ID'
};

function typeLabel(type) {
  return TYPE_LABELS[type] || String(type || 'Sensitive').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

async function showAuth() {
  state.account = null;
  state.vault = {};
  state.selected.clear();
  state.revealed.clear();
  state.revealAll = false;
  $('unlocked').hidden = true;
  $('count').hidden = true;
  $('rows').replaceChildren();
  $('auth').hidden = false;

  const [accounts, session, legacy] = await Promise.all([
    PrivexAccounts.listAccounts(),
    PrivexAccounts.getSession(),
    PrivexAccounts.legacyCount()
  ]);
  const ids = Object.keys(accounts);
  const creating = state.creating || ids.length === 0;

  $('unlockForm').hidden = creating;
  $('createForm').hidden = !creating;
  $('showUnlock').hidden = ids.length === 0;

  const select = $('accountSelect');
  select.replaceChildren(...ids.map((id) => new Option(
    `${accounts[id].username} (${accounts[id].tag})${session?.userId === id ? ' · signed in' : ''}`, id
  )));
  if (session && accounts[session.userId]) select.value = session.userId;

  $('legacyRow').hidden = legacy === 0;
  $('legacyLabel').textContent = `Move the ${legacy} item${legacy === 1 ? '' : 's'} saved before accounts existed into this account`;
  updateTagPreview();

  (creating ? $('newUsername') : $('unlockPassword')).focus();
}

function updateTagPreview() {
  const tag = ($('newUsername').value.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'USR').slice(0, 3).padEnd(2, 'X');
  $('tagPreview').textContent = `[${tag}:EMAIL_1]`;
}

async function busy(button, label, work) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try {
    return await work();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

$('unlockForm').addEventListener('submit', (event) => {
  event.preventDefault();
  $('unlockError').textContent = '';
  busy($('unlockBtn'), 'Unlocking…', async () => {
    try {
      const account = await PrivexAccounts.unlock($('accountSelect').value, $('unlockPassword').value);
      await PrivexAccounts.signIn(account);
      $('unlockPassword').value = '';
      await openVault(account);
    } catch (error) {
      $('unlockError').textContent = error.message;
      $('unlockPassword').select();
    }
  });
});

$('createForm').addEventListener('submit', (event) => {
  event.preventDefault();
  $('createError').textContent = '';
  if ($('newPassword').value !== $('confirmPassword').value) {
    $('createError').textContent = "The passwords don't match.";
    return;
  }
  busy($('createBtn'), 'Creating…', async () => {
    try {
      const account = await PrivexAccounts.createAccount($('newUsername').value, $('newPassword').value, {
        importLegacy: !$('legacyRow').hidden && $('importLegacy').checked
      });
      await PrivexAccounts.signIn(account);
      for (const id of ['newUsername', 'newPassword', 'confirmPassword']) $(id).value = '';
      state.creating = false;
      await openVault(account);
    } catch (error) {
      $('createError').textContent = error.message;
    }
  });
});

$('newUsername').addEventListener('input', updateTagPreview);
$('showCreate').addEventListener('click', () => { state.creating = true; showAuth(); });
$('showUnlock').addEventListener('click', () => { state.creating = false; showAuth(); });

async function openVault(account) {
  state.account = account;
  $('auth').hidden = true;
  $('unlocked').hidden = false;
  $('count').hidden = false;
  $('whoName').textContent = `Signed in as ${account.username}`;
  $('whoTag').textContent = `[${account.tag}:EMAIL_1]`;
  await load();
}

async function load() {
  if (!state.account) return;
  state.vault = await PrivexAccounts.readVault(state.account.id, state.account.key);
  for (const key of state.selected) if (!state.vault[key]) state.selected.delete(key);
  const legacy = await PrivexAccounts.legacyCount();
  $('legacyNotice').hidden = legacy === 0;
  $('legacyText').textContent = `${legacy} item${legacy === 1 ? ' was' : 's were'} saved before accounts existed and ${legacy === 1 ? 'is' : 'are'} not encrypted or linked to anyone.`;
  render();
}

function entries() {
  const query = $('search').value.trim().toLowerCase();
  const type = $('typeFilter').value;
  return Object.entries(state.vault)
    .filter(([, entry]) => !type || entry.type === type)
    .filter(([placeholder, entry]) => !query || [placeholder, entry.original, entry.site, typeLabel(entry.type)]
      .some((value) => String(value || '').toLowerCase().includes(query)))
    .sort((a, b) => (b[1].lastUsed || b[1].createdAt || 0) - (a[1].lastUsed || a[1].createdAt || 0));
}

function renderTypeFilter() {
  const select = $('typeFilter');
  const current = select.value;
  const types = [...new Set(Object.values(state.vault).map((entry) => entry.type))].sort();
  select.replaceChildren(new Option('All types', ''), ...types.map((type) => new Option(typeLabel(type), type)));
  select.value = types.includes(current) ? current : '';
}

function render() {
  renderTypeFilter();
  const total = Object.keys(state.vault).length;
  const visible = entries();

  $('count').textContent = `${total} item${total === 1 ? '' : 's'}`;
  $('empty').hidden = visible.length > 0;
  $('empty').querySelector('strong').textContent = total === 0 ? 'Nothing saved yet' : 'No matches';
  $('deleteAll').disabled = total === 0;
  $('deleteSelected').disabled = state.selected.size === 0;
  $('deleteSelected').textContent = state.selected.size ? `Delete selected (${state.selected.size})` : 'Delete selected';
  $('revealAll').textContent = state.revealAll ? 'Hide values' : 'Show values';
  $('selectAll').checked = visible.length > 0 && visible.every(([placeholder]) => state.selected.has(placeholder));

  $('rows').replaceChildren(...visible.map(([placeholder, entry]) => renderRow(placeholder, entry)));
}

function renderRow(placeholder, entry) {
  const row = document.createElement('tr');

  const check = document.createElement('td');
  check.className = 'check';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = state.selected.has(placeholder);
  box.setAttribute('aria-label', `Select ${placeholder}`);
  box.addEventListener('change', () => {
    box.checked ? state.selected.add(placeholder) : state.selected.delete(placeholder);
    render();
  });
  check.append(box);

  const type = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = 'type';
  badge.textContent = typeLabel(entry.type);
  type.append(badge);

  const original = document.createElement('td');
  const wrap = document.createElement('div');
  wrap.className = 'original';
  const value = document.createElement('span');
  const shown = state.revealAll || state.revealed.has(placeholder);
  value.textContent = shown ? entry.original : '•'.repeat(Math.min(12, Math.max(4, String(entry.original).length)));
  value.className = shown ? '' : 'hidden-value';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'link-btn';
  toggle.textContent = shown ? 'Hide' : 'Show';
  toggle.addEventListener('click', () => {
    state.revealed.has(placeholder) ? state.revealed.delete(placeholder) : state.revealed.add(placeholder);
    render();
  });
  wrap.append(value, toggle);
  original.append(wrap);

  const code = document.createElement('td');
  const codeText = document.createElement('code');
  codeText.textContent = placeholder;
  code.append(codeText);

  const site = document.createElement('td');
  site.className = 'site muted';
  site.textContent = entry.site || '—';

  const date = document.createElement('td');
  date.className = 'date muted';
  date.textContent = formatDate(entry.createdAt);

  const actions = document.createElement('td');
  actions.className = 'actions';
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'danger';
  del.textContent = 'Delete';
  del.addEventListener('click', () => removeEntries([placeholder]));
  actions.append(del);

  row.append(check, type, original, code, site, date, actions);
  return row;
}

async function removeEntries(placeholders) {
  if (!state.account) return;
  for (const placeholder of placeholders) state.selected.delete(placeholder);
  await PrivexAccounts.removeEntries(state.account.id, placeholders);
}

$('search').addEventListener('input', render);
$('typeFilter').addEventListener('change', render);
$('revealAll').addEventListener('click', () => {
  state.revealAll = !state.revealAll;
  if (!state.revealAll) state.revealed.clear();
  render();
});
$('selectAll').addEventListener('change', (event) => {
  for (const [placeholder] of entries()) {
    event.target.checked ? state.selected.add(placeholder) : state.selected.delete(placeholder);
  }
  render();
});
$('deleteSelected').addEventListener('click', () => {
  const count = state.selected.size;
  if (count && confirm(`Delete ${count} saved item${count === 1 ? '' : 's'}? Their placeholders will no longer show your real values.`)) {
    removeEntries([...state.selected]);
  }
});
$('deleteAll').addEventListener('click', () => {
  const total = Object.keys(state.vault).length;
  if (total && confirm(`Delete all ${total} saved items? Placeholders in your chats will no longer show your real values.`)) {
    removeEntries(Object.keys(state.vault));
  }
});

$('lock').addEventListener('click', () => { state.creating = false; showAuth(); });
$('signOut').addEventListener('click', async () => {
  await PrivexAccounts.signOut();
  state.creating = false;
  showAuth();
});
$('deleteAccount').addEventListener('click', async () => {
  const { id, username } = state.account;
  if (confirm(`Delete the account "${username}" and all of its saved data? This can't be undone.`)) {
    await PrivexAccounts.deleteAccount(id);
    state.creating = false;
    showAuth();
  }
});
$('moveLegacy').addEventListener('click', async () => {
  await PrivexAccounts.importLegacyVault(state.account.id, state.account.key);
  await load();
});
$('deleteLegacy').addEventListener('click', async () => {
  if (confirm('Delete the old unencrypted saved data? Placeholders that used it will no longer show real values.')) {
    await PrivexAccounts.deleteLegacyVault();
    await load();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && state.account && (changes[PrivexAccounts.vaultKeyFor(state.account.id)] || changes.privexVault)) load();
  if (area === 'local' && !state.account && changes[PrivexAccounts.ACCOUNTS_KEY]) showAuth();

  if (area === 'session' && state.account && changes[PrivexAccounts.SESSION_KEY] && !changes[PrivexAccounts.SESSION_KEY].newValue) showAuth();
});

showAuth();

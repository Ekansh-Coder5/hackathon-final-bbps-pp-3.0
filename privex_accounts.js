const PrivexAccounts = (() => {
  const ACCOUNTS_KEY = 'privexAccounts';
  const SESSION_KEY = 'privexSession';
  const LEGACY_VAULT_KEY = 'privexVault';
  const VAULT_PREFIX = 'privexVault:';
  const PBKDF2_ITERATIONS = 310000;
  const CHECK_TEXT = 'privex-account-check';

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

  async function deriveKey(password, saltBase64) {
    const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: fromBase64(saltBase64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  const exportKey = async (key) => toBase64(await crypto.subtle.exportKey('raw', key));
  const importKey = (base64) => crypto.subtle.importKey('raw', fromBase64(base64), 'AES-GCM', false, ['encrypt', 'decrypt']);

  async function encryptJSON(key, value) {
    const iv = randomBytes(12);
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(value)));
    return { iv: toBase64(iv), data: toBase64(data) };
  }

  async function decryptJSON(key, { iv, data }) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(data));
    return JSON.parse(decoder.decode(plain));
  }

  async function listAccounts() {
    const data = await chrome.storage.local.get(ACCOUNTS_KEY);
    return data[ACCOUNTS_KEY] || {};
  }

  function makeTag(username, accounts) {
    const taken = new Set(Object.values(accounts).map((account) => account.tag));
    const base = (username.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'USR').slice(0, 3).padEnd(2, 'X');
    if (!taken.has(base)) return base;
    for (let n = 2; n < 1000; n++) {
      const tag = `${base.slice(0, 3)}${n}`.slice(0, 6);
      if (!taken.has(tag)) return tag;
    }
    return toBase64(randomBytes(3)).replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 4);
  }

  async function createAccount(username, password, { importLegacy = false } = {}) {
    const name = String(username || '').trim();
    if (!name) throw new Error('Choose a username.');
    if (String(password || '').length < 6) throw new Error('Use a password with at least 6 characters.');
    const accounts = await listAccounts();
    if (Object.values(accounts).some((account) => account.username.toLowerCase() === name.toLowerCase())) {
      throw new Error('That username is already taken on this browser.');
    }

    const id = toBase64(randomBytes(9)).replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
    const salt = toBase64(randomBytes(16));
    const key = await deriveKey(password, salt);
    const account = { username: name, tag: makeTag(name, accounts), salt, check: await encryptJSON(key, CHECK_TEXT), createdAt: Date.now() };
    await chrome.storage.local.set({ [ACCOUNTS_KEY]: { ...accounts, [id]: account } });

    if (importLegacy) await importLegacyVault(id, key);
    return { id, ...account, key };
  }

  async function unlock(id, password) {
    const account = (await listAccounts())[id];
    if (!account) throw new Error('Account not found.');
    const key = await deriveKey(password, account.salt);
    try {
      if ((await decryptJSON(key, account.check)) === CHECK_TEXT) return { id, ...account, key };
    } catch (_error) {}
    throw new Error('Wrong password.');
  }

  async function deleteAccount(id) {
    const accounts = await listAccounts();
    delete accounts[id];
    await chrome.storage.local.set({ [ACCOUNTS_KEY]: accounts });
    await chrome.storage.local.remove(VAULT_PREFIX + id);
    const session = await getSession();
    if (session?.userId === id) await signOut();
  }

  async function signIn(account) {
    await chrome.storage.session.set({
      [SESSION_KEY]: { userId: account.id, username: account.username, tag: account.tag, key: await exportKey(account.key) }
    });
  }

  const signOut = () => chrome.storage.session.remove(SESSION_KEY);

  async function getSession() {
    try {
      const data = await chrome.storage.session.get(SESSION_KEY);
      return data[SESSION_KEY] || null;
    } catch (_error) {
      return null;
    }
  }

  const vaultKeyFor = (id) => VAULT_PREFIX + id;

  async function readVault(id, key) {
    const data = await chrome.storage.local.get(vaultKeyFor(id));
    const encrypted = data[vaultKeyFor(id)] || {};
    const entries = {};
    await Promise.all(Object.entries(encrypted).map(async ([placeholder, box]) => {
      try {
        entries[placeholder] = await decryptJSON(key, box);
      } catch (_error) {

      }
    }));
    return entries;
  }

  async function addEntries(id, key, entries) {
    if (!entries.size) return;
    const encryptedNew = {};
    for (const [placeholder, entry] of entries) encryptedNew[placeholder] = await encryptJSON(key, entry);
    const data = await chrome.storage.local.get(vaultKeyFor(id));
    const vault = data[vaultKeyFor(id)] || {};
    for (const [placeholder, box] of Object.entries(encryptedNew)) if (!vault[placeholder]) vault[placeholder] = box;
    await chrome.storage.local.set({ [vaultKeyFor(id)]: vault });
  }

  async function removeEntries(id, placeholders) {
    const data = await chrome.storage.local.get(vaultKeyFor(id));
    const vault = data[vaultKeyFor(id)] || {};
    for (const placeholder of placeholders) delete vault[placeholder];
    await chrome.storage.local.set({ [vaultKeyFor(id)]: vault });
  }

  async function countEntries(id) {
    const data = await chrome.storage.local.get(vaultKeyFor(id));
    return Object.keys(data[vaultKeyFor(id)] || {}).length;
  }

  async function legacyCount() {
    const data = await chrome.storage.local.get(LEGACY_VAULT_KEY);
    return Object.keys(data[LEGACY_VAULT_KEY] || {}).length;
  }

  async function importLegacyVault(id, key) {
    const data = await chrome.storage.local.get(LEGACY_VAULT_KEY);
    const legacy = data[LEGACY_VAULT_KEY] || {};
    await addEntries(id, key, new Map(Object.entries(legacy)));
    await chrome.storage.local.remove(LEGACY_VAULT_KEY);
  }

  const deleteLegacyVault = () => chrome.storage.local.remove(LEGACY_VAULT_KEY);

  return {
    ACCOUNTS_KEY,
    SESSION_KEY,
    vaultKeyFor,
    importKey,
    listAccounts,
    createAccount,
    unlock,
    deleteAccount,
    signIn,
    signOut,
    getSession,
    readVault,
    addEntries,
    removeEntries,
    countEntries,
    legacyCount,
    importLegacyVault,
    deleteLegacyVault
  };
})();

if (typeof window !== 'undefined') window.PrivexAccounts = PrivexAccounts;

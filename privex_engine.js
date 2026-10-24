const PRIVEX_PLACEHOLDER_RE = /\[(?:[A-Z0-9]{2,6}:)?[A-Z_]+_\d+\]/g;
const PRIVEX_GUEST_TAG = 'GUEST';

const PRIVEX_SKIP_SELECTOR = 'textarea, input, script, style, noscript, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], .privex-ui';

class PrivexEngine {
  constructor() {
    this.sensitivityMap = new Map();
    this.metadata = new Map();
    this.pending = new Map();
    this.guestEntries = new Map();
    this.account = null;
    this.key = null;
    this.listeners = new Set();
    this.detectionEngine = new PrivexDetectionEngine();
    this.ready = this.loadSession();
    this.watchStorage();
  }

  async loadSession() {
    try {
      const session = await PrivexAccounts.getSession();
      if (!session) {
        this.account = null;
        this.key = null;
        this.applyEntries(Object.fromEntries(this.guestEntries));
        return;
      }
      this.account = { userId: session.userId, username: session.username, tag: session.tag };
      this.key = await PrivexAccounts.importKey(session.key);
      await this.loadVault();
    } catch (error) {
      console.warn('[Privex] Could not load the signed-in account', error);
    }
  }

  async loadVault() {
    if (!this.account) return;
    const entries = await PrivexAccounts.readVault(this.account.userId, this.key);
    this.applyEntries(entries);
  }

  watchStorage() {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'session' && changes[PrivexAccounts.SESSION_KEY]) {
          this.pending.clear();
          this.ready = this.loadSession();
        } else if (area === 'local' && this.account && changes[PrivexAccounts.vaultKeyFor(this.account.userId)]) {
          this.loadVault();
        }
      });
    } catch (_error) {}
  }

  applyEntries(entries) {
    for (const placeholder of this.pending.keys()) {
      if (entries[placeholder]) this.pending.delete(placeholder);
    }
    this.sensitivityMap = new Map();
    this.metadata = new Map();
    for (const [placeholder, entry] of Object.entries(entries)) this.remember(placeholder, entry);
    for (const [placeholder, entry] of this.pending) this.remember(placeholder, entry);
    for (const listener of this.listeners) listener();
  }

  remember(placeholder, entry) {
    this.sensitivityMap.set(placeholder, entry.original);
    this.metadata.set(placeholder, {
      type: entry.type || parsePlaceholder(placeholder)?.type || 'SENSITIVE',
      source: entry.source || 'automatic',
      site: entry.site || '',
      createdAt: entry.createdAt || 0
    });
  }

  onChange(listener) {
    this.listeners.add(listener);
  }

  async persist(entries) {
    if (entries.size === 0 || !this.account) return;
    try {
      await PrivexAccounts.addEntries(this.account.userId, this.key, entries);
    } catch (error) {
      console.warn('[Privex] Could not save placeholders', error);
    }
  }

  maskUserInput(text, selectedDetections = null) {
    if (!text) return text;

    const tag = this.account?.tag || PRIVEX_GUEST_TAG;
    const { sanitizedText, vault, detections } = this.detectionEngine.mask(text, selectedDetections, this.sensitivityMap, tag);

    const created = new Map();
    vault.forEach((original, placeholder) => {
      if (this.sensitivityMap.get(placeholder) === original) return;
      const detection = detections.find((d) => d.word === original);
      const entry = {
        original,
        type: parsePlaceholder(placeholder)?.type || 'SENSITIVE',
        source: detection?.source === 'manual' ? 'manual' : 'automatic',
        site: location.hostname,
        createdAt: Date.now()
      };
      if (this.account) this.pending.set(placeholder, entry);
      else this.guestEntries.set(placeholder, entry);
      this.remember(placeholder, entry);
      created.set(placeholder, entry);
    });
    this.persist(created);

    return sanitizedText;
  }

  restoreString(text) {
    if (!text || this.sensitivityMap.size === 0 || text.indexOf('[') === -1) return text;
    return text.replace(PRIVEX_PLACEHOLDER_RE, (placeholder) => this.sensitivityMap.get(placeholder) ?? placeholder);
  }

  restoreDOMSubtree(root) {
    if (!root || this.sensitivityMap.size === 0) return 0;
    if (root.nodeType === Node.TEXT_NODE) root = root.parentNode;
    if (!root || (root.nodeType === Node.ELEMENT_NODE && root.closest(PRIVEX_SKIP_SELECTOR))) return 0;

    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!node.nodeValue || !parent || parent.closest(PRIVEX_SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    if (nodes.length === 0) return 0;

    const full = nodes.map((node) => node.nodeValue).join('');
    if (full.indexOf('[') === -1) return 0;

    const matches = Array.from(full.matchAll(PRIVEX_PLACEHOLDER_RE))
      .filter((match) => this.sensitivityMap.has(match[0]))
      .reverse();
    for (const match of matches) {
      this.replaceAcrossNodes(nodes, match.index, match.index + match[0].length, this.sensitivityMap.get(match[0]));
    }
    return matches.length;
  }

  replaceAcrossNodes(nodes, start, end, replacement) {
    let offset = 0;
    let inserted = false;
    for (const node of nodes) {
      const value = node.nodeValue;
      const nodeStart = offset;
      const nodeEnd = offset + value.length;
      offset = nodeEnd;
      if (nodeEnd <= start) continue;
      if (nodeStart >= end) break;
      const s = Math.max(start, nodeStart) - nodeStart;
      const e = Math.min(end, nodeEnd) - nodeStart;
      node.nodeValue = value.slice(0, s) + (inserted ? '' : replacement) + value.slice(e);
      inserted = true;
    }
  }

  restoreResponse(aiResponse) {
    return this.restoreString(aiResponse);
  }

  getMasks() {
    return Array.from(this.sensitivityMap.entries()).map(([placeholder, original]) => ({
      placeholder,
      dataType: this.metadata.get(placeholder)?.type || 'SENSITIVE',
      original,
      masked: original.length > 6
        ? original.substring(0, 3) + '*'.repeat(Math.max(0, original.length - 6)) + original.substring(original.length - 3)
        : '***'
    }));
  }

  clearMasks() {
    this.guestEntries.clear();
    if (!this.account) this.applyEntries({});
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrivexEngine;
}

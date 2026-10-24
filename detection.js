const PRIORITY = {
    WEAK: 0,
    MODEL: 1,
    PATTERN: 2,
    VALIDATED: 3,
    SECRET: 4
};

const digitsOnly = (value) => value.replace(/\D/g, '');

function luhnValid(value) {
    const digits = digitsOnly(value);
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let double = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let d = digits.charCodeAt(i) - 48;
        if (double) {
            d *= 2;
            if (d > 9) d -= 9;
        }
        sum += d;
        double = !double;
    }
    return sum % 10 === 0;
}

function creditCardValid(value) {
    const digits = digitsOnly(value);

    return /^(?:4|5[1-5]|2[2-7]|3[47]|3[0-9]|6)/.test(digits) && luhnValid(digits) && !/^(\d)\1+$/.test(digits);
}

const VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];
const VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

function aadhaarValid(value) {
    const digits = digitsOnly(value);
    if (digits.length !== 12 || /^(\d)\1+$/.test(digits)) return false;
    let c = 0;
    const reversed = digits.split('').reverse();
    for (let i = 0; i < reversed.length; i++) {
        c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(reversed[i])]];
    }
    return c === 0;
}

function ipv4Valid(value) {
    const parts = value.split('.');
    return parts.length === 4 && parts.every((p) => Number(p) <= 255 && !(p.length > 1 && p[0] === '0'));
}

function ipv6Valid(value) {
    const colons = (value.match(/:/g) || []).length;
    const groups = value.split(':').filter(Boolean).length;
    if (groups < 3) return false;
    return value.includes('::') ? colons >= 2 && colons <= 7 : colons === 7;
}

function phoneValid(value) {
    const digits = digitsOnly(value);
    return digits.length >= 10 && digits.length <= 15 && !/^(\d)\1+$/.test(digits);
}

function ibanValid(value) {
    const iban = value.replace(/\s/g, '');
    if (iban.length < 15 || iban.length > 34) return false;
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    let remainder = 0;
    for (const ch of rearranged) {
        const n = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
        for (const d of n) remainder = (remainder * 10 + Number(d)) % 97;
    }
    return remainder === 1;
}

const COMMON_TLDS = new Set([
    'com', 'net', 'org', 'io', 'ai', 'co', 'in', 'us', 'uk', 'dev', 'app', 'edu', 'gov', 'mil',
    'me', 'info', 'biz', 'xyz', 'tech', 'cloud', 'ca', 'de', 'fr', 'jp', 'au', 'ru', 'cn', 'br',
    'nl', 'eu', 'ch', 'se', 'no', 'es', 'it', 'pl', 'tv', 'gg', 'ly', 'site', 'online', 'store',
    'live', 'page', 'blog', 'shop', 'today', 'world', 'news', 'email', 'link', 'sg', 'ae', 'za',
    'nz', 'ie', 'kr', 'hk', 'tw', 'mx', 'ar', 'id', 'my', 'ph', 'pk', 'bd', 'lk', 'np', 'int'
]);

function domainValid(value) {
    const labels = value.split('.');
    const tld = labels[labels.length - 1];
    return COMMON_TLDS.has(tld) && labels.slice(0, -1).some((label) => /[a-z]/i.test(label));
}

const UPI_HANDLES = new Set([
    'upi', 'ybl', 'ibl', 'axl', 'apl', 'paytm', 'okaxis', 'okhdfcbank', 'okicici', 'oksbi',
    'axisbank', 'hdfcbank', 'icici', 'sbi', 'kotak', 'barodampay', 'freecharge', 'jupiteraxis',
    'idfcbank', 'waicici', 'wahdfcbank', 'waaxis', 'wasbi', 'airtel', 'fbl', 'rbl', 'pnb',
    'yesbank', 'yesbankltd', 'indus', 'federal', 'aubank', 'citi', 'hsbc', 'sliceaxis', 'naviaxis'
]);

const upiValid = (value) => UPI_HANDLES.has(value.split('@')[1].toLowerCase());

const BUILT_IN_REGEX_PATTERNS = [
    { type: "EMAIL",       priority: PRIORITY.VALIDATED, regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
    { type: "URL",          priority: PRIORITY.PATTERN,   regex: /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/g, trim: true },
    { type: "PHONE",        priority: PRIORITY.VALIDATED, regex: /(?<![\w+])(?:(?:\+|00)91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g, validate: phoneValid },
    { type: "PHONE",        priority: PRIORITY.VALIDATED, regex: /(?<![\w+])\+\d{1,3}[\s.-]?(?:\(\d{1,4}\)[\s.-]?)?\d{1,4}(?:[\s.-]?\d{2,4}){1,4}(?!\d)/g, validate: phoneValid },
    { type: "PHONE",        priority: PRIORITY.PATTERN,   regex: /(?<!\w)(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?!\d)/g },
    { type: "PHONE",        priority: PRIORITY.WEAK,      regex: /(?<![\d.])\d{10}(?![\d.])/g, validate: phoneValid },
    { type: "IP",           priority: PRIORITY.VALIDATED, regex: /(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.]*\d)/g, validate: ipv4Valid },
    { type: "IP",           priority: PRIORITY.VALIDATED, regex: /(?<![\w:])(?:[0-9A-Fa-f]{1,4}:){1,7}:?(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4})*)?(?![\w:])/g, validate: ipv6Valid },
    { type: "AADHAAR",      priority: PRIORITY.VALIDATED, regex: /(?<!\d)[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g, validate: aadhaarValid },

    { type: "AADHAAR",      priority: PRIORITY.VALIDATED, group: 1, regex: /\b(?:aadhaa?r|adhaa?r|uidai|uid)\b(?:\s*(?:card|no\.?|number|num|#))*\s*(?:is|:|-)?\s*(\d{4}[\s-]?\d{4}[\s-]?\d{4})(?![\d]|[\s-]\d)/gi },

    { type: "AADHAAR",      priority: PRIORITY.PATTERN,   regex: /(?<!\d[\s-]?)\d{4}([\s-])\d{4}\1\d{4}(?![\s-]?\d)/g },
    { type: "CREDIT_CARD",  priority: PRIORITY.VALIDATED, regex: /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g, validate: creditCardValid },
    { type: "GSTIN",        priority: PRIORITY.VALIDATED, regex: /\b\d{2}[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g },
    { type: "PAN",          priority: PRIORITY.VALIDATED, regex: /\b[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]\b/g },
    { type: "IFSC",         priority: PRIORITY.PATTERN,   regex: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
    { type: "UPI_ID",       priority: PRIORITY.VALIDATED, regex: /\b[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}\b(?![.@\w-])/g, validate: upiValid },
    { type: "IBAN",         priority: PRIORITY.VALIDATED, regex: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g, validate: ibanValid },
    { type: "SSN",          priority: PRIORITY.PATTERN,   regex: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
    { type: "PASSPORT",     priority: PRIORITY.MODEL,     regex: /\b[A-PR-WY][1-9]\d{6}\b/g },
    { type: "DATE_OF_BIRTH", priority: PRIORITY.VALIDATED, group: 1, regex: /\b(?:DOB|D\.O\.B\.?|date of birth|birth ?date|born on)\s*[:\-]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9},?\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/gi },
    { type: "MAC",          priority: PRIORITY.VALIDATED, regex: /\b(?:[0-9A-Fa-f]{2}([:-]))(?:[0-9A-Fa-f]{2}\1){4}[0-9A-Fa-f]{2}\b/g },
    { type: "DOMAIN",       priority: PRIORITY.WEAK,      regex: /\b(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[a-z]{2,24}\b/g, validate: domainValid }
];

const BUILT_IN_SECRET_PATTERNS = [
    { type: "ANTHROPIC_API_KEY", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
    { type: "OPENAI_API_KEY",    regex: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g },
    { type: "STRIPE_KEY",        regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },
    { type: "GITHUB_TOKEN",      regex: /\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{50,})\b/g },
    { type: "GOOGLE_API_KEY",    regex: /\bAIza[0-9A-Za-z_-]{35}/g },
    { type: "GOOGLE_OAUTH",      regex: /\bya29\.[0-9A-Za-z_-]{20,}/g },
    { type: "AWS_ACCESS_KEY",    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
    { type: "AWS_SECRET_KEY",    group: 1, regex: /aws_?secret_?access_?key["']?\s*[:=]\s*["']?([A-Za-z0-9\/+=]{40})/gi },
    { type: "SLACK_TOKEN",       regex: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
    { type: "SLACK_WEBHOOK",     regex: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9\/]+/g },
    { type: "HUGGINGFACE_TOKEN", regex: /\bhf_[A-Za-z0-9]{30,}\b/g },
    { type: "NPM_TOKEN",         regex: /\bnpm_[A-Za-z0-9]{36}\b/g },
    { type: "SENDGRID_KEY",      regex: /\bSG\.[\w-]{22}\.[\w-]{43}\b/g },
    { type: "TWILIO_KEY",        regex: /\bSK[0-9a-fA-F]{32}\b/g },
    { type: "JWT",               regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
    { type: "BEARER_TOKEN",      group: 1, regex: /\bBearer\s+([A-Za-z0-9._~+\/=-]{8,})/g },
    { type: "SUPABASE_KEY",      regex: /\bsbp_[A-Za-z0-9]{20,}\b/g },
    { type: "DATABASE_URL",      regex: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|mariadb|rediss?|amqps?|mssql|sqlserver):\/\/[^\s"'`<>]+/g, trim: true },
    { type: "SSH_PRIVATE_KEY",   regex: /-----BEGIN[\s\S]*?PRIVATE KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE KEY-----/g },
    { type: "PASSWORD",          group: 1, trim: true, regex: /\b(?:password|passwd|pwd|passcode|pass ?phrase|pin|otp)(?:\s+is\s+|\s*[:=]\s*)["'`]?([^\s"'`]{4,})/gi },
    { type: "ENV_VARIABLE",      group: 1, regex: /\b[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PASS|PWD|AUTH|CREDENTIALS?|PRIVATE|DSN|SALT)[A-Z0-9_]*\s*[:=]\s*["']?([^\s"'`,;]{4,})/g },
    { type: "SECRET",            group: 1, regex: /\b(?:api[_-]?key|apikey|secret(?:[_-]?key)?|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key)["']?\s*[:=]\s*["']?([A-Za-z0-9_\-.\/+=]{12,})/gi }
].map((pattern) => ({ priority: PRIORITY.SECRET, ...pattern }));

const RULES_STORAGE_KEY = 'privexRules';

const VALIDATORS = {
    phone: phoneValid,
    ipv4: ipv4Valid,
    ipv6: ipv6Valid,
    aadhaar: aadhaarValid,
    creditCard: creditCardValid,
    luhn: luhnValid,
    upi: upiValid,
    iban: ibanValid,
    domain: domainValid
};

const PRIORITY_NAMES = Object.fromEntries(Object.entries(PRIORITY).map(([name, value]) => [value, name]));

let regexPatterns = BUILT_IN_REGEX_PATTERNS;
let secretPatterns = BUILT_IN_SECRET_PATTERNS;
let activeRulesInfo = { source: 'built-in', count: BUILT_IN_REGEX_PATTERNS.length + BUILT_IN_SECRET_PATTERNS.length, skipped: [] };

function compileRules(rules) {
    const regex = [];
    const secret = [];
    const skipped = [];
    for (const [index, rule] of (Array.isArray(rules) ? rules : []).entries()) {
        const id = rule?.id || `rule ${index + 1}`;
        if (!rule || rule.enabled === false) continue;
        try {
            if (!rule.type || !/^[A-Z][A-Z0-9_]*$/.test(rule.type)) throw new Error('type must be UPPER_SNAKE_CASE');
            if (typeof rule.pattern !== 'string' || !rule.pattern) throw new Error('pattern is missing');
            const flags = [...new Set(`${rule.flags || ''}g`)].filter((f) => 'gimsuy'.includes(f)).join('');
            const validate = rule.validator ? VALIDATORS[rule.validator] : undefined;
            if (rule.validator && !validate) throw new Error(`unknown validator "${rule.validator}"`);
            const isSecret = rule.category === 'secret';
            const priority = PRIORITY[rule.priority] ?? (isSecret ? PRIORITY.SECRET : PRIORITY.PATTERN);
            const compiled = {
                id,
                type: rule.type,
                regex: new RegExp(rule.pattern, flags),
                priority,
                group: Number(rule.group) || 0,
                validate,
                trim: Boolean(rule.trim)
            };
            (isSecret ? secret : regex).push(compiled);
        } catch (error) {
            skipped.push({ id, error: String(error.message || error) });
        }
    }
    return { regex, secret, skipped };
}

function applyRules(rules, source = 'online') {
    if (!Array.isArray(rules) || rules.length === 0) {
        regexPatterns = BUILT_IN_REGEX_PATTERNS;
        secretPatterns = BUILT_IN_SECRET_PATTERNS;
        activeRulesInfo = { source: 'built-in', count: regexPatterns.length + secretPatterns.length, skipped: [] };
        return activeRulesInfo;
    }
    const { regex, secret, skipped } = compileRules(rules);
    if (regex.length + secret.length === 0) {

        applyRules(null);
        activeRulesInfo.skipped = skipped;
        return activeRulesInfo;
    }
    regexPatterns = regex;
    secretPatterns = secret;
    activeRulesInfo = { source, count: regex.length + secret.length, skipped };
    return activeRulesInfo;
}

function builtInRulesAsJSON() {
    const validatorName = (fn) => Object.keys(VALIDATORS).find((name) => VALIDATORS[name] === fn);
    const toRule = (pattern, category, index) => {
        const rule = {
            id: `${category}-${pattern.type.toLowerCase().replace(/_/g, '-')}-${index + 1}`,
            category,
            type: pattern.type,
            pattern: pattern.regex.source,
            flags: pattern.regex.flags,
            priority: PRIORITY_NAMES[pattern.priority]
        };
        if (pattern.group) rule.group = pattern.group;
        if (pattern.validate) rule.validator = validatorName(pattern.validate);
        if (pattern.trim) rule.trim = true;
        rule.enabled = true;
        return rule;
    };
    return [
        ...BUILT_IN_REGEX_PATTERNS.map((p, i) => toRule(p, 'pii', i)),
        ...BUILT_IN_SECRET_PATTERNS.map((p, i) => toRule(p, 'secret', i))
    ];
}

if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
        chrome.storage.local.get(RULES_STORAGE_KEY).then((data) => {
            const saved = data[RULES_STORAGE_KEY];
            if (saved?.rules) applyRules(saved.rules, saved.source || 'online');
        }).catch(() => {});
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local' || !changes[RULES_STORAGE_KEY]) return;
            const saved = changes[RULES_STORAGE_KEY].newValue;
            applyRules(saved?.rules || null, saved?.source || 'online');
        });
    } catch (_error) {}
}

const PLACEHOLDER_RE = /\[(?:[A-Z0-9]{2,6}:)?[A-Z_]+_\d+\]/g;

function parsePlaceholder(placeholder) {
    const match = /^\[(?:([A-Z0-9]{2,6}):)?([A-Z_]+)_(\d+)\]$/.exec(placeholder);
    return match ? { tag: match[1] || '', type: match[2], n: Number(match[3]) } : null;
}

const MODEL_STOPWORDS = new Set([
    'i', 'me', 'my', 'mine', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
    'their', 'we', 'us', 'our', 'it', 'its', 'the', 'a', 'an', 'is', 'am', 'are', 'and', 'or',
    'name', 'password', 'email', 'phone', 'address', 'number', 'username', 'user', 'mr', 'mrs', 'ms', 'dr'
]);

const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;
const WORD_CHAR = /[\p{L}\p{M}\p{N}_]/u;

function collectPatternMatches(text, patterns) {
    const candidates = [];
    for (const { type, regex, priority, group, validate, trim } of patterns) {
        regex.lastIndex = 0;
        for (const match of text.matchAll(regex)) {
            let word = group ? match[group] : match[0];
            if (!word) continue;
            let start = group ? match.index + match[0].lastIndexOf(word) : match.index;
            if (trim) word = word.replace(TRAILING_PUNCTUATION, '');
            if (!word || (validate && !validate(word))) continue;
            candidates.push({ entity_group: type, word, start, end: start + word.length, priority });
        }
    }
    return candidates;
}

const toDetections = (candidates) => candidates.map(({ entity_group, word }) => ({ entity_group, word }));

function detectRegex(text) {
    return toDetections(resolveOverlaps(collectPatternMatches(text, regexPatterns)));
}

function detectSecrets(text) {
    return toDetections(resolveOverlaps(collectPatternMatches(text, secretPatterns)));
}

function resolveOverlaps(candidates) {
    const ordered = candidates
        .map((c, order) => ({ ...c, order }))
        .sort((a, b) => b.priority - a.priority || (b.end - b.start) - (a.end - a.start) || a.order - b.order);

    let picked = [];
    for (const c of ordered) {
        const conflicts = picked.filter((p) => c.start < p.end && p.start < c.end);
        if (conflicts.length === 0) {
            picked.push(c);
            continue;
        }
        const swallowsAll = conflicts.every((p) => c.start <= p.start && c.end >= p.end && (c.end - c.start) > (p.end - p.start));
        if (!swallowsAll) continue;
        picked = picked.filter((p) => !conflicts.includes(p));
        picked.push(c);
    }
    return picked.sort((a, b) => a.start - b.start);
}

function mergeDetections(...detectionArrays) {
    const seen = new Map();

    for (const arr of detectionArrays) {
        for (const d of arr) {
            const key = d.word.trim();
            if (key && !seen.has(key)) seen.set(key, { entity_group: d.entity_group, word: key });
        }
    }

    return Array.from(seen.values());
}

function findCaseInsensitiveMatches(text, candidate) {
    if (!candidate) return [];
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
        const matches = [];
        for (const match of text.matchAll(new RegExp(escaped, 'giu'))) {
            let start = match.index;
            let end = start + match[0].length;

            while (start > 0) {
                let previousIndex = start - 1;
                let previous = text.codePointAt(previousIndex);
                if (previous >= 0xDC00 && previous <= 0xDFFF && previousIndex > 0) {
                    const high = text.charCodeAt(previousIndex - 1);
                    if (high >= 0xD800 && high <= 0xDBFF) {
                        previousIndex--;
                        previous = text.codePointAt(previousIndex);
                    }
                }
                const previousChar = String.fromCodePoint(previous);
                if (!WORD_CHAR.test(previousChar)) break;
                start = previousIndex;
            }
            while (end < text.length) {
                const next = text.codePointAt(end);
                const nextChar = String.fromCodePoint(next);
                if (!WORD_CHAR.test(nextChar)) break;
                end += next > 0xFFFF ? 2 : 1;
            }

            const alignedToWordStart = start === match.index;
            const coversMostOfWord = match[0].length * 2 >= end - start;
            if (!alignedToWordStart && !coversMostOfWord) continue;
            if (alignedToWordStart && end - start > match[0].length * 2 && match[0].length < 4) continue;

            matches.push({ word: text.slice(start, end), index: start });
        }
        return matches;
    } catch (_error) {
        return [];
    }
}

function modelEntityType(entityGroup, word) {
    const digits = digitsOnly(word);
    if (/^[\d\s-]+$/.test(word) && digits.length >= 13 && digits.length <= 19) return 'CREDIT_CARD';
    return entityGroup;
}

function isUsefulModelWord(word) {
    const trimmed = (word || '').trim();
    return trimmed.length >= 2 && /[\p{L}\p{N}]/u.test(trimmed) && !MODEL_STOPWORDS.has(trimmed.toLocaleLowerCase());
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replaceOccurrences(text, word, replacement) {
    const before = WORD_CHAR.test(word[0]) ? '(?<![\\p{L}\\p{M}\\p{N}_])' : '';
    const after = WORD_CHAR.test(word[word.length - 1]) ? '(?![\\p{L}\\p{M}\\p{N}_])' : '';
    try {
        let count = 0;
        const result = text.replace(new RegExp(before + escapeRegExp(word) + after, 'gu'), () => {
            count++;
            return replacement;
        });
        if (count > 0) return result;
    } catch (_error) {}
    return text.split(word).join(replacement);
}

function sanitize(text, detections, existingVault = null, tag = '') {
    const sorted = [...detections].sort((a, b) => b.word.length - a.word.length);

    const known = new Map();
    const typeCounters = {};
    for (const [placeholder, original] of existingVault || []) {
        known.set(original, placeholder);
        const parsed = parsePlaceholder(placeholder);
        if (parsed && parsed.tag === tag) typeCounters[parsed.type] = Math.max(typeCounters[parsed.type] || 0, parsed.n);
    }

    const vault = new Map();
    let sanitized = text;

    for (const { entity_group, word } of sorted) {
        if (!word || sanitized.indexOf(word) === -1) continue;

        let placeholder = known.get(word);
        if (!placeholder) {
            const type = String(entity_group || 'SENSITIVE').toUpperCase().replace(/[^A-Z_]/g, '_');
            typeCounters[type] = (typeCounters[type] || 0) + 1;
            placeholder = tag ? `[${tag}:${type}_${typeCounters[type]}]` : `[${type}_${typeCounters[type]}]`;
            known.set(word, placeholder);
        }
        vault.set(placeholder, word);

        sanitized = replaceOccurrences(sanitized, word, placeholder);
    }

    return { sanitizedText: sanitized, vault };
}

function restore(text, vault) {
    let restored = text;
    for (const [placeholder, original] of vault.entries()) {
        restored = restored.split(placeholder).join(original);
    }
    return restored;
}

class PrivexDetectionEngine {
    constructor() {
        this.detectionHistory = new Map();
        this.nerCache = [];
        this._nerTimer = null;
    }

    refreshNER(text, done) {
        clearTimeout(this._nerTimer);

        const clean = (text || '').replace(PLACEHOLDER_RE, ' ');
        if (!clean.trim()) {
            this.nerCache = [];
            if (done) done({ state: 'idle' }, []);
            return;
        }

        this._nerTimer = setTimeout(async () => {
            try {
                const res = await chrome.runtime.sendMessage({ action: 'ner', text: clean });
                this.nerCache = (res && res.entities) || [];
                if (done) done((res && res.status) || { state: 'error', error: 'Model returned no status' }, this.nerCache);
            } catch (error) {
                this.nerCache = [];
                if (done) done({ state: 'error', error: String(error?.message || error) }, []);
            }
        }, 300);
    }

    detectAll(text) {
        if (!text) return [];

        const modelCandidates = this.nerCache.flatMap(entity => {
            if (!isUsefulModelWord(entity.word)) return [];
            return findCaseInsensitiveMatches(text, entity.word.trim()).map(({ word, index }) => ({
                entity_group: modelEntityType(entity.entity_group, word),
                word,
                start: index,
                end: index + word.length,
                priority: PRIORITY.MODEL
            }));
        });

        const placeholderSpans = Array.from(text.matchAll(PLACEHOLDER_RE), (m) => [m.index, m.index + m[0].length]);
        const candidates = [
            ...collectPatternMatches(text, secretPatterns),
            ...collectPatternMatches(text, regexPatterns),
            ...modelCandidates
        ].filter((c) => !placeholderSpans.some(([s, e]) => c.start < e && s < c.end));

        return mergeDetections(toDetections(resolveOverlaps(candidates)));
    }

    mask(text, selectedDetections = null, existingVault = null, tag = '') {
        const detections = selectedDetections || this.detectAll(text);
        const { sanitizedText, vault } = sanitize(text, detections, existingVault, tag);

        this.detectionHistory.set(sanitizedText, vault);

        return {
            sanitizedText,
            vault,
            detections,
            count: detections.length
        };
    }

    restoreText(text) {
        for (const [key, vault] of this.detectionHistory.entries()) {
            if (text.includes(key) || key.includes(text)) {
                return restore(text, vault);
            }
        }
        return restore(text, new Map());
    }

    clear() {
        this.detectionHistory.clear();
        this.nerCache = [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PrivexDetectionEngine,
        detectRegex,
        detectSecrets,
        mergeDetections,
        resolveOverlaps,
        sanitize,
        restore,
        parsePlaceholder,
        luhnValid,
        aadhaarValid,
        ibanValid,
        compileRules,
        applyRules,
        builtInRulesAsJSON,
        getActiveRulesInfo: () => activeRulesInfo
    };
}

if (typeof window !== 'undefined') {
    window.PrivexDetectionEngine = PrivexDetectionEngine;
}

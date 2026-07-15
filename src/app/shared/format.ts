// Rende "attivo" il contenuto HTML: numeri di telefono → chiama + WhatsApp,
// link ed email cliccabili. Lavora sul DOM (solo nodi di testo) così non tocca
// mai attributi o immagini base64 (che contengono lunghe sequenze di cifre).

const TOKEN = /((?:https?:\/\/|www\.)[^\s<]+)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|(\+?\d[\d\s./-]{6,}\d)/g;

const HAS_TAGS = /<[a-z/][\s\S]*>/i;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Testo semplice → HTML impaginato: riga vuota = nuovo paragrafo, a-capo singolo = <br>.
// Formattazione minima in stile markdown: **grassetto** e _corsivo_.
export function plainTextToHtml(text: string): string {
  let esc = escapeHtml((text ?? '').trim());
  esc = esc
    .replace(/\*\*([^\n*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])_([^\n_]+?)_(?!\w)/g, '$1<em>$2</em>');
  return esc
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, '<br>').trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${p}</p>`)
    .join('');
}

// Rende il corpo notizia: se è già HTML (notizie vecchie) lo usa così com'è,
// altrimenti impagina il testo semplice. In ogni caso rende attivi telefoni/link
// e incolonna le righe di contatto ("Nome: numero" → nome | 📞 | 💬).
export function renderNewsBody(body: string): string {
  if (!body) return '';
  const html = HAS_TAGS.test(body) ? body : plainTextToHtml(body);
  const doc = new DOMParser().parseFromString(linkifyHtml(html), 'text/html');
  groupContacts(doc);
  return doc.body.innerHTML;
}

// Divide i figli di un <p> in "righe" separate dai <br>.
function splitByBr(p: HTMLElement): ChildNode[][] {
  const lines: ChildNode[][] = [[]];
  for (const node of Array.from(p.childNodes)) {
    if (node.nodeName === 'BR') lines.push([]);
    else lines[lines.length - 1].push(node);
  }
  return lines;
}

function isBlank(nodes: ChildNode[]): boolean {
  return nodes.every((n) => n.nodeType === 3 && !(n.nodeValue ?? '').trim());
}

// Una riga è "contatto" se è esattamente: testo "Etichetta:" + un solo .phone-group.
function parseContactLine(nodes: ChildNode[]): { label: string; group: Element } | null {
  const meaningful = nodes.filter((n) => !(n.nodeType === 3 && !(n.nodeValue ?? '').trim()));
  if (meaningful.length !== 2) return null;
  const [first, second] = meaningful;
  if (first.nodeType !== 3) return null;
  const m = (first.nodeValue ?? '').match(/^\s*([^:]{1,24}):\s*$/);
  if (!m) return null;
  if (!(second instanceof Element) || !second.classList.contains('phone-group')) return null;
  return { label: m[1].trim(), group: second };
}

// Trasforma i <p> che contengono righe di contatto in una griglia a colonne.
function groupContacts(doc: Document): void {
  for (const p of Array.from(doc.body.querySelectorAll('p'))) {
    const lines = splitByBr(p);
    const parsed = lines.map(parseContactLine);
    if (!parsed.some(Boolean)) continue; // nessun contatto: lascio il paragrafo com'è

    const grid = doc.createElement('div');
    grid.className = 'contact-grid';

    lines.forEach((nodes, i) => {
      const c = parsed[i];
      if (c) {
        const name = doc.createElement('span');
        name.className = 'c-name';
        name.textContent = c.label;
        const phone = doc.createElement('span');
        phone.className = 'c-phone';
        const wa = doc.createElement('span');
        wa.className = 'c-wa';
        const call = c.group.querySelector('.phone-call');
        const waLink = c.group.querySelector('.phone-wa');
        if (call) phone.appendChild(call);
        if (waLink) wa.appendChild(waLink);
        grid.append(name, phone, wa);
      } else if (!isBlank(nodes)) {
        const full = doc.createElement('div');
        full.className = 'c-full';
        nodes.forEach((n) => full.appendChild(n));
        grid.appendChild(full);
      }
    });

    p.replaceWith(grid);
  }
}

// HTML → testo semplice (per ricaricare in modifica le notizie vecchie senza tag).
export function htmlToPlain(html: string): string {
  if (!html) return '';
  if (!HAS_TAGS.test(html)) return html;
  const prepared = html
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const doc = new DOMParser().parseFromString(prepared, 'text/html');
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

export function linkifyHtml(html: string): string {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // raccoglie prima tutti i nodi di testo (non dentro un link già esistente)
  const texts: Text[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const el = (node as Text).parentElement;
    if (el && !el.closest('a')) texts.push(node as Text);
  }

  for (const t of texts) linkifyTextNode(t, doc);
  return doc.body.innerHTML;
}

function linkifyTextNode(textNode: Text, doc: Document): void {
  const text = textNode.nodeValue ?? '';
  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  let last = 0;
  const frag = doc.createDocumentFragment();
  let changed = false;

  while ((match = TOKEN.exec(text))) {
    const [full, url, email, phone] = match;
    let el: Node | null = null;

    if (url) {
      el = anchor(doc, /^https?:/i.test(url) ? url : 'https://' + url, url, 'content-link', true);
    } else if (email) {
      el = anchor(doc, 'mailto:' + email, email, 'content-link', false);
    } else if (phone) {
      el = phoneNodes(doc, phone);
    }

    if (el) {
      if (match.index > last) frag.appendChild(doc.createTextNode(text.slice(last, match.index)));
      frag.appendChild(el);
      last = match.index + full.length;
      changed = true;
    }
  }

  if (!changed) return;
  if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
  textNode.parentNode?.replaceChild(frag, textNode);
}

function anchor(doc: Document, href: string, label: string, cls: string, external: boolean): HTMLAnchorElement {
  const a = doc.createElement('a');
  a.href = href;
  a.className = cls;
  a.textContent = label;
  if (external) {
    a.target = '_blank';
    a.rel = 'noopener';
  }
  return a;
}

// Numero IT: restituisce chiamata (+ WhatsApp se cellulare), oppure il testo invariato.
function phoneNodes(doc: Document, raw: string): Node {
  let d = raw.replace(/[^\d]/g, '');
  if (d.startsWith('0039')) d = d.slice(4);
  else if (d.startsWith('39') && d.length > 10) d = d.slice(2);

  const isMobile = /^3\d{8,9}$/.test(d);
  const isLandline = /^0\d{5,10}$/.test(d);
  if (!isMobile && !isLandline) return doc.createTextNode(raw);

  const span = doc.createElement('span');
  span.className = 'phone-group';

  const call = anchor(doc, 'tel:+39' + d, '📞 ' + raw.trim(), 'phone-call', false);
  span.appendChild(call);

  if (isMobile) {
    span.appendChild(doc.createTextNode(' '));
    span.appendChild(anchor(doc, 'https://wa.me/39' + d, '💬 WhatsApp', 'phone-wa', true));
  }
  return span;
}

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

// Trasforma le righe di contatto ("Nome: numero", anche col nome in grassetto
// e più contatti sulla stessa riga) in una griglia allineata: nome | 📞 | 💬.
// Per ogni telefono risale all'etichetta "Nome:" che lo precede. I telefoni
// senza etichetta restano nel testo; l'eventuale intro resta come paragrafo.
function groupContacts(doc: Document): void {
  // "Nome:" (qualsiasi etichetta seguita da due punti)
  const NAME_COLON = /(.{1,40}?)\s*:\s*$/u;
  // "Nome" senza due punti: 1-2 parole con iniziale maiuscola subito prima del numero
  // (prende "Fabrizio", "Mario Rossi"; ignora prosa minuscola come "al numero")
  const NAME_BARE = /(\p{Lu}[\p{L}\p{M}.'’-]*(?:\s+\p{Lu}[\p{L}\p{M}.'’-]*)?)\s*$/u;

  for (const p of Array.from(doc.body.querySelectorAll('p'))) {
    const groups = Array.from(p.querySelectorAll('.phone-group'));
    if (!groups.length) continue;

    const contacts: { name: string; call: Element | null; wa: Element | null }[] = [];

    for (const g of groups) {
      // Risale a ritroso l'etichetta fino a <br>, un altro gruppo o l'inizio.
      const labelNodes: ChildNode[] = [];
      let cur = g.previousSibling;
      while (cur && cur.nodeName !== 'BR' && !(cur instanceof Element && cur.classList.contains('phone-group'))) {
        labelNodes.push(cur);
        cur = cur.previousSibling;
      }
      const labelText = labelNodes.map((n) => n.textContent ?? '').reverse().join('');
      const m = labelText.match(NAME_COLON) ?? labelText.match(NAME_BARE);
      if (!m) continue; // telefono senza etichetta riconoscibile: lo lascio nel testo

      contacts.push({
        name: m[1].trim(),
        call: g.querySelector('.phone-call'),
        wa: g.querySelector('.phone-wa'),
      });

      // Rimuove dal testo i nodi che compongono "Nome:" (dalla fine dell'etichetta).
      let need = m[0].length;
      for (const n of labelNodes) {
        if (need <= 0) break;
        const t = n.textContent ?? '';
        if (t.length <= need) {
          need -= t.length;
          n.parentNode?.removeChild(n);
        } else {
          n.textContent = t.slice(0, t.length - need);
          need = 0;
        }
      }
      g.parentNode?.removeChild(g);
    }

    if (!contacts.length) continue;

    const grid = doc.createElement('div');
    grid.className = 'contact-grid';
    for (const c of contacts) {
      const name = doc.createElement('span');
      name.className = 'c-name';
      name.textContent = c.name;
      const phone = doc.createElement('span');
      phone.className = 'c-phone';
      if (c.call) phone.appendChild(c.call);
      const wa = doc.createElement('span');
      wa.className = 'c-wa';
      if (c.wa) wa.appendChild(c.wa);
      grid.append(name, phone, wa);
    }

    // L'eventuale intro resta come paragrafo sopra la griglia; pulisco code vuote.
    p.after(grid);
    while (
      p.lastChild &&
      (p.lastChild.nodeName === 'BR' || (p.lastChild.nodeType === 3 && !(p.lastChild.nodeValue ?? '').trim()))
    ) {
      p.removeChild(p.lastChild);
    }
    if (!(p.textContent ?? '').trim()) p.remove();
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

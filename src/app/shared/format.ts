// Rende "attivo" il contenuto HTML: numeri di telefono → chiama + WhatsApp,
// link ed email cliccabili. Lavora sul DOM (solo nodi di testo) così non tocca
// mai attributi o immagini base64 (che contengono lunghe sequenze di cifre).

const TOKEN = /((?:https?:\/\/|www\.)[^\s<]+)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|(\+?\d[\d\s./-]{6,}\d)/g;

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

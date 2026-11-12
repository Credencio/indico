/* Gestão do site Indico Insights — interface gráfica que edita conteudo.js
   e publica as alterações directamente no repositório GitHub. */
(function () {
  "use strict";
  let S = JSON.parse(JSON.stringify(window.SITE || {}));
  const uploads = {};      // caminho -> base64 (ficheiros novos por publicar)
  const previews = {};     // caminho -> dataURL (para mostrar antes de publicar)
  const deletions = new Set();
  let dirty = false, remoteSha = null, section = "inicio";

  /* ===================== utilidades ===================== */
  const $ = s => document.querySelector(s);
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "value") e.value = v;
      else if (k === "checked") e.checked = !!v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach(c => c != null && c !== false && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  }
  const bi = v => v && typeof v === "object" && !Array.isArray(v) ? v : { pt: v == null ? "" : String(v), en: v == null ? "" : String(v) };
  const tx = v => (v == null ? "" : typeof v === "object" ? (v.pt || v.en || "") : String(v)).replace(/\*/g, "");
  const slug = s => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "item";
  const clone = o => JSON.parse(JSON.stringify(o));
  function markDirty() { dirty = true; $("#dirty").textContent = "● Alterações por publicar"; try { localStorage.setItem("ii-admin-draft", JSON.stringify(S)); } catch (e) {} }
  function toast(msg, err) { const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : ""); clearTimeout(t._t); t._t = setTimeout(() => t.className = "toast", 3200); }
  function imgSrc(p) { return p ? (previews[p] || p) : ""; }
  window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* diálogo de confirmação */
  function ask(title, msg, okLabel = "Confirmar", danger) {
    return new Promise(res => {
      const d = $("#dialog"), box = d.querySelector(".dbox");
      box.className = "dbox small"; box.innerHTML = "";
      const close = v => { d.classList.remove("open"); box.className = "dbox"; res(v); };
      box.append(el("div", { class: "dc" }, el("h2", {}, title), el("p", {}, msg),
        el("div", { class: "acts" }, el("button", { class: "b ghost", onclick: () => close(false) }, "Cancelar"),
          el("button", { class: "b " + (danger ? "sun" : "primary"), onclick: () => close(true) }, okLabel))));
      d.classList.add("open");
    });
  }
  /* gaveta de edição */
  function drawer(title, body, onClose) {
    const d = $("#dialog"), box = d.querySelector(".dbox");
    box.className = "dbox"; box.innerHTML = "";
    const close = () => { d.classList.remove("open"); onClose && onClose(); };
    box.append(el("div", { class: "dh" }, el("h2", {}, title), el("button", { class: "b primary", onclick: close }, "Concluído ✓")), el("div", { class: "dc" }, body));
    d.classList.add("open");
    d.onclick = e => { if (e.target === d) close(); };
    return close;
  }

  /* ===================== imagens e PDF ===================== */
  let pdfReady;
  function loadPdfJs() {
    if (pdfReady) return pdfReady;
    pdfReady = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; res(window.pdfjsLib); };
      s.onerror = () => rej(new Error("Não foi possível carregar o leitor de PDF"));
      document.head.append(s);
    });
    return pdfReady;
  }
  async function fileToCanvas(file) {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      const pdfjs = await loadPdfJs();
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const page = await doc.getPage(1);
      const vp = page.getViewport({ scale: 1.6 });
      const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      return { canvas: c, pages: doc.numPages };
    }
    const url = URL.createObjectURL(file);
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
    c.getContext("2d").drawImage(im, 0, 0); URL.revokeObjectURL(url);
    return { canvas: c };
  }
  function shrink(canvas, maxW) {
    if (canvas.width <= maxW) return canvas;
    const c = document.createElement("canvas"); c.width = maxW; c.height = Math.round(canvas.height * maxW / canvas.width);
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(canvas, 0, 0, c.width, c.height); return c;
  }
  async function processImage(file, folder, maxW, name) {
    const { canvas, pages } = await fileToCanvas(file);
    const c = shrink(canvas, maxW);
    const dataUrl = c.toDataURL("image/jpeg", .84);
    const path = `${folder}/${slug(name || file.name.replace(/\.[^.]+$/, ""))}-${Date.now().toString(36)}.jpg`;
    uploads[path] = dataUrl.split(",")[1]; previews[path] = dataUrl;
    return { path, pages };
  }
  function forgetFile(p) { if (!p) return; if (uploads[p]) { delete uploads[p]; delete previews[p]; } else if (!/^https?:/.test(p) && !p.startsWith("assets/")) deletions.add(p); }

  /* ===================== campos ===================== */
  const ICONS = { wave: "Ondas / mar", tree: "Árvore", sprout: "Planta", chart: "Gráfico", layers: "Camadas / mapas", drone: "Drone", map: "Mapa", phone: "Telemóvel", clip: "Inquérito", cap: "Formação", globe: "Globo", bars: "Barras", screen: "Ecrã", people: "Pessoas", eye: "Olho", check: "Visto", target: "Alvo", leaf: "Folha", mail: "Email", pin: "Localização" };
  const pageOptions = () => [["", "— escolher —"], ...S.pages.map(p => ["#" + p.id, "Página: " + tx(p.menu)])];

  /* Esquemas: cada campo {k, l(abel), t(ipo), ...} */
  function field(f, obj, onChange) {
    const change = () => { markDirty(); onChange && onChange(); };
    const wrap = el("div", { class: "f" }, f.l ? el("label", {}, f.l) : null, f.help ? el("div", { class: "help" }, f.help) : null);
    const v = obj[f.k];
    switch (f.t) {
      case "bi": case "biarea": {
        const val = bi(v); obj[f.k] = val;
        const mk = lg => f.t === "biarea"
          ? el("textarea", { value: val[lg] || "", rows: f.rows || 3, oninput: e => { val[lg] = e.target.value; change(); } })
          : el("input", { type: "text", value: val[lg] || "", oninput: e => { val[lg] = e.target.value; change(); } });
        wrap.append(el("div", { class: "bi" }, el("div", { "data-l": "PT" }, mk("pt")), el("div", { "data-l": "EN" }, mk("en"))));
        break;
      }
      case "text": case "url": case "email":
        wrap.append(el("input", { type: f.t === "text" ? "text" : f.t, value: v ?? "", placeholder: f.ph || "", oninput: e => { obj[f.k] = e.target.value; change(); } })); break;
      case "area":
        wrap.append(el("textarea", { value: v ?? "", oninput: e => { obj[f.k] = e.target.value; change(); } })); break;
      case "number":
        wrap.append(el("input", { type: "number", value: v ?? "", step: f.step || "any", oninput: e => { obj[f.k] = e.target.value === "" ? "" : +e.target.value; change(); } })); break;
      case "bool": {
        wrap.innerHTML = "";
        const on = f.inverse ? v !== false : !!v;
        wrap.append(el("label", { class: "check" }, el("input", { type: "checkbox", checked: on, onchange: e => {
          if (f.inverse) { if (e.target.checked) delete obj[f.k]; else obj[f.k] = false; } else obj[f.k] = e.target.checked; change(); } }), f.l));
        if (f.help) wrap.append(el("div", { class: "help" }, f.help)); break;
      }
      case "select": {
        const opts = typeof f.o === "function" ? f.o() : f.o;
        const s = el("select", { onchange: e => { obj[f.k] = e.target.value; change(); } }, opts.map(([val, lab]) => el("option", { value: val }, lab)));
        s.value = v ?? opts[0][0]; if (v == null) obj[f.k] = s.value;
        wrap.append(s); break;
      }
      case "icon": {
        const s = el("select", { onchange: e => { obj[f.k] = e.target.value; change(); } }, Object.entries(ICONS).map(([k, lab]) => el("option", { value: k }, lab)));
        s.value = v || "globe"; obj[f.k] = s.value; wrap.append(s); break;
      }
      case "link": {
        const id = "dl" + Math.random().toString(36).slice(2);
        wrap.append(el("input", { type: "text", list: id, value: v ?? "", placeholder: "#pagina ou https://…", oninput: e => { obj[f.k] = e.target.value; change(); } }),
          el("datalist", { id }, pageOptions().slice(1).map(([val, lab]) => el("option", { value: val }, lab))));
        break;
      }
      case "multi": {
        const opts = typeof f.o === "function" ? f.o() : f.o;
        const cur = new Set(v || []);
        wrap.append(el("div", { class: "chips" }, opts.map(([val, lab]) => el("label", {}, el("input", { type: "checkbox", checked: cur.has(val), onchange: e => { e.target.checked ? cur.add(val) : cur.delete(val); obj[f.k] = opts.map(o => o[0]).filter(x => cur.has(x)); change(); } }), lab))));
        break;
      }
      case "image": {
        const pv = el("div", { class: "pv" + (f.cover ? " cover" : "") });
        const paint = () => { const p = obj[f.k]; pv.style.backgroundImage = p ? `url("${imgSrc(p)}")` : ""; pv.textContent = p ? "" : (f.empty || "Sem imagem"); };
        const inp = el("input", { type: "file", accept: f.pdf ? "image/*,application/pdf" : "image/*", style: "display:none", onchange: async e => {
          const file = e.target.files[0]; if (!file) return;
          try { toast(f.pdf && /pdf/i.test(file.type) ? "A gerar a capa a partir do PDF…" : "A preparar a imagem…");
            const r = await processImage(file, f.folder || "imagens", f.maxW || 1600, f.nameFrom ? tx(obj[f.nameFrom]) || file.name : file.name);
            forgetFile(obj[f.k]); obj[f.k] = r.path; if (r.pages && f.pagesKey && !obj[f.pagesKey]) obj[f.pagesKey] = r.pages;
            paint(); change(); toast("Imagem pronta. Será enviada ao publicar."); f.after && f.after();
          } catch (err) { toast("Erro: " + err.message, true); }
          e.target.value = ""; } });
        paint();
        wrap.append(el("div", { class: "imgf" }, pv, el("div", { class: "btns" },
          el("button", { class: "b ghost small", type: "button", onclick: () => inp.click() }, f.pdf ? "Carregar PDF ou imagem" : "Carregar imagem"),
          el("button", { class: "b danger small", type: "button", onclick: () => { forgetFile(obj[f.k]); obj[f.k] = ""; paint(); change(); } }, "Remover"),
          el("small", {}, f.pdf ? "Do PDF só é usada a 1ª página (a capa). O PDF não é publicado." : (f.note || "JPG ou PNG. A imagem é optimizada automaticamente.")), inp)));
        break;
      }
      case "file": {
        const info = el("small", {}, v ? "Ficheiro: " + v : "Nenhum ficheiro (não descarregável)");
        const inp = el("input", { type: "file", style: "display:none", onchange: async e => {
          const file = e.target.files[0]; if (!file) return;
          if (file.size > 20e6) { toast("Ficheiro demasiado grande (máx. 20 MB)", true); return; }
          const buf = new Uint8Array(await file.arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
          const path = `documentos/${slug(file.name.replace(/\.[^.]+$/, ""))}.${file.name.split(".").pop().toLowerCase()}`;
          forgetFile(obj[f.k]); uploads[path] = btoa(s); obj[f.k] = path; info.textContent = "Ficheiro: " + path + " (por publicar)"; change(); e.target.value = ""; } });
        wrap.append(el("div", { class: "imgf" }, el("div", { class: "btns" },
          el("div", { style: "display:flex;gap:.4rem" }, el("button", { class: "b ghost small", type: "button", onclick: () => inp.click() }, "Carregar ficheiro"),
            el("button", { class: "b danger small", type: "button", onclick: () => { forgetFile(obj[f.k]); obj[f.k] = ""; info.textContent = "Nenhum ficheiro (não descarregável)"; change(); } }, "Remover")), info, inp)));
        break;
      }
      case "group": {
        obj[f.k] = obj[f.k] && typeof obj[f.k] === "object" ? obj[f.k] : {};
        wrap.className = "grp"; wrap.innerHTML = ""; wrap.append(el("div", { class: "gl" }, f.l), fields(f.of, obj[f.k], onChange)); break;
      }
      case "list": case "bilist": {
        obj[f.k] = Array.isArray(obj[f.k]) ? obj[f.k] : [];
        wrap.append(listEditor(obj[f.k], f.t === "bilist" ? { simple: f.area ? "biarea" : "bi" } : f, onChange)); break;
      }
      case "cols": {
        wrap.className = f.n === 3 ? "cols3" : "cols2"; wrap.innerHTML = "";
        f.of.forEach(ff => wrap.append(field(ff, obj, onChange))); break;
      }
    }
    return wrap;
  }
  function fields(schema, obj, onChange) { return el("div", { class: "fields" }, schema.map(f => field(f, obj, onChange))); }
  function defaults(schema) {
    const o = {};
    (schema || []).forEach(f => {
      if (f.t === "cols") Object.assign(o, defaults(f.of));
      else if (f.t === "bi" || f.t === "biarea") o[f.k] = { pt: "", en: "" };
      else if (f.t === "list" || f.t === "bilist" || f.t === "multi") o[f.k] = [];
      else if (f.t === "group") o[f.k] = defaults(f.of);
      else if (f.t === "bool") { if (f.def !== undefined) o[f.k] = f.def; }
      else if (f.t === "number") o[f.k] = f.def ?? "";
      else if (f.t === "select") o[f.k] = f.def ?? ((typeof f.o === "function" ? f.o() : f.o)[0] || [""])[0];
      else if (f.t === "icon") o[f.k] = "globe";
      else o[f.k] = f.def ?? "";
    });
    return o;
  }

  /* editor genérico de listas (usado dentro dos formulários) */
  function listEditor(arr, f, onChange) {
    const box = el("div", {});
    const draw = () => {
      box.innerHTML = "";
      const rows = el("div", { class: "rows nested" });
      arr.forEach((item, i) => {
        if (f.simple) {
          const holder = { v: item };
          const fe = field({ k: "v", t: f.simple }, holder, () => { arr[i] = holder.v; onChange && onChange(); });
          rows.append(el("div", { style: "display:flex;gap:.5rem;align-items:flex-start" }, el("div", { style: "flex:1" }, fe), tools(arr, i, draw, onChange, true)));
          return;
        }
        const label = () => tx(item[f.labelKey || "title"]) || tx(item.label) || tx(item.text) || `${f.itemName || "Item"} ${i + 1}`;
        const r = el("div", { class: "row" + (item.visible === false ? " hidden-item" : "") });
        const lt = el("b", {}, label());
        r.append(el("div", { class: "rh", onclick: e => { if (!e.target.closest(".tools")) r.classList.toggle("open"); } },
          f.thumb && item[f.thumb] ? el("img", { class: "thumb wide", src: imgSrc(item[f.thumb]) }) : null,
          el("div", { class: "tt" }, lt), tools(arr, i, draw, onChange)),
          el("div", { class: "rb" }, fields(f.of, item, () => { lt.textContent = label(); onChange && onChange(); })));
        rows.append(r);
      });
      box.append(arr.length ? rows : el("div", { class: "empty" }, "Lista vazia"),
        el("button", { class: "b ghost small add", type: "button", onclick: () => { arr.push(f.simple ? { pt: "", en: "" } : defaults(f.of)); markDirty(); draw(); const last = box.querySelectorAll(".row"); if (last.length) last[last.length - 1].classList.add("open"); } }, "+ Adicionar " + (f.itemName || "item").toLowerCase()));
    };
    draw();
    return box;
  }
  function tools(arr, i, redraw, onChange, simple) {
    const it = arr[i], obj = typeof it === "object" && it && !("pt" in it && Object.keys(it).length <= 2);
    const mv = d => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; markDirty(); redraw(); onChange && onChange(); };
    return el("div", { class: "tools" },
      el("button", { class: "ib", type: "button", title: "Subir", onclick: () => mv(-1) }, "↑"),
      el("button", { class: "ib", type: "button", title: "Descer", onclick: () => mv(1) }, "↓"),
      !simple && obj ? el("button", { class: "ib" + (it.visible === false ? " off" : ""), type: "button", title: it.visible === false ? "Escondido — clique para mostrar" : "Visível — clique para esconder", onclick: () => { if (it.visible === false) delete it.visible; else it.visible = false; markDirty(); redraw(); } }, it.visible === false ? "◌" : "👁") : null,
      el("button", { class: "ib del", type: "button", title: "Apagar", onclick: async () => { if (await ask("Apagar este item?", "Esta acção remove o item do site quando publicar.", "Apagar", true)) { arr.splice(i, 1); markDirty(); redraw(); onChange && onChange(); } } }, "🗑"));
  }

  /* ===================== esquemas ===================== */
  const btnGroup = (k = "button", l = "Botão") => ({ k, l, t: "group", of: [{ t: "cols", of: [{ k: "label", l: "Texto do botão", t: "bi" }, { k: "link", l: "Leva para", t: "link" }] }] });
  const headF = [{ k: "eyebrow", l: "Etiqueta (pequeno texto acima do título)", t: "bi" }, { k: "title", l: "Título", t: "bi", help: "Palavras entre *asteriscos* ficam destacadas a laranja." }, { k: "text", l: "Texto de introdução", t: "biarea" }];
  const linkF = { k: "link", l: "Link no canto (ex.: “Ver todos →”)", t: "group", of: [{ t: "cols", of: [{ k: "label", l: "Texto", t: "bi" }, { k: "href", l: "Leva para", t: "link" }] }] };
  const docOpts = () => S.documents.map(d => { if (!d.id) d.id = "d-" + Math.random().toString(36).slice(2, 8); return [d.id, tx(d.title).slice(0, 48)]; });
  const projOpts = () => S.projects.map(p => [p.id, tx(p.title).slice(0, 48)]);

  const BLOCKS = {
    hero: { n: "Abertura com slides", d: "Imagem grande no topo, com vários slides", f: [
      { k: "slides", l: "Slides", t: "list", itemName: "Slide", thumb: "image", of: [
        { k: "label", l: "Etiqueta", t: "bi" }, { k: "title", l: "Título", t: "biarea", rows: 2, help: "Palavras entre *asteriscos* ficam a laranja." }, { k: "text", l: "Texto", t: "biarea" },
        { k: "image", l: "Fotografia de fundo (opcional)", t: "image", folder: "imagens", maxW: 2000, note: "Sem fotografia, aparece o fundo verde animado com o globo." }, { t: "cols", of: [{ k: "credit", l: "Crédito da fotografia (autor · licença)", t: "text", ph: "Foto: Nome · CC BY 4.0" }, { k: "creditLink", l: "Link da fonte (opcional)", t: "url" }] }, btnGroup()] }] },
    bento: { n: "Mosaico de apresentação", d: "Cartão verde com logótipo + 3 cartões", f: [
      { k: "brand", l: "Cartão principal (com logótipo)", t: "group", of: [{ k: "text", l: "Texto", t: "biarea" }, btnGroup()] },
      { k: "tiles", l: "Cartões", t: "list", itemName: "Cartão", of: [{ k: "icon", l: "Ícone", t: "icon" }, { k: "title", l: "Título", t: "bi" }, { k: "text", l: "Texto", t: "biarea" }, { k: "list", l: "Lista com vistos (opcional)", t: "bilist" }] }] },
    stats: { n: "Números", d: "Números grandes animados", f: [
      { k: "items", l: "Números", t: "list", itemName: "Número", labelKey: "label", of: [{ t: "cols", n: 3, of: [{ k: "value", l: "Valor", t: "number" }, { k: "decimals", l: "Casas decimais", t: "number" }, { k: "prefix", l: "Antes (ex.: US$)", t: "bi" }] }, { k: "suffix", l: "Depois (ex.: M, países)", t: "bi" }, { k: "label", l: "Descrição", t: "biarea" }] }] },
    text: { n: "Texto + cartões", d: "Parágrafos e até 4 cartões com ícone", f: [...headF,
      { k: "paragraphs", l: "Parágrafos", t: "bilist", area: true },
      { k: "pillars", l: "Cartões (opcional)", t: "list", itemName: "Cartão", of: [{ k: "icon", l: "Ícone", t: "icon" }, { k: "title", l: "Título", t: "bi" }, { k: "text", l: "Texto", t: "biarea" }] }] },
    services: { n: "Serviços", d: "Mostra a lista de serviços", f: [...headF,
      { t: "cols", of: [{ k: "style", l: "Estilo", t: "select", o: [["grid", "Grelha de cartões"], ["bento", "Mosaico com imagem + painel escuro"]] }, { k: "limit", l: "Mostrar no máximo (vazio = todos)", t: "number" }] },
      { k: "image", l: "Imagem do mosaico (estilo mosaico)", t: "image", folder: "imagens", maxW: 1400 }, { t: "cols", of: [{ k: "credit", l: "Crédito da fotografia (autor · licença)", t: "text", ph: "Foto: Nome · CC BY 4.0" }, { k: "creditLink", l: "Link da fonte (opcional)", t: "url" }] }, linkF,
      { k: "cta", l: "Cartão laranja final (estilo grelha)", t: "group", of: [{ k: "title", l: "Título", t: "bi" }, { t: "cols", of: [{ k: "label", l: "Texto do link", t: "bi" }, { k: "link", l: "Leva para", t: "link" }] }] }] },
    checklist: { n: "Faixa de compromisso", d: "Faixa laranja com lista de vistos", f: [
      { k: "title", l: "Título", t: "bi" }, { k: "text", l: "Subtítulo", t: "bi" }, { k: "items", l: "Pontos", t: "bilist" }, btnGroup()] },
    projects: { n: "Projectos", d: "Cartões de projectos com fichas", f: [...headF,
      { t: "cols", of: [{ k: "filters", l: "Mostrar filtros", t: "bool", def: true }, { k: "limit", l: "Mostrar no máximo (vazio = todos)", t: "number" }] },
      { k: "only", l: "Mostrar apenas estes (nenhum seleccionado = todos)", t: "multi", o: projOpts }, linkF] },
    documents: { n: "Documentos (capas)", d: "Galeria de capas de relatórios", f: [...headF,
      { k: "style", l: "Estilo", t: "select", o: [["grid", "Galeria de capas"], ["feature", "Destaque (capa grande + botões)"]] },
      { t: "cols", of: [{ k: "filters", l: "Mostrar filtros por categoria", t: "bool", def: true }, { k: "limit", l: "Mostrar no máximo (vazio = todos)", t: "number" }] },
      { k: "only", l: "Mostrar apenas estes (nenhum = todos)", t: "multi", o: docOpts }, { k: "exclude", l: "Esconder estes neste bloco", t: "multi", o: docOpts }, linkF] },
    clients: { n: "Clientes", d: "Faixa animada com os clientes", f: [{ k: "title", l: "Título (vazio = o definido em Geral)", t: "bi" }] },
    impact: { n: "Impacto", d: "Cartão escuro com número grande", f: [
      { k: "text", l: "Texto", t: "biarea" }, { k: "number", l: "Número em destaque", t: "text" }, { k: "after", l: "Texto depois do número", t: "biarea" },
      { k: "items", l: "Cartões", t: "list", itemName: "Cartão", of: [{ k: "title", l: "Título", t: "bi" }, { k: "text", l: "Texto", t: "biarea" }] }] },
    duo: { n: "Dois cartões", d: "Ex.: visão e abordagem", f: [{ k: "eyebrow", l: "Etiqueta", t: "bi" }, { k: "title", l: "Título", t: "bi" },
      { k: "left", l: "Cartão verde", t: "group", of: [{ k: "eyebrow", l: "Etiqueta", t: "bi" }, { k: "title", l: "Título", t: "bi" }, { k: "text", l: "Texto", t: "biarea" }] },
      { k: "right", l: "Cartão escuro", t: "group", of: [{ k: "eyebrow", l: "Etiqueta", t: "bi" }, { k: "title", l: "Título", t: "bi" }, { k: "text", l: "Texto", t: "biarea" }, { k: "flow", l: "Sequência de etapas (opcional)", t: "bilist" }] }] },
    tags: { n: "Etiquetas", d: "Lista de competências em pílulas", f: [...headF, { k: "items", l: "Etiquetas", t: "bilist" }] },
    cta: { n: "Chamada à acção", d: "Faixa verde com título e botão", f: [{ k: "title", l: "Título", t: "bi" }, btnGroup(), { k: "image", l: "Fotografia de fundo (opcional)", t: "image", folder: "imagens", maxW: 1800 }, { t: "cols", of: [{ k: "credit", l: "Crédito da fotografia (autor · licença)", t: "text", ph: "Foto: Nome · CC BY 4.0" }, { k: "creditLink", l: "Link da fonte (opcional)", t: "url" }] }] },
    contact: { n: "Formulário de contacto", d: "Formulário + email e morada", f: [{ k: "eyebrow", l: "Etiqueta", t: "bi" }, { k: "title", l: "Título", t: "bi" }, { k: "text", l: "Texto", t: "biarea" }] }
  };
  const commonBlock = [{ k: "bg", l: "Fundo da secção", t: "select", o: [["", "Normal (cinzento claro)"], ["white", "Branco"]] }];

  const SERVICE = [{ k: "icon", l: "Ícone", t: "icon" }, { k: "title", l: "Nome do serviço", t: "bi" }, { k: "text", l: "Descrição", t: "biarea" }];
  const PROJECT = [
    { k: "title", l: "Título", t: "biarea", rows: 2 }, { k: "client", l: "Cliente", t: "bi" },
    { t: "cols", n: 3, of: [{ k: "country", l: "País", t: "select", o: () => Object.keys(S.countries).map(c => [c, tx(S.countries[c])]) }, { k: "place", l: "Local (opcional, ex.: Inhambane)", t: "text" }, { k: "team", l: "Equipa (pessoas)", t: "number" }] },
    { k: "duration", l: "Duração (ex.: 2024 – 2026)", t: "bi" },
    { k: "tags", l: "Áreas (para os filtros)", t: "multi", o: () => S.projectFilters.filter(f => f.value !== "all" && !S.countries[f.value]).map(f => [f.value, tx(f.label)]) },
    { t: "cols", of: [{ k: "live", l: "Sistema em operação", t: "bool" }, { k: "link", l: "Link para o sistema (opcional)", t: "url" }] },
    { k: "image", l: "Imagem do cartão (opcional — sem imagem aparece um mapa gerado)", t: "image", folder: "imagens", maxW: 1200 }, { t: "cols", of: [{ k: "credit", l: "Crédito da fotografia (autor · licença)", t: "text", ph: "Foto: Nome · CC BY 4.0" }, { k: "creditLink", l: "Link da fonte (opcional)", t: "url" }] },
    { k: "text", l: "Descrição", t: "biarea", rows: 6 }];
  const DOCUMENT = [
    { k: "cover", l: "Capa", t: "image", pdf: true, cover: true, folder: "documentos/capas", maxW: 700, nameFrom: "title", pagesKey: "pages", empty: "Sem capa" },
    { k: "title", l: "Título", t: "biarea", rows: 2 }, { k: "client", l: "Cliente", t: "bi" },
    { t: "cols", n: 3, of: [{ k: "year", l: "Ano", t: "text" }, { k: "language", l: "Língua do documento", t: "select", o: [["PT", "Português"], ["EN", "Inglês"], ["PT/EN", "Bilingue"]] }, { k: "pages", l: "Nº de páginas", t: "number" }] },
    { k: "category", l: "Categoria", t: "select", o: () => (S.documentCategories || []).map((c, i) => [String(i), tx(c)]) },
    { k: "project", l: "Projecto relacionado (a capa aparece na ficha do projecto)", t: "select", o: () => [["", "— nenhum —"], ...projOpts()] },
    { k: "text", l: "Descrição curta", t: "biarea" },
    { k: "download", l: "Permitir descarregar (opcional)", t: "file", help: "Deixe vazio para mostrar só a capa, com o aviso “disponível mediante pedido”." }];

  /* ===================== secções ===================== */
  const SECTIONS = [
    ["inicio", "🏠", "Resumo"], ["paginas", "🗂", "Abas / Páginas"], ["servicos", "🧭", "Serviços"], ["projectos", "📍", "Projectos"],
    ["documentos", "📄", "Documentos"], ["geral", "⚙️", "Geral e clientes"], "-", ["publicar", "🚀", "Publicar"], ["ligacao", "🔑", "Ligação GitHub"]];
  function renderNav() {
    const counts = { paginas: S.pages.length, servicos: S.services.length, projectos: S.projects.length, documentos: S.documents.length };
    $("#sidenav").innerHTML = "";
    SECTIONS.forEach(s => {
      if (s === "-") return $("#sidenav").append(el("hr"));
      $("#sidenav").append(el("button", { class: section === s[0] ? "on" : "", onclick: () => go(s[0]) }, s[1], " ", s[2], counts[s[0]] ? el("span", { class: "n" }, counts[s[0]]) : null));
    });
    const c = cfg();
    $("#conn").className = "conn " + (c.token ? "on" : "off");
    $("#conn").textContent = c.token ? `Ligado a ${c.repo} (${c.branch})` : "Não ligado ao GitHub — as alterações não podem ser publicadas.";
  }
  function go(s) { section = s; renderNav(); render(); scrollTo(0, 0); }
  function head(t, s) { $("#title").textContent = t; $("#subtitle").textContent = s || ""; }

  function render() {
    const v = $("#view"); v.innerHTML = "";
    ({ inicio: vHome, paginas: vPages, servicos: vServices, projectos: vProjects, documentos: vDocs, geral: vGeneral, publicar: vPublish, ligacao: vConnect }[section])(v);
  }

  function vHome(v) {
    head("Bem-vindo à gestão do site", "Escolha o que quer alterar. Nada fica público até carregar em “Publicar alterações”.");
    v.append(el("div", { class: "kpis" }, [["paginas", S.pages.filter(p => p.visible !== false).length, "abas visíveis"], ["servicos", S.services.length, "serviços"], ["projectos", S.projects.length, "projectos"], ["documentos", S.documents.length, "documentos"]]
      .map(([s, n, l]) => el("div", { class: "kpi", onclick: () => go(s) }, el("b", {}, n), el("span", {}, l)))));
    v.append(el("div", { class: "panel" }, el("h2", {}, "Como funciona"), el("ol", { class: "steps" },
      el("li", {}, "Faça as alterações nas secções do menu à esquerda: textos (em português e inglês), abas, projectos, documentos, imagens."),
      el("li", {}, "Use “Pré-visualizar” para ver o site com as alterações antes de as tornar públicas."),
      el("li", {}, "Carregue em “Publicar alterações”. O site é actualizado em 1 a 2 minutos."),
      el("li", {}, cfg().token ? "Está ligado ao GitHub. Pode publicar." : "Primeiro, ligue esta página ao GitHub (uma única vez) em “Ligação GitHub”."))));
  }

  /* ---- Páginas ---- */
  function vPages(v) {
    head("Abas / Páginas", "Adicione, esconda, reordene ou apague abas do menu. Clique numa aba para editar o seu conteúdo.");
    const rows = el("div", { class: "rows" });
    const draw = () => {
      rows.innerHTML = "";
      S.pages.forEach((p, i) => {
        rows.append(el("div", { class: "row" + (p.visible === false ? " hidden-item" : "") },
          el("div", { class: "rh", onclick: e => { if (!e.target.closest(".tools")) editPage(p, draw); } },
            el("div", { class: "tt" }, el("b", {}, tx(p.menu) || p.id), el("small", {}, `site/#${p.id} · ${(p.blocks || []).length} blocos`)),
            p.visible === false ? el("span", { class: "badge gray" }, "Escondida") : p.inMenu === false ? el("span", { class: "badge gray" }, "Fora do menu") : el("span", { class: "badge" }, i === S.pages.findIndex(x => x.visible !== false) ? "Página inicial" : "Visível"),
            tools(S.pages, i, () => { draw(); renderNav(); }))));
      });
    };
    draw();
    v.append(el("div", { class: "toolbar" }, el("span", { class: "hint", style: "color:var(--muted)" }, "A primeira aba visível é a página inicial."),
      el("button", { class: "b primary", onclick: () => newPage(draw) }, "+ Nova aba")), rows);
  }
  async function newPage(draw) {
    const p = { id: "nova-pagina-" + Date.now().toString(36).slice(-4), menu: { pt: "Nova página", en: "New page" }, header: { eyebrow: { pt: "", en: "" }, title: { pt: "Nova página", en: "New page" }, text: { pt: "", en: "" } }, blocks: [] };
    const ci = S.pages.findIndex(x => (x.blocks || []).some(b => b.type === "contact"));
    S.pages.splice(ci >= 0 ? ci : S.pages.length, 0, p); markDirty(); draw(); renderNav(); editPage(p, draw, true);
  }
  function editPage(p, redraw, isNew) {
    const body = el("div", {});
    const idInput = el("input", { type: "text", value: p.id, oninput: e => { p.id = slug(e.target.value); markDirty(); } });
    const pageFields = [
      { t: "cols", of: [{ k: "menu", l: "Nome no menu", t: "bi" }] },
      { t: "cols", of: [{ k: "visible", l: "Mostrar esta aba no site", t: "bool", inverse: true }, { k: "inMenu", l: "Mostrar no menu", t: "bool", inverse: true, help: "Desligado: a página existe mas só se chega a ela por link." }] }];
    body.append(el("div", { class: "panel" }, el("h2", {}, "Aba"), fields(pageFields, p, () => { if (isNew && p._autoId !== false) { p.id = slug(tx(p.menu)); idInput.value = p.id; } }),
      el("div", { class: "f", style: "margin-top:1rem" }, el("label", {}, "Endereço da página"), el("div", { class: "help" }, "Aparece no link: site/#endereço. Use só letras, números e hífens."), idInput)));
    const hold = p.header || { eyebrow: { pt: "", en: "" }, title: clone(bi(p.menu)), text: { pt: "", en: "" } };
    const hf = el("div", { style: p.header ? "" : "display:none" }, fields([...headF, { k: "image", l: "Fotografia de fundo do cabeçalho (opcional)", t: "image", folder: "imagens", maxW: 2000 }, { t: "cols", of: [{ k: "credit", l: "Crédito da fotografia (autor · licença)", t: "text", ph: "Foto: Nome · CC BY 4.0" }, { k: "creditLink", l: "Link da fonte (opcional)", t: "url" }] }], hold));
    const hdr = el("div", { class: "panel" }, el("h2", {}, "Cabeçalho da página"), el("p", { class: "hint" }, "Faixa verde no topo da página (a página inicial normalmente usa antes a abertura com slides)."),
      el("label", { class: "check", style: "margin-bottom:1rem" }, el("input", { type: "checkbox", checked: !!p.header, onchange: e => { if (e.target.checked) p.header = hold; else delete p.header; hf.style.display = e.target.checked ? "" : "none"; markDirty(); } }), "Mostrar cabeçalho"));
    hdr.append(hf); body.append(hdr);

    p.blocks = p.blocks || [];
    const bl = el("div", { class: "rows" });
    const drawBlocks = () => {
      bl.innerHTML = "";
      p.blocks.forEach((b, i) => {
        const def = BLOCKS[b.type] || { n: b.type, f: [] };
        const r = el("div", { class: "row" + (b.visible === false ? " hidden-item" : "") });
        r.append(el("div", { class: "rh", onclick: e => { if (!e.target.closest(".tools")) r.classList.toggle("open"); } },
          el("span", { class: "badge" }, def.n), el("div", { class: "tt" }, el("b", {}, tx(b.title) || tx(b.slides && b.slides[0] && b.slides[0].title) || def.d || "")), tools(p.blocks, i, drawBlocks)),
          el("div", { class: "rb" }, fields([...def.f, ...commonBlock], b)));
        bl.append(r);
      });
      if (!p.blocks.length) bl.append(el("div", { class: "empty" }, "Esta página ainda não tem blocos. Adicione o primeiro abaixo."));
    };
    drawBlocks();
    const picker = el("div", { class: "blocktype", style: "display:none;margin-top:.8rem" }, Object.entries(BLOCKS).map(([k, d]) => el("button", { type: "button", onclick: () => {
      const nb = Object.assign({ type: k }, defaults(BLOCKS[k].f)); if (k === "hero") nb.slides = [defaults(BLOCKS.hero.f[0].of)];
      p.blocks.push(nb); markDirty(); picker.style.display = "none"; drawBlocks(); const rs = bl.querySelectorAll(".row"); rs[rs.length - 1].classList.add("open"); } }, el("b", {}, d.n), el("small", {}, d.d))));
    body.append(el("div", { class: "panel" }, el("h2", {}, "Conteúdo da página"), el("p", { class: "hint" }, "A página é feita de blocos, mostrados pela ordem desta lista. Clique num bloco para o editar."),
      bl, el("button", { class: "b ghost add", onclick: () => picker.style.display = picker.style.display === "none" ? "" : "none" }, "+ Adicionar bloco"), picker));
    body.append(el("button", { class: "b danger", onclick: async () => { if (await ask("Apagar a aba “" + tx(p.menu) + "”?", "A aba e todo o seu conteúdo serão removidos do site quando publicar. Se só quiser escondê-la temporariamente, desligue “Mostrar esta aba no site”.", "Apagar aba", true)) { S.pages.splice(S.pages.indexOf(p), 1); markDirty(); $("#dialog").classList.remove("open"); redraw(); renderNav(); } } }, "Apagar esta aba"));
    drawer("Editar aba: " + tx(p.menu), body, () => { const ids = S.pages.map(x => x.id); if (ids.filter(x => x === p.id).length > 1) p.id += "-2"; redraw(); renderNav(); });
  }

  /* ---- colecções com lista ---- */
  function collection(v, arr, opts) {
    const rows = el("div", { class: "rows" });
    const q = el("input", { type: "search", placeholder: "Procurar…", oninput: () => draw() });
    const draw = () => {
      rows.innerHTML = "";
      arr.forEach((it, i) => {
        if (q.value && !JSON.stringify(it).toLowerCase().includes(q.value.toLowerCase())) return;
        rows.append(el("div", { class: "row" + (it.visible === false ? " hidden-item" : "") },
          el("div", { class: "rh", onclick: e => { if (!e.target.closest(".tools")) edit(it); } },
            opts.thumb ? (it[opts.thumb] ? el("img", { class: "thumb" + (opts.wide ? " wide" : ""), src: imgSrc(it[opts.thumb]) }) : el("div", { class: "thumb" + (opts.wide ? " wide" : "") })) : null,
            el("div", { class: "tt" }, el("b", {}, tx(it.title) || "(sem título)"), el("small", {}, opts.sub(it))),
            it.visible === false ? el("span", { class: "badge gray" }, "Escondido") : opts.badge ? opts.badge(it) : null,
            tools(arr, i, () => { draw(); renderNav(); }))));
      });
      if (!rows.children.length) rows.append(el("div", { class: "empty" }, "Nada encontrado."));
    };
    const edit = (it, isNew) => drawer((isNew ? "Novo: " : "Editar: ") + opts.name, el("div", { class: "panel" }, fields(opts.schema, it, opts.onChange && (() => opts.onChange(it)))), () => { draw(); renderNav(); });
    v.append(el("div", { class: "toolbar" }, q, el("button", { class: "b primary", onclick: () => { const it = Object.assign(defaults(opts.schema), opts.extra ? opts.extra() : {}); arr.unshift(it); markDirty(); draw(); renderNav(); edit(it, true); } }, "+ Adicionar " + opts.name.toLowerCase())), rows);
    draw();
  }
  function vServices(v) {
    head("Serviços", "A lista de serviços aparece na página Serviços, na página inicial e no formulário de contacto.");
    collection(v, S.services, { name: "Serviço", schema: SERVICE, sub: it => tx(it.text).slice(0, 110) + "…" });
  }
  function vProjects(v) {
    head("Projectos", "Cada projecto tem uma ficha que abre ao clicar. Pode ligar documentos a um projecto na secção Documentos.");
    collection(v, S.projects, { name: "Projecto", schema: PROJECT, thumb: "image", wide: true, extra: () => ({ id: "p-" + Date.now().toString(36), country: "MZ", tags: [] }),
      sub: it => [tx(it.client), tx(it.duration)].filter(Boolean).join(" · "), badge: it => it.live ? el("span", { class: "badge" }, "Em operação") : null });
  }

  /* ---- Documentos (grelha de capas) ---- */
  function docCat(d) { const cats = S.documentCategories || []; const i = cats.findIndex(c => tx(c) === tx(d.category)); return i < 0 ? "" : String(i); }
  function vDocs(v) {
    head("Documentos", "Mostre as capas dos relatórios. Carregue o PDF: a capa (1ª página) é gerada automaticamente e o PDF não é publicado.");
    const grid = el("div", { class: "cgrid" });
    const draw = () => {
      grid.innerHTML = "";
      grid.append(el("div", { class: "cc new", onclick: () => newDoc() }, el("span", {}, "+"), "Novo documento", el("small", { style: "font-weight:500;color:var(--muted)" }, "a partir de um PDF ou imagem")));
      S.documents.forEach(d => grid.append(el("div", { class: "cc", onclick: () => editDoc(d) },
        d.cover ? el("img", { src: imgSrc(d.cover), loading: "lazy" }) : el("div", { class: "ph" }, "Sem capa"),
        d.visible === false ? el("span", { class: "hid" }, "Escondido") : null,
        el("div", { class: "ct" }, tx(d.title), el("small", {}, [tx(d.category), d.year].filter(Boolean).join(" · "))))));
    };
    const editDoc = (d, isNew) => {
      const proxy = { _cat: docCat(d) };
      const schema = DOCUMENT.map(f => f.k === "category" ? Object.assign({}, f, { k: "_cat" }) : f);
      const holder = new Proxy(d, { get: (o, k) => k === "_cat" ? proxy._cat : o[k], set: (o, k, val) => { if (k === "_cat") { proxy._cat = val; o.category = clone((S.documentCategories || [])[+val] || ""); } else o[k] = val; return true; } });
      const body = el("div", {}, el("div", { class: "panel" }, fields(schema, holder)),
        el("div", { style: "display:flex;gap:.6rem;flex-wrap:wrap" },
          el("button", { class: "b ghost", onclick: () => { if (d.visible === false) delete d.visible; else d.visible = false; markDirty(); toast(d.visible === false ? "Documento escondido" : "Documento visível"); } }, "Mostrar / esconder no site"),
          el("button", { class: "b ghost", onclick: () => { const i = S.documents.indexOf(d); if (i > 0) { S.documents.splice(i, 1); S.documents.splice(i - 1, 0, d); markDirty(); toast("Movido para a frente"); } } }, "← Mover para a frente"),
          el("button", { class: "b danger", onclick: async () => { if (await ask("Apagar este documento?", "A capa deixa de aparecer no site quando publicar.", "Apagar", true)) { forgetFile(d.cover); forgetFile(d.download); S.documents.splice(S.documents.indexOf(d), 1); markDirty(); $("#dialog").classList.remove("open"); draw(); renderNav(); } } }, "Apagar documento")));
      drawer(isNew ? "Novo documento" : "Editar documento", body, () => { draw(); renderNav(); });
    };
    const newDoc = () => { const d = Object.assign(defaults(DOCUMENT), { id: "d-" + Date.now().toString(36), category: clone((S.documentCategories || [""])[0]), language: "PT", year: String(new Date().getFullYear()) }); S.documents.unshift(d); markDirty(); draw(); renderNav(); editDoc(d, true); };
    const cats = el("div", { class: "panel" }, el("h2", {}, "Categorias de documentos"), el("p", { class: "hint" }, "Usadas nos filtros da página Documentos."));
    const holder = { c: S.documentCategories || (S.documentCategories = []) };
    cats.append(field({ k: "c", t: "bilist" }, holder));
    v.append(grid, el("div", { style: "height:1.4rem" }), cats);
    draw();
  }

  /* ---- Geral ---- */
  function vGeneral(v) {
    head("Geral e clientes", "Contactos, frase da empresa, clientes e filtros de projectos.");
    v.append(el("div", { class: "panel" }, el("h2", {}, "Contactos e identidade"), fields([
      { t: "cols", of: [{ k: "email", l: "Email de contacto (recebe o formulário)", t: "email" }, { k: "company", l: "Nome legal da empresa", t: "text" }] },
      { k: "address", l: "Morada", t: "bi" }, { k: "tagline", l: "Frase da empresa (rodapé)", t: "biarea" },
      { k: "defaultLanguage", l: "Língua por defeito para visitantes", t: "select", o: [["pt", "Português"], ["en", "Inglês"]] }], S)));
    const h = { clients: S.clients };
    v.append(el("div", { class: "panel" }, el("h2", {}, "Clientes e parceiros"), el("p", { class: "hint" }, "Aparecem na faixa animada “Confiam em nós”."), fields([{ k: "clientsTitle", l: "Título da faixa", t: "bi" }], S), el("div", { style: "height:1rem" }), field({ k: "clients", t: "bilist" }, h)));
    v.append(el("div", { class: "panel" }, el("h2", {}, "Filtros de projectos"), el("p", { class: "hint" }, "Os botões de filtro na página Projectos. O valor “all” mostra todos; os códigos de país (MZ, AO) filtram por país; os outros valores filtram pelas áreas dos projectos."),
      field({ k: "projectFilters", t: "list", itemName: "Filtro", labelKey: "label", of: [{ t: "cols", of: [{ k: "label", l: "Nome", t: "bi" }, { k: "value", l: "Valor (código)", t: "text" }] }] }, S)));
    const ctry = { list: Object.entries(S.countries).map(([code, name]) => ({ code, name })) };
    v.append(el("div", { class: "panel" }, el("h2", {}, "Países"), field({ k: "list", t: "list", itemName: "País", labelKey: "name", of: [{ t: "cols", of: [{ k: "code", l: "Código (ex.: MZ)", t: "text" }, { k: "name", l: "Nome", t: "bi" }] }] }, ctry, () => { S.countries = {}; ctry.list.forEach(c => { if (c.code) S.countries[c.code.toUpperCase()] = c.name; }); })));
  }

  /* ===================== GitHub ===================== */
  function cfg() { let c = {}; try { c = JSON.parse(localStorage.getItem("ii-gh") || "{}"); } catch (e) {} return { repo: c.repo || (S.admin && S.admin.repo) || "", branch: c.branch || "main", token: c.token || "" }; }
  function saveCfg(c) { try { localStorage.setItem("ii-gh", JSON.stringify(c)); } catch (e) {} }
  async function gh(path, opts = {}) {
    const c = cfg();
    const r = await fetch(`https://api.github.com/repos/${c.repo}/${path}`, Object.assign({ headers: { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" } }, opts));
    if (!r.ok) { let m = r.status + ""; try { m = (await r.json()).message || m; } catch (e) {} throw new Error(m === "Bad credentials" ? "Token inválido ou expirado" : m === "Not Found" ? "Repositório ou ficheiro não encontrado (verifique o nome e as permissões do token)" : m); }
    return r.status === 204 ? null : r.json();
  }
  const b64utf8 = s => { const b = new TextEncoder().encode(s); let o = ""; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(o); };
  const utf8b64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, "")), c => c.charCodeAt(0)));
  function parseContent(txt) { const i = txt.indexOf("window.SITE"); const a = txt.indexOf("{", i), b = txt.lastIndexOf("}"); return JSON.parse(txt.slice(a, b + 1)); }
  function serialize() {
    const out = clone(S); out.admin = { repo: cfg().repo, branch: cfg().branch };
    return `/* ============================================================\n   CONTEÚDO DO SITE INDICO INSIGHTS\n   Gerido pela página de gestão (admin.html). Não precisa de editar à mão.\n   Última actualização: ${new Date().toISOString()}\n   ============================================================ */\nwindow.SITE = ${JSON.stringify(out, null, 2)};\n`;
  }
  async function loadRemote() {
    const c = cfg(); const ref = encodeURIComponent(c.branch);
    const f = await gh(`contents/conteudo.js?ref=${ref}`);
    remoteSha = f.sha;
    return parseContent(utf8b64(f.content));
  }
  async function sha(path) { try { return (await gh(`contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(cfg().branch)}`)).sha; } catch (e) { return null; } }
  async function put(path, b64, message, knownSha) {
    const body = { message, content: b64, branch: cfg().branch };
    const s = knownSha !== undefined ? knownSha : await sha(path); if (s) body.sha = s;
    return gh(`contents/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "PUT", body: JSON.stringify(body) });
  }

  function vConnect(v) {
    head("Ligação GitHub", "Configure uma única vez neste computador. O código de acesso fica guardado apenas neste navegador.");
    const c = cfg();
    v.append(el("div", { class: "panel" }, el("h2", {}, "Como obter o código de acesso (token)"), el("ol", { class: "steps" },
      el("li", {}, "No GitHub, abra Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token."),
      el("li", {}, "Em “Repository access”, escolha “Only select repositories” e seleccione o repositório do site."),
      el("li", {}, "Em “Permissions → Repository permissions”, dê a “Contents” o acesso “Read and write”."),
      el("li", {}, "Gere o token, copie-o e cole-o abaixo. Cada pessoa que gere o site deve ter o seu próprio token.")),
      el("a", { href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener" }, "Abrir a página de criação de tokens no GitHub ↗")));
    const form = { repo: c.repo, branch: c.branch, token: c.token };
    const log = el("div", { class: "hint" });
    v.append(el("div", { class: "panel" }, el("h2", {}, "Dados da ligação"), fields([
      { t: "cols", of: [{ k: "repo", l: "Repositório (utilizador/nome)", t: "text", ph: "ex.: indicoinsights/site" }, { k: "branch", l: "Ramo (branch)", t: "text" }] },
      { k: "token", l: "Token de acesso", t: "text" }], form),
      el("div", { style: "display:flex;gap:.6rem;margin-top:1rem;flex-wrap:wrap" },
        el("button", { class: "b primary", onclick: async () => {
          form.repo = (form.repo || "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, ""); form.token = (form.token || "").trim();
          saveCfg(form); log.textContent = "A testar a ligação…";
          try { const remote = await loadRemote(); log.textContent = "✓ Ligação feita com sucesso.";
            if (dirty && !(await ask("Carregar a versão publicada?", "Tem alterações por publicar neste navegador. Quer substituí-las pela versão que está publicada no site?", "Usar versão publicada"))) { renderNav(); return; }
            S = remote; dirty = false; $("#dirty").textContent = ""; renderNav(); toast("Ligado. Conteúdo actual carregado do site.");
          } catch (e) { log.textContent = "✗ " + e.message; renderNav(); } } }, "Guardar e testar ligação"),
        el("button", { class: "b ghost", onclick: () => { saveCfg({ repo: form.repo, branch: form.branch }); toast("Token removido deste navegador"); go("ligacao"); } }, "Desligar (apagar token)")), log));
    v.querySelectorAll('input[type=text]')[2].type = "password";
  }

  function vPublish(v) {
    head("Publicar", "Envia as alterações para o GitHub. O site é actualizado automaticamente em 1 a 2 minutos.");
    const c = cfg(), n = Object.keys(uploads).length;
    const log = el("div", { class: "log", style: "display:none" });
    const btn = el("button", { class: "b primary", disabled: !c.token, onclick: () => publish(log, btn) }, "🚀 Publicar agora");
    v.append(el("div", { class: "panel" }, el("h2", {}, dirty ? "Há alterações por publicar" : "Não há alterações por publicar"),
      el("p", { class: "hint" }, `${n} ficheiro(s) novo(s) para enviar · ${deletions.size} ficheiro(s) para apagar.`),
      c.token ? null : el("p", { class: "hint", style: "color:var(--sun);font-weight:700" }, "Ligue primeiro ao GitHub em “Ligação GitHub”."),
      el("div", { style: "display:flex;gap:.6rem;flex-wrap:wrap" }, btn,
        el("button", { class: "b ghost", onclick: async () => { if (await ask("Descartar as alterações?", "Volta à última versão carregada. As alterações não publicadas perdem-se.", "Descartar", true)) { try { localStorage.removeItem("ii-admin-draft"); } catch (e) {} dirty = false; location.reload(); } } }, "Descartar alterações")), log));
    v.append(el("div", { class: "panel" }, el("h2", {}, "Cópia de segurança"), el("p", { class: "hint" }, "Descarregue o ficheiro de conteúdo (conteudo.js). Pode carregá-lo manualmente no GitHub ou guardá-lo como cópia."),
      el("div", { style: "display:flex;gap:.6rem;flex-wrap:wrap" },
        el("button", { class: "b ghost", onclick: () => { const a = el("a", { href: URL.createObjectURL(new Blob([serialize()], { type: "text/javascript" })), download: "conteudo.js" }); document.body.append(a); a.click(); a.remove(); } }, "⬇ Descarregar conteudo.js"),
        el("label", { class: "b ghost" }, "⬆ Restaurar de um ficheiro", el("input", { type: "file", accept: ".js,.json", style: "display:none", onchange: async e => { try { S = parseContent(await e.target.files[0].text()); markDirty(); renderNav(); toast("Conteúdo restaurado. Publique para aplicar."); } catch (err) { toast("Ficheiro inválido", true); } } })))));
  }
  async function publish(log, btn) {
    btn.disabled = true; log.style.display = ""; log.textContent = "";
    const say = m => { log.textContent += m + "\n"; log.scrollTop = 1e9; };
    try {
      say("A verificar a versão publicada…");
      const cur = await gh(`contents/conteudo.js?ref=${encodeURIComponent(cfg().branch)}`);
      if (remoteSha && cur.sha !== remoteSha && !(await ask("O site foi alterado por outra pessoa", "Desde que abriu esta página, alguém publicou alterações. Se continuar, as suas alterações substituem as dela.", "Publicar mesmo assim", true))) { say("Cancelado."); btn.disabled = false; return; }
      for (const p of Object.keys(uploads)) { say("↑ " + p); await put(p, uploads[p], "Gestão do site: adicionar " + p.split("/").pop()); delete uploads[p]; }
      for (const p of [...deletions]) { const s = await sha(p); if (s) { say("✕ " + p); await gh(`contents/${p.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE", body: JSON.stringify({ message: "Gestão do site: remover " + p.split("/").pop(), sha: s, branch: cfg().branch }) }); } deletions.delete(p); }
      say("↑ conteudo.js");
      const r = await put("conteudo.js", b64utf8(serialize()), "Gestão do site: actualizar conteúdo", cur.sha);
      remoteSha = r.content.sha; dirty = false; $("#dirty").textContent = ""; try { localStorage.removeItem("ii-admin-draft"); } catch (e) {}
      say("\n✓ Publicado! O site será actualizado em 1 a 2 minutos."); toast("Publicado com sucesso");
    } catch (e) { say("✗ Erro: " + e.message); toast("Erro ao publicar: " + e.message, true); }
    btn.disabled = false;
  }

  /* ===================== pré-visualização ===================== */
  $("#previewBtn").onclick = () => {
    const d = clone(S);
    const swap = o => { if (Array.isArray(o)) return o.map(swap); if (o && typeof o === "object") { for (const k in o) o[k] = swap(o[k]); return o; } return typeof o === "string" && previews[o] ? previews[o] : o; };
    try { localStorage.setItem("ii-preview", JSON.stringify(swap(d))); } catch (e) { toast("Pré-visualização demasiado grande para o navegador (muitas imagens novas). Publique para ver.", true); return; }
    window.open("index.html?preview=1", "_blank");
  };
  $("#publishBtn").onclick = () => go("publicar");

  /* ===================== arranque ===================== */
  (async function init() {
    try { const d = localStorage.getItem("ii-admin-draft"); if (d) { const draft = JSON.parse(d); if (JSON.stringify(draft) !== JSON.stringify(S)) { S = draft; dirty = true; $("#dirty").textContent = "● Alterações por publicar (rascunho recuperado)"; } } } catch (e) {}
    renderNav(); render();
    if (cfg().token) { try { const remote = await loadRemote(); if (!dirty) { S = remote; renderNav(); render(); } } catch (e) { toast("Não foi possível ler o GitHub: " + e.message, true); } }
    else if (section === "inicio") toast("Para publicar, ligue primeiro ao GitHub (menu “Ligação GitHub”).");
  })();
})();

/* Motor do site Indico Insights — não precisa de editar este ficheiro.
   O conteúdo está em conteudo.js e gere-se pela página admin.html */
(function () {
  let S = window.SITE, PREVIEW = false;
  try { if (/[?&]preview=1/.test(location.search)) { const d = localStorage.getItem("ii-preview"); if (d) { S = JSON.parse(d); PREVIEW = true; } } } catch (e) {}
  const pages = S.pages.filter(p => p.visible !== false);
  let lang;
  try { lang = localStorage.getItem("ii-lang"); } catch (e) {}
  if (!["pt", "en"].includes(lang)) lang = (navigator.language || "").startsWith("pt") ? "pt" : (S.defaultLanguage || "pt");

  /* ---------- helpers ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const t = v => v == null ? "" : (typeof v === "object" && !Array.isArray(v)) ? (v[lang] || v.pt || v.en || "") : String(v);
  const h = v => esc(t(v));
  const md = v => h(v).replace(/\*(.+?)\*/g, "<em>$1</em>");
  const vis = arr => (arr || []).filter(x => x && x.visible !== false);
  const ext = l => /^https?:/.test(l || "");
  const href = l => esc(l || "#");
  const tgt = l => ext(l) ? ' target="_blank" rel="noopener"' : "";
  const U = S.ui;
  let rvi = 0; const rv = () => `rv d${(rvi++) % 4}`;

  const ICONS = {
    wave: '<path d="M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 20c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
    tree: '<path d="M12 22v-7M12 2 5 12h4l-3 4h12l-3-4h4z"/>',
    sprout: '<path d="M12 22V11M12 11C12 6 8 4 3 4c0 5 4 7 9 7zM12 13c0-4 3-6 8-6 0 4-3 6-8 6z"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5M2 17l10 5 10-5"/>',
    drone: '<circle cx="5" cy="5" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/><path d="M7 7l2 2M17 7l-2 2M7 17l2-2M17 17l-2-2"/>',
    map: '<path d="m9 3-6 3v15l6-3 6 3 6-3V3l-6 3z"/><path d="M9 3v15M15 6v15"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2M9 8l2 2 4-4"/>',
    clip: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M9 11h6M9 15h4"/>',
    cap: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    bars: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    screen: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 1.8 6 5.5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>',
    down: '<path d="M12 4v12M6 11l6 6 6-6M4 21h16"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    leaf: '<path d="M20 3C9 3 4 9 4 16c0 1.5.3 3 .8 4.3M6 19c2-4 5-7 10-9"/>'
  };
  const ic = (k, s = 24, sw = 1.8, cls = "") => `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ICONS.globe}</svg>`;
  const canvas = (opts, cls = "bgcanvas") => `<canvas class="${cls}" data-contour='${JSON.stringify(opts)}'></canvas>`;
  const img = src => src ? `background-image:url('${esc(src)}')` : "";
  const credit = (c, l) => c ? (l ? `<a class="credit" href="${esc(l)}" target="_blank" rel="noopener">${esc(c)}</a>` : `<span class="credit">${esc(c)}</span>`) : "";

  const head = (b, center) => (b.eyebrow || b.title || b.text || b.link) ? `<div class="head ${center ? "center" : ""}"><div>
      ${b.eyebrow ? `<span class="eyebrow ${rv()}">${h(b.eyebrow)}</span>` : ""}
      ${b.title ? `<h2 class="${rv()}">${md(b.title)}</h2>` : ""}
      ${b.text ? `<p class="${rv()}">${h(b.text)}</p>` : ""}</div>
      ${b.link && t(b.link.label) ? `<a class="more ${rv()}" href="${href(b.link.href)}"${tgt(b.link.href)}>${h(b.link.label)}</a>` : ""}</div>` : "";
  const sec = (b, inner, cls = "") => `<section class="${cls} ${b.bg ? "bg-" + b.bg : ""}"><div class="wrap">${inner}</div></section>`;
  const projArt = (p, i) => {
    const ao = p.country === "AO", fill = ao ? "#b4472f" : ["#066a3a", "#0b3d5c", "#0a5a44"][i % 3];
    return p.image ? "" : canvas({ seed: i * 7 + 3 + (p.id || "").length, scale: .012, levels: 9, color: ao ? "255,210,180" : "200,255,220", alpha: .7, fill }, "");
  };
  const docCard = d => `<button class="docc ${rv()}" data-doc="${esc(S.documents.indexOf(d))}" data-cat="${h(d.category)}">
      <div class="cover">${d.cover ? `<img src="${esc(d.cover)}" alt="${h(d.title)}" loading="lazy">` : ""}<span class="cat">${h(d.category)}</span></div>
      <div><h3>${h(d.title)}</h3><small>${[t(d.client), d.year].filter(Boolean).map(esc).join(" · ")}</small></div></button>`;

  /* ---------- BLOCOS ---------- */
  const B = {
    hero: b => {
      const slides = vis(b.slides);
      return `<header class="hero" data-slider>${slides.map((s, i) => `<div class="slide ${i ? "" : "on"} ${s.image ? "" : "noimg"}">
          ${s.image ? `<div class="bgimg" style="${img(s.image)}"></div><div class="shade"></div>` : canvas({ seed: 4 + i * 5, scale: .0035, levels: 16, alpha: .45, anim: i === 0 })}
          <div class="wrap"><div class="txt">
            ${s.label ? `<span class="pill-label">${h(s.label)}</span>` : ""}
            <h1>${md(s.title)}</h1><p>${h(s.text)}</p>
            ${s.button && t(s.button.label) ? `<a class="btn btn-dark" href="${href(s.button.link)}"${tgt(s.button.link)}>${h(s.button.label)} ${ic("arrow", 18, 2.2)}</a>` : ""}
          </div>
          ${s.image ? "" : `<div class="orbit" aria-hidden="true"><div class="ring"><span class="sat"></span></div><div class="ring r2"></div><div class="core">${canvas({ seed: 9 + i, scale: .03, levels: 10, color: "200,255,220", alpha: .55, anim: i === 0 }, "")}<div class="scan"></div></div></div>`}
          </div>${s.image ? credit(s.credit, s.creditLink) : ""}</div>`).join("")}
        ${slides.length > 1 ? `<div class="hero-dots">${slides.map((_, i) => `<button aria-label="${i + 1}" class="${i ? "" : "on"}"></button>`).join("")}</div>
        <div class="hero-ctrl"><button data-d="-1" aria-label="‹">${ic("left", 20, 2.4)}</button><button data-d="1" aria-label="›">${ic("right", 20, 2.4)}</button></div><div class="hero-bar"></div>` : ""}
      </header>`;
    },

    bento: b => sec(b, `<div class="bento">
        <div class="brand rv"><img src="assets/logo-white.png" alt="Indico Insights"><p>${h(b.brand && b.brand.text)}</p>
          ${b.brand && b.brand.button && t(b.brand.button.label) ? `<a class="btn btn-dark" href="${href(b.brand.button.link)}">${h(b.brand.button.label)} ${ic("arrow", 18, 2.2)}</a>` : ""}</div>
        ${vis(b.tiles).map(x => `<div class="tile ${rv()}"><div class="ic">${ic(x.icon || "target", 22)}</div><h3>${h(x.title)}</h3>
          ${x.text ? `<p>${h(x.text)}</p>` : ""}${x.list && x.list.length ? `<ul>${x.list.map(l => `<li>${h(l)}</li>`).join("")}</ul>` : ""}</div>`).join("")}
      </div>`),

    stats: b => sec(b, `<div class="stats-card rv">${canvas({ seed: 11, scale: .004, levels: 10, alpha: .25 })}${vis(b.items).map(s => `<div class="stat">
        <b data-count="${+s.value || 0}" data-dec="${s.decimals || 0}" data-pre="${h(s.prefix)}" data-suf="${h(s.suffix)}">0</b><span>${h(s.label)}</span></div>`).join("")}</div>`),

    text: b => sec(b, head(b) + `<div class="grid ${b.pillars && b.pillars.length ? "" : "single"}">
        <div>${vis(b.paragraphs).map(p => `<p class="${rv()}">${h(p)}</p>`).join("")}</div>
        ${b.pillars && b.pillars.length ? `<div class="pillars">${vis(b.pillars).map(p => `<div class="pillar ${rv()}"><div class="ic">${ic(p.icon)}</div><h3>${h(p.title)}</h3><p>${h(p.text)}</p></div>`).join("")}</div>` : ""}
      </div>`, "textblock"),

    services: b => {
      const list = vis(S.services).slice(0, b.limit || 99);
      const cards = list.map(s => `<article class="svc-card ${rv()}">${ic(s.icon, 30, 1.6, "ic")}<h3>${h(s.title)}</h3><p>${h(s.text)}</p></article>`).join("");
      const cta = b.cta && t(b.cta.title) ? `<a class="svc-card more-card" href="${href(b.cta.link)}"><h3>${h(b.cta.title)}</h3><p><b>${h(b.cta.label)}</b></p></a>` : "";
      if (b.style === "bento") return sec(b, head(b) + `<div class="svc-bento">
          <div class="svc-visual rv" style="${img(b.image)}">${b.image ? `<div class="shade-v"></div>` : canvas({ seed: 21, scale: .006, levels: 14, color: "200,255,220", alpha: .45, anim: true })}
            <div class="cap"><span class="pill-label">${lang === "pt" ? "Do satélite ao terreno" : "From satellite to ground"}</span></div>${b.image ? credit(b.credit, b.creditLink) : ""}</div>
          <div class="svc-panel">${cards}</div></div>`);
      return sec(b, head(b) + `<div class="svc-grid">${cards}${cta}</div>`);
    },

    checklist: b => sec(b, `<div class="band rv">${canvas({ seed: 31, scale: .004, levels: 10, color: "255,255,255", alpha: .18 })}
        <div style="position:relative"><h2>${md(b.title)}</h2>${b.text ? `<p>${h(b.text)}</p>` : ""}
          ${b.button && t(b.button.label) ? `<a class="btn btn-white" href="${href(b.button.link)}">${h(b.button.label)} ${ic("arrow", 18, 2.2)}</a>` : ""}</div>
        <ul style="position:relative">${vis(b.items).map(x => `<li>${ic("check", 22, 2)}<span>${h(x)}</span></li>`).join("")}</ul></div>`),

    projects: b => {
      let list = vis(S.projects);
      if (b.only && b.only.length) list = b.only.map(id => list.find(p => p.id === id)).filter(Boolean);
      list = list.slice(0, b.limit || 99);
      const filters = b.filters === false ? "" : `<div class="filters rv">${vis(S.projectFilters).map((f, i) => `<button class="chip ${i ? "" : "on"}" data-f="${esc(f.value)}">${h(f.label)}</button>`).join("")}</div>`;
      return sec(b, head(b) + filters + `<div class="proj-grid">${list.map((p, i) => `<button class="proj ${rv()}" data-id="${esc(p.id)}" data-country="${esc(p.country)}" data-tags="${esc((p.tags || []).join(" "))}">
          <div class="art" style="${img(p.image)}">${projArt(p, i)}<span class="flag pill-label">${h(p.place || S.countries[p.country])}</span>${p.live ? `<span class="live"><i></i>${h(U.live)}</span>` : ""}</div>
          <div class="body"><span class="client">${h(p.client)}</span><h3>${h(p.title)}</h3>
          <div class="meta"><span>📅 ${h(p.duration)}</span><span>👥 ${h(p.team)} ${h(U.people)}</span></div></div></button>`).join("")}</div>`);
    },

    documents: b => {
      let docs = vis(S.documents);
      if (b.only && b.only.length) docs = b.only.map(id => docs.find(d => d.id === id)).filter(Boolean);
      if (b.exclude && b.exclude.length) docs = docs.filter(d => !b.exclude.includes(d.id));
      docs = docs.slice(0, b.limit || 999);
      if (b.style === "feature") return sec(b, head(b) + docs.map(d => `<div class="docfeat rv">
          <button class="cv" data-doc="${S.documents.indexOf(d)}">${d.cover ? `<img src="${esc(d.cover)}" alt="${h(d.title)}" loading="lazy">` : ""}</button>
          <div><span class="eyebrow">${h(d.category)}</span><h3>${h(d.title)}</h3><p>${h(d.text)}</p>
            <div class="meta">${[d.language, d.pages ? d.pages + " " + t(U.pagesCount).toLowerCase() : "", d.year].filter(Boolean).map(esc).join(" · ")}</div>
            <div class="btns">${d.download ? `<a class="btn btn-sun" href="${href(d.download)}" target="_blank" rel="noopener" download>${ic("down", 18, 2.2)} ${h(U.download)}</a>` : ""}
            <button class="btn btn-line" data-doc="${S.documents.indexOf(d)}">${ic("eye", 16)} ${h(U.view)}</button></div></div></div>`).join(""));
      const cats = [...new Set(docs.map(d => t(d.category)).filter(Boolean))];
      const filters = b.filters && cats.length > 1 ? `<div class="filters rv"><button class="chip on" data-dc="all">${h(U.all)}</button>${cats.map(c => `<button class="chip" data-dc="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : "";
      return sec(b, head(b) + (docs.length ? filters + `<div class="doc-grid">${docs.map(docCard).join("")}</div>` : `<div class="empty">${h(U.noDocs)}</div>`));
    },

    clients: b => `<div class="clients"><p>${h(b.title || S.clientsTitle)}</p><div class="marquee">${(() => { const m = vis(S.clients).map(c => `<span>${h(c)}</span>`).join(""); return m + m; })()}</div></div>`,

    impact: b => sec(b, `<div class="impact-card rv">${canvas({ seed: 2, scale: .004, levels: 12, color: "240,122,74", alpha: .5 })}
        <div><p>${h(b.text)}</p><div class="big-num">${h(b.number)}</div><p>${h(b.after)}</p></div>
        <div class="why">${vis(b.items).map(x => `<div><h3>${h(x.title)}</h3><p>${h(x.text)}</p></div>`).join("")}</div></div>`),

    duo: b => sec(b, head(b) + `<div class="duo">${["left", "right"].map((k, i) => { const c = b[k] || {}; return `<div class="vcard ${i ? "b" : "a"} ${rv()}"><span class="eyebrow">${h(c.eyebrow)}</span><h3>${h(c.title)}</h3><p>${h(c.text)}</p>
          ${c.flow && c.flow.length ? `<div class="flow">${c.flow.map(f => `<span>${h(f)}</span>`).join("<i>→</i>")}</div>` : ""}</div>`; }).join("")}</div>`),

    tags: b => sec(b, head(b) + `<div class="skills ${rv()}">${vis(b.items).map(x => `<span>${h(x)}</span>`).join("")}</div>`),

    cta: b => sec(b, `<div class="ctaband rv ${b.image ? "withimg" : ""}" style="${img(b.image)}">${b.image ? credit(b.credit, b.creditLink) : canvas({ seed: 6, scale: .004, levels: 12, alpha: .5 })}
        <h2>${md(b.title)}</h2>${b.button && t(b.button.label) ? `<a class="btn btn-sun" href="${href(b.button.link)}">${h(b.button.label)} ${ic("arrow", 18, 2.2)}</a>` : ""}</div>`),

    contact: b => {
      const F = U.form;
      const areas = vis(S.services).map(s => `<option>${h(s.title)}</option>`).join("") + `<option>${lang === "pt" ? "Outro" : "Other"}</option>`;
      return `<section style="padding-top:6.5rem"><div class="wrap"><div class="contact-card">${canvas({ seed: 6, scale: .003, levels: 14, alpha: .4, anim: true })}
        <div><span class="eyebrow rv">${h(b.eyebrow)}</span><h1 class="rv d1">${md(b.title)}</h1><p class="rv d2">${h(b.text)}</p>
          <div class="cinfo rv d3"><a href="mailto:${esc(S.email)}"><span class="ic">${ic("mail", 20)}</span>${esc(S.email)}</a>
          <div><span class="ic">${ic("pin", 20)}</span>${h(S.address)}</div></div></div>
        <form id="form" class="cf rv d2" novalidate>
          <div class="row2"><label>${h(F.name)}<input name="nome" required placeholder="${h(F.namePh)}"></label>
          <label>${h(F.org)}<input name="org" placeholder="${h(F.orgPh)}"></label></div>
          <label>${h(F.email)}<input type="email" name="email" required placeholder="nome@exemplo.com"></label>
          <label>${h(F.area)}<select name="area">${areas}</select></label>
          <label>${h(F.message)}<textarea name="msg" required placeholder="${h(F.msgPh)}"></textarea></label>
          <button class="btn btn-sun" type="submit">${h(F.send)} ${ic("arrow", 18, 2.2)}</button><div class="note" id="note"></div>
        </form></div></div></section>`;
    }
  };

  /* ---------- NAV + FOOTER ---------- */
  const menuPages = pages.filter(p => p.menu && p.inMenu !== false);
  const contactPage = pages.find(p => (p.blocks || []).some(b => b.type === "contact"));
  function renderChrome() {
    document.documentElement.lang = lang;
    document.getElementById("nav").innerHTML = `<div class="wrap">
      <a class="logo-pill" href="#${pages[0].id}" aria-label="Indico Insights"><img src="assets/logo.png" alt="Indico Insights"></a>
      <ul class="menu-pill" id="menu">${menuPages.map(p => `<li><a href="#${esc(p.id)}" data-id="${esc(p.id)}">${h(p.menu)}</a></li>`).join("")}</ul>
      <div class="right-pill">${contactPage ? `<a class="cta" href="#${contactPage.id}"><span>${h(U.talk)}</span>${ic("arrow", 16, 2.4)}</a>` : ""}
        <div class="lang" role="group" aria-label="Language"><button data-l="pt">PT</button><button data-l="en">EN</button></div>
        <button class="burger" id="burger" aria-label="${h(U.menu)}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div></div>`;
    document.querySelectorAll(".lang button").forEach(b => { b.classList.toggle("on", b.dataset.l === lang); b.onclick = () => setLang(b.dataset.l); });
    document.getElementById("burger").onclick = () => document.getElementById("nav").classList.toggle("open");
    document.getElementById("footer").innerHTML = `<div class="wrap"><div class="top">
      <div><span class="flogo"><img src="assets/logo.png" alt="Indico Insights"></span><p>${h(S.tagline)}</p></div>
      <div><h4>${h(U.pages)}</h4><ul>${menuPages.map(p => `<li><a href="#${esc(p.id)}">${h(p.menu)}</a></li>`).join("")}</ul></div>
      <div><h4>${h(U.form.email)}</h4><ul><li><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></li><li>${h(S.address)}</li></ul></div></div>
      <div class="bottom"><span>© ${new Date().getFullYear()} ${esc(S.company)} ${h(U.rights)}</span><a href="admin.html">${h(U.manage)}</a></div></div>`;
    const fab = document.getElementById("fab");
    if (fab) { fab.href = contactPage ? "#" + contactPage.id : "mailto:" + S.email; fab.innerHTML = ic("mail", 24, 2); fab.title = t(U.talk); }
  }

  /* ---------- ROUTER ---------- */
  let current;
  function render() {
    const id = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const page = pages.find(p => p.id === id) || pages[0];
    const changed = current !== page.id; current = page.id;
    rvi = 0; stopSlider();
    let html = "";
    if (page.header) html += `<div class="phero-wrap"><div class="wrap"><header class="phero ${page.header.image ? "withimg" : ""}" style="${img(page.header.image)}">${page.header.image ? credit(page.header.credit, page.header.creditLink) : ""}${canvas({ seed: page.id.length * 3, scale: .0035, levels: 14, alpha: .35, anim: true })}
        ${page.header.eyebrow ? `<span class="pill-label rv">${h(page.header.eyebrow)}</span>` : ""}
        <h1 class="rv d1">${md(page.header.title || page.menu)}</h1>${page.header.text ? `<p class="rv d2">${h(page.header.text)}</p>` : ""}
        <div class="crumbs">Indico Insights / ${h(page.menu)}</div></header></div></div>`;
    html += vis(page.blocks).map(b => B[b.type] ? B[b.type](b) : "").join("");
    const app = document.getElementById("app");
    app.innerHTML = html;
    app.style.animation = "none"; void app.offsetWidth; app.style.animation = "";
    document.title = (page.id === pages[0].id ? "" : t(page.menu) + " · ") + "Indico Insights";
    document.querySelectorAll("#menu a").forEach(a => a.classList.toggle("active", a.dataset.id === page.id));
    document.getElementById("nav").classList.remove("open");
    if (changed) scrollTo(0, 0);
    afterRender();
  }
  function setLang(l) { lang = l; try { localStorage.setItem("ii-lang", l); } catch (e) {} renderChrome(); render(); }

  /* ---------- slider ---------- */
  let sliderTimer, barAnim;
  function stopSlider() { clearInterval(sliderTimer); if (barAnim) barAnim.cancel(); }
  function startSlider() {
    const hero = document.querySelector("[data-slider]"); if (!hero) return;
    const slides = [...hero.querySelectorAll(".slide")], dots = [...hero.querySelectorAll(".hero-dots button")], bar = hero.querySelector(".hero-bar");
    if (slides.length < 2) return;
    let i = 0; const DUR = 7000;
    const go = n => { i = (n + slides.length) % slides.length; slides.forEach((s, k) => s.classList.toggle("on", k === i)); dots.forEach((d, k) => d.classList.toggle("on", k === i));
      if (bar && bar.animate) { if (barAnim) barAnim.cancel(); barAnim = bar.animate([{ width: "0%" }, { width: "100%" }], { duration: DUR, easing: "linear" }); }
      clearInterval(sliderTimer); sliderTimer = setInterval(() => go(i + 1), DUR); };
    hero.querySelectorAll(".hero-ctrl button").forEach(b => b.onclick = () => go(i + +b.dataset.d));
    dots.forEach((d, k) => d.onclick = () => go(k));
    go(0);
  }

  /* ---------- interações ---------- */
  let io, cio;
  function afterRender() {
    io && io.disconnect(); cio && cio.disconnect();
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .08 });
    document.querySelectorAll("#app .rv").forEach(el => io.observe(el));
    cio = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; cio.unobserve(e.target);
      const el = e.target, to = +el.dataset.count, dec = +el.dataset.dec, pre = el.dataset.pre, suf = el.dataset.suf, t0 = performance.now();
      (function f(now) { const k = Math.min(1, (now - t0) / 1600), v = to * (1 - Math.pow(1 - k, 3));
        el.innerHTML = (pre ? `<small>${pre}</small> ` : "") + v.toFixed(dec).replace(".", lang === "pt" ? "," : ".") + (suf ? `<small>${suf}</small>` : "");
        if (k < 1) requestAnimationFrame(f); })(t0);
    }), { threshold: .4 });
    document.querySelectorAll("[data-count]").forEach(el => cio.observe(el));
    document.querySelectorAll("canvas[data-contour]").forEach(c => contours(c, JSON.parse(c.dataset.contour)));
    startSlider();

    document.querySelectorAll(".filters").forEach(fl => fl.addEventListener("click", e => {
      const b = e.target.closest(".chip"); if (!b) return;
      fl.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c === b));
      const grid = fl.nextElementSibling;
      if (b.dataset.dc) { const f = b.dataset.dc; grid.querySelectorAll(".docc").forEach(d => d.classList.toggle("hide", !(f === "all" || d.dataset.cat === f))); return; }
      const f = b.dataset.f;
      grid.querySelectorAll(".proj").forEach(p => p.classList.toggle("hide", !(f === "all" || p.dataset.country === f || p.dataset.tags.split(" ").includes(f))));
    }));
    document.querySelectorAll(".proj").forEach(c => c.addEventListener("click", () => openProject(c.dataset.id)));
    document.querySelectorAll(".docc, .docfeat [data-doc]").forEach(c => c.addEventListener("click", () => openDoc(+c.dataset.doc)));

    const form = document.getElementById("form");
    if (form) form.addEventListener("submit", e => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const d = new FormData(form), F = U.form;
      const body = `${t(F.name)}: ${d.get("nome")}\n${t(F.org)}: ${d.get("org")}\n${t(F.email)}: ${d.get("email")}\n${t(F.area)}: ${d.get("area")}\n\n${d.get("msg")}`;
      location.href = `mailto:${S.email}?subject=${encodeURIComponent(t(F.subject) + " · " + d.get("area"))}&body=${encodeURIComponent(body)}`;
      document.getElementById("note").textContent = `${t(F.opening)} ${S.email}`;
    });
  }

  const modal = document.getElementById("modal");
  function showModal(html) {
    modal.querySelector(".box").innerHTML = `<button class="x" aria-label="×">×</button>` + html;
    modal.querySelector(".x").onclick = closeModal;
    modal.classList.add("open"); document.body.style.overflow = "hidden";
  }
  function openProject(id) {
    const p = S.projects.find(x => x.id === id); if (!p) return;
    const docs = vis(S.documents).filter(d => d.project === p.id);
    showModal(`<div class="top"><span class="pill-label">${h(p.live ? U.live : U.reference)}</span><h3>${h(p.title)}</h3></div>
      <div class="facts">${[[U.client, p.client], [U.location, p.place || S.countries[p.country]], [U.duration, p.duration], [U.team, `${t(p.team)} ${t(U.people)}`]].map(f => `<div><small>${h(f[0])}</small>${h(f[1])}</div>`).join("")}</div>
      <div class="desc"><p>${h(p.text)}</p>${p.link ? `<a class="btn btn-sun" href="${href(p.link)}" target="_blank" rel="noopener">${h(U.openSystem)}</a>` : ""}
      ${docs.length ? `<div class="related">${docs.map(d => `<img src="${esc(d.cover)}" alt="${h(d.title)}" title="${h(d.title)}" data-doc="${S.documents.indexOf(d)}">`).join("")}</div>` : ""}</div>`);
    modal.querySelectorAll(".related img").forEach(im => im.onclick = () => openDoc(+im.dataset.doc));
  }
  function openDoc(i) {
    const d = S.documents[i]; if (!d) return;
    const rows = [[U.client, d.client], [U.year, d.year], [U.language, d.language], [U.pagesCount, d.pages]].filter(r => t(r[1]));
    showModal(`<div class="doc-modal"><div class="cv">${d.cover ? `<img src="${esc(d.cover)}" alt="${h(d.title)}">` : ""}</div>
      <div class="info"><span class="eyebrow">${h(d.category)}</span><h3>${h(d.title)}</h3><p style="color:var(--muted)">${h(d.text)}</p>
      <dl>${rows.map(r => `<dt>${h(r[0])}</dt><dd>${h(r[1])}</dd>`).join("")}</dl>
      ${d.download ? `<a class="btn btn-sun" href="${href(d.download)}" target="_blank" rel="noopener" download>${ic("down", 18, 2.2)} ${h(U.download)}</a>`
        : `<div class="lock">${ic("lock", 18, 2)} ${h(U.onRequest)}</div>${contactPage ? `<a class="btn btn-dark" href="#${contactPage.id}" data-close>${h(U.requestAccess)} ${ic("arrow", 18, 2.2)}</a>` : ""}`}
      </div></div>`);
    const c = modal.querySelector("[data-close]"); if (c) c.addEventListener("click", closeModal);
  }
  function closeModal() { modal.classList.remove("open"); document.body.style.overflow = ""; }
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  /* ---------- curvas de nível generativas ---------- */
  function noise(seed) {
    const p = []; for (let i = 0; i < 512; i++) p[i] = Math.abs(Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453 % 1);
    const g = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, hh = (a, b) => p[((a * 31 + b * 57) % 512 + 512) % 512];
      const s = q => q * q * (3 - 2 * q), u = s(xf), v = s(yf);
      return (hh(xi, yi) * (1 - u) + hh(xi + 1, yi) * u) * (1 - v) + (hh(xi, yi + 1) * (1 - u) + hh(xi + 1, yi + 1) * u) * v; };
    return (x, y) => g(x, y) * .6 + g(x * 2.1, y * 2.1) * .3 + g(x * 4.3, y * 4.3) * .1;
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function contours(cv, o) {
    const { seed = 1, scale = .006, levels = 14, color = "95,208,143", alpha = .5, anim = false, fill = null, width = 1 } = o;
    const ctx = cv.getContext("2d"), n = noise(seed), step = 8; let W, H, tt = 0;
    function size() { const r = Math.min(devicePixelRatio, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0); }
    function draw() {
      ctx.clearRect(0, 0, W, H); if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, W, H); }
      const cols = Math.ceil(W / step) + 1, rows = Math.ceil(H / step) + 1, v = [];
      for (let j = 0; j < rows; j++) { v[j] = []; for (let i = 0; i < cols; i++) v[j][i] = n(i * step * scale + tt, j * step * scale + tt * .6); }
      for (let L = 1; L < levels; L++) {
        const th = L / levels * .85 + .05; ctx.beginPath();
        ctx.strokeStyle = `rgba(${color},${alpha * (L % 4 === 0 ? 1 : .5)})`; ctx.lineWidth = L % 4 === 0 ? width * 1.4 : width * .7;
        for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
          const a = v[j][i], b = v[j][i + 1], c = v[j + 1][i + 1], d = v[j + 1][i], x = i * step, y = j * step;
          const idx = (a > th) * 8 + (b > th) * 4 + (c > th) * 2 + (d > th); if (idx === 0 || idx === 15) continue;
          const lp = (p, q) => (th - p) / (q - p), T = [x + step * lp(a, b), y], R = [x + step, y + step * lp(b, c)], Bm = [x + step * lp(d, c), y + step], Lf = [x, y + step * lp(a, d)];
          const seg = { 1: [Lf, Bm], 2: [Bm, R], 3: [Lf, R], 4: [T, R], 5: [Lf, T, Bm, R], 6: [T, Bm], 7: [Lf, T], 8: [Lf, T], 9: [T, Bm], 10: [T, R, Lf, Bm], 11: [T, R], 12: [Lf, R], 13: [Bm, R], 14: [Lf, Bm] }[idx];
          for (let s = 0; s < seg.length; s += 2) { ctx.moveTo(seg[s][0], seg[s][1]); ctx.lineTo(seg[s + 1][0], seg[s + 1][1]); }
        }
        ctx.stroke();
      }
    }
    size(); draw();
    const ro = new ResizeObserver(() => { if (!cv.isConnected) return ro.disconnect(); size(); draw(); }); ro.observe(cv);
    if (anim && !reduce) {
      let last = 0, seen = true; const ob = new IntersectionObserver(([e]) => seen = e.isIntersecting); ob.observe(cv);
      (function loop(ts) { if (!cv.isConnected) return ob.disconnect(); if (seen && ts - last > 60) { tt += .004; draw(); last = ts; } requestAnimationFrame(loop); })(0);
    }
  }


  /* ---------- arranque ---------- */
  renderChrome();
  if (PREVIEW) document.body.insertAdjacentHTML("afterbegin", '<div style="position:fixed;left:50%;transform:translateX(-50%);bottom:1rem;z-index:99;background:#f07a4a;color:#fff;font-weight:700;padding:.6rem 1.1rem;border-radius:999px;box-shadow:0 10px 30px -10px rgba(0,0,0,.4);font-size:.85rem">Pré-visualização · alterações ainda não publicadas</div>');
  addEventListener("hashchange", render);
  render();
})();

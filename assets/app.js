(() => {
  'use strict';
  const catalog = window.ATLAS_CATALOG;
  if (!catalog?.plants?.length) { document.querySelector('#plant-grid').textContent = 'Dados não encontrados. Execute node scripts/build-data.mjs na pasta do projeto.'; return; }
  const plants = catalog.plants, byId = new Map(plants.map(p => [p.id,p]));
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const labels = {'tradicional':'Uso tradicional','pre-clinica':'Pré-clínica','clinica-limitada':'Clínica limitada','clinica-especifica':'Clínica de produto específico¹','sem-uso-seguro':'Sem uso caseiro seguro','nao-estabelecida':'Uso medicinal não estabelecido'};
  const riskLabels = {moderado:'Atenção contextual',alto:'Atenção alta',critico:'Atenção crítica'};
  const storageKey = 'atlas-vivo-notebook-v1';
  let notebook = AtlasNotebook.empty(), persistent = true, toastTimer, activePlant = null, previousFocus = null, previousProfile = null, recoveryRaw = null, focusSearchAfterNavigation = false;
  try { recoveryRaw = localStorage.getItem(storageKey); if (recoveryRaw) notebook = AtlasNotebook.validateBackup(JSON.parse(recoveryRaw), [...byId.keys()]); recoveryRaw = null; }
  catch { persistent = false; }
  function notify(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,5500); }
  async function persist() {
    const write = () => {
      let next=notebook;
      const raw=localStorage.getItem(storageKey);
      if(raw){let latest;try{latest=AtlasNotebook.validateBackup(JSON.parse(raw),[...byId.keys()]);}catch(error){recoveryRaw=raw;$('#export-recovery').hidden=false;throw error;}next=AtlasNotebook.merge(latest,notebook);}
      next=AtlasNotebook.validateBackup(next,[...byId.keys()]);
      localStorage.setItem(storageKey,JSON.stringify(next));notebook=next;persistent=true;
    };
    try { if(navigator.locks?.request)await navigator.locks.request('atlas-vivo-notebook',write);else write(); }
    catch { persistent=false; notify('Gravação indisponível: dados anteriores preservados. Exporte os registros desta sessão antes de fechar.'); }
    $('#saved-count').textContent=notebook.favorites.length;
  }
  const saved = id => notebook.favorites.includes(id);
  const scientific = p => `<i>${esc(p.scientificName)}</i> <span class="author">${esc(p.author)}</span>`;
  const pills = p => `<div class="pills"><span class="pill">${esc(labels[p.medicinal.evidence])}</span><span class="pill risk-${esc(p.risk.level)}">${esc(riskLabels[p.risk.level])}</span></div>`;
  const svgPath = (d,fill='#6e8c58',extra='') => `<path d="${d}" fill="${fill}" stroke="#3f6346" stroke-width="1.2" ${extra}/>`;
  function artwork(p, index=0) {
    const colors=['#e8ecdc','#e4ebdf','#eee9dd','#e6ebdc','#ede7d8','#e5e7d8'];
    let body='';
    if (p.genus==='Bryum') {
      body=Array.from({length:9},(_,i)=>`<path d="M${64+i*14} 228Q${49+i*16} 193 ${64+i*14} ${156+(i%3)*11}" fill="none" stroke="#577944" stroke-width="3"/>${svgPath(`M${64+i*14} 210q-18 -7 -13 -20q17 4 13 20q18 -8 14 -22q-17 5 -14 22Z`,'#799653')}`).join('')+`<path d="M93 197Q89 118 105 81M143 200Q153 128 148 98" fill="none" stroke="#846c47" stroke-width="2"/><ellipse cx="108" cy="77" rx="9" ry="15" fill="#a28b50"/><ellipse cx="149" cy="94" rx="8" ry="13" fill="#a28b50"/>`;
    } else if (['Blechnum','Bowenia'].includes(p.genus)) {
      body=[-42,0,42].map(r=>`<g transform="rotate(${r} 120 226)"><path d="M120 226Q111 117 120 36" fill="none" stroke="#4d7349" stroke-width="2"/>${Array.from({length:8},(_,i)=>svgPath(`M119 ${65+i*18}Q${83-i*2} ${49+i*18} ${80-i} ${65+i*18}Q102 ${80+i*18}119 ${65+i*18}Q${153+i*2} ${49+i*18} ${159+i} ${65+i*18}Q138 ${80+i*18}119 ${65+i*18}Z`,i%2?'#779769':'#92a97c')).join('')}</g>`).join('');
    } else if (p.genus==='Bambusa') {
      body=[75,118,161].map((x,i)=>`<path d="M${x} 232L${x+8} ${35+i*12}" stroke="#738958" stroke-width="12"/><path d="M${x-7} 177h16M${x-5} 123h17M${x-2} 70h16" stroke="#3c6444" stroke-width="3"/>${svgPath(`M${x+5} 121Q${x+47} 80 ${x+57} 93Q${x+29} 127 ${x+5} 121Z`)}${svgPath(`M${x+3} 175Q${x-49} 131 ${x-51} 149Q${x-19} 180 ${x+3} 175Z`,'#91a574')}`).join('');
    } else if (p.genus==='Bixa'||p.genus==='Bertholletia') {
      body=`<path d="M122 226L122 40M122 126L76 89M122 166L168 119" stroke="#5d7450" stroke-width="3"/>${svgPath('M120 130Q64 134 76 89Q113 92 120 130Z')}${svgPath('M124 166Q176 171 168 119Q135 126 124 166Z','#91a574')}`;
      if(p.genus==='Bixa')body+=svgPath('M122 43Q81 66 97 105Q124 126 149 101Q160 68 122 43Z','#bb7b58')+Array.from({length:12},(_,i)=>`<path d="M${96+(i%4)*16} ${61+Math.floor(i/4)*17}l-3 -8" stroke="#78543b"/>`).join('');
      else body+=`<circle cx="122" cy="73" r="31" fill="#9c8664" stroke="#645b40" stroke-width="2"/><circle cx="122" cy="72" r="20" fill="none" stroke="#76664c" stroke-dasharray="2 4"/>`;
    } else if (['aloe-vera','ananas-comosus'].includes(p.id)) {
      body = [-63,-40,-20,0,20,40,63].map((r,i)=>svgPath(`M120 213Q${84+i*9} 138 120 ${35+Math.abs(r)*.5}Q${143+i*2} 138 120 213Z`,i%2?'#8ca271':'#647e52',`transform="rotate(${r} 120 213)"`)).join('');
      if (p.id==='ananas-comosus') body+=`<ellipse cx="120" cy="130" rx="29" ry="42" fill="#bd9a4f" stroke="#61744b"/><path d="M98 103L140 153M94 120L131 164M105 95L147 137M143 107L102 158M146 125L114 170M130 92L93 137" fill="none" stroke="#8a7945"/>${svgPath('M120 92L100 49L116 61L120 29L128 62L144 47L120 92','#5d7b49')}`;
    } else if(p.genus==='Allium') {
      body = `<path d="M120 192Q74 112 87 38Q120 115 120 192Q141 94 156 49Q155 133 120 192M120 191Q115 113 119 20Q133 110 120 191" fill="#799266" stroke="#426342" stroke-width="1.2"/>${svgPath('M119 155C110 174 79 179 84 204C87 232 153 231 158 205C164 180 128 171 123 155Z',p.id==='allium-cepa'?'#c79a65':'#e8dfc5')}<path d="M121 165Q102 187 108 222M122 166Q139 187 131 224M108 227L99 237M119 227L120 239M130 227L139 237" fill="none" stroke="#8f8966" stroke-width="1"/>`;
    } else if(p.id==='acorus-calamus') {
      body = [0,1,2,3,4].map((x)=>svgPath(`M${113+x*4} 227Q${63+x*19} 126 ${67+x*25} ${25+(x%2)*15}Q${87+x*17} 132 ${118+x*4} 227Z`,x%2?'#98a16a':'#728451')).join('')+`<path d="M125 216L143 104" stroke="#5e7847" stroke-width="3"/><ellipse cx="148" cy="99" rx="8" ry="26" transform="rotate(25 148 99)" fill="#a3a66b"/>`;
    } else {
      const branch = `<path d="M120 228Q110 139 126 42M118 180L76 141M119 151L166 117M123 108L92 79M125 79L154 56" fill="none" stroke="#456a45" stroke-width="2"/>`;
      const leaves = svgPath('M116 178Q67 187 76 141Q109 139 116 178Z','#8c9e70')+svgPath('M120 151Q171 158 166 117Q130 117 120 151Z','#738e5c')+svgPath('M121 108Q81 117 92 79Q119 82 121 108Z','#8c9e70')+svgPath('M125 79Q161 91 154 56Q131 57 125 79Z','#738e5c');
      body=branch+leaves;
      if(p.id==='achillea-millefolium') body+=Array.from({length:17},(_,i)=>`<circle cx="${92+(i%5)*15}" cy="${34+Math.floor(i/5)*10}" r="7" fill="#f9f4d9" stroke="#b9b895" stroke-width=".8"/>`).join('');
      else if(p.id==='atropa-bella-donna') body+=`<g fill="#464151" stroke="#2d3c37"><circle cx="76" cy="139" r="12"/><circle cx="166" cy="114" r="12"/></g><g fill="#b6b2b7"><circle cx="72" cy="135" r="3"/><circle cx="162" cy="110" r="3"/></g>${svgPath('M122 40Q111 57 115 68Q126 78 137 65Q140 50 129 39Z','#877188')}`;
      else if(p.id==='aconitum-napellus') body+=Array.from({length:5},(_,i)=>svgPath(`M${115+(i%2)*19} ${25+i*23}q-24 2 -18 18q12 -4 23 4q11 -13 -5 -22Z`,['#7b779c','#9992ad'][i%2])).join('');
      else if(p.id==='anacardium-occidentale') body+=svgPath('M125 44Q105 64 111 83Q124 99 140 84Q148 65 125 44Z','#c68a54')+svgPath('M119 91Q108 103 118 109Q136 112 136 98Q129 108 126 95Z','#919068');
      else if(p.id==='arachis-hypogaea') body+=`<g fill="#ddbd67" stroke="#948856"><ellipse cx="124" cy="42" rx="14" ry="8"/><ellipse cx="124" cy="42" rx="7" ry="13"/></g><path d="M70 228Q78 209 85 229Q92 249 78 250Q64 247 70 228ZM92 234Q98 214 106 232Q120 251 102 255Q88 253 92 234Z" fill="#c5a176" stroke="#9c835c"/>`;
      else body+=Array.from({length:12},(_,i)=>`<circle cx="${101+(i%4)*12}" cy="${27+Math.floor(i/4)*14}" r="4" fill="${p.id==='artemisia-annua'?'#c9bb64':'#b6b98b'}" stroke="#8a9464" stroke-width=".7"/>`).join('');
    }
    return `<div class="plant-art" style="--art-bg:${colors[index%colors.length]}"><span class="art-index">ESTUDO ${String(index+1).padStart(2,'0')}</span><svg viewBox="0 0 240 260" aria-hidden="true"><ellipse cx="122" cy="241" rx="57" ry="5" fill="#6c7b5020"/>${body}</svg><span class="art-type">ILUSTRAÇÃO EDITORIAL · NÃO DIAGNÓSTICA</span></div>`;
  }
  function card(p) {
    const index=plants.indexOf(p);
    return `<article class="plant-card"><div style="position:relative">${artwork(p,index)}<button class="save-button ${saved(p.id)?'saved':''}" data-save="${esc(p.id)}" aria-pressed="${saved(p.id)}" aria-label="${saved(p.id)?'Remover dos':'Adicionar aos'} favoritos: ${esc(p.commonName)}">${saved(p.id)?'♥':'♡'}</button></div><div class="plant-body"><div class="family-label">${esc(p.family)} · ${esc(p.education.classification.clade)}</div><h3>${esc(p.commonName.split(' · ')[0])}</h3><p class="scientific">${scientific(p)}</p><p class="plant-description">${esc(p.cardSummary || p.habit)}</p>${pills(p)}<div class="card-bottom"><span>${p.sources.length} fontes vinculadas</span><button class="open-profile" data-open="${esc(p.id)}" aria-label="Ver perfil de ${esc(p.commonName)}">Ver perfil ↗</button></div></div></article>`;
  }
  function renderCards() {
    const clade=$('#clade-filter').value, letter=$('#letter-filter').value, group=$('#group-filter').value;
    const query=normalize($('#search').value.trim()), family=$('#family-filter').value, risk=$('#risk-filter').value, evidence=$('#evidence-filter').value;
    const found=plants.filter(p=>(!letter||p.genus.startsWith(letter))&&(!group||p.education.classification.majorGroup===group)&&(!query||normalize([p.commonName,p.scientificName,p.author,p.family,p.habit,p.description,...p.tags,p.education.classification.clade,p.education.classification.order,p.education.morphology.reserveOrgan].join(' ')).includes(query))&&(!clade||p.education.classification.clade===clade)&&(!family||p.family===family)&&(!risk||p.risk.level===risk)&&(!evidence||p.medicinal.evidence===evidence));
    $('#plant-grid').innerHTML=found.map(card).join('');
    $('#results-count').textContent=`${found.length} de ${plants.length} espécies · ordem por nome científico`;
    $('#empty-results').hidden=found.length>0;
    $('#clear-filters').hidden=!(query||letter||group||clade||family||risk||evidence);
  }
  function resetFilters() { $('#search').value=''; for(const sel of ['#letter-filter','#group-filter','#clade-filter','#family-filter','#risk-filter','#evidence-filter'])$(sel).value='';renderCards(); }
  function refs(p, group) { return `<div class="refs">Fontes: ${p.sourceRefs[group].map(id=>{const s=p.sources.find(x=>x.id===id);return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title.split(' — ')[0])} ↗</a>`;}).join('')}</div>`; }
  function recordsHtml(records=[]) { return records.map(n=>`<div class="notebook-record"><small>${esc(new Date(n.date).toLocaleString('pt-BR',{timeZone:'America/Fortaleza',dateStyle:'medium',timeStyle:'short'}))}</small><p>${esc(n.text)}</p></div>`).join(''); }
  const emergency = `<div class="medical-note"><strong>Suspeita de intoxicação?</strong> Procure orientação de um CIATox; em emergência, ligue <a href="tel:192">192 (SAMU)</a>. Disque-Intoxicação: <a href="tel:08007226001">0800 722 6001</a>. Consulte também os contatos regionais no <a href="https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/animais-peconhentos/ciatox" target="_blank" rel="noopener noreferrer">Ministério da Saúde ↗</a>. <a href="https://www.gov.br/saude/pt-br/composicao/saes/samu-192" target="_blank" rel="noopener noreferrer">Sobre o SAMU ↗</a></div>`;
  function profile(p) {
    const c=p.education.classification, groupName=catalog.education.groups.find(g=>g.id===c.majorGroup)?.name||c.majorGroup;
    const tax = [['Reino',c.kingdom],['Grupo',groupName],...(c.division?[['Divisão',c.division]]:[]),...(c.class?[['Classe',c.class]]:[]),['Linhagem',c.clade],['Ordem',p.education.classification.order],['Família',p.family],['Gênero',p.genus],['Epíteto específico',p.epithet],['Espécie',p.scientificName],['Autoria botânica',p.author]];
    return `<div class="profile-header">${artwork(p,plants.indexOf(p))}<div><div class="family-label">${esc(p.family)} · ${esc(p.habit)}</div><h2 id="dialog-title">${esc(p.commonName)}</h2><p class="scientific">${scientific(p)}</p><p>${esc(p.description)}</p>${pills(p)}<button class="button secondary" data-save="${esc(p.id)}" aria-pressed="${saved(p.id)}">${saved(p.id)?'♥ Perfil salvo':'♡ Salvar no meu caderno'}</button></div></div><div class="profile-body"><div class="profile-tabs" role="tablist" aria-label="Seções do perfil">${[['botanica','Botânica'],['aprofundar','Ciclos & funções'],['pesquisa','Pesquisa & riscos'],['notas','Anotações'],['referencias','Fontes']].map(([id,title],i)=>`<button id="tab-${id}" role="tab" aria-selected="${i===0}" aria-controls="panel-${id}" tabindex="${i===0?0:-1}" data-tab="${id}">${title}</button>`).join('')}</div><section id="panel-botanica" class="profile-panel" role="tabpanel" aria-labelledby="tab-botanica" tabindex="0"><dl class="taxonomy">${tax.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}<div class="full"><dt>Subespécie / detalhe infraespecífico</dt><dd>${esc(p.subspecies)}</dd></div><div class="full"><dt>Origem & distribuição</dt><dd>${esc(p.origin)}</dd></div></dl><h3>O que observar</h3><ul>${p.characteristics.map(c=>`<li>${esc(c)}</li>`).join('')}</ul><h3>Habitat & relações</h3><p>${esc(p.ecology)}</p><h3>Conservação</h3><p>${esc(p.conservation)}</p>${refs(p,'taxonomy')}<p class="subtle-note">Perfil de espécie. Ilustração editorial e descrição geral não identificam um exemplar com segurança.</p></section><section id="panel-aprofundar" class="profile-panel" role="tabpanel" aria-labelledby="tab-aprofundar" tabindex="0" hidden>${window.AtlasStudy.profile(p)}</section><section id="panel-pesquisa" class="profile-panel" role="tabpanel" aria-labelledby="tab-pesquisa" tabindex="0" hidden><h3>Potencial medicinal estudado</h3><p>${esc(p.medicinal.summary)}</p><div class="medical-note"><strong>${esc(labels[p.medicinal.evidence])}</strong><br>${esc(p.medicinal.limits)}</div>${p.medicinal.evidence==='clinica-especifica'?'<p class="subtle-note">¹ O rótulo pertence à preparação e indicação descritas, sem comprovar benefício do consumo da planta.</p>':''}${refs(p,'medicinal')}<h3>Psicoatividade & dependência</h3><p>${esc(p.psychoactive.summary)}</p><p><strong>Dependência:</strong> ${esc(p.psychoactive.dependence)}</p><h3>Amadeus · amor e conexão</h3><p>${esc(p.amadeusAssessment.summary)}</p><p class="subtle-note">Conceito autoral de Aldenir. <a href="#metodo">Conheça a definição e o método de estudo ↗</a></p><div class="risk-banner ${p.risk.level==='critico'?'critical':''}"><strong>${esc(riskLabels[p.risk.level])} · contexto da exposição</strong><p>${esc(p.risk.summary)}</p></div><h3>Manifestações e sinais de alerta</h3><p>${esc(p.risk.symptoms)}</p><h3>Interações & lacunas</h3><p>${esc(p.risk.interactions)}</p>${refs(p,'risk')}<p class="attention-help">A etiqueta de atenção é editorial e depende da preparação e da exposição. Não estima risco individual nem determina segurança alimentar.</p>${emergency}</section><section id="panel-notas" class="profile-panel" role="tabpanel" aria-labelledby="tab-notas" tabindex="0" hidden><h3>Seu registro de estudo</h3><p>Registre perguntas, características a conferir e temas para pesquisar. Identificações de exemplares permanecem pendentes de validação.</p><form class="note-form" id="note-form"><label for="note-text">Anotação sobre ${esc(p.commonName)}</label><textarea id="note-text" maxlength="4000" required placeholder="O que quero observar ou investigar nesta espécie?"></textarea><div class="form-foot"><small>Evite dados pessoais e localização precisa de espécies.<br>${persistent?'Salvo neste navegador. Exporte um backup.':'Armazenamento indisponível; exporte antes de fechar.'}</small><button class="button primary" type="submit">Salvar anotação</button></div></form><div id="plant-notes">${recordsHtml(notebook.notes[p.id])}</div></section><section id="panel-referencias" class="profile-panel" role="tabpanel" aria-labelledby="tab-referencias" tabindex="0" hidden><h3>Confira a origem da informação</h3><p>Taxonomia, estudos e riscos têm referências distintas. Consulta editorial: 20/10/2026. Revisão especializada pendente.</p><ul class="profile-source-list">${p.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><small>${esc(s.scope)}</small></li>`).join('')}</ul></section></div>`;
  }
  function selectTab(name) {
    for(const tab of document.querySelectorAll('[data-tab]')) {const active=tab.dataset.tab===name;tab.setAttribute('aria-selected',active);tab.tabIndex=active?0:-1;}
    for(const pane of document.querySelectorAll('.profile-panel'))pane.hidden=pane.id!==`panel-${name}`;
  }
  function openProfile(id) {const p=byId.get(id);if(!p)return;activePlant=id;previousProfile=id;previousFocus=document.activeElement;$('#dialog-content').innerHTML=profile(p);$('#plant-dialog').showModal();$('#plant-dialog').scrollTop=0;}
  async function toggleSaved(id) {
    if(!byId.has(id))return;
    notebook=AtlasNotebook.setFavorite(notebook,id,!saved(id));await persist();
    const focus=document.activeElement?.dataset.save===id;
    if(location.hash==='#caderno'&&!$('#plant-dialog').open)renderNotebook();
    for(const btn of document.querySelectorAll(`[data-save="${id}"]`)) {btn.setAttribute('aria-pressed',saved(id));if(btn.classList.contains('save-button')){btn.classList.toggle('saved',saved(id));btn.textContent=saved(id)?'♥':'♡';btn.setAttribute('aria-label',`${saved(id)?'Remover dos':'Adicionar aos'} favoritos: ${byId.get(id).commonName}`);}else btn.textContent=saved(id)?'♥ Perfil salvo':'♡ Salvar no meu caderno';}
    if(focus&&!$('#plant-dialog').open)document.querySelector(`[data-save="${id}"]`)?.focus();
    if(persistent)notify(saved(id)?'Perfil salvo no seu caderno.':'Perfil removido dos favoritos. Anotações preservadas.');
  }
  function renderNotebook() {
    const ids=plants.filter(p=>saved(p.id)||(notebook.notes[p.id]?.length));
    if(!ids.length){$('#notebook-content').innerHTML='<div class="empty-state"><span>❧</span><h3>Seu caderno está pronto para começar.</h3><p>Toque no coração de uma planta para guardar o perfil ou adicione uma anotação.</p><a class="button secondary" href="#catalogo">Explorar plantas</a></div>';return;}
    const total=Object.values(notebook.notes).reduce((n,arr)=>n+arr.length,0), favCount=notebook.favorites.length;
    $('#notebook-content').innerHTML=`<p class="notebook-count">${favCount} ${favCount===1?'favorito':'favoritos'} · ${total} ${total===1?'anotação':'anotações'}</p>${ids.map(p=>`<article class="notebook-entry"><div class="family-label">${esc(p.family)} ${saved(p.id)?'· ♥ FAVORITO':''}</div><h2>${esc(p.commonName)}</h2><p>${scientific(p)}</p>${recordsHtml(notebook.notes[p.id])}<button class="button secondary" data-open="${p.id}">Abrir perfil & anotar ↗</button></article>`).join('')}`;
  }
  function renderSources() {
    $('#sources-content').innerHTML=plants.map(p=>`<article class="sources-group"><h2>${esc(p.commonName)}</h2><p class="scientific">${scientific(p)}</p><ul>${p.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><span class="source-scope">${esc(s.scope)}</span></li>`).join('')}</ul></article>`).join('');
    $('#sources-content').insertAdjacentHTML('beforeend',`<article class="sources-group"><h2>Academia · fontes educacionais</h2><ul>${catalog.education.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><span class="source-scope">${esc(s.scope)}</span></li>`).join('')}</ul></article>`);
    $('#sources-content').insertAdjacentHTML('beforeend',`<article class="sources-group"><h2>Amadeus · métodos de pesquisa</h2><p class="muted">${esc(catalog.glossary.amadeus.referenceLimit)}</p><ul>${catalog.glossary.amadeus.references.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a></li>`).join('')}</ul></article>`);
  }
  const viewNames={catalogo:'Plantas · A e B',caderno:'Meu caderno',metodo:'Como estudamos',fontes:'Biblioteca de fontes',estudo:'Academia de botânica',comparar:'Comparar grupos',ciclos:'Ciclos & reprodução',questoes:'Questões comentadas',provas:'ENEM & UFC/CCV',fisiologia:'Fisiologia viva'};
  function navigate() {
    const raw=location.hash.slice(1), legacy={animais:'https://aldenirfilho.github.io/atlas-vivo-360x-animais/',rochas:'https://aldenirfilho.github.io/atlas-vivo-360x-rochas/'};
    if(Object.hasOwn(legacy,raw)){location.replace(legacy[raw]);return;}
    const name=Object.hasOwn(viewNames,raw)?raw:'catalogo';
    if($('#plant-dialog').open)$('#plant-dialog').close();
    for(const section of document.querySelectorAll('.view'))section.hidden=section.id!==`view-${name}`;
    for(const link of document.querySelectorAll('[data-view]')){link.classList.toggle('active',link.dataset.view===name);if(link.dataset.view===name)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
    $('#breadcrumb-current').textContent=viewNames[name];document.title=`${viewNames[name]} · Atlas Vivo 360X`;
    if(name==='caderno')renderNotebook();
    if(['estudo','comparar','ciclos','questoes','provas','fisiologia'].includes(name))window.AtlasStudy.render(name);
    window.scrollTo(0,0);
    if(focusSearchAfterNavigation){focusSearchAfterNavigation=false;$('#search').focus();}
  }
  function download(name,value) {
    const blob=new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'}), url=URL.createObjectURL(blob), anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Arquivo preparado para download. Confira o destino no navegador.');
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('.skip-link')){event.preventDefault();$('#main').focus();$('#main').scrollIntoView({block:'start'});return;}
    const save=event.target.closest('[data-save]');if(save){toggleSaved(save.dataset.save);return;}
    const open=event.target.closest('[data-open]');if(open){openProfile(open.dataset.open);return;}
    const tab=event.target.closest('[data-tab]');if(tab){selectTab(tab.dataset.tab);return;}
    const template=event.target.closest('[data-template]');if(template)download(`atlas-modelo-${template.dataset.template}.json`,{schemaVersion:1,module:template.dataset.template,status:'modelo-sem-registros',name:'',classification:{},description:'',sources:[],review:{status:'pendente',reviewer:null},media:[],sensitiveLocation:'Não incluir coordenadas em versões compartilháveis'});
  });
  document.addEventListener('submit',async event=>{
    if(event.target.id!=='note-form')return;event.preventDefault();const text=$('#note-text').value.trim();if(!text){$('#note-text').focus();return;}
    const total=Object.values(notebook.notes).reduce((n,arr)=>n+arr.length,0);if(total>=500){notify('Limite de 500 registros nesta versão. Exporte seu caderno para preservar o acervo.');return;}
    const species=activePlant;notebook.notes[species]??=[];notebook.notes[species].push({id:globalThis.crypto?.randomUUID?.()||`note-${Date.now()}-${Math.random().toString(36).slice(2)}`,date:new Date().toISOString(),text});await persist();if(activePlant===species){$('#plant-notes').innerHTML=recordsHtml(notebook.notes[species]);$('#note-text').value='';}if(location.hash==='#caderno'&&!$('#plant-dialog').open)renderNotebook();if(persistent)notify('Anotação salva neste navegador.');
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='/'&&!$('#plant-dialog').open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();if(location.hash==='#catalogo'||!location.hash)$('#search').focus();else{focusSearchAfterNavigation=true;location.hash='catalogo';}}
    const tab=event.target.closest('[data-tab]');if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const tabs=[...document.querySelectorAll('[data-tab]')],i=tabs.indexOf(tab),n=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;selectTab(tabs[n].dataset.tab);tabs[n].focus();}
  });
  $('#close-dialog').addEventListener('click',()=>$('#plant-dialog').close());
  $('#plant-dialog').addEventListener('close',()=>{if(location.hash==='#caderno')renderNotebook();const view=[...document.querySelectorAll('.view')].find(v=>!v.hidden),opener=view?.querySelector(`[data-open="${previousProfile}"]`);if(opener)opener.focus();else if(previousFocus?.isConnected)previousFocus.focus();activePlant=null;});
  $('#plant-dialog').addEventListener('click',e=>{if(e.target===$('#plant-dialog')){const rect=e.target.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)e.target.close();}});
  $('#search').addEventListener('input',renderCards);for(const sel of ['#letter-filter','#group-filter','#clade-filter','#family-filter','#risk-filter','#evidence-filter'])$(sel).addEventListener('change',renderCards);
  $('#clear-filters').addEventListener('click',resetFilters);$('#empty-clear').addEventListener('click',resetFilters);
  $('#export-notebook').addEventListener('click',()=>download(`atlas-caderno-${new Date().toISOString().slice(0,10)}.json`,{...notebook,app:'Atlas Vivo 360X',exportedAt:new Date().toISOString()}));
  $('#export-recovery').addEventListener('click',()=>{if(recoveryRaw===null)return;const url=URL.createObjectURL(new Blob([recoveryRaw],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='atlas-dados-anteriores-recuperacao.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('#export-catalog').addEventListener('click',()=>download(`atlas-vivo-catalogo-v${catalog.version}.json`,catalog));
  $('#export-sources').addEventListener('click',()=>download(`atlas-vivo-fontes-v${catalog.version}.json`,{version:catalog.version,checkedAt:catalog.checkedAt,methodReferences:catalog.glossary.amadeus.references,educationReferences:catalog.education.sources,sources:plants.map(p=>({id:p.id,scientificName:p.scientificName,sources:p.sources}))}));
  $('#import-notebook').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>10*1024*1024)throw new Error('Arquivo maior que 10 MB.');const incoming=AtlasNotebook.validateBackup(JSON.parse(await file.text()),[...byId.keys()]);const merged=AtlasNotebook.merge(notebook,incoming);const total=Object.values(merged.notes).reduce((n,arr)=>n+arr.length,0);if(total>500)throw new Error('O backup somado ao caderno excede 500 registros; nenhum dado foi alterado.');notebook=merged;await persist();renderNotebook();renderCards();if(persistent)notify('Backup incorporado. Anotações preservadas; favoritos conciliados pela marcação mais recente.');}
    catch(error){notify(`Não foi possível importar: ${error instanceof SyntaxError?'JSON inválido.':error.message}`);}finally{e.target.value='';}
  });
  for(const [selector,values] of [['#clade-filter',plants.map(p=>p.education.classification.clade)],['#group-filter',plants.map(p=>p.education.classification.majorGroup)]])$(selector).insertAdjacentHTML('beforeend',[...new Set(values)].sort().map(value=>`<option value="${esc(value)}">${esc(selector==='#group-filter'?(catalog.education.groups.find(g=>g.id===value)?.name||value):value)}</option>`).join(''));
  $('#family-filter').insertAdjacentHTML('beforeend',[...new Set(plants.map(p=>p.family))].sort().map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join(''));
  $('#letter-filter').value='B';$('#hero-count').textContent=plants.length;$('#nav-count').textContent=plants.length;$('#saved-count').textContent=notebook.favorites.length;
  renderCards();renderSources();navigate();window.addEventListener('hashchange',navigate);
  window.addEventListener('storage',event=>{if(event.key!==storageKey||!event.newValue)return;try{const incoming=AtlasNotebook.validateBackup(JSON.parse(event.newValue),[...byId.keys()]);notebook=AtlasNotebook.validateBackup(AtlasNotebook.merge(notebook,incoming),[...byId.keys()]);$('#saved-count').textContent=notebook.favorites.length;renderCards();if(location.hash==='#caderno')renderNotebook();if(activePlant)$('#plant-notes').innerHTML=recordsHtml(notebook.notes[activePlant]);}catch{notify('Dados de outra aba não puderam ser lidos. Os registros desta sessão foram preservados.');}});
  $('#export-recovery').hidden=recoveryRaw===null;
  if(!persistent)notify('Não foi possível ler o armazenamento local. Exporte novos registros antes de fechar esta sessão.');
})();

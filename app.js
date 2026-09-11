(() => {
  'use strict';
  const chapters=window.HANDBOOK||[], $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today=()=>dateKey(new Date()), KEY='cs2-fieldnotes-v1';
  const blank=()=>({version:1,days:{},read:[],bookmarks:[],checks:{},weeks:[],logs:[],lastChapter:'01'});
  const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));
  const chapterIDs=new Set(chapters.map(c=>c.id));
  let state=blank(),storageOK=true,warning='';
  function validate(data){
    if(!data||data.version!==1||!data.days||typeof data.days!=='object'||Array.isArray(data.days)||!Array.isArray(data.logs))throw Error('不是有效的训练备份');
    const s=blank();
    for(const [date,d] of Object.entries(data.days)){
      if(!validDate(date)||!d||!Array.isArray(d.tasks)||d.tasks.some(t=>!Number.isInteger(t)||t<0||t>5)||typeof d.focus!=='string'||d.focus.length>300)throw Error('每日记录格式不正确');
      s.days[date]={tasks:[...new Set(d.tasks)],focus:d.focus};
    }
    for(const name of ['read','bookmarks']){if(!Array.isArray(data[name])||data[name].some(id=>!chapterIDs.has(id)))throw Error('章节记录格式不正确');s[name]=[...new Set(data[name])];}
    if(!Array.isArray(data.weeks)||data.weeks.some(n=>!Number.isInteger(n)||n<1||n>8))throw Error('周计划格式不正确');
    s.weeks=[...new Set(data.weeks)];
    if(!data.checks||typeof data.checks!=='object'||Array.isArray(data.checks))throw Error('清单格式不正确');
    for(const [k,v] of Object.entries(data.checks)){if(!/^\d{2}-\d+$/.test(k)||typeof v!=='boolean')throw Error('清单格式不正确');s.checks[k]=v;}
    if(data.logs.length>10000)throw Error('日志数量超出限制');
    const ids=new Set();
    for(const log of data.logs){
      if(!log||typeof log.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(log.id)||ids.has(log.id)||!validDate(log.date))throw Error('日志编号或日期不正确');
      ids.add(log.id);const record={id:log.id,date:log.date};
      for(const k of ['map','side','category','context','lesson','next']){if(typeof log[k]!=='string'||log[k].length>12000)throw Error('日志内容格式不正确');record[k]=log[k];}
      s.logs.push(record);
    }
    s.lastChapter=chapterIDs.has(data.lastChapter)?data.lastChapter:'01';return s;
  }
  try{const raw=localStorage.getItem(KEY);if(raw)state=validate(JSON.parse(raw));}catch{storageOK=false;warning='浏览器中的记录暂时无法读取，当前修改不会覆盖原记录。请先导出备份，或导入有效备份。';}
  let toastTimeout;
  function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
  function save(){if(!storageOK){toast('当前为临时记录，请导出备份保存。');return false;}try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{storageOK=false;warning='浏览器无法保存记录，修改仅在本次页面中有效。请立即导出备份。';toast(warning);return false;}}
  const day=()=>state.days[today()]||(state.days[today()]={tasks:[],focus:''});
  const tasks=[['基础动作','急停 → 单发 → 小幅修正','8 分钟','02'],['当日专项','压枪、AWP、清点，选择一项','10 分钟','05'],['地图与道具','复习旧点，最多新增 1～2 颗','10 分钟','07'],['死斗应用','只关注一个动作，不追求排名','7 分钟','03'],['正式实战','带着今天的目标完成一场比赛','1 场','09'],['回合复盘','回看 3～5 回合，写下一条改法','10 分钟','14']];
  const weeks=[
    ['打好第一枪的基础','设置、A/D 急停与地图报点',['固定灵敏度与两张主练地图','分解 A/D 急停，左右各 20 次','认识主要报点，完成能力基线记录'],'能明确说出按键顺序，听懂主要报点。','02'],
    ['让准星提前到位','预瞄、短点射与基础压枪',['沿一条进点路线逐角预瞄','AK / M4 分别练前 10 发','抽查移动开枪与低头的问题'],'固定 40 次急停单发争取命中 32 次。','03'],
    ['让每颗道具有目的','核心道具与掩体清点',['每张地图建立 8 颗道具卡','检查烟缝、闪光与队友行动','用掩体逐步隔离多条枪线'],'核心投掷 10 次至少成功 9 次，并能解释用途。','07'],
    ['从单打走向配合','补枪、进点职责与统一购买',['约定第一、第二身位清点方向','回看有机会却没补上的场景','每回合先看队伍购买意图'],'完成明确协同，能解释配合失败的原因。','12'],
    ['守得住，也退得出','CT 轮转与 AWP 基础',['为常用防守位写好退路','按信息强弱决定支援方式','练习狙击射后回掩体'],'能说明何时轮转；空枪后不在原地等待。','05'],
    ['用信息决定下一步','T 中期、下包与守包',['盘点人数、时间与区域控制','下包位置与后续枪线关联','人数优势时保持相互支援'],'决定能关联人数、时间、包位与资源。','09'],
    ['把残局拆成小任务','1v1、1v2 与回防计时',['完成 5 个录像暂停决策题','区分阵营及下包前后的目标','练习隔离枪线与拆包时间估算'],'能比较两个可行选项，识别时间不足的局面。','11'],
    ['复测，让进步可见','集中修正两个高频问题',['用同条件重复第一周基线','统计两类错误是否减少','制定下一轮的唯一主目标'],'找到已改善的能力与仍需保留的训练。','14']
  ];
  let route='',filter='全部',query='',editing=null,logFilter='全部';
  let remaining=480,total=480,timerEnd=null,timerInterval=null;
  const heading=(eye,title,sub,extra='')=>`<div class="page-heading"><div><p class="eyebrow">${eye}</p><h1>${title}</h1><p class="muted">${sub}</p></div>${extra}</div>`;
  function dashboard(){
    const dates=Object.values(state.days).filter(d=>d.tasks.length).length,current=weeks.findIndex((_,i)=>!state.weeks.includes(i+1));
    const heat=[];for(let i=20;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=dateKey(d),n=state.days[key]?.tasks.length||0;heat.push(`<span class="heat-cell ${n?'on':''}" title="${key}：${n} 项" aria-label="${key}完成${n}项"></span>`);}
    return heading('PRACTICE WITH PURPOSE','练得有章法，打得有思路<span class="accent">。</span>','先完成今天的一小步，再把它带进下一场比赛。',`<span class="date-badge">${new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date())}</span>`)+
    `<section class="focus-card"><div><span class="pill">TODAY'S FOCUS</span><h2>停稳，再打出第一枪。</h2><p>动作越稳定，越有余力思考下一步。</p><a class="primary" href="#chapter/${state.lastChapter}">继续学习 · 第 ${Number(state.lastChapter)} 章 ↗</a><div class="focus-editor"><label for="daily-focus">今天只专注一件事</label><input id="daily-focus" class="focus-input" maxlength="300" value="${esc(day().focus)}" placeholder="例如：每次出角，停稳后再开枪"></div></div><div class="key-diagram" aria-label="向右移动、反向制动、停稳开枪"><kbd>D</kbd><span>→</span><kbd>A</kbd><span>→</span><span class="crosshair">⊕</span><small>横向移动 / 反向制动 / 准确射击</small></div></section>
    <section class="stats" aria-label="学习统计">${[[dates,'天','累计训练','▦'],[state.read.length,'/ 17','已学章节','▤'],[state.logs.length,'篇','复盘记录','✎']].map(s=>`<div class="stat"><div><strong>${s[0]}<span> ${s[1]}</span></strong><span>${s[2]}</span></div><span class="stat-symbol">${s[3]}</span></div>`).join('')}</section>
    <div class="two-col"><section class="panel"><div class="section-head"><h2>今天的训练</h2><span class="tiny">${day().tasks.length} / 6 已完成</span></div>${tasks.map((t,i)=>`<div class="task-row ${day().tasks.includes(i)?'done':''}"><label><input type="checkbox" data-task="${i}" ${day().tasks.includes(i)?'checked':''}><span><strong>${t[0]}</strong><small>${t[1]}</small></span></label><span class="minutes">${t[2]}</span><a href="#chapter/${t[3]}" aria-label="学习${t[0]}" class="text-button">↗</a></div>`).join('')}<div class="track" role="progressbar" aria-label="今日训练完成度" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${day().tasks.length}"><span style="width:${day().tasks.length/6*100}%"></span></div></section>
    <aside><section class="panel"><div class="section-head"><h2>${current<0?'八周训练已完成':`第 ${String(current+1).padStart(2,'0')} 周`}</h2><a class="text-button" href="#plan">查看计划 ↗</a></div><p class="muted">${current<0?'回看基线，为下一轮选一个重点。':weeks[current][1]}</p><span class="tiny">最近 21 天 · 完成任一训练即点亮</span><div class="heatmap">${heat.join('')}</div><div class="timer"><label for="timer-length" class="tiny">专注一个动作</label><select id="timer-length" aria-label="训练计时时长" class="chip">${[[480,'8 分钟 · 基础'],[600,'10 分钟 · 专项'],[1200,'20 分钟 · 打狙']].map(t=>`<option value="${t[0]}" ${total===t[0]?'selected':''}>${t[1]}</option>`).join('')}</select><div class="timer-display" id="timer-display">${formatTime(remaining)}</div><div class="timer-actions"><button id="timer-toggle" class="primary">${timerEnd?'暂停计时':'开始计时'}</button><button id="timer-reset" class="secondary">重置</button></div></div></section></aside></div>
    <div class="section-head"><h2>高频技巧，随手查阅</h2><a href="#library" class="text-button">全部 17 章 ↗</a></div><div class="quick-links">${[['02','如何正确急停','按键顺序 · 出枪时机 · 常见纠错'],['05','把 AWP 打得更稳','架点选择 · 空枪撤退 · 回防处理'],['11','残局先做哪一步','1v1 / 1v2 · 守包与拆包 · 时间判断']].map(c=>`<a class="quick-link" href="#chapter/${c[0]}"><span class="num">FIELD GUIDE / ${c[0]}</span><strong>${c[1]} ↗</strong><p>${c[2]}</p></a>`).join('')}</div>`;
  }
  const matches=()=>chapters.filter(c=>(filter==='全部'||(filter==='我的收藏'?state.bookmarks.includes(c.id):c.category===filter))&&(!query.trim()||`${c.title} ${c.text}`.toLowerCase().includes(query.trim().toLowerCase())));
  function cards(){const list=matches();return list.length?list.map(c=>`<a class="chapter-card" href="#chapter/${c.id}"><div class="card-meta"><span class="num">CHAPTER ${c.id}</span><span>${c.category} · ${c.minutes} 分钟</span></div><h2>${esc(c.title)}</h2><p>${esc(c.description)}</p><div class="card-footer"><span>${state.read.includes(c.id)?'✓ 已学完':state.bookmarks.includes(c.id)?'☆ 已收藏':'开始阅读'}</span><span>↗</span></div></a>`).join(''):'<div class="empty"><strong>没有找到匹配章节</strong>试试“急停”“空枪”“拆包”，或切换分类。</div>';}
  function library(){return heading('THE FIELD GUIDE','学习手册','17 章完整内容。先理解，再练习，需要时随时回来查。')+`<div class="search-wrap"><input id="chapter-search" class="search-input" type="search" placeholder="搜索章节与全文内容，例如：急停、残局、打狙…" aria-label="搜索训练手册" value="${esc(query)}"></div><div class="filter-bar" aria-label="章节分类">${['全部','基础','枪法','道具','地图','战术','训练','资料','我的收藏'].map(f=>`<button class="chip ${filter===f?'active':''}" data-filter="${f}" aria-pressed="${filter===f}">${f}</button>`).join('')}</div><p id="result-count" class="tiny" aria-live="polite">共 ${matches().length} 章</p><div class="library-grid" id="chapter-grid">${cards()}</div>`;}
  function reader(id){
    const c=chapters.find(c=>c.id===id);if(!c)return '<div class="empty"><strong>未找到章节</strong><a href="#library">返回学习手册 →</a></div>';
    state.lastChapter=id;save();const i=chapters.indexOf(c);
    return `<div class="reader-toolbar"><a href="#library" class="text-button">← 返回学习手册</a><button class="secondary" id="bookmark" data-id="${id}" aria-pressed="${state.bookmarks.includes(id)}">${state.bookmarks.includes(id)?'★ 已收藏':'☆ 收藏章节'}</button><button class="secondary" id="mark-read" data-id="${id}" aria-pressed="${state.read.includes(id)}">${state.read.includes(id)?'✓ 已学完':'标记为已学完'}</button><button class="secondary" id="print-chapter">打印</button></div><div class="reader-layout"><div><p class="eyebrow">CHAPTER ${id} / ${c.category} / 约 ${c.minutes} 分钟</p><article class="prose">${c.html}</article><div class="reader-next">${i?`<a class="secondary" href="#chapter/${chapters[i-1].id}">← 上一章</a>`:'<span></span>'}${i<chapters.length-1?`<a class="primary" href="#chapter/${chapters[i+1].id}">下一章 →</a>`:'<a class="primary" href="#dashboard">回到训练台 →</a>'}</div></div><aside class="reader-toc"><p class="eyebrow">本章导航</p>${c.headings.map(h=>`<a href="#chapter/${id}/${h.id}">${esc(h.title)}</a>`).join('')}</aside></div>`;
  }
  function plan(){const current=weeks.findIndex((_,i)=>!state.weeks.includes(i+1));return heading('EIGHT WEEKS, ONE FOUNDATION','八周进阶计划','每周一个重点。未达标就延长练习，稳定比赶进度更重要。',`<span class="date-badge">${state.weeks.length} / 8 周已完成</span>`)+`<div class="note">每周建议 4 天专项与实战、1 天重点复盘，其余时间休息或轻松玩。下方验收是自测目标，不是官方段位标准。</div><div class="week-grid">${weeks.map((w,i)=>`<section class="week-card ${current===i?'current':''} ${state.weeks.includes(i+1)?'completed':''}"><div class="week-top"><span class="week-number">WEEK ${String(i+1).padStart(2,'0')}</span><span class="tiny">${state.weeks.includes(i+1)?'✓ 已完成':current===i?'当前阶段':'待训练'}</span></div><h2>${w[0]}</h2><p>${w[1]}</p><ul>${w[2].map(t=>`<li>${t}</li>`).join('')}</ul><p><strong>验收：</strong>${w[3]}</p><a class="text-button" href="#chapter/${w[4]}">阅读相关训练方法 ↗</a><button class="${state.weeks.includes(i+1)?'secondary':'primary'}" data-week="${i+1}" aria-pressed="${state.weeks.includes(i+1)}">${state.weeks.includes(i+1)?'✓ 已完成 · 点击继续练习':'已达到验收，完成本周'}</button></section>`).join('')}</div>`;}
  const categories=['动作','预瞄','身位','信息','决策','配合','资源'];
  function journal(){const r=state.logs.find(l=>l.id===editing),v=k=>esc(r?.[k]??'');return heading('REVIEW. ADJUST. REPEAT.','把一场比赛，变成一次进步。','只用当时已知的信息评价决定，每次找出一个具体改法。')+`<div class="journal-grid"><section class="panel"><div class="section-head"><h2>${r?'编辑复盘':'记录一个关键回合'}</h2><span class="tiny">保存在此浏览器</span></div><form id="log-form"><div class="field-grid"><label class="field">日期<input type="date" name="date" required value="${r?.date||today()}"></label><label class="field">地图<input name="map" required maxlength="80" placeholder="例如 Mirage / 荒漠迷城" value="${v('map')}"></label><label class="field">阵营<select name="side"><option ${r?.side==='T'?'selected':''}>T</option><option ${r?.side==='CT'?'selected':''}>CT</option></select></label><label class="field">主要问题<select name="category">${categories.map(c=>`<option ${r?.category===c?'selected':''}>${c}</option>`).join('')}</select></label><label class="field full">当时发生了什么？<textarea name="context" required maxlength="12000" placeholder="人数、时间、包的位置、已知信息，以及我的动作…">${v('context')}</textarea></label><label class="field full">更合理的动作是什么？<textarea name="lesson" required maxlength="12000" placeholder="例如：先用烟隔离远线，再处理近点。">${v('lesson')}</textarea></label><label class="field full">下一场唯一重点<input name="next" required maxlength="500" placeholder="写一个能执行的动作，而不是“提高意识”" value="${v('next')}"></label></div><div class="form-buttons"><button class="primary" type="submit">${r?'保存修改':'保存这次复盘'} ↗</button>${r?'<button class="secondary" type="button" id="cancel-edit">取消编辑</button>':''}</div><p class="status-text" id="form-status" aria-live="polite"></p></form></section><section><div class="section-head"><h2>复盘记录 <span class="tiny">${state.logs.length} 篇</span></h2><button class="text-button" id="journal-backup">导出 / 导入 ↗</button></div><div class="journal-tools"><select id="log-filter" aria-label="按主要问题筛选日志">${['全部',...categories].map(c=>`<option ${logFilter===c?'selected':''}>${c}</option>`).join('')}</select></div><div id="log-list">${logCards()}</div></section></div>`;}
  function logCards(){const logs=state.logs.filter(l=>logFilter==='全部'||l.category===logFilter).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));return logs.length?logs.map(l=>`<article class="log-card"><div class="log-head"><strong>${esc(l.map)} · ${esc(l.side)}</strong><span class="tiny">${esc(l.date)}</span></div><span class="pill">${esc(l.category)}</span><p style="margin-top:15px">${esc(l.context)}</p><p class="lesson">${esc(l.lesson)}</p><p class="tiny">下场重点 · ${esc(l.next)}</p><div class="log-actions"><button data-edit="${esc(l.id)}">编辑记录</button><button data-delete="${esc(l.id)}">删除</button></div></article>`).join(''):`<div class="empty"><strong>${state.logs.length?'这个分类还没有记录':'从一个回合开始'}</strong>${state.logs.length?'换一个分类，或记下新的复盘。':'记录一次本可避免的死亡，<br>也记录一次值得重复的好决定。'}</div>`;}
  function render(){
    const parts=location.hash.slice(1).split('/');route=parts[0]||'dashboard';const nav=route==='chapter'?'library':route,labels={dashboard:'训练台',library:'学习手册',plan:'八周计划',journal:'复盘日志'};
    $('#page-label').textContent=labels[nav]||'训练台';$$('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===nav);if(a.dataset.nav===nav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    const html=route==='library'?library():route==='chapter'?reader(parts[1]):route==='plan'?plan():route==='journal'?journal():dashboard();
    $('#main').innerHTML=(warning?`<p class="storage-warning" role="alert">${esc(warning)}</p>`:'')+html;$$('[data-check]').forEach(el=>el.checked=!!state.checks[el.dataset.check]);
    document.title=`${route==='chapter'?(chapters.find(c=>c.id===parts[1])?.title||'学习手册'):(labels[nav]||'训练台')} · CS2 FIELDNOTES`;
    if(parts[2])document.getElementById(parts[2])?.scrollIntoView({block:'start'});else window.scrollTo({top:0,behavior:'instant'});
  }
  function formatTime(s){s=Math.max(0,Math.ceil(s));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
  function timerUI(){if($('#timer-display'))$('#timer-display').textContent=formatTime(remaining);if($('#timer-toggle'))$('#timer-toggle').textContent=timerEnd?'暂停计时':'开始计时';}
  function stopTimer(){if(timerEnd)remaining=Math.max(0,(timerEnd-Date.now())/1000);timerEnd=null;clearInterval(timerInterval);timerInterval=null;timerUI();}
  function toggleTimer(){if(timerEnd){stopTimer();return;}if(remaining<=0)remaining=total;timerEnd=Date.now()+remaining*1000;timerInterval=setInterval(()=>{remaining=Math.max(0,(timerEnd-Date.now())/1000);if(remaining<=0){stopTimer();toast('本组训练结束。确认完成后，勾选对应训练项。');}timerUI();},250);timerUI();}
  function toggleIn(name,id){const i=state[name].indexOf(id);if(i<0)state[name].push(id);else state[name].splice(i,1);save();}
  function backup(){const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`CS2训练备份-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已导出，请妥善保存。');}
  document.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t)return;
    if(t.id==='backup-open'||t.id==='journal-backup')$('#backup-dialog').showModal();
    if(t.id==='backup-close')$('#backup-dialog').close();if(t.id==='export-data')backup();
    if(t.id==='timer-toggle')toggleTimer();if(t.id==='timer-reset'){stopTimer();remaining=total;timerUI();}
    if(t.dataset.filter){filter=t.dataset.filter;$$('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',b.dataset.filter===filter);});$('#chapter-grid').innerHTML=cards();$('#result-count').textContent=`共 ${matches().length} 章`;}
    if(t.id==='bookmark'||t.id==='mark-read'){const name=t.id==='bookmark'?'bookmarks':'read';toggleIn(name,t.dataset.id);const on=state[name].includes(t.dataset.id);t.setAttribute('aria-pressed',on);t.textContent=t.id==='bookmark'?(on?'★ 已收藏':'☆ 收藏章节'):(on?'✓ 已学完':'标记为已学完');}
    if(t.id==='print-chapter')window.print();
    if(t.dataset.week){toggleIn('weeks',Number(t.dataset.week));const y=window.scrollY;render();window.scrollTo(0,y);}
    if(t.dataset.edit){editing=t.dataset.edit;render();$('#log-form input')?.focus();}
    if(t.id==='cancel-edit'){editing=null;render();}
    if(t.dataset.delete&&confirm('删除这条复盘？建议先导出备份。')){state.logs=state.logs.filter(l=>l.id!==t.dataset.delete);if(editing===t.dataset.delete)editing=null;save();render();toast('记录已删除');}
  });
  document.addEventListener('change',async e=>{
    const t=e.target;
    if(t.matches('[data-task]')){const i=Number(t.dataset.task),d=day();d.tasks=t.checked?[...new Set([...d.tasks,i])]:d.tasks.filter(n=>n!==i);save();const y=window.scrollY;render();window.scrollTo(0,y);}
    if(t.matches('[data-check]')){state.checks[t.dataset.check]=t.checked;save();}
    if(t.id==='timer-length'){stopTimer();total=Number(t.value);remaining=total;timerUI();}
    if(t.id==='log-filter'){logFilter=t.value;$('#log-list').innerHTML=logCards();}
    if(t.id==='import-data'){
      const file=t.files?.[0];if(!file)return;
      try{
        if(file.size>10*1024*1024)throw Error('备份文件不能超过 10 MB');
        const imported=validate(JSON.parse(await file.text()));
        if(!confirm(`导入 ${imported.logs.length} 篇复盘与 ${Object.keys(imported.days).length} 天训练记录？同日期、同编号的数据将以备份为准。`)){t.value='';return;}
        const logs=new Map(state.logs.map(l=>[l.id,l]));imported.logs.forEach(l=>logs.set(l.id,l));
        state={version:1,days:{...state.days,...imported.days},read:[...new Set([...state.read,...imported.read])],bookmarks:[...new Set([...state.bookmarks,...imported.bookmarks])],checks:{...state.checks,...imported.checks},weeks:[...new Set([...state.weeks,...imported.weeks])],logs:[...logs.values()],lastChapter:imported.lastChapter};
        storageOK=true;warning='';const persisted=save();$('#backup-dialog').close();render();toast(persisted?'备份已合并并保存。':'已导入到当前页面，但浏览器保存失败，请导出备份。');
      }catch(error){toast(`导入失败：${error.message}。现有记录未改变。`);}t.value='';
    }
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='chapter-search'){query=e.target.value;$('#chapter-grid').innerHTML=cards();$('#result-count').textContent=`共 ${matches().length} 章`;}
    if(e.target.id==='daily-focus'){day().focus=e.target.value;save();}
  });
  document.addEventListener('submit',e=>{
    if(e.target.id!=='log-form')return;e.preventDefault();const f=new FormData(e.target),record={id:editing||(globalThis.crypto?.randomUUID?.()||`log-${Date.now()}`)};
    for(const k of ['date','map','side','category','context','lesson','next'])record[k]=String(f.get(k)||'').trim();
    if(!validDate(record.date)||!record.map||!record.context||!record.lesson||!record.next){$('#form-status').textContent='请填写日期、地图、回合经过和具体改法。';return;}
    const i=state.logs.findIndex(l=>l.id===record.id);if(i<0)state.logs.push(record);else state.logs[i]=record;
    const persisted=save();editing=null;render();toast(persisted?'复盘已保存。把这条改法带进下一场。':'复盘已暂存，请导出备份。');
  });
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!$('#backup-dialog').open){e.preventDefault();if(location.hash==='#library')$('#chapter-search').focus();else{location.hash='library';setTimeout(()=>$('#chapter-search')?.focus(),0);}}});
  window.addEventListener('storage',e=>{if(e.key!==KEY||!e.newValue)return;try{state=validate(JSON.parse(e.newValue));if(route!=='journal')render();toast('已载入另一个标签页保存的记录。');}catch{toast('另一个标签页的数据无法读取，请先导出当前记录。');}});
  let calendarDay=today();setInterval(()=>{if(today()!==calendarDay){calendarDay=today();if(route==='dashboard')render();}},30000);
  window.addEventListener('hashchange',render);render();
  const mc=document.modelContext;
  if(mc?.registerTool){
    const lifecycle=new AbortController();
    const tools=[{name:'read_training_progress',title:'读取训练进度',description:'读取此浏览器的章节、周计划和今日训练完成数量，不返回复盘正文。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('不接受额外参数');return{date:today(),dailyTasks:day().tasks.length,readChapters:state.read.length,completedWeeks:state.weeks.length,logCount:state.logs.length};}},
    {name:'open_training_chapter',title:'打开训练章节',description:'打开指定章节进行阅读，不标记已学完。',inputSchema:{type:'object',properties:{chapterId:{type:'string',enum:chapters.map(c=>c.id)}},required:['chapterId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).some(k=>k!=='chapterId')||!chapterIDs.has(input.chapterId))throw Error('无效章节编号');history.replaceState(null,'',`#chapter/${input.chapterId}`);render();return{chapterId:input.chapterId,title:chapters.find(c=>c.id===input.chapterId).title};}}];
    for(const tool of tools){try{Promise.resolve(mc.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();

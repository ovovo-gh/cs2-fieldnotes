(() => {
  'use strict';
  const KEY='cs2-assets-v1', $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=cents=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(cents/100);
  const safeURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
  const buffURL=value=>{const url=safeURL(value);return url&&new URL(url).hostname==='buff.163.com'?url:'';};
  const wears=['崭新出厂','略有磨损','久经沙场','破损不堪','战痕累累','不适用'];
  let records=[],storageError='',query='',sort='newest',catalog=[],catalogState='idle',matches=[],editing=null,chosen=null;
  function validate(items){
    if(!Array.isArray(items)||items.length>5000)throw Error('最多支持 5000 条饰品记录');
    const ids=new Set();
    return items.map(r=>{
      if(!r||typeof r.id!=='string'||!/^[\w-]{1,80}$/.test(r.id)||ids.has(r.id))throw Error('记录编号不正确');ids.add(r.id);
      for(const k of ['name','wear','edition','notes','image','buff'])if(typeof r[k]!=='string'||r[k].length>(k==='notes'?2000:2048))throw Error('饰品内容不正确');
      if(!r.name.trim()||r.name.length>200||!wears.includes(r.wear)||!['普通','StatTrak™','纪念品'].includes(r.edition))throw Error('饰品名称或版本不正确');
      for(const k of ['quantity','buy','fee'])if(!Number.isSafeInteger(r[k])||r[k]<0)throw Error('金额或数量不正确');
      if(r.quantity<1||r.quantity>10000||r.buy>1000000000||r.fee>10000||!(r.market===null||(Number.isSafeInteger(r.market)&&r.market>=0&&r.market<=1000000000)))throw Error('金额或数量超出范围');
      if(typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date)))throw Error('购买日期不正确');
      if(r.float!==null&&(!Number.isFinite(r.float)||r.float<0||r.float>1))throw Error('磨损值不正确');
      if(r.market!==null&&(!r.updated||!Number.isFinite(Date.parse(r.updated))))throw Error('估值时间不正确');
      return {id:r.id,name:r.name,wear:r.wear,edition:r.edition,notes:r.notes,image:safeURL(r.image),buff:buffURL(r.buff),quantity:r.quantity,buy:r.buy,fee:r.fee,market:r.market,date:r.date,float:r.float,updated:r.market===null?null:r.updated};
    });
  }
  try{const raw=localStorage.getItem(KEY);if(raw)records=validate(JSON.parse(raw).items);}catch{storageError='饰品记录读取失败。为保护原数据，暂时禁止修改；请先导出原始备份。';}
  function persist(next){
    if(storageError)throw Error(storageError);
    next=validate(next);localStorage.setItem(KEY,JSON.stringify({version:1,items:next}));records=next;
  }
  const totals=items=>items.reduce((s,r)=>{const cost=r.buy*r.quantity;s.cost+=cost;s.count+=r.quantity;if(r.market===null){s.missing+=r.quantity;return s;}const value=r.market*r.quantity;s.value+=value;s.pricedCost+=cost;s.net+=Math.round(value*(1-r.fee/10000));return s;},{cost:0,count:0,missing:0,value:0,pricedCost:0,net:0});
  const change=n=>`<span class="${n>=0?'asset-gain':'asset-loss'}">${n>0?'+':''}${money(n)}</span>`;
  const picture=(r,small=false)=>`<div class="asset-picture ${small?'small':''}"><span>◇</span>${safeURL(r.image)?`<img src="${esc(safeURL(r.image))}" alt="${esc(r.name)}" loading="lazy" referrerpolicy="no-referrer">`:''}</div>`;
  const status=text=>{const node=$('#asset-status');if(node)node.textContent=text;};
  function list(){
    const items=records.filter(r=>`${r.name} ${r.wear} ${r.edition} ${r.notes}`.toLowerCase().includes(query.toLowerCase()));
    if(sort==='value')items.sort((a,b)=>(b.market??-1)*b.quantity-(a.market??-1)*a.quantity);
    if(sort==='profit')items.sort((a,b)=>(b.market===null?-Infinity:(b.market-b.buy)*b.quantity)-(a.market===null?-Infinity:(a.market-a.buy)*a.quantity));
    if(sort==='name')items.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
    if(!items.length)return `<div class="empty"><strong>${records.length?'没有找到匹配的饰品':'从你的第一件饰品开始'}</strong>${records.length?'试试名称、磨损或备注。':'点击“新增饰品”，选择皮肤即可自动配图，再填写购买价。'}</div>`;
    return items.map(r=>{const p=r.market===null?null:(r.market-r.buy)*r.quantity,net=r.market===null?null:Math.round(r.market*r.quantity*(1-r.fee/10000))-r.buy*r.quantity;return `<article class="asset-card">${picture(r)}<div class="asset-card-body"><p class="eyebrow">${esc(r.edition)} · ${esc(r.wear)}</p><h2>${esc(r.name)}</h2><p class="tiny">${r.quantity} 件 · 购于 ${esc(r.date)}${r.float!==null?` · 磨损 ${r.float}`:''}</p><dl><div><dt>购买单价</dt><dd>${money(r.buy)}</dd></div><div><dt>BUFF 估值 / 件</dt><dd>${r.market===null?'待更新':money(r.market)}</dd></div><div><dt>浮动盈亏</dt><dd>${p===null?'—':change(p)}</dd></div><div><dt>预计扣费后盈亏</dt><dd>${net===null?'—':change(net)}</dd></div></dl><p class="tiny">${r.market===null?'尚未填写市场价':`手动估值 · ${esc(new Date(r.updated).toLocaleString('zh-CN'))}`}<br>预估卖出手续费 ${(r.fee/100).toFixed(2)}%</p>${r.notes?`<p class="asset-notes">${esc(r.notes)}</p>`:''}<div class="asset-actions"><button class="secondary" data-asset-edit="${r.id}">编辑 / 更新价格</button><a class="text-button" href="${esc(r.buff||'https://buff.163.com/market/csgo')}" target="_blank" rel="noopener noreferrer">查看 BUFF ↗</a><button class="text-button" data-asset-delete="${r.id}" aria-label="删除 ${esc(r.name)}">删除</button></div></div></article>`;}).join('');
  }
  function render(){
    const s=totals(records),profit=s.value-s.pricedCost,rate=s.pricedCost?profit/s.pricedCost*100:null;
    return `<div class="page-heading"><div><p class="eyebrow">MY COLLECTION / 饰品资产</p><h1>收藏在眼前，盈亏有记录。</h1><p class="muted">BUFF 口径 · 人民币 · ${s.count} 件饰品</p></div><button class="primary" id="asset-add">＋ 新增饰品</button></div>${storageError?`<p class="storage-warning">${esc(storageError)}</p>`:''}<div class="asset-stats"><div><span>总购买成本</span><strong>${money(s.cost)}</strong></div><div><span>${s.missing?'已估值部分市值':'当前估值'}</span><strong>${money(s.value)}</strong></div><div><span>${s.missing?'已估值部分盈亏':'总浮动盈亏'}</span><strong>${change(profit)}</strong><small>${rate===null?'收益率 —':`${rate.toFixed(2)}%`} · 未实现收益</small></div><div><span>预计扣费后盈亏</span><strong>${change(s.net-s.pricedCost)}</strong><small>${s.missing?`${s.missing} 件尚未估值，未计入盈亏`:'按各饰品填写的手续费估算'}</small></div></div><p class="note">市场价目前由你参照 BUFF 填写，尚未接入自动行情。空价格不按零元算亏损。标准配图不体现个人贴纸、图案编号等差异。</p><div class="asset-toolbar"><label>查找饰品<input id="asset-search" type="search" placeholder="名称、磨损、备注…" value="${esc(query)}"></label><label>排序<select id="asset-sort">${[['newest','最近添加'],['value','市值从高到低'],['profit','盈亏从高到低'],['name','名称']].map(([v,n])=>`<option value="${v}" ${sort===v?'selected':''}>${n}</option>`).join('')}</select></label><button class="secondary" id="asset-export">导出饰品备份</button><label class="secondary file-label">导入饰品备份<input id="asset-import" type="file" accept=".json,application/json"></label></div><p id="asset-status" role="status" class="tiny"></p><div class="asset-grid" id="asset-list">${list()}</div><p class="tiny">饰品记录单独保存在此浏览器。跨设备请使用本页的饰品备份导入 / 导出；训练备份不包含饰品。自动配图目录来自 <a href="https://github.com/ByMykel/CSGO-API" target="_blank" rel="noopener noreferrer">ByMykel / CSGO-API ↗</a>。</p>`;
  }
  function refresh(){if(location.hash==='#assets'){$('#main').innerHTML=render();}}
  async function loadCatalog(){
    if(catalogState==='ready')return;if(catalogState==='loading')return;
    catalogState='loading';showMatches();
    try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);let data;try{const response=await fetch('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/zh-CN/skins.json',{signal:controller.signal});if(!response.ok)throw Error();data=await response.json();}finally{clearTimeout(timer);}
      if(!Array.isArray(data))throw Error();catalog=data.filter(r=>typeof r.name==='string'&&typeof r.id==='string').map(r=>({id:r.id,name:r.name,image:safeURL(r.image),wears:(r.wears||[]).map(w=>w.name).filter(w=>wears.includes(w)),stattrak:!!r.stattrak,souvenir:!!r.souvenir}));catalogState='ready';
    }catch{catalogState='error';}showMatches();
  }
  function showMatches(){
    const box=$('#asset-matches');if(!box)return;
    const q=$('#asset-name').value.trim().toLowerCase();
    if(catalogState==='loading'){box.textContent='正在载入皮肤配图目录…';return;}
    if(catalogState==='error'){box.innerHTML='配图目录暂时无法连接，可继续手动填写名称与图片链接。<button type="button" class="text-button" id="asset-retry">重试</button>';return;}
    matches=q?catalog.filter(r=>q.split(/\s+/).every(term=>r.name.toLowerCase().includes(term))).slice(0,12):[];
    box.innerHTML=matches.length?matches.map((r,i)=>`<button type="button" data-asset-pick="${i}">${picture(r,true)}<span>${esc(r.name)}</span></button>`).join(''):(q?'没有匹配项，可手动录入。':'输入名称，选择对应款式即可自动配图。');
  }
  function openForm(id){
    editing=records.find(r=>r.id===id)||null;chosen=editing?{name:editing.name}:null;
    const r=editing||{name:'',image:'',wear:'久经沙场',edition:'普通',quantity:1,buy:0,market:null,fee:0,date:new Date().toLocaleDateString('sv-SE'),float:null,buff:'',notes:''};
    $('#asset-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='asset-dialog';dialog.className='asset-dialog';
    dialog.innerHTML=`<div class="dialog-head"><h2>${editing?'编辑饰品':'新增饰品'}</h2><button type="button" id="asset-close" class="icon-button" aria-label="关闭">×</button></div><form id="asset-form"><label class="field">饰品名称<input id="asset-name" name="name" required maxlength="200" value="${esc(r.name)}" placeholder="例如：AK-47 | 红线" autocomplete="off"></label><div id="asset-matches" class="asset-matches"></div><div id="asset-preview">${picture(r,true)}</div><div class="field-grid"><label class="field">磨损<select name="wear">${wears.map(w=>`<option ${w===r.wear?'selected':''}>${w}</option>`).join('')}</select></label><label class="field">版本<select name="edition">${['普通','StatTrak™','纪念品'].map(w=>`<option ${w===r.edition?'selected':''}>${w}</option>`).join('')}</select></label><label class="field">数量<input name="quantity" required type="number" min="1" max="10000" step="1" value="${r.quantity}"></label><label class="field">购买日期<input name="date" required type="date" value="${esc(r.date)}"></label><label class="field">购买单价（¥）<input name="buy" required type="number" min="0" max="10000000" step="0.01" value="${editing?r.buy/100:''}"></label><label class="field">BUFF 市场单价（¥）<input name="market" type="number" min="0" max="10000000" step="0.01" placeholder="可留空，稍后估值" value="${r.market===null?'':r.market/100}"></label><label class="field">预计卖出手续费（%）<input name="fee" required type="number" min="0" max="100" step="0.01" value="${r.fee/100}"></label><label class="field">具体磨损值（选填）<input name="float" type="number" min="0" max="1" step="any" value="${r.float??''}"></label><label class="field full">BUFF 商品链接（选填）<input name="buff" type="url" value="${esc(r.buff)}" placeholder="https://buff.163.com/…"></label><label class="field full">图片链接（选择目录项后自动填写）<input name="image" type="url" value="${esc(r.image)}" placeholder="https://…"></label><label class="field full">备注<input name="notes" maxlength="2000" value="${esc(r.notes)}" placeholder="贴纸、图案编号、购买平台等"></label></div><p class="tiny">价格均为每件单价。手续费默认 0%，请按实际费率填写。提交市场价时记录本次确认时间。</p><p class="status-text" role="alert" id="asset-form-error"></p><button class="primary" ${storageError?'disabled':''}>保存饰品</button></form>`;
    document.body.append(dialog);dialog.showModal();loadCatalog();if(catalogState==='ready')showMatches();
  }
  document.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t)return;
    if(t.id==='asset-add')openForm();
    if(t.dataset.assetEdit)openForm(t.dataset.assetEdit);
    if(t.id==='asset-close')$('#asset-dialog').close();
    if(t.id==='asset-retry')loadCatalog();
    if(t.dataset.assetPick!==undefined){chosen=matches[Number(t.dataset.assetPick)];if(!chosen)return;const f=$('#asset-form');f.elements.name.value=chosen.name;f.elements.image.value=chosen.image;f.elements.wear.innerHTML=(chosen.wears.length?chosen.wears:['不适用']).map(w=>`<option>${esc(w)}</option>`).join('');f.elements.edition.innerHTML=['普通',...(chosen.stattrak?['StatTrak™']:[]),...(chosen.souvenir?['纪念品']:[])].map(w=>`<option>${w}</option>`).join('');$('#asset-preview').innerHTML=picture(chosen,true);$('#asset-matches').innerHTML='已匹配图片，请核对磨损与版本。';}
    if(t.dataset.assetDelete){const r=records.find(r=>r.id===t.dataset.assetDelete);if(r&&confirm(`删除“${r.name}”这条记录？可从此前导出的饰品备份恢复。`)){try{persist(records.filter(x=>x.id!==r.id));refresh();status('已删除饰品记录。');}catch(err){status(err.message);}}}
    if(t.id==='asset-export'){const payload=storageError?localStorage.getItem(KEY):JSON.stringify({version:1,items:records},null,2);const url=URL.createObjectURL(new Blob([payload||''],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`CS2-饰品备份-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='asset-search'){query=e.target.value;$('#asset-list').innerHTML=list();}
    if(e.target.id==='asset-name'){if(chosen&&chosen.name!==e.target.value){chosen=null;$('#asset-form').elements.image.value='';$('#asset-preview').innerHTML=picture({name:'',image:''},true);}showMatches();}
  });
  document.addEventListener('change',async e=>{
    if(e.target.id==='asset-sort'){sort=e.target.value;$('#asset-list').innerHTML=list();}
    if(e.target.id==='asset-import'){const file=e.target.files?.[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('备份超过 10 MB');const data=JSON.parse(await file.text());if(data.version!==1)throw Error('备份版本不支持');const incoming=validate(data.items);if(confirm(`合并 ${incoming.length} 条饰品记录？相同编号以导入内容为准。`)){const map=new Map(records.map(r=>[r.id,r]));incoming.forEach(r=>map.set(r.id,r));persist([...map.values()]);refresh();status('饰品备份已合并。');}}catch(err){status(`导入失败：${err.message}`);}e.target.value='';}
  });
  document.addEventListener('submit',e=>{
    if(e.target.id!=='asset-form')return;e.preventDefault();const f=e.target.elements,cent=k=>Math.round(Number(f[k].value)*100);
    try{if(f.buff.value&&!buffURL(f.buff.value))throw Error('商品链接须为 https://buff.163.com/ 下的地址');if(f.image.value&&!safeURL(f.image.value))throw Error('图片需要有效的 HTTPS 地址');const r={id:editing?.id||crypto.randomUUID(),name:f.name.value.trim(),image:f.image.value,wear:f.wear.value,edition:f.edition.value,quantity:Number(f.quantity.value),buy:cent('buy'),market:f.market.value===''?null:cent('market'),fee:cent('fee'),date:f.date.value,float:f.float.value===''?null:Number(f.float.value),notes:f.notes.value,buff:f.buff.value,updated:f.market.value===''?null:new Date().toISOString()};persist(editing?records.map(x=>x.id===editing.id?r:x):[r,...records]);$('#asset-dialog').close();refresh();status('饰品已保存，盈亏已重新计算。');}catch(err){$('#asset-form-error').textContent=err.message;}
  });
  document.addEventListener('error',e=>{if(e.target.matches?.('.asset-picture img'))e.target.remove();},true);
  window.addEventListener('hashchange',()=>$('#asset-dialog')?.close());
  window.addEventListener('storage',e=>{if(e.key===KEY){try{records=e.newValue?validate(JSON.parse(e.newValue).items):[];storageError='';refresh();}catch{status('另一标签页的饰品数据无法读取。');}}});
  window.CS2Assets={render};
})();

(() => {
  'use strict';
  const chapters=window.HANDBOOK||[], $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today=()=>dateKey(new Date()), KEY='cs2-fieldnotes-v1';
  const sensitivityProfile=mode=>({dpi:800,sens:1,zoom:mode==='sniper'?0.8:1,tests:[]});
  const blank=()=>({version:1,days:{},read:[],bookmarks:[],checks:{},weeks:[],logs:[],lastChapter:'01',sensitivity:{active:'rifle',profiles:{rifle:sensitivityProfile('rifle'),sniper:sensitivityProfile('sniper')}},recoil:{sessions:[]}});
  const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));
  const chapterIDs=new Set(chapters.map(c=>c.id));
  let state=blank(),storageOK=true,warning='';
  const numberIn=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;};
  const safeId=/^[a-zA-Z0-9_-]{1,80}$/;
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
    s.lastChapter=chapterIDs.has(data.lastChapter)?data.lastChapter:'01';
    const rawSensitivity=data.sensitivity&&typeof data.sensitivity==='object'&&!Array.isArray(data.sensitivity)?data.sensitivity:{};
    if(rawSensitivity.active&& !['rifle','sniper'].includes(rawSensitivity.active))throw Error('灵敏度模式不正确');
    s.sensitivity.active=rawSensitivity.active==='sniper'?'sniper':'rifle';
    for(const mode of ['rifle','sniper']){
      const raw=rawSensitivity.profiles?.[mode]&&typeof rawSensitivity.profiles[mode]==='object'&&!Array.isArray(rawSensitivity.profiles[mode])?rawSensitivity.profiles[mode]:{};
      const base=sensitivityProfile(mode), profile={dpi:numberIn(raw.dpi,100,10000,base.dpi),sens:numberIn(raw.sens,.01,20,base.sens),zoom:numberIn(raw.zoom,.1,2,base.zoom),tests:[]};
      if(raw.tests!==undefined&&!Array.isArray(raw.tests))throw Error('灵敏度测试记录格式不正确');
      if((raw.tests||[]).length>500)throw Error('灵敏度测试记录超出限制');
      for(const test of raw.tests||[]){
        if(!test||typeof test!=='object'||!safeId.test(String(test.id||''))||!validDate(String(test.date||''))||typeof test.candidate!=='string'||test.candidate.length>80)throw Error('灵敏度测试记录格式不正确');
        profile.tests.push({id:String(test.id),date:String(test.date),candidate:String(test.candidate),label:typeof test.label==='string'&&test.label.length<=80?test.label:'',dpi:numberIn(test.dpi,100,10000,profile.dpi),sens:numberIn(test.sens,.01,20,profile.sens),zoom:numberIn(test.zoom,.1,2,profile.zoom),hits:numberIn(test.hits,0,500,0),attempts:numberIn(test.attempts,0,500,0),accuracy:numberIn(test.accuracy,0,100,0),reaction:numberIn(test.reaction,0,10000,0)});
      }
      s.sensitivity.profiles[mode]=profile;
    }
    const rawRecoil=data.recoil&&typeof data.recoil==='object'&&!Array.isArray(data.recoil)?data.recoil:{};
    if(rawRecoil.sessions!==undefined&&!Array.isArray(rawRecoil.sessions))throw Error('压枪记录格式不正确');
    if((rawRecoil.sessions||[]).length>2000)throw Error('压枪记录超出限制');
    for(const session of rawRecoil.sessions||[]){
      if(!session||typeof session!=='object'||!safeId.test(String(session.id||''))||!validDate(String(session.date||''))||typeof session.weaponId!=='string'||session.weaponId.length>40)throw Error('压枪记录格式不正确');
      const trace=Array.isArray(session.trace)?session.trace.slice(0,40).filter(p=>p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y))).map(p=>({x:numberIn(p.x,-1200,1200,0),y:numberIn(p.y,-1200,1200,0)})):[];
      s.recoil.sessions.push({id:String(session.id),date:String(session.date),weaponId:String(session.weaponId),shots:numberIn(session.shots,1,40,10),score:numberIn(session.score,0,100,0),meanError:numberIn(session.meanError,0,2000,0),verticalError:numberIn(session.verticalError,-2000,2000,0),lateralError:numberIn(session.lateralError,-2000,2000,0),trace});
    }
    return s;
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
  let aimSession=null,aimInterval=null;
  let recoilWeaponId='ak47',recoilCategory='全部',recoilQuery='',recoilShots=10,recoilSession=null;
  const recoilCategories=['全部','步枪','冲锋枪','霰弹枪','机枪','手枪','狙击枪'];
  const interpolatePattern=(control,total)=>Array.from({length:total},(_,i)=>{
    if(total===1)return {x:control[0][0],y:control[0][1]};
    const position=i/(total-1)*(control.length-1),index=Math.floor(position),t=position-index,a=control[index],b=control[Math.min(index+1,control.length-1)];
    return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t};
  });
  const recoilPatterns={
    ak:interpolatePattern([[0,0],[2,16],[7,36],[9,58],[6,80],[0,102],[-8,124],[-14,145],[-15,164],[-9,182],[-1,198],[7,211],[13,223],[12,233],[5,242],[-3,249],[-10,255],[-13,260],[-8,264],[1,267],[10,270]],30),
    m4a4:interpolatePattern([[0,0],[-1,18],[-4,38],[-4,60],[0,80],[6,99],[10,118],[7,136],[0,151],[-7,165],[-9,178],[-4,190],[4,200],[9,209],[7,218],[0,224],[-4,230],[0,236]],30),
    m4a1s:interpolatePattern([[0,0],[-1,18],[-3,38],[-2,58],[2,77],[6,95],[8,112],[4,128],[-3,143],[-7,157],[-5,169],[1,180],[6,190],[5,199],[0,207],[-4,214],[0,220]],30),
    galil:interpolatePattern([[0,0],[2,18],[6,38],[11,60],[13,81],[8,101],[-1,120],[-11,138],[-14,155],[-8,171],[2,186],[12,200],[15,213],[8,225],[-3,235],[-12,244],[-8,251],[3,257],[11,262]],30),
    famas:interpolatePattern([[0,0],[1,17],[4,36],[5,56],[2,76],[-3,94],[-6,111],[-2,127],[5,142],[7,155],[2,167],[-5,177],[-6,187],[1,196],[7,203]],25),
    aug:interpolatePattern([[0,0],[-1,18],[-3,38],[-2,59],[2,78],[7,97],[9,115],[5,132],[-2,147],[-6,161],[-4,174],[2,185],[7,195],[5,204],[0,212],[-3,219],[0,225]],30),
    sg:interpolatePattern([[0,0],[2,18],[5,38],[8,59],[7,79],[2,98],[-5,116],[-10,133],[-8,149],[-2,164],[6,178],[10,190],[6,201],[-2,211],[-8,220],[-5,228],[3,235],[8,241]],30),
    smg:interpolatePattern([[0,0],[1,14],[4,32],[6,52],[5,72],[0,91],[-6,108],[-10,124],[-8,139],[-2,153],[5,165],[9,176],[6,185],[-1,193],[-7,200],[-4,206],[3,211],[7,215]],30),
    mp9:interpolatePattern([[0,0],[1,14],[3,31],[4,49],[2,67],[-3,84],[-7,101],[-6,116],[-1,130],[5,142],[7,153],[3,163],[-4,172],[-5,180],[1,187],[5,193]],30),
    p90:interpolatePattern([[0,0],[1,15],[4,33],[7,53],[8,73],[4,93],[-3,112],[-9,130],[-11,147],[-6,163],[3,178],[11,191],[13,203],[7,214],[-2,224],[-10,233],[-8,241],[2,248],[10,254]],30),
    shotgun:interpolatePattern([[0,0],[-2,18],[3,36],[-4,54],[4,71],[-3,88],[2,104],[-2,119],[3,133]],9),
    machine:interpolatePattern([[0,0],[2,17],[7,37],[11,59],[10,80],[3,101],[-7,121],[-14,140],[-12,158],[-3,175],[9,190],[16,204],[14,217],[4,229],[-8,239],[-15,248],[-10,256],[2,263],[13,269]],30),
    negev:interpolatePattern([[0,0],[4,16],[11,34],[16,53],[11,72],[0,91],[-13,109],[-20,127],[-14,144],[-1,160],[13,175],[21,189],[13,202],[-3,214],[-18,225],[-23,236],[-13,246],[3,255],[18,263]],35),
    pistol:interpolatePattern([[0,0],[1,14],[-1,29],[3,44],[-4,58],[2,71],[-1,84],[4,96]],8),
    deagle:interpolatePattern([[0,0],[4,16],[-4,32],[6,48],[-5,63],[3,77],[-2,90]],7),
    cz:interpolatePattern([[0,0],[1,13],[4,28],[2,44],[-4,60],[-7,75],[-2,89],[6,102],[8,114],[2,125],[-6,135],[-4,144],[4,152]],13),
    sniper:interpolatePattern([[0,0],[0,7],[1,14],[-1,21],[0,28]],5)
  };
  const weapons=[
    {id:'ak47',name:'AK-47',alias:'AK',category:'步枪',pattern:'ak',shots:30,difficulty:'进阶',note:'前 10 发先练垂直下拉，再加入左右反向修正。'},
    {id:'m4a4',name:'M4A4',alias:'M4',category:'步枪',pattern:'m4a4',shots:30,difficulty:'进阶',note:'横向摆动比 AK 更温和，先练稳定的中段连发。'},
    {id:'m4a1s',name:'M4A1-S',alias:'M4-S',category:'步枪',pattern:'m4a1s',shots:30,difficulty:'中等',note:'消音步枪的参照线更收敛，适合对比 M4A4 的手感。'},
    {id:'galil',name:'Galil AR',alias:'咖喱',category:'步枪',pattern:'galil',shots:30,difficulty:'进阶',note:'前段上扬与横向变化明显，先把前 10 发压在同一区域。'},
    {id:'famas',name:'FAMAS',alias:'法玛斯',category:'步枪',pattern:'famas',shots:25,difficulty:'中等',note:'建议用 10～15 发短连发，不必每次打满弹匣。'},
    {id:'aug',name:'AUG',alias:'AUG',category:'步枪',pattern:'aug',shots:30,difficulty:'中等',note:'开镜后视野与节奏不同，步枪基础稳定后再加开镜。'},
    {id:'sg553',name:'SG 553',alias:'SG',category:'步枪',pattern:'sg',shots:30,difficulty:'进阶',note:'开镜会改变观察节奏，分开记录不开镜与开镜体验。'},
    {id:'mac10',name:'MAC-10',alias:'MAC',category:'冲锋枪',pattern:'smg',shots:30,difficulty:'中等',note:'用近距离跟枪练习，不要把冲锋枪的节奏搬到远距离。'},
    {id:'mp9',name:'MP9',alias:'MP9',category:'冲锋枪',pattern:'mp9',shots:30,difficulty:'中等',note:'先练前 10 发跟随，再练急停后的小范围横向修正。'},
    {id:'mp7',name:'MP7',alias:'MP7',category:'冲锋枪',pattern:'smg',shots:30,difficulty:'中等',note:'用固定中近距离比较压枪与移动跟枪的差异。'},
    {id:'mp5sd',name:'MP5-SD',alias:'MP5',category:'冲锋枪',pattern:'smg',shots:30,difficulty:'中等',note:'把重点放在短距离补枪与持续跟随目标。'},
    {id:'ump45',name:'UMP-45',alias:'UMP',category:'冲锋枪',pattern:'smg',shots:30,difficulty:'中等',note:'中近距离更容易控制，先固定交火距离再比较成绩。'},
    {id:'p90',name:'P90',alias:'P90',category:'冲锋枪',pattern:'p90',shots:30,difficulty:'进阶',note:'弹匣长但不代表可以无脑扫，记录前 20 发的横向误差。'},
    {id:'bizon',name:'PP-Bizon',alias:'Bizon',category:'冲锋枪',pattern:'smg',shots:30,difficulty:'中等',note:'用作近距离移动跟枪专项，注意压枪与跟枪不要混为一谈。'},
    {id:'nova',name:'Nova',alias:'Nova',category:'霰弹枪',pattern:'shotgun',shots:9,difficulty:'基础',note:'这是近距离多发节奏参照，不代表每颗散弹的真实落点。'},
    {id:'xm1014',name:'XM1014',alias:'XM',category:'霰弹枪',pattern:'shotgun',shots:9,difficulty:'基础',note:'射击后利用掩体，练习开火节奏而不是持续站桩。'},
    {id:'mag7',name:'MAG-7',alias:'MAG',category:'霰弹枪',pattern:'shotgun',shots:9,difficulty:'基础',note:'适合固定近角训练，结合射击后撤退。'},
    {id:'sawedoff',name:'Sawed-Off',alias:'短喷',category:'霰弹枪',pattern:'shotgun',shots:9,difficulty:'基础',note:'近距离单次命中优先，参考线只用于熟悉连续操作。'},
    {id:'m249',name:'M249',alias:'M249',category:'机枪',pattern:'machine',shots:30,difficulty:'高',note:'前段控制后再观察横向漂移，建议只在专项时间练习。'},
    {id:'negev',name:'Negev',alias:'Negev',category:'机枪',pattern:'negev',shots:35,difficulty:'高',note:'先练稳定开火节奏，注意长弹匣与持续射击的负荷。'},
    {id:'glock18',name:'Glock-18',alias:'Glock',category:'手枪',pattern:'pistol',shots:8,difficulty:'基础',note:'按距离控制点击，不要为了速度把节奏拉满。'},
    {id:'usp',name:'USP-S',alias:'USP',category:'手枪',pattern:'pistol',shots:8,difficulty:'基础',note:'头线与小幅修正优先，练习每发之间的恢复。'},
    {id:'p2000',name:'P2000',alias:'P2K',category:'手枪',pattern:'pistol',shots:8,difficulty:'基础',note:'固定中距离，观察点击节奏和首枪稳定性。'},
    {id:'p250',name:'P250',alias:'P250',category:'手枪',pattern:'pistol',shots:8,difficulty:'基础',note:'先练停稳首枪，再练两发之间的快速修正。'},
    {id:'fiveseven',name:'Five-SeveN',alias:'57',category:'手枪',pattern:'pistol',shots:8,difficulty:'中等',note:'近距离连点更实用，避免照搬步枪的长扫。'},
    {id:'tec9',name:'Tec-9',alias:'Tec',category:'手枪',pattern:'pistol',shots:8,difficulty:'中等',note:'移动与近距离节奏单独练，远距离先停再点。'},
    {id:'cz75',name:'CZ75-Auto',alias:'CZ',category:'手枪',pattern:'cz',shots:13,difficulty:'进阶',note:'短窗口内控制前段，及时换弹或切换到身位处理。'},
    {id:'deagle',name:'Desert Eagle',alias:'Deagle',category:'手枪',pattern:'deagle',shots:7,difficulty:'高',note:'命中优先，等待恢复；远距离连续猛点容易失控。'},
    {id:'r8',name:'R8 Revolver',alias:'R8',category:'手枪',pattern:'deagle',shots:7,difficulty:'高',note:'按住蓄力时更要保持停稳，参考线只看操作方向。'},
    {id:'dualies',name:'Dual Berettas',alias:'双枪',category:'手枪',pattern:'pistol',shots:8,difficulty:'中等',note:'用固定距离记录左右散布与点击节奏。'},
    {id:'awp',name:'AWP',alias:'AWP',category:'狙击枪',pattern:'sniper',shots:5,difficulty:'单发',note:'这里练的是射击后恢复与下一枪方向，不是全自动压枪。'},
    {id:'ssg08',name:'SSG 08',alias:'鸟狙',category:'狙击枪',pattern:'sniper',shots:5,difficulty:'单发',note:'开镜命中、头线和射击后移动要分开观察。'},
    {id:'scar20',name:'SCAR-20',alias:'SCAR',category:'狙击枪',pattern:'sniper',shots:5,difficulty:'中等',note:'半自动连续射击时仍要按节奏控制，不要长按失去目标。'},
    {id:'g3sg1',name:'G3SG1',alias:'G3',category:'狙击枪',pattern:'sniper',shots:5,difficulty:'中等',note:'先练短段连续射击和回掩体，再增加目标移动。'}
  ];
  const heading=(eye,title,sub,extra='')=>`<div class="page-heading"><div><p class="eyebrow">${eye}</p><h1>${title}</h1><p class="muted">${sub}</p></div>${extra}</div>`;
  function dashboard(){
    const dates=Object.values(state.days).filter(d=>d.tasks.length).length,current=weeks.findIndex((_,i)=>!state.weeks.includes(i+1));
    const heat=[];for(let i=20;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=dateKey(d),n=state.days[key]?.tasks.length||0;heat.push(`<span class="heat-cell ${n?'on':''}" title="${key}：${n} 项" aria-label="${key}完成${n}项"></span>`);}
    return heading('PRACTICE WITH PURPOSE','练得有章法，打得有思路<span class="accent">。</span>','先完成今天的一小步，再把它带进下一场比赛。',`<span class="date-badge">${new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date())}</span>`)+
    `<section class="focus-card"><div><span class="pill">TODAY'S FOCUS</span><h2>停稳，再打出第一枪。</h2><p>动作越稳定，越有余力思考下一步。</p><a class="primary" href="#chapter/${state.lastChapter}">继续学习 · 第 ${Number(state.lastChapter)} 章 ↗</a><div class="focus-editor"><label for="daily-focus">今天只专注一件事</label><input id="daily-focus" class="focus-input" maxlength="300" value="${esc(day().focus)}" placeholder="例如：每次出角，停稳后再开枪"></div></div><div class="key-diagram" aria-label="向右移动、反向制动、停稳开枪"><kbd>D</kbd><span>→</span><kbd>A</kbd><span>→</span><span class="crosshair">⊕</span><small>横向移动 / 反向制动 / 准确射击</small></div></section>
    <section class="stats" aria-label="学习统计">${[[dates,'天','累计训练','▦'],[state.read.length,'/ 17','已学章节','▤'],[state.logs.length,'篇','复盘记录','✎']].map(s=>`<div class="stat"><div><strong>${s[0]}<span> ${s[1]}</span></strong><span>${s[2]}</span></div><span class="stat-symbol">${s[3]}</span></div>`).join('')}</section>
    <div class="two-col"><section class="panel"><div class="section-head"><h2>今天的训练</h2><span class="tiny">${day().tasks.length} / 6 已完成</span></div>${tasks.map((t,i)=>`<div class="task-row ${day().tasks.includes(i)?'done':''}"><label><input type="checkbox" data-task="${i}" ${day().tasks.includes(i)?'checked':''}><span><strong>${t[0]}</strong><small>${t[1]}</small></span></label><span class="minutes">${t[2]}</span><a href="#chapter/${t[3]}" aria-label="学习${t[0]}" class="text-button">↗</a></div>`).join('')}<div class="track" role="progressbar" aria-label="今日训练完成度" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${day().tasks.length}"><span style="width:${day().tasks.length/6*100}%"></span></div></section>
    <aside><section class="panel"><div class="section-head"><h2>${current<0?'八周训练已完成':`第 ${String(current+1).padStart(2,'0')} 周`}</h2><a class="text-button" href="#plan">查看计划 ↗</a></div><p class="muted">${current<0?'回看基线，为下一轮选一个重点。':weeks[current][1]}</p><span class="tiny">最近 21 天 · 完成任一训练即点亮</span><div class="heatmap">${heat.join('')}</div><div class="timer"><label for="timer-length" class="tiny">专注一个动作</label><select id="timer-length" aria-label="训练计时时长" class="chip">${[[480,'8 分钟 · 基础'],[600,'10 分钟 · 专项'],[1200,'20 分钟 · 打狙']].map(t=>`<option value="${t[0]}" ${total===t[0]?'selected':''}>${t[1]}</option>`).join('')}</select><div class="timer-display" id="timer-display">${formatTime(remaining)}</div><div class="timer-actions"><button id="timer-toggle" class="primary">${timerEnd?'暂停计时':'开始计时'}</button><button id="timer-reset" class="secondary">重置</button></div></div></section></aside></div>
    <div class="section-head"><h2>高频技巧，随手查阅</h2><a href="#library" class="text-button">全部 17 章 ↗</a></div><div class="quick-links">${[['02','如何正确急停','按键顺序 · 出枪时机 · 常见纠错','chapter'],['05','把 AWP 打得更稳','架点选择 · 空枪撤退 · 回防处理','chapter'],['11','残局先做哪一步','1v1 / 1v2 · 守包与拆包 · 时间判断','chapter'],['sensitivity','找到你的灵敏度','通用枪械与狙击 / 开镜分开测试','lab'],['recoil','开始压枪训练','AK · M4 · 咖喱 · 全类型武器记录','lab']].map(c=>`<a class="quick-link" href="#${c[3]==='chapter'?'chapter/':''}${c[0]}"><span class="num">${c[3]==='chapter'?'FIELD GUIDE':'TRAINING LAB'} / ${c[0]}</span><strong>${c[1]} ↗</strong><p>${c[2]}</p></a>`).join('')}</div>`;
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
  const sensModes={rifle:{title:'通用枪械',short:'步枪 / 手枪 / 冲锋枪',eyebrow:'RIFLE & PISTOL'},sniper:{title:'狙击 / 开镜',short:'AWP / SSG / 开镜枪',eyebrow:'SNIPER & ZOOM'}};
  const decimal=(value,digits=2)=>Number(Number(value).toFixed(digits)).toString();
  const cm360=eDpi=>eDpi>0?360*2.54/(.022*eDpi):0;
  const profileFor=mode=>state.sensitivity.profiles[mode]||state.sensitivity.profiles.rifle;
  function sensitivityCandidates(mode){
    const p=profileFor(mode),values=mode==='sniper'?[p.zoom*.82,p.zoom,Math.min(2,p.zoom*1.18)]:[p.sens*.8,p.sens,Math.min(20,p.sens*1.2)];
    const labels=mode==='sniper'?[['low','细腻开镜','留出更多微调空间'],['current','当前基准','先用现有习惯做对照'],['high','快速开镜','转身更快但更考验停枪']]:[['low','细腻修正','小幅修正更稳，适合先做基线'],['current','当前基准','不改习惯，先记录真实表现'],['high','快速转身','覆盖范围更大，但更容易过冲']];
    return labels.map((item,i)=>({id:item[0],name:item[1],desc:item[2],dpi:p.dpi,sens:mode==='sniper'?p.sens:values[i],zoom:mode==='sniper'?values[i]:p.zoom}));
  }
  function sensitivityStats(mode,candidate){
    const tests=profileFor(mode).tests.filter(t=>t.candidate===candidate.id&&Math.abs(t.dpi-candidate.dpi)<.01&&Math.abs(t.sens-candidate.sens)<.001&&Math.abs(t.zoom-candidate.zoom)<.001),count=tests.length;
    return {count,accuracy:count?tests.reduce((sum,t)=>sum+t.accuracy,0)/count:0,reaction:count?tests.reduce((sum,t)=>sum+t.reaction,0)/count:0};
  }
  function sensitivityRecommendation(mode){
    const p=profileFor(mode),candidates=sensitivityCandidates(mode),tested=p.tests.filter(t=>t.attempts>0);
    if(!tested.length)return {title:'先做三组对照，再谈适不适合',body:'用同一个目标大小和测试时间，把三个候选各做至少 2 轮。不要因为第一轮手感新鲜就立刻改掉设置。'};
    const grouped=candidates.map(c=>({candidate:c,...sensitivityStats(mode,c)})).filter(item=>item.count);
    if(!grouped.length)return {title:'已有记录，但还不能比较',body:'请完成带有有效点击次数的测试；只打开页面或中途退出不会进入推荐。'};
    grouped.sort((a,b)=>b.accuracy-a.accuracy||a.reaction-b.reaction);
    const best=grouped[0],confidence=best.count>=2?'重复结果较稳定':'目前只有一轮，建议再复测一次';
    return {title:`当前数据更支持「${best.candidate.name}」`,body:`平均命中率 ${best.accuracy.toFixed(0)}%，平均反应 ${best.reaction?best.reaction.toFixed(0):'—'} ms；${confidence}。把它带回游戏，用同一张图和同一距离再验证。`};
  }
  function sensitivityHistory(mode){
    const tests=profileFor(mode).tests.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,8);
    if(!tests.length)return '<p class="empty-history">还没有测试记录。先从三个候选设置各做一轮。</p>';
    return `<div class="history-list">${tests.map(t=>{const candidate=sensitivityCandidates(mode).find(item=>item.id===t.candidate);return `<div class="history-item"><div><strong>${esc(t.label||candidate?.name||t.candidate)}</strong><small>${esc(t.date)} · ${t.hits} / ${t.attempts} 次</small></div><span class="history-score ${t.accuracy<60?'low':''}">${t.accuracy.toFixed(0)}%</span><small>${t.reaction?t.reaction.toFixed(0)+' ms':'—'}</small></div>`;}).join('')}</div>`;
  }
  function aimTargetPosition(){return {left:Math.round(15+Math.random()*70),top:Math.round(24+Math.random()*57)};}
  function aimMarkup(mode,candidates){
    const session=aimSession&&aimSession.mode===mode?aimSession:null,defaultCandidate=candidates[1]||candidates[0],candidate=session?.candidate||defaultCandidate,target=session?.target||{left:50,top:50};
    const result=session?.result;
    return `<section class="panel aim-panel"><div class="section-head"><div><h2>20 秒定点测试</h2><p class="tiny">浏览器测试只用于比较你的相对手感，不等同于游戏内 1:1 灵敏度。</p></div><span class="tiny">${session?.running?'正在记录':'每次测试都会留档'}</span></div><div class="aim-layout"><div id="aim-board" class="aim-board ${session?.running?'is-live':''}" aria-label="灵敏度定点测试区域"><button class="aim-target" type="button" aria-label="点击目标" style="left:${target.left}%;top:${target.top}%"></button></div><div class="aim-side"><h3>${esc(candidate.name)} · ${mode==='sniper'?'开镜':'通用'}</h3><p>${esc(candidate.dpi)} DPI · sens ${esc(decimal(candidate.sens))} · zoom ${esc(decimal(candidate.zoom))}<br>${esc(candidate.desc)}</p><div id="aim-clock" class="aim-clock">${session?.running?Math.ceil(session.remaining)+'s':'20s'}</div><div class="aim-live-metrics"><div><b id="aim-hits">${session?.hits||0}</b><span>命中</span></div><div><b id="aim-attempts">${session?.attempts||0}</b><span>尝试</span></div></div><p id="aim-status" class="tiny">${session?.running?'按住注意力，点击橙色目标；空点也会计入尝试。':result?`本轮 ${result.accuracy.toFixed(0)}% 命中，平均反应 ${result.reaction?result.reaction.toFixed(0):'—'} ms。`:'选一个候选设置开始，三个候选要在相同条件下比较。'}</p><button class="primary" id="aim-start" data-aim-start="${esc(candidate.id)}">${session?.running?'记录中…':'开始测试这组设置'}</button>${session?.running?'<button class="secondary" id="aim-stop">提前结束并保存</button>':''}</div></div></section>`;
  }
  function sensitivity(){
    const mode=state.sensitivity.active,p=profileFor(mode),meta=sensModes[mode],candidates=sensitivityCandidates(mode),recommendation=sensitivityRecommendation(mode),allTests=Object.values(state.sensitivity.profiles).flatMap(item=>item.tests),bestTest=allTests.slice().sort((a,b)=>b.accuracy-a.accuracy)[0];
    const eDpi=p.dpi*p.sens,scoped=eDpi*p.zoom;
    return `<div class="lab-hero"><div><p class="eyebrow">SENSITIVITY LAB / ${meta.eyebrow}</p><h2>别猜数字，测出你的控制区间。</h2><p>先固定硬件和显示设置，再分别比较通用枪械与狙击 / 开镜。DPI 是鼠标硬件档位，网页不会替你修改；这里记录设置、测试结果和复测建议。</p></div><div class="lab-stat-stack"><div class="lab-stat"><strong>${allTests.length}</strong><span>已完成测试</span></div><div class="lab-stat"><strong>${bestTest?bestTest.accuracy.toFixed(0)+'%':'—'}</strong><span>最高命中率</span></div></div></div><div class="lab-tabs" role="tablist" aria-label="灵敏度测试模式">${Object.entries(sensModes).map(([id,item])=>`<button class="lab-tab ${mode===id?'active':''}" data-sens-profile="${id}" role="tab" aria-selected="${mode===id}"><span>${id==='sniper'?'◉':'◎'}</span><span><strong>${item.title}</strong><small>${item.short}</small></span></button>`).join('')}</div><div class="sensitivity-layout"><section class="panel settings-panel"><div class="profile-title"><span class="profile-dot"></span><h2>${meta.title}设置</h2></div><p class="tiny">同一个 DPI 可以配不同的游戏灵敏度；狙击页额外记录开镜倍率。先保持一周不改，再看趋势。</p><div class="lab-form"><label class="field">鼠标 DPI<input class="number-input" data-sens-field="dpi" type="number" min="100" max="10000" step="50" value="${p.dpi}"><small>常见档位：400 / 800 / 1600。请以鼠标驱动当前值为准。</small></label><div class="preset-row"><span>还不确定 DPI？等 eDPI 试算</span><div>${[400,800,1600].map(d=>`<button class="preset-button" data-dpi-preset="${d}" data-preserve-edpi="true">${d} DPI</button>`).join('')}</div></div><label class="field">游戏灵敏度 <code>sensitivity</code><input class="number-input" data-sens-field="sens" type="number" min="0.01" max="20" step="0.01" value="${decimal(p.sens)}"><small>这项是通用枪械的基础灵敏度，狙击也会继承它。</small></label><label class="field">开镜灵敏度倍率 <code>zoom_sensitivity_ratio</code><input class="number-input" data-sens-field="zoom" type="number" min="0.1" max="2" step="0.01" value="${decimal(p.zoom)}"><small>只影响开镜时的相对速度；狙击模式重点比较这一项。</small></label></div><div class="metric-grid" id="sens-metrics"><div class="metric-card"><span class="metric-value" data-metric="edpi">${decimal(eDpi)}</span><span class="metric-label">通用 eDPI</span></div><div class="metric-card"><span class="metric-value" data-metric="cm">${cm360(eDpi).toFixed(1)}</span><span class="metric-label">通用理论 cm/360</span></div><div class="metric-card"><span class="metric-value" data-metric="scoped">${decimal(scoped)}</span><span class="metric-label">开镜等效 eDPI</span></div></div><div class="chart-note"><strong>怎么选：</strong>数字只方便比较，不代表水平。优先选能让你停稳、小幅修正不容易过冲，而且连续两周都舒服的组合。</div></section><section class="panel candidate-panel"><div class="section-head"><div><h2>三组候选设置</h2><p class="tiny">当前基准上下各取一档；${mode==='sniper'?'这里改变开镜倍率，基础 sens 保持不变。':'这里改变游戏 sens，DPI 和开镜倍率保持不变。'}</p></div><span class="tiny">${p.tests.length} 次本模式测试</span></div><div class="candidate-grid">${candidates.map(c=>{const stats=sensitivityStats(mode,c),isBest=stats.count&&p.tests.slice().sort((a,b)=>b.accuracy-a.accuracy)[0]?.candidate===c.id,candidateEdpi=mode==='sniper'?c.dpi*c.sens*c.zoom:c.dpi*c.sens;return `<article class="candidate-card ${c.id==='current'?'current':''} ${isBest?'best':''}"><div class="candidate-label"><strong>${c.name}</strong><span>${c.id==='current'?'BASELINE':c.id==='low'?'LOW':'HIGH'}</span></div><div class="candidate-setting">DPI <b>${c.dpi}</b> · sens <b>${decimal(c.sens)}</b><br>zoom <b>${decimal(c.zoom)}</b><br>${mode==='sniper'?'开镜 ':''}eDPI <b>${decimal(candidateEdpi)}</b> · cm/360 <b>${cm360(candidateEdpi).toFixed(1)}</b></div><p>${c.desc}</p><button class="secondary" data-aim-start="${c.id}">${stats.count?`再测这组 · ${stats.accuracy.toFixed(0)}%`:'开始 20 秒测试'}</button><span class="candidate-best">${stats.count?`${stats.count} 轮 · 平均 ${stats.accuracy.toFixed(0)}%`:'尚无结果'}</span></article>`;}).join('')}</div>${`<div class="chart-note"><strong>${recommendation.title}</strong><br>${recommendation.body}</div>`}</section></div>${aimMarkup(mode,candidates)}<section class="panel history-panel"><div class="section-head"><div><h2>本模式测试记录</h2><p class="tiny">按模式分开保存；换设备时从“备份与数据管理”导出 JSON。</p></div><a class="text-button" href="#recoil">去练压枪 ↗</a></div>${sensitivityHistory(mode)}</section>`;
  }
  const selectedWeapon=()=>weapons.find(w=>w.id===recoilWeaponId)||weapons[0];
  const weaponPattern=weapon=>recoilPatterns[weapon.pattern]||recoilPatterns.sniper;
  function recoilViewSession(weapon){
    if(recoilSession&&recoilSession.weaponId===weapon.id)return recoilSession;
    const saved=state.recoil.sessions.find(item=>item.weaponId===weapon.id);return saved?{...saved,active:false,points:saved.trace||[],result:saved}:null;
  }
  function recoilList(){
    const list=weapons.filter(w=>(recoilCategory==='全部'||w.category===recoilCategory)&&(!recoilQuery.trim()||`${w.name} ${w.alias} ${w.category}`.toLowerCase().includes(recoilQuery.trim().toLowerCase())));
    return list.length?list.map(w=>`<button class="weapon-row ${selectedWeapon().id===w.id?'active':''}" data-recoil-weapon="${w.id}"><span class="weapon-icon">${esc(w.alias.slice(0,3))}</span><span><strong>${esc(w.name)}</strong><small>${esc(w.category)} · ${w.shots} 发</small></span></button>`).join(''):'<p class="empty-history">没有匹配的武器。</p>';
  }
  function recoilShotOptions(weapon){return [10,20,30,weapon.shots].filter((n,i,a)=>n<=weapon.shots&&a.indexOf(n)===i).sort((a,b)=>a-b);}
  function recoilSuggestions(metrics,weapon){
    const suggestions=[];
    if(metrics.verticalError<-12)suggestions.push('后段下拉不足：从第 3～5 发就开始给鼠标持续向下的补偿。');
    if(metrics.verticalError>12)suggestions.push('下拉过早或过多：先只练前 10 发，让准星停在目标区再继续。');
    if(Math.abs(metrics.lateralError)>14)suggestions.push(metrics.lateralError>0?'整体偏右：左向修正还不够，先把横向摆动放小。':'整体偏左：右向修正过度，尝试只跟随参考线的转折。');
    if(!suggestions.length)suggestions.push(`这轮形状已经接近参考线。${weapon.shots>10?'下一轮保持同一距离，增加到 '+Math.min(weapon.shots,20)+' 发。':'下一轮练习射击节奏与射后回掩体。'}`);
    return suggestions;
  }
  function recoilSummary(){
    const sessions=state.recoil.sessions,avg=sessions.length?sessions.reduce((sum,s)=>sum+s.score,0)/sessions.length:0,best=sessions.slice().sort((a,b)=>b.score-a.score)[0];
    return `<div class="recoil-summary"><div><b>${sessions.length}</b><span>总记录</span></div><div><b>${sessions.length?avg.toFixed(0):'—'}</b><span>平均评分</span></div><div><b>${best?best.score.toFixed(0):'—'}</b><span>最高评分</span></div><div><b>${new Set(sessions.map(s=>s.weaponId)).size}</b><span>已练武器</span></div></div>`;
  }
  function recoilHistory(){
    const sessions=state.recoil.sessions.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,8);
    if(!sessions.length)return '<p class="empty-history">还没有压枪记录。选一把武器，按住画布从起点向下拖动。</p>';
    return `<div class="recoil-history">${sessions.map(s=>{const w=weapons.find(item=>item.id===s.weaponId);return `<div class="recoil-history-item"><div class="history-top"><strong>${esc(w?.name||s.weaponId)}</strong><span class="score">${s.score.toFixed(0)} 分</span></div><p>${esc(s.date)} · ${s.shots} 发 · 平均误差 ${s.meanError.toFixed(1)} px</p></div>`;}).join('')}</div>`;
  }
  function recoilCanvasMarkup(weapon,shots){
    const session=recoilViewSession(weapon),last=session?.result;
    return `<div class="recoil-chart-frame"><canvas id="recoil-canvas" width="760" height="460" aria-label="${esc(weapon.name)}压枪参考与我的轨迹"></canvas></div><div class="recoil-legend"><span><i class="legend-dot"></i>参考弹道 · 枪口上扬</span><span><i class="legend-dot ideal"></i>理想压枪 · 鼠标补偿</span><span><i class="legend-dot mine"></i>我的轨迹 · 实际记录</span></div>${last?`<div class="recoil-result"><h3>本轮建议 · ${last.score.toFixed(0)} 分</h3><p>${recoilSuggestions(last,weapon).map(esc).join('<br>')}</p><div class="result-metrics"><div><b>${last.meanError.toFixed(1)} px</b><span>平均误差</span></div><div><b>${last.verticalError>0?'+':''}${last.verticalError.toFixed(1)}</b><span>纵向偏差</span></div><div><b>${last.lateralError>0?'+':''}${last.lateralError.toFixed(1)}</b><span>横向偏差</span></div></div></div>`:''}`;
  }
  function drawRecoil(){
    const canvas=$('#recoil-canvas');if(!canvas)return;
    const ctx=canvas.getContext('2d'),W=760,H=460,origin={x:W/2,y:52},weapon=selectedWeapon(),pattern=weaponPattern(weapon).slice(0,Math.min(recoilShots,weapon.shots)),session=recoilViewSession(weapon);
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#101710';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#263423';ctx.lineWidth=1;for(let x=40;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=20;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.strokeStyle='#8fa66b35';ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(origin.x,20);ctx.lineTo(origin.x,H-20);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#8a9a84';ctx.font='12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';ctx.fillText('第 1 发起点',origin.x+10,origin.y-14);ctx.fillText(`${pattern.length} 发参照`,W-86,24);
    const toBullet=p=>({x:origin.x+p.x*1.7,y:origin.y-p.y*1.18}),toIdeal=p=>({x:origin.x-p.x*1.7,y:origin.y+p.y*1.18});
    const bullet=pattern.map(toBullet),ideal=pattern.map(toIdeal);
    function path(points,color,width,dash=[]){if(!points.length)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();ctx.restore();}
    path(bullet,'#ff955d',2.5);path(ideal,'#c8dd91',2,[7,5]);
    bullet.forEach((p,i)=>{ctx.fillStyle='#ff955d';ctx.beginPath();ctx.arc(p.x,p.y,i===0?5:3.5,0,Math.PI*2);ctx.fill();if(i===0||i%5===4){ctx.fillStyle='#f8c1a0';ctx.font='10px ui-monospace,monospace';ctx.fillText(String(i+1),p.x+7,p.y-6);}});
    if(session?.points?.length){const mine=session.points.map(p=>({x:origin.x+p.x,y:origin.y+p.y}));path(mine,'#70d6d2',3);mine.forEach((p,i)=>{if(i===0||i===mine.length-1){ctx.fillStyle='#70d6d2';ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();}});}
    ctx.fillStyle='#879685';ctx.font='12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';ctx.fillText('向下拖动鼠标，模拟反向补偿',16,H-18);ctx.fillText('参考线已标准化，不是逐像素官方坐标',W-244,H-18);
  }
  function recoil(){
    const weapon=selectedWeapon(),options=recoilShotOptions(weapon);if(!options.includes(recoilShots))recoilShots=options[options.length-1];const pattern=weaponPattern(weapon),last=recoilSession&&recoilSession.weaponId===weapon.id?recoilSession:null;
    return `<div class="lab-hero"><div><p class="eyebrow">RECOIL LAB / WEAPON CONTROL</p><h2>把每把枪的后坐力，练成可复现的动作。</h2><p>先看参考线，再按住画布从起点向下拖动，记录你的补偿轨迹。AK、M4、咖喱和其他武器会分别留档，方便看出真正需要修正的枪。</p></div><div class="lab-stat-stack"><div class="lab-stat"><strong>${weapons.length}</strong><span>可训练武器</span></div><div class="lab-stat"><strong>${state.recoil.sessions.length}</strong><span>压枪记录</span></div></div></div><div class="recoil-layout"><aside class="panel weapon-panel"><div class="section-head"><h2>选择武器</h2><span class="tiny">${weapons.length} 把</span></div><input class="weapon-search" id="recoil-search" type="search" placeholder="搜索 AK、咖喱、AWP…" aria-label="搜索武器" value="${esc(recoilQuery)}"><div class="weapon-filters">${recoilCategories.map(c=>`<button class="weapon-filter ${recoilCategory===c?'active':''}" data-recoil-filter="${c}">${c}</button>`).join('')}</div><p class="weapon-count">显示 ${weapons.filter(w=>(recoilCategory==='全部'||w.category===recoilCategory)&&(!recoilQuery.trim()||`${w.name} ${w.alias} ${w.category}`.toLowerCase().includes(recoilQuery.trim().toLowerCase()))).length} 把</p><div class="weapon-list" id="weapon-list">${recoilList()}</div></aside><section class="panel recoil-main"><div class="weapon-heading"><div><p class="eyebrow">${esc(weapon.category)} / ${esc(weapon.difficulty)}</p><h2>${esc(weapon.name)}</h2><p>${esc(weapon.note)}</p></div><span class="weapon-tag">${weapon.shots} 发训练参照</span></div>${recoilCanvasMarkup(weapon,recoilShots)}<div class="recoil-controls"><label>训练弹数<select id="recoil-shots" aria-label="训练弹数">${options.map(n=>`<option value="${n}" ${n===recoilShots?'selected':''}>前 ${n} 发</option>`).join('')}</select></label><button class="primary" id="recoil-start">${last?.active?'请在图上拖动…':'开始记录压枪'}</button>${last?.active?'<button class="secondary" id="recoil-finish">松开并保存</button>':'<button class="secondary" id="recoil-clear">清除本轮</button>'}</div><div class="recoil-instruction"><strong>动作：</strong>点击“开始记录”后，在画布任意位置按住鼠标，从橙色起点的方向向下拖动；松开后会把轨迹重采样到当前弹数。先做前 10 发，稳定后再延长。${pattern.length<=9?' 这把枪不是全自动，重点放在点击节奏与射后动作。':''}</div></section><aside class="panel recoil-side"><div class="section-head"><h2>训练概览</h2><span class="tiny">本地保存</span></div>${recoilSummary()}<div class="section-head"><h2>最近记录</h2></div>${recoilHistory()}<div class="chart-note"><strong>参考线说明：</strong>这是为了比较形状与补偿方向的标准化训练参照，不声称是 Valve 逐发坐标。版本更新后，请在游戏里用固定距离、固定站姿重新验证。</div></aside></div>`;
  }
  function stopAimClock(){clearInterval(aimInterval);aimInterval=null;}
  function setAimTarget(){if(!aimSession)return;aimSession.target=aimTargetPosition();aimSession.targetAt=performance.now();const target=$('.aim-target');if(target){target.style.left=`${aimSession.target.left}%`;target.style.top=`${aimSession.target.top}%`;}}
  function updateAimLive(){if(!aimSession)return;const clock=$('#aim-clock'),hits=$('#aim-hits'),attempts=$('#aim-attempts');if(clock)clock.textContent=`${Math.max(0,Math.ceil(aimSession.remaining))}s`;if(hits)hits.textContent=aimSession.hits;if(attempts)attempts.textContent=aimSession.attempts;}
  function startAimTest(candidateId){
    if(aimSession?.running)return;
    const mode=state.sensitivity.active,candidate=sensitivityCandidates(mode).find(item=>item.id===candidateId)||sensitivityCandidates(mode)[1];
    if(!candidate)return;
    stopAimClock();aimSession={mode,candidateId:candidate.id,candidate,running:true,remaining:20,hits:0,attempts:0,reactionTimes:[],target:aimTargetPosition(),targetAt:performance.now(),result:null};render();
    aimInterval=setInterval(()=>{if(!aimSession?.running){stopAimClock();return;}aimSession.remaining=Math.max(0,aimSession.remaining-.1);updateAimLive();if(aimSession.remaining<=0)finishAimTest(true);},100);
  }
  function finishAimTest(force=false){
    if(!aimSession?.running)return;
    if(!force&&aimSession.attempts<1){toast('至少点击一次目标后再保存本轮。');return;}
    const session=aimSession;stopAimClock();session.running=false;
    if(!session.attempts){session.result=null;render();toast('本轮没有有效点击，未写入记录。');return;}
    const reaction=session.reactionTimes.length?session.reactionTimes.reduce((sum,n)=>sum+n,0)/session.reactionTimes.length:0,result={id:globalThis.crypto?.randomUUID?.()||`aim-${Date.now()}`,date:today(),candidate:session.candidateId,label:session.candidate.name,dpi:session.candidate.dpi,sens:session.candidate.sens,zoom:session.candidate.zoom,hits:session.hits,attempts:session.attempts,accuracy:session.hits/session.attempts*100,reaction};
    const profile=profileFor(session.mode);profile.tests.unshift(result);profile.tests=profile.tests.slice(0,500);session.result=result;save();render();toast(`本轮完成：${result.accuracy.toFixed(0)}% 命中，已保存。`);
  }
  function resamplePath(points,total){
    if(!points.length)return [];
    if(points.length===1)return Array.from({length:total},()=>({...points[0]}));
    return Array.from({length:total},(_,i)=>{const index=Math.round(i*(points.length-1)/(total-1));return {...points[index]};});
  }
  function canvasPoint(event,canvas){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*(canvas.width/rect.width),y:(event.clientY-rect.top)*(canvas.height/rect.height)};}
  function finishRecoil(){
    if(!recoilSession?.active)return;
    if(recoilSession.points.length<3){toast('轨迹太短，请按住画布拖动一段再保存。');return;}
    const weapon=weapons.find(w=>w.id===recoilSession.weaponId)||selectedWeapon(),reference=weaponPattern(weapon).slice(0,recoilSession.shots),actual=resamplePath(recoilSession.points,reference.length),ideal=reference.map(p=>({x:-p.x*1.7,y:p.y*1.18}));
    const errors=actual.map((p,i)=>Math.hypot(p.x-ideal[i].x,p.y-ideal[i].y)),meanError=errors.reduce((sum,n)=>sum+n,0)/errors.length,verticalError=actual.reduce((sum,p,i)=>sum+p.y-ideal[i].y,0)/actual.length,lateralError=actual.reduce((sum,p,i)=>sum+p.x-ideal[i].x,0)/actual.length,coverage=ideal.at(-1)?.y?actual.at(-1).y/ideal.at(-1).y:1,score=Math.max(0,Math.min(100,100-meanError*.55-Math.abs(1-coverage)*18));
    const result={id:globalThis.crypto?.randomUUID?.()||`recoil-${Date.now()}`,date:today(),weaponId:weapon.id,shots:recoilSession.shots,score,meanError,verticalError,lateralError,trace:actual};state.recoil.sessions.unshift(result);state.recoil.sessions=state.recoil.sessions.slice(0,2000);recoilSession={active:false,weaponId:weapon.id,shots:recoilSession.shots,points:actual,result};save();render();toast(`${weapon.name} 本轮 ${score.toFixed(0)} 分，建议已生成。`);
  }
  function startRecoilRecord(){
    const weapon=selectedWeapon();recoilSession={active:true,weaponId:weapon.id,shots:recoilShots,points:[],pointerId:null,drawing:false,result:null};render();
  }
  function updateSensitivityMetrics(){
    const p=profileFor(state.sensitivity.active),eDpi=p.dpi*p.sens;
    const values={edpi:decimal(eDpi),cm:cm360(eDpi).toFixed(1),scoped:decimal(eDpi*p.zoom)};
    Object.entries(values).forEach(([key,value])=>{const node=$(`[data-metric="${key}"]`);if(node)node.textContent=value;});
  }
  function render(){
    const parts=location.hash.slice(1).split('/');route=parts[0]||'dashboard';
    if(route!=='sensitivity'&&aimSession?.running){stopAimClock();aimSession=null;}
    if(route!=='recoil'&&recoilSession?.active)recoilSession=null;
    const nav=route==='chapter'?'library':route,labels={dashboard:'训练台',library:'学习手册',plan:'八周计划',journal:'复盘日志',sensitivity:'灵敏度实验室',recoil:'压枪训练'};
    $('#page-label').textContent=labels[nav]||'训练台';$$('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===nav);if(a.dataset.nav===nav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    const html=route==='library'?library():route==='chapter'?reader(parts[1]):route==='plan'?plan():route==='journal'?journal():route==='sensitivity'?sensitivity():route==='recoil'?recoil():dashboard();
    $('#main').innerHTML=(warning?`<p class="storage-warning" role="alert">${esc(warning)}</p>`:'')+html;$$('[data-check]').forEach(el=>el.checked=!!state.checks[el.dataset.check]);
    document.title=`${route==='chapter'?(chapters.find(c=>c.id===parts[1])?.title||'学习手册'):(labels[nav]||'训练台')} · CS2 FIELDNOTES`;
    if(route==='recoil')drawRecoil();
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
    if(t.dataset.sensProfile){stopAimClock();aimSession=null;state.sensitivity.active=t.dataset.sensProfile;save();render();return;}
    if(t.dataset.dpiPreset){const p=profileFor(state.sensitivity.active),oldEdpi=p.dpi*p.sens;p.dpi=Number(t.dataset.dpiPreset);if(t.dataset.preserveEdpi==='true')p.sens=numberIn(oldEdpi/p.dpi,.01,20,p.sens);save();render();return;}
    if(t.dataset.aimStart){startAimTest(t.dataset.aimStart);return;}
    if(t.id==='aim-stop'){finishAimTest(false);return;}
    if(t.dataset.recoilFilter){
      recoilCategory=t.dataset.recoilFilter;const first=weapons.find(w=>(recoilCategory==='全部'||w.category===recoilCategory)&&(!recoilQuery.trim()||`${w.name} ${w.alias} ${w.category}`.toLowerCase().includes(recoilQuery.trim().toLowerCase())));if(first)recoilWeaponId=first.id;recoilSession=null;render();return;
    }
    if(t.dataset.recoilWeapon){recoilWeaponId=t.dataset.recoilWeapon;recoilSession=null;render();return;}
    if(t.id==='recoil-start'){if(!recoilSession?.active)startRecoilRecord();return;}
    if(t.id==='recoil-finish'){finishRecoil();return;}
    if(t.id==='recoil-clear'){recoilSession=null;render();return;}
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
  document.addEventListener('pointerdown',e=>{
    const aimBoard=e.target.closest?.('#aim-board');
    if(aimBoard&&aimSession?.running){const hit=!!e.target.closest('.aim-target');aimSession.attempts++;if(hit){aimSession.hits++;aimSession.reactionTimes.push(performance.now()-aimSession.targetAt);setAimTarget();}updateAimLive();e.preventDefault();return;}
    const canvas=e.target.closest?.('#recoil-canvas');
    if(canvas&&recoilSession?.active){const point=canvasPoint(e,canvas);recoilSession.pointerId=e.pointerId;recoilSession.drawing=true;recoilSession.start=point;recoilSession.points=[{x:0,y:0}];try{canvas.setPointerCapture(e.pointerId);}catch{}drawRecoil();e.preventDefault();}
  });
  document.addEventListener('pointermove',e=>{
    if(!recoilSession?.active||!recoilSession.drawing||recoilSession.pointerId!==e.pointerId)return;const canvas=$('#recoil-canvas');if(!canvas)return;const point=canvasPoint(e,canvas),next={x:point.x-recoilSession.start.x,y:point.y-recoilSession.start.y},last=recoilSession.points[recoilSession.points.length-1];if(Math.hypot(next.x-last.x,next.y-last.y)>1){recoilSession.points.push(next);drawRecoil();}e.preventDefault();
  });
  document.addEventListener('pointerup',e=>{if(recoilSession?.active&&recoilSession.drawing&&recoilSession.pointerId===e.pointerId){recoilSession.drawing=false;recoilSession.pointerId=null;finishRecoil();}});
  document.addEventListener('pointercancel',e=>{if(recoilSession?.active&&recoilSession.pointerId===e.pointerId){recoilSession.drawing=false;recoilSession.pointerId=null;finishRecoil();}});
  document.addEventListener('change',async e=>{
    const t=e.target;
    if(t.matches('[data-task]')){const i=Number(t.dataset.task),d=day();d.tasks=t.checked?[...new Set([...d.tasks,i])]:d.tasks.filter(n=>n!==i);save();const y=window.scrollY;render();window.scrollTo(0,y);}
    if(t.matches('[data-check]')){state.checks[t.dataset.check]=t.checked;save();}
    if(t.id==='timer-length'){stopTimer();total=Number(t.value);remaining=total;timerUI();}
    if(t.id==='log-filter'){logFilter=t.value;$('#log-list').innerHTML=logCards();}
    if(t.id==='recoil-shots'){recoilShots=Number(t.value);if(recoilSession?.active)recoilSession=null;render();}
    if(t.id==='import-data'){
      const file=t.files?.[0];if(!file)return;
      try{
        if(file.size>10*1024*1024)throw Error('备份文件不能超过 10 MB');
        const payload=JSON.parse(await file.text()),imported=validate(payload),hasSensitivity=Object.prototype.hasOwnProperty.call(payload,'sensitivity');
        const importedTests=Object.values(imported.sensitivity.profiles).reduce((sum,p)=>sum+p.tests.length,0),importedRecoil=imported.recoil.sessions.length;
        if(!confirm(`导入 ${imported.logs.length} 篇复盘、${importedTests} 次灵敏度测试、${importedRecoil} 条压枪记录与 ${Object.keys(imported.days).length} 天训练记录？同编号的数据将以备份为准。`)){t.value='';return;}
        const logs=new Map(state.logs.map(l=>[l.id,l]));imported.logs.forEach(l=>logs.set(l.id,l));
        const mergeById=(current,incoming,limit)=>{const map=new Map(current.map(item=>[item.id,item]));incoming.forEach(item=>map.set(item.id,item));return [...map.values()].slice(0,limit);};
        const importedSensitivity=hasSensitivity?imported.sensitivity:state.sensitivity,importedRecoilData=Object.prototype.hasOwnProperty.call(payload,'recoil')?imported.recoil:state.recoil;
        state={version:1,days:{...state.days,...imported.days},read:[...new Set([...state.read,...imported.read])],bookmarks:[...new Set([...state.bookmarks,...imported.bookmarks])],checks:{...state.checks,...imported.checks},weeks:[...new Set([...state.weeks,...imported.weeks])],logs:[...logs.values()],lastChapter:imported.lastChapter,sensitivity:{active:importedSensitivity.active,profiles:{rifle:{...state.sensitivity.profiles.rifle,...importedSensitivity.profiles.rifle,tests:mergeById(state.sensitivity.profiles.rifle.tests,importedSensitivity.profiles.rifle.tests,500)},sniper:{...state.sensitivity.profiles.sniper,...importedSensitivity.profiles.sniper,tests:mergeById(state.sensitivity.profiles.sniper.tests,importedSensitivity.profiles.sniper.tests,500)}}},recoil:{sessions:mergeById(state.recoil.sessions,importedRecoilData.sessions,2000)}};
        storageOK=true;warning='';const persisted=save();$('#backup-dialog').close();render();toast(persisted?'备份已合并并保存。':'已导入到当前页面，但浏览器保存失败，请导出备份。');
      }catch(error){toast(`导入失败：${error.message}。现有记录未改变。`);}t.value='';
    }
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='chapter-search'){query=e.target.value;$('#chapter-grid').innerHTML=cards();$('#result-count').textContent=`共 ${matches().length} 章`;}
    if(e.target.id==='daily-focus'){day().focus=e.target.value;save();}
    if(e.target.matches('[data-sens-field]')){if(e.target.value==='')return;const key=e.target.dataset.sensField,p=profileFor(state.sensitivity.active),limits={dpi:[100,10000,p.dpi],sens:[.01,20,p.sens],zoom:[.1,2,p.zoom]},rule=limits[key];if(!rule)return;p[key]=numberIn(e.target.value,rule[0],rule[1],rule[2]);save();updateSensitivityMetrics();}
    if(e.target.id==='recoil-search'){recoilQuery=e.target.value;const list=$('#weapon-list');if(list)list.innerHTML=recoilList();const count=$('.weapon-count');if(count)count.textContent=`显示 ${weapons.filter(w=>(recoilCategory==='全部'||w.category===recoilCategory)&&(!recoilQuery.trim()||`${w.name} ${w.alias} ${w.category}`.toLowerCase().includes(recoilQuery.trim().toLowerCase()))).length} 把`;}
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
    const tools=[{name:'read_training_progress',title:'读取训练进度',description:'读取此浏览器的章节、周计划、今日训练、灵敏度和压枪完成数量，不返回复盘正文。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('不接受额外参数');return{date:today(),dailyTasks:day().tasks.length,readChapters:state.read.length,completedWeeks:state.weeks.length,logCount:state.logs.length,sensitivityTests:Object.values(state.sensitivity.profiles).reduce((sum,p)=>sum+p.tests.length,0),recoilSessions:state.recoil.sessions.length};}},
    {name:'open_training_chapter',title:'打开训练章节',description:'打开指定章节进行阅读，不标记已学完。',inputSchema:{type:'object',properties:{chapterId:{type:'string',enum:chapters.map(c=>c.id)}},required:['chapterId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).some(k=>k!=='chapterId')||!chapterIDs.has(input.chapterId))throw Error('无效章节编号');history.replaceState(null,'',`#chapter/${input.chapterId}`);render();return{chapterId:input.chapterId,title:chapters.find(c=>c.id===input.chapterId).title};}}];
    for(const tool of tools){try{Promise.resolve(mc.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();

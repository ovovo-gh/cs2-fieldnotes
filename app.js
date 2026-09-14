(() => {
  'use strict';
  const chapters=window.HANDBOOK||[], $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today=()=>dateKey(new Date()), KEY='cs2-fieldnotes-v1';
  const sensitivityProfile=mode=>({dpi:800,sens:1,zoom:mode==='sniper'?0.8:1,tests:[]});
  const blank=()=>({version:1,days:{},read:[],bookmarks:[],checks:{},weeks:[],logs:[],lastChapter:'01',sensitivity:{active:'rifle',profiles:{rifle:sensitivityProfile('rifle'),sniper:sensitivityProfile('sniper')}},recoil:{sessions:[]},tactics:{lineups:[]}});
  const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));
  const tacticMapIDs=new Set(['dust2','mirage','inferno']),tacticUtilityIDs=new Set(['smoke','flash','he','fire']),tacticSideIDs=new Set(['T','CT']);
  const validHttpUrl=value=>{if(!value)return true;try{const url=new URL(value);return url.protocol==='http:'||url.protocol==='https:';}catch{return false;}};
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
      const readPoints=(value,limit)=>Array.isArray(value)?value.slice(0,limit).filter(p=>p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y))).map(p=>({x:numberIn(p.x,-1200,1200,0),y:numberIn(p.y,-1200,1200,0)})):[];
      const trace=readPoints(session.trace,600),sampleTrace=readPoints(session.sampleTrace,150),shots=numberIn(session.shots,1,150,10),shotErrors=Array.isArray(session.shotErrors)?session.shotErrors.slice(0,150).map(n=>numberIn(n,0,2000,0)):[];
      s.recoil.sessions.push({id:String(session.id),date:String(session.date),weaponId:String(session.weaponId),shots,targetShots:numberIn(session.targetShots,1,150,shots),score:numberIn(session.score,0,100,0),meanError:numberIn(session.meanError,0,2000,0),verticalError:numberIn(session.verticalError,-2000,2000,0),lateralError:numberIn(session.lateralError,-2000,2000,0),lateShots:numberIn(session.lateShots,0,150,0),timingAccuracy:numberIn(session.timingAccuracy,0,100,100),shotErrors,trace,sampleTrace});
    }
    const rawTactics=data.tactics&&typeof data.tactics==='object'&&!Array.isArray(data.tactics)?data.tactics:{};
    if(rawTactics.lineups!==undefined&&!Array.isArray(rawTactics.lineups))throw Error('投掷卡格式不正确');
    if((rawTactics.lineups||[]).length>500)throw Error('投掷卡数量超出限制');
    const lineupIDs=new Set();
    for(const lineup of rawTactics.lineups||[]){
      if(!lineup||typeof lineup!=='object'||!safeId.test(String(lineup.id||''))||lineupIDs.has(String(lineup.id)))throw Error('投掷卡编号不正确');
      const mapId=String(lineup.mapId||''),utility=String(lineup.utility||''),side=String(lineup.side||'');
      if(!tacticMapIDs.has(mapId)||!tacticUtilityIDs.has(utility)||!tacticSideIDs.has(side))throw Error('投掷卡地图或道具类型不正确');
      const text=(key,max,required=false)=>{if(lineup[key]===undefined&&!required)return '';if(typeof lineup[key]!=='string'||lineup[key].length>max)throw Error('投掷卡文字格式不正确');return lineup[key].trim();};
      const point=(value,key)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error(`投掷卡${key}坐标不正确`);if(typeof value.label!=='string'||value.label.length>80)throw Error(`投掷卡${key}名称不正确`);return {label:value.label.trim(),x:numberIn(value.x,0,100,50),y:numberIn(value.y,0,100,50)};};
      const steps=Array.isArray(lineup.steps)?lineup.steps.slice(0,8).map(step=>{if(typeof step!=='string'||step.length>260)throw Error('投掷卡步骤格式不正确');return step.trim();}).filter(Boolean):[];
      if(lineup.steps!==undefined&&!Array.isArray(lineup.steps))throw Error('投掷卡步骤格式不正确');
      const media=lineup.media&&typeof lineup.media==='object'&&!Array.isArray(lineup.media)?lineup.media:{};
      for(const key of ['source','poster','video']){if(lineup[key]!==undefined&&typeof lineup[key]!=='string')throw Error('投掷卡链接格式不正确');if(media[key]!==undefined&&typeof media[key]!=='string')throw Error('投掷卡媒体格式不正确');}
      const source=text('source',1000),poster=typeof media.poster==='string'?media.poster.trim():'',video=typeof media.video==='string'?media.video.trim():'';
      if(!validHttpUrl(source)||!validHttpUrl(poster)||!validHttpUrl(video))throw Error('投掷卡只允许 http / https 链接');
      lineupIDs.add(String(lineup.id));
      s.tactics.lineups.push({id:String(lineup.id),mapId,utility,side,name:text('name',120,true),from:point(lineup.from,'站位'),target:point(lineup.target,'落点'),technique:text('technique',80),movement:text('movement',80),airTime:text('airTime',40),steps,result:text('result',1000),source,updated:text('updated',30),media:{poster,video},custom:true});
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
  let recoilWeaponId='ak47',recoilCategory='全部',recoilQuery='',recoilShots=10,recoilSession=null,recoilFrame=null;
  const recoilErrorThreshold=24;
  const recoilCategories=['全部','步枪','冲锋枪','机枪'];
  const recoilDeltas=value=>String(value||'').trim().split(/\s*;\s*/).filter(Boolean).map(pair=>{
    const [dx,dy]=pair.split(',').map(Number);return {dx:Number.isFinite(dx)?dx:0,dy:Number.isFinite(dy)?dy:0};
  });
  const cumulativeRecoilPath=value=>{
    let x=0,y=0;return recoilDeltas(value).map(({dx,dy})=>{x-=dx;y+=dy;return {x,y};});
  };
  const recoilPatterns=Object.fromEntries(Object.entries(window.CS2_RECOIL_DATA||{}).map(([key,value])=>[key,cumulativeRecoilPath(value)]));
  const recoilInterval=weapon=>60000/Math.max(1,Number(weapon?.fireRate)||600);
  const weapons=[
    {id:'ak47',name:'AK-47',alias:'AK',category:'步枪',pattern:'ak47',recoilType:'fixed',magazine:30,reserveMags:3,fireRate:600,difficulty:'进阶',note:'前 10 发先练垂直下拉，再加入左右反向修正。'},
    {id:'m4a4',name:'M4A4',alias:'M4',category:'步枪',pattern:'m4a4',recoilType:'fixed',magazine:30,reserveMags:4,fireRate:666,difficulty:'进阶',note:'横向摆动比 AK 更温和，先练稳定的中段连发。'},
    {id:'m4a1s',name:'M4A1-S',alias:'M4-S',category:'步枪',pattern:'m4a1s',recoilType:'fixed',magazine:20,reserveMags:2,fireRate:600,difficulty:'中等',note:'这是 20 发弹匣；消音步枪的参照线更收敛，适合对比 M4A4。'},
    {id:'galil',name:'Galil AR',alias:'咖喱',category:'步枪',pattern:'galil',recoilType:'fixed',magazine:35,reserveMags:4,fireRate:666,difficulty:'进阶',note:'这是 35 发弹匣；前段上扬与横向变化明显，先把前 10 发压在同一区域。'},
    {id:'famas',name:'FAMAS',alias:'法玛斯',category:'步枪',pattern:'famas',recoilType:'fixed',magazine:25,reserveMags:4,fireRate:666,difficulty:'中等',note:'全自动参照为 25 发；建议用 10～15 发短连发，不必每次打满。'},
    {id:'aug',name:'AUG',alias:'AUG',category:'步枪',pattern:'aug',recoilType:'fixed',magazine:30,reserveMags:3,fireRate:600,difficulty:'中等',note:'当前参照是默认未开镜路径；开镜后请单独验证手感。'},
    {id:'sg553',name:'SG 553',alias:'SG',category:'步枪',pattern:'sg553',recoilType:'fixed',magazine:30,reserveMags:3,fireRate:666,difficulty:'进阶',note:'当前参照是默认未开镜路径；开镜模式与观察节奏要分开练。'},
    {id:'mac10',name:'MAC-10',alias:'MAC',category:'冲锋枪',pattern:'mac10',recoilType:'fixed',magazine:30,reserveMags:3,fireRate:800,difficulty:'中等',note:'用近距离跟枪练习，不要把冲锋枪的节奏搬到远距离。'},
    {id:'mp9',name:'MP9',alias:'MP9',category:'冲锋枪',pattern:'mp9',recoilType:'fixed',magazine:30,reserveMags:2,fireRate:857,difficulty:'中等',note:'先练前 10 发跟随，再练急停后的小范围横向修正。'},
    {id:'mp7',name:'MP7',alias:'MP7',category:'冲锋枪',pattern:'mp7',recoilType:'fixed',magazine:30,reserveMags:3,fireRate:750,difficulty:'中等',note:'用固定中近距离比较压枪与移动跟枪的差异。'},
    {id:'mp5sd',name:'MP5-SD',alias:'MP5',category:'冲锋枪',pattern:'mp5sd',recoilType:'fixed',magazine:30,reserveMags:3,fireRate:800,difficulty:'中等',note:'把重点放在短距离补枪与持续跟随目标。'},
    {id:'ump45',name:'UMP-45',alias:'UMP',category:'冲锋枪',pattern:'ump45',recoilType:'fixed',magazine:25,reserveMags:3,fireRate:666,difficulty:'中等',note:'这是 25 发弹匣；中近距离更容易控制，先固定交火距离。'},
    {id:'p90',name:'P90',alias:'P90',category:'冲锋枪',pattern:'p90',recoilType:'fixed',magazine:50,reserveMags:2,fireRate:857,difficulty:'进阶',note:'这是 50 发弹匣；弹匣长但不代表可以无脑扫，记录前 20 发横向误差。'},
    {id:'bizon',name:'PP-Bizon',alias:'Bizon',category:'冲锋枪',pattern:'bizon',recoilType:'fixed',magazine:64,reserveMags:2,fireRate:750,difficulty:'中等',note:'这是 64 发弹匣；用作近距离移动跟枪专项，别把压枪与跟枪混为一谈。'},
    {id:'m249',name:'M249',alias:'M249',category:'机枪',pattern:'m249',recoilType:'fixed',magazine:100,reserveMags:2,fireRate:750,difficulty:'高',note:'这是 100 发弹匣；前段控制后再观察横向漂移，建议分段练习。'},
    {id:'negev',name:'Negev',alias:'Negev',category:'机枪',pattern:'negev',recoilType:'fixed',magazine:150,reserveMags:2,fireRate:800,difficulty:'高',note:'这是 150 发弹匣；前段上扬后进入稳定区，建议按 10～20 发分段练。'}
  ];
  weapons.forEach(weapon=>{weapon.patternShots=weapon.pattern?recoilPatterns[weapon.pattern]?.length||0:0;});
  const supportedRecoilWeapons=new Set(weapons.map(weapon=>weapon.id));
  const tacticsData=window.CS2_TACTICS_DATA||{snapshot:'',maps:[],utilityTypes:[]},tacticMaps=tacticsData.maps||[],tacticUtilityTypes=tacticsData.utilityTypes||[];
  const tacticPlayerClamp=value=>Math.max(3,Math.min(97,Number(value)||50)),tacticPlayerOffsets=[[-8,-4],[-4,-1],[0,0],[4,1],[8,4]],tacticPlayerDefaults=map=>{
    const spawnPlayers=(side,spawn)=>tacticPlayerOffsets.map(([dx,dy],index)=>({id:side+String(index+1),side,label:side+String(index+1),x:tacticPlayerClamp(Number(spawn?.x)+dx),y:tacticPlayerClamp(Number(spawn?.y)+dy)}));
    return [...spawnPlayers('CT',map.spawns?.CT),...spawnPlayers('T',map.spawns?.T)];
  };
  let tacticsMapId='dust2',tacticPlaceUtility='smoke',tacticPlaceSide='T',tacticsLineupId='',tacticsPlacementMode=false,tacticsLineupPickMode=null,tacticThrowSerial=0,tacticLineupQuery='',tacticLineupFilter='all',tacticLineupEditingId=null;
  const tacticPlans=Object.fromEntries(tacticMaps.map(map=>[map.id,[]]));
  const tacticPlayers=Object.fromEntries(tacticMaps.map(map=>[map.id,tacticPlayerDefaults(map)]));
  let tacticDraggingPlayer=null;
  const tacticTimelineMax=120;
  let tacticsTimeline={time:0,running:false,side:'T'},tacticsTimelineFrame=null,tacticsTimelineLast=0;
  const heading=(eye,title,sub,extra='')=>`<div class="page-heading"><div><p class="eyebrow">${eye}</p><h1>${title}</h1><p class="muted">${sub}</p></div>${extra}</div>`;
  const selectedTacticMap=()=>tacticMaps.find(map=>map.id===tacticsMapId)||tacticMaps[0];
  const tacticUtilityById=id=>tacticUtilityTypes.find(item=>item.id===id);
  const tacticUtilityShort=id=>({smoke:'烟',flash:'闪',he:'雷',fire:'火'}[id]||'道');
  const tacticDisplayTime=value=>String(Math.round(Number(value)||0));
  const customTacticLineupsFor=mapId=>(state.tactics?.lineups||[]).filter(item=>item.mapId===mapId);
  const tacticLineupsFor=mapId=>[...(tacticMaps.find(map=>map.id===mapId)?.lineups||[]),...customTacticLineupsFor(mapId)];
  const customTacticLineupById=id=>(state.tactics?.lineups||[]).find(item=>item.id===id);
  const tacticLineupMatches=mapId=>{const query=tacticLineupQuery.trim().toLowerCase(),filter=tacticLineupFilter;return tacticLineupsFor(mapId).filter(item=>(filter==='all'||item.utility===filter)&&(!query||`${item.name} ${item.utility} ${item.technique} ${item.movement} ${item.from?.label||''} ${item.target?.label||''} ${item.result||''}`.toLowerCase().includes(query)));};
  const tacticPlanFor=mapId=>tacticPlans[mapId]||(tacticPlans[mapId]=[]);
  const tacticPlanCount=(mapId,utility,side)=>tacticPlanFor(mapId).filter(item=>item.utility===utility&&(!side||item.side===side)).length;
  const tacticPlayersFor=mapId=>tacticPlayers[mapId]||(tacticPlayers[mapId]=tacticPlayerDefaults(selectedTacticMap()));
  const tacticPlayerById=(mapId,id)=>tacticPlayersFor(mapId).find(player=>player.id===id);
  function selectedTacticLineup(mapId=selectedTacticMap()?.id){const list=tacticLineupsFor(mapId),selected=list.find(item=>item.id===tacticsLineupId);return selected||null;}
  function tacticPct(value){return Math.max(0,Math.min(100,Number(value)||0));}
  function tacticPlayerMarkup(player){const tint=player.side==='CT'?'#8ad7fa':'#ffbf7c',label=player.label||player.id;return `<g class="tactic-player-marker tactic-player-${player.side==='CT'?'ct':'t'}" data-tactic-player="${esc(player.id)}" transform="translate(${tacticPct(player.x)} ${tacticPct(player.y)})" tabindex="0" role="button" aria-label="${esc(player.side)} 方 ${esc(label)}，可拖动"><circle r="1.15" style="--player-color:${tint}"><title>${esc(player.side)} 方 ${esc(label)} · 可拖动调整走位</title></circle><text x="0" y="0">${esc(label.replace(/^(?:CT|T)/,''))}</text></g>`;}
  function tacticTimelineDuration(itemOrId,side=tacticsTimeline.side){const item=typeof itemOrId==='string'?tacticUtilityById(itemOrId):itemOrId,duration=item?.timelineWindowSeconds??item?.durationSeconds;if(duration&&typeof duration==='object')return Number(duration[side]||duration.T||7);return Number(duration)||0;}
  function tacticTimelineStart(itemOrId){const item=typeof itemOrId==='string'?tacticUtilityById(itemOrId):itemOrId;return Math.max(0,Number(item?.timelineStartSeconds)||0);}
  function tacticTimelineEnd(itemOrId,side=tacticsTimeline.side){return tacticTimelineStart(itemOrId)+tacticTimelineDuration(itemOrId,side);}
  function tacticTimelineDurationLabel(item){if(item?.id==='fire')return 'T 7.0 秒 / CT 5.5 秒';if(item?.id==='flash')return '1.5 秒后爆炸 · 实际致盲最长 5 秒 · 画面保留 1 秒';if(item?.id==='he')return '1.5 秒后爆炸 · 瞬时 · 画面保留 1 秒';return item?.duration||'';}
  function tacticTimelineState(item,time){const start=tacticTimelineStart(item),end=tacticTimelineEnd(item);if(time<=0)return '待投掷';if(time<start)return '引信中';if(item.id==='he')return time<end?'爆炸事件':'已爆炸';if(item.id==='flash')return time<end?'致盲窗口':'已结束';return time<end?'生效中':'已结束';}
  function tacticTimelineThrowStart(throwItem){return Math.max(0,Number(throwItem?.time)||0)+tacticTimelineStart(throwItem?.utility);}
  function tacticTimelineThrowEnd(throwItem){const side=throwItem?.side==='CT'?'CT':'T';return tacticTimelineThrowStart(throwItem)+tacticTimelineDuration(throwItem?.utility,side);}
  function tacticTimelineThrowState(throwItem,time){const throwAt=Math.max(0,Number(throwItem?.time)||0),start=tacticTimelineThrowStart(throwItem),end=tacticTimelineThrowEnd(throwItem);if(time<throwAt||time<=0)return '待投掷';if(time<start)return '引信中';if(throwItem.utility==='he')return time<end?'爆炸事件':'已爆炸';if(throwItem.utility==='flash')return time<end?'致盲窗口':'已结束';return time<end?'生效中':'已结束';}
  function tacticTimelineEffectWindow(effect){const item=tacticUtilityById(effect.dataset.utility),rawTime=Number(effect.dataset.throwTime),side=effect.dataset.throwSide==='CT'?'CT':tacticsTimeline.side,offset=Number.isFinite(rawTime)?rawTime:0,start=offset+tacticTimelineStart(item);return {start,end:start+tacticTimelineDuration(item,side)};}
  function tacticTimelineGenericStrategy(time=tacticsTimeline.time,side=tacticsTimeline.side){const fire=tacticTimelineEnd('fire',side),flashEnd=tacticTimelineEnd('flash'),heStart=tacticTimelineStart('he');if(time<=0)return '<strong>准备阶段：</strong>按下播放后，从 0 秒开始观察“投掷 → 引信 → 生效 → 结束”。先把烟、火的剩余时间和闪光 / HE 的短窗口对齐，再决定是否进点。';if(time<heStart)return '<strong>0–1.5 秒：</strong>HE / 闪光仍在引信窗口；不要把尚未爆炸的道具当作已经创造了空间，跟进者应先等确认或利用掩体。';if(time<Math.min(fire,flashEnd))return `<strong>1.5–${Math.min(fire,flashEnd).toFixed(1)} 秒：</strong>HE 已完成爆炸，闪光进入最长致盲窗口；${side==='T'?'T 方火焰':'CT 方火焰'}也仍在封锁区域，适合短促跟进、清近点或借烟火分割枪线。`;if(fire<=flashEnd&&time<flashEnd)return `<strong>${fire.toFixed(1)}–${flashEnd.toFixed(1)} 秒：</strong>火焰已结束，但闪光仍可能处于致盲窗口；不要只按火焰结束判断区域已经安全。`;if(flashEnd<fire&&time<fire)return `<strong>${flashEnd.toFixed(1)}–${fire.toFixed(1)} 秒：</strong>闪光窗口已结束，${side==='T'?'T 方火焰':'CT 方火焰'}仍在封锁区域；继续利用烟火隔离枪线，或等待火焰结束再进退。`;if(time<15)return `<strong>${fire.toFixed(1)}–15 秒：</strong>火焰已经结束，但烟雾仍可持续遮挡；${side==='T'?'进攻方要抓住烟边转移或补第二颗烟。':'防守方要利用烟散前的时间回到交叉火力。'}注意烟雾边缘的视线变化。`;if(time<18)return '<strong>15–18 秒：</strong>烟雾仍在接近结束窗口；开始为下一轮枪线、补烟或撤退路线做准备。';return '<strong>18 秒后：</strong>标准烟雾周期结束。把这个时间点当作重新争夺视线、转点或结束拖延的提醒。';}
  function tacticTimelineStrategy(time=tacticsTimeline.time,side=tacticsTimeline.side){const plan=tacticPlanFor(tacticsMapId),pending=plan.filter(item=>time<Number(item.time)||time<=0),active=plan.filter(item=>{const start=tacticTimelineThrowStart(item),end=tacticTimelineThrowEnd(item);return time>0&&time>=start&&time<end;}),next=plan.filter(item=>Number(item.time)>time).sort((a,b)=>Number(a.time)-Number(b.time))[0];if(!plan.length)return '<strong>空方案：</strong>地图目前没有固定道具。先选择道具、设定投掷时刻并点击落点；有了至少两颗道具后，再用播放检查它们的衔接。';if(time<=0)return '<strong>方案预览：</strong>已布置 '+plan.length+' 颗道具；橙色竖线标记投掷时刻。点击播放，观察每颗道具何时从“待投掷”进入“生效中”。';if(active.length){const nextText=next?'；下一颗是“'+esc(tacticUtilityShort(next.utility))+'”，'+tacticDisplayTime(next.time)+' 秒投掷。':'。';return '<strong>当前策略窗口：</strong>'+active.length+' 颗道具正在生效'+nextText+(side==='T'?'T 方可利用烟火边缘分割枪线，再让后续队员按顺序进点。':'CT 方优先利用仍在生效的区域拖延，等效果结束前保持交叉火力。');}if(next)return '<strong>下一拍：</strong>当前没有道具生效；'+tacticDisplayTime(next.time)+' 秒投掷“'+esc(tacticUtilityShort(next.utility))+'”，还剩 '+Math.max(0,Math.round(Number(next.time)-time))+' 秒。不要把计划中的落点误当成已经产生效果。';if(pending.length)return '<strong>方案提醒：</strong>还有 '+pending.length+' 颗道具尚未到投掷时刻；把时间轴拖回对应秒数，检查它们与前一颗道具的衔接。';return '<strong>复盘窗口：</strong>当前方案的道具效果已结束；拖动时间轴回看投掷顺序，或删除后重新布置下一套组合。';}
  function tacticTimelineMapStatus(map=selectedTacticMap(),time=tacticsTimeline.time){const plan=tacticPlanFor(map?.id),counts=plan.reduce((result,throwItem)=>{const throwAt=Math.max(0,Number(throwItem.time)||0),start=tacticTimelineThrowStart(throwItem),end=tacticTimelineThrowEnd(throwItem);if(time>0&&time>=start&&time<end)result.active+=1;else if(time<throwAt)result.future+=1;else if(time<start)result.arming+=1;else result.expired+=1;return result;},{active:0,arming:0,future:0,expired:0});if(!plan.length)return '尚未布置道具 · 先设定时间，再点击地图落点';if(time<=0)return `方案已布置 ${plan.length} 颗 · 当前 0.0 秒`;return `当前生效 ${counts.active} · 引信中 ${counts.arming} · 待投掷 ${counts.future} · 已结束 ${counts.expired}`;}
  function requestTacticsFrame(callback){return globalThis.requestAnimationFrame?globalThis.requestAnimationFrame(callback):setTimeout(()=>callback(performance.now()),16);}
  function cancelTacticsFrame(id){if(id===null)return;if(globalThis.cancelAnimationFrame)globalThis.cancelAnimationFrame(id);else clearTimeout(id);}
  function stopTacticsTimeline(){if(tacticsTimelineFrame!==null)cancelTacticsFrame(tacticsTimelineFrame);tacticsTimelineFrame=null;tacticsTimeline.running=false;tacticsTimelineLast=0;}
  function updateTacticTimelineUI(){
    const time=Math.max(0,Math.min(tacticTimelineMax,tacticsTimeline.time)),ratio=time/tacticTimelineMax,slider=$('#tactic-timeline-slider'),readout=$('#tactic-time-readout'),play=$('#tactic-timeline-play'),side=$('#tactic-side');
    if(slider){slider.value=time;slider.setAttribute('aria-valuenow',tacticDisplayTime(time));}
    if(readout)readout.textContent=`${tacticDisplayTime(time)} / ${tacticTimelineMax} 秒`;
    if(play){play.textContent=tacticsTimeline.running?'暂停时间轴':'播放时间轴';play.setAttribute('aria-pressed',String(tacticsTimeline.running));}
    if(side&&side.value!==tacticsTimeline.side)side.value=tacticsTimeline.side;
    $$('[data-tactic-track]').forEach(row=>{const throwItem={utility:row.dataset.utility,time:Number(row.dataset.throwTime)||0,side:row.dataset.throwSide},start=tacticTimelineThrowStart(throwItem),duration=tacticTimelineThrowEnd(throwItem)-start,end=start+duration,cursor=$('.tactic-track-cursor',row),throwMarker=$('.tactic-throw-time-marker',row),fill=$('.tactic-track-fill',row),stateNode=$('.tactic-track-state',row);if(cursor)cursor.style.left=`${ratio*100}%`;if(throwMarker)throwMarker.style.left=`${Math.min(100,Math.max(0,throwItem.time/tacticTimelineMax*100))}%`;if(fill){fill.style.left=`${Math.min(100,start/tacticTimelineMax*100)}%`;fill.style.width=`${Math.min(100-start/tacticTimelineMax*100,Math.max(.8,duration/tacticTimelineMax*100))}%`;}row.classList.toggle('is-active',time>0&&time>=start&&time<end);row.classList.toggle('is-expired',time>=end&&time>0);if(stateNode)stateNode.textContent=tacticTimelineThrowState(throwItem,time);});
    $$('[data-tactic-effect]').forEach(effect=>{const {start,end}=tacticTimelineEffectWindow(effect),active=time>0&&time>=start&&time<end,future=time<Math.max(start,.01),expired=time>=end&&time>0;effect.classList.toggle('is-future',future);effect.classList.toggle('is-active',active);effect.classList.toggle('is-expired',expired);effect.style.display=active?'':'none';effect.style.opacity=active?'1':'0';});
    $$('[data-tactic-throw-marker]').forEach(marker=>{const throwItem=tacticPlanFor(tacticsMapId).find(item=>item.id===marker.dataset.tacticThrowMarker),active=!!throwItem&&time>0&&time>=tacticTimelineThrowStart(throwItem)&&time<tacticTimelineThrowEnd(throwItem);marker.style.display=active?'':'none';});
    const mapTime=$('#tactic-map-live-time'),mapStatus=$('#tactic-map-live-status'),placeCue=$('.map-place-cue'),editorHint=$('.editor-hint');if(mapTime)mapTime.textContent=`时间轴 ${tacticDisplayTime(time)} 秒`;if(mapStatus)mapStatus.textContent=tacticTimelineMapStatus(selectedTacticMap(),time);if(placeCue)placeCue.textContent=tacticsLineupPickMode?`点击地图选择${tacticsLineupPickMode==='from'?'投掷点':'落点'}`:tacticsPlacementMode?`点击地图放置 · 当前时刻 ${tacticDisplayTime(time)} 秒`:'';if(editorHint)editorHint.textContent=`当前时间 ${tacticDisplayTime(time)} 秒 · 选择“点击地图添加”后，在地图上点击实际落点；投掷时间和落点都会记录到下方时间轴。`;
    const note=$('#tactic-strategy-note');if(note)note.innerHTML=tacticTimelineStrategy(time,tacticsTimeline.side);
    updateTacticLineupPickUI();
  }
  function tacticsTimelineLoop(now){if(!tacticsTimeline.running){tacticsTimelineFrame=null;return;}if(!tacticsTimelineLast)tacticsTimelineLast=now;tacticsTimeline.time=Math.min(tacticTimelineMax,tacticsTimeline.time+(now-tacticsTimelineLast)/1000);tacticsTimelineLast=now;updateTacticTimelineUI();if(tacticsTimeline.time>=tacticTimelineMax){stopTacticsTimeline();updateTacticTimelineUI();return;}tacticsTimelineFrame=requestTacticsFrame(tacticsTimelineLoop);}
  function toggleTacticsTimeline(){if(tacticsTimeline.running){stopTacticsTimeline();updateTacticTimelineUI();return;}if(tacticsTimeline.time>=tacticTimelineMax)tacticsTimeline.time=0;tacticsTimeline.running=true;tacticsTimelineLast=0;updateTacticTimelineUI();tacticsTimelineFrame=requestTacticsFrame(tacticsTimelineLoop);}
  function resetTacticsTimeline(){stopTacticsTimeline();tacticsTimeline.time=0;updateTacticTimelineUI();}
  function tacticEffectMarkup(zone){
    const x=tacticPct(zone.x),y=tacticPct(zone.y),r=Math.max(1,Number(zone.r)||6),utility=zone.utility,side=zone.throwSide==='CT'?'ct':'t',label=tacticUtilityShort(utility),detailLabel=zone.label||label,timelineAttrs=zone.throwTime===undefined?'':` data-tactic-throw="${esc(zone.throwId||zone.id)}" data-throw-time="${esc(zone.throwTime)}" data-throw-side="${esc(zone.throwSide||'T')}"`;
    if(utility==='fire'){
      const fireRx=Math.max(2,Number(zone.rx)||8),fireRy=Math.max(2,Number(zone.ry)||5);
      return `<g class="tactic-effect tactic-effect-fire tactic-effect-side-${side}" data-tactic-effect="${esc(zone.id)}" data-utility="${esc(utility)}"${timelineAttrs}><title>${esc(detailLabel)}</title><ellipse class="fire-inner" cx="${x+1}" cy="${y-1}" rx="${Math.max(1,fireRx*.62)}" ry="${Math.max(1,fireRy*.58)}"></ellipse><ellipse class="flame-tongue flame-one" cx="${x-fireRx*.42}" cy="${y-fireRy*.2}" rx="${Math.max(.7,fireRx*.17)}" ry="${Math.max(1.2,fireRy*.7)}"></ellipse><ellipse class="flame-tongue flame-two" cx="${x+fireRx*.04}" cy="${y-fireRy*.4}" rx="${Math.max(.7,fireRx*.15)}" ry="${Math.max(1.2,fireRy*.85)}"></ellipse><ellipse class="flame-tongue flame-three" cx="${x+fireRx*.47}" cy="${y-fireRy*.12}" rx="${Math.max(.7,fireRx*.14)}" ry="${Math.max(1.2,fireRy*.58)}"></ellipse><text x="${x}" y="${Math.max(4,y-r*.55)}">${esc(label)}</text></g>`;
    }
    if(utility==='flash'){
      const angle=(Number(zone.angle)||0)*Math.PI/180,half=.52,x1=x+Math.cos(angle-half)*r,y1=y+Math.sin(angle-half)*r,x2=x+Math.cos(angle+half)*r,y2=y+Math.sin(angle+half)*r;
      return `<g class="tactic-effect tactic-effect-flash tactic-effect-side-${side}" data-tactic-effect="${esc(zone.id)}" data-utility="${esc(utility)}"${timelineAttrs}><path d="M ${x} ${y} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z"><title>${esc(detailLabel)}</title></path><circle class="flash-pulse" cx="${x}" cy="${y}" r="${Math.max(2,r*.18)}"></circle><text x="${x}" y="${Math.max(4,y-r*.58)}">${esc(label)}</text></g>`;
    }
    if(utility==='he')return `<g class="tactic-effect tactic-effect-he tactic-effect-side-${side}" data-tactic-effect="${esc(zone.id)}" data-utility="${esc(utility)}"${timelineAttrs}><title>${esc(detailLabel)}</title><circle class="blast-core" cx="${x}" cy="${y}" r="${Math.max(1.4,r*.16)}"></circle><circle class="blast-ring blast-ring-a" cx="${x}" cy="${y}" r="${Math.max(1,r*.22)}"></circle><circle class="blast-ring blast-ring-b" cx="${x}" cy="${y}" r="${Math.max(1,r*.36)}"></circle><path class="blast-burst" d="M ${x-r*.52} ${y} L ${x+r*.52} ${y} M ${x} ${y-r*.52} L ${x} ${y+r*.52}"></path><text x="${x}" y="${Math.max(4,y-r*.65)}">${esc(label)}</text></g>`;
    return `<g class="tactic-effect tactic-effect-smoke tactic-effect-side-${side}" data-tactic-effect="${esc(zone.id)}" data-utility="${esc(utility)}"${timelineAttrs}><title>${esc(detailLabel)}</title><circle class="smoke-core" cx="${x}" cy="${y}" r="${Math.max(1.5,r*.25)}"></circle><circle class="smoke-puff smoke-puff-a" cx="${x-r*.35}" cy="${y+r*.15}" r="${Math.max(1.2,r*.52)}"></circle><circle class="smoke-puff smoke-puff-b" cx="${x+r*.28}" cy="${y-r*.18}" r="${Math.max(1.2,r*.58)}"></circle><circle class="smoke-puff smoke-puff-c" cx="${x+r*.05}" cy="${y+r*.4}" r="${Math.max(1.2,r*.45)}"></circle><text x="${x}" y="${Math.max(4,y-r*.62)}">${esc(label)}</text></g>`;
  }
  function tacticMapMarker(label,point,type){const x=tacticPct(point.x),y=tacticPct(point.y);return `<g class="map-marker map-marker-${type}" transform="translate(${x} ${y})"><text x="0" y="0" text-anchor="middle" dominant-baseline="central">${esc(label)}</text></g>`;}
  function tacticLineupRoute(lineup){
    if(!lineup)return '';
    const fx=tacticPct(lineup.from.x),fy=tacticPct(lineup.from.y),tx=tacticPct(lineup.target.x),ty=tacticPct(lineup.target.y);
    return `<g class="tactic-lineup-route"><path d="M ${fx} ${fy} L ${tx} ${ty}"></path><circle class="route-from" cx="${fx}" cy="${fy}" r="2"></circle><circle class="route-target" cx="${tx}" cy="${ty}" r="2.6"></circle><text x="${fx+2.8}" y="${fy-2.2}">${esc(lineup.from.label)}</text><text x="${tx+3.1}" y="${ty-2.2}">${esc(lineup.target.label)}</text></g>`;
  }
  function tacticCoverageRadiusPercent(itemOrId,map=selectedTacticMap(),side=tacticsTimeline.side){const item=typeof itemOrId==='string'?tacticUtilityById(itemOrId):itemOrId;let units=item?.coverageUnits;if(units&&typeof units==='object')units=units[side]??units.T;const scale=Number(map?.calibration?.scale)||5,radarSize=Number(map?.radarSize)||1024;return Math.max(.8,Number(units)/(scale*radarSize)*100||6);}
  function tacticThrowZone(throwItem){const item=tacticUtilityById(throwItem.utility),radius=tacticCoverageRadiusPercent(item,selectedTacticMap(),throwItem.side),defaults={smoke:{r:radius},flash:{r:radius,angle:0},he:{r:radius},fire:{rx:radius,ry:radius*.68}}[throwItem.utility]||{r:radius};return {...defaults,...throwItem,id:`throw-${throwItem.id}`,label:throwItem.label||tacticUtilityShort(throwItem.utility),throwId:throwItem.id,throwTime:throwItem.time,throwSide:throwItem.side};}
  function tacticThrowMarker(){return '';}
  function legacyTacticMapBoard(map,lineup){
    const plan=tacticPlanFor(map.id),effects=plan.map(throwItem=>tacticEffectMarkup(tacticThrowZone(throwItem))).join(''),throwMarkers=plan.map(tacticThrowMarker).join(''),markers=[tacticMapMarker('CT',map.spawns.CT,'spawn-ct'),tacticMapMarker('T',map.spawns.T,'spawn-t'),tacticMapMarker('A',map.bombs.A,'bomb-a'),tacticMapMarker('B',map.bombs.B,'bomb-b')].join('');
    const cal=map.calibration;
    return `<div class="tactics-map-board"><div class="map-image-wrap"><img src="${esc(map.image)}" alt="${esc(map.name)} / ${esc(map.english)} 官方雷达平面图" draggable="false"><svg class="map-overlay" viewBox="0 0 100 100" role="img" aria-label="${esc(map.name)} 的道具效果和点位叠加图"><defs><filter id="map-glow-${esc(map.id)}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".6" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMerge></feMerge></filter></defs>${effects}${tacticLineupRoute(lineup)}${markers}</svg><div class="map-board-label"><span>${esc(map.overview)}</span><span>雷达快照 · ${esc(tacticsData.snapshot)}</span></div></div><div class="map-board-meta"><span><i class="key-dot bomb"></i>A / B 包点</span><span><i class="key-dot spawn"></i>CT / T 出生</span><span><i class="key-dot effect"></i>${tacticUtilityById(tacticPlaceUtility)?.name||'当前道具'}效果示意</span><span><i class="key-dot timeline"></i>高亮=当前生效 · 灰显=已结束</span></div><p class="tiny map-calibration">官方 overview：pos_x ${esc(cal.posX)} · pos_y ${esc(cal.posY)} · scale ${esc(cal.scale)}${cal.rotate?' · rotate '+esc(cal.rotate):''}。底图按雷达坐标快照固定，彩色范围用于教学标注，不等同于游戏内部碰撞 / 可见性像素。</p></div>`;
  }
  function legacyTacticMapBoardV2(map,lineup){
    const plan=tacticPlanFor(map.id),effects=plan.map(throwItem=>tacticEffectMarkup(tacticThrowZone(throwItem))).join(''),throwMarkers=plan.map(tacticThrowMarker).join(''),markers=[tacticMapMarker('CT',map.spawns.CT,'spawn-ct'),tacticMapMarker('T',map.spawns.T,'spawn-t'),tacticMapMarker('A',map.bombs.A,'bomb-a'),tacticMapMarker('B',map.bombs.B,'bomb-b')].join(''),utilityOptions=tacticUtilityTypes.map(item=>`<option value="${esc(item.id)}" ${tacticPlaceUtility===item.id?'selected':''}>${esc(item.name)}</option>`).join(''),cal=map.calibration;
    return `<div class="tactics-map-board"><div class="map-image-wrap ${tacticsPlacementMode?'is-place-mode':''}" id="tactic-map-canvas"><img id="tactic-map-image" src="${esc(map.image)}" alt="${esc(map.name)} / ${esc(map.english)} 官方雷达平面图；点击地图可放置自定义道具" draggable="false"><svg class="map-overlay" viewBox="0 0 100 100" role="img" aria-label="${esc(map.name)} 的自定义道具效果和点位叠加图"><defs><filter id="map-glow-${esc(map.id)}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".6" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMerge></feMerge></filter></defs>${effects}${throwMarkers}${tacticLineupRoute(lineup)}${markers}</svg><div class="map-board-label"><span>${esc(map.overview)}</span><span>雷达快照 · ${esc(tacticsData.snapshot)}</span></div><div class="map-place-cue">${tacticsPlacementMode?'点击地图放置 · 当前时刻 '+tacticsTimeline.time.toFixed(1)+' 秒':''}</div></div><div class="map-board-meta"><span><i class="key-dot bomb"></i>A / B 包点</span><span><i class="key-dot spawn"></i>CT / T 出生</span><span><i class="key-dot effect"></i>方案道具 ${plan.length} 颗</span><span><i class="key-dot timeline"></i>亮起=生效 · 灰显=结束</span></div><p class="tiny map-calibration">官方 overview：pos_x ${esc(cal.posX)} · pos_y ${esc(cal.posY)} · scale ${esc(cal.scale)}${cal.rotate?' · rotate '+esc(cal.rotate):''}。底图只负责点位参照；道具位置、投掷时刻和组合由你在本页自定义。</p><div class="tactic-map-editor"><div class="editor-head"><div><h3>自定义投掷组合</h3><p class="tiny">先拖动下方时间轴到投掷时刻，再选择道具并点击地图落点；重复操作即可编排整套进攻 / 防守方案。</p></div><span class="tiny">${plan.length} 颗已布置</span></div><div class="tactic-map-editor-controls"><label>道具<select id="tactic-place-utility" aria-label="选择要放置的道具">${utilityOptions}</select></label><label>投掷方<select id="tactic-place-side" aria-label="选择投掷方"><option value="T" ${tacticPlaceSide==='T'?'selected':''}>T 方</option><option value="CT" ${tacticPlaceSide==='CT'?'selected':''}>CT 方</option></select></label><label class="editor-label">备注（可选）<input id="tactic-place-label" maxlength="40" placeholder="例如：第一颗中路烟" value=""></label><button class="primary" id="tactic-place-toggle" type="button" aria-pressed="${tacticsPlacementMode}">${tacticsPlacementMode?'退出地图布置':'点击地图添加'}</button><button class="secondary" id="tactic-plan-clear" type="button" ${plan.length?'':'disabled'}>清空当前方案</button></div><p class="tiny editor-hint">当前时间 ${tacticsTimeline.time.toFixed(1)} 秒 · 选择“点击地图添加”后，在地图上点击实际落点；投掷时间和落点都会记录到下方时间轴。</p></div>${tacticsTimelineMarkup()}</div>`;
  }
  function tacticMapBoard(map,lineup){
    const plan=tacticPlanFor(map.id),effects=plan.map(throwItem=>tacticEffectMarkup(tacticThrowZone(throwItem))).join(''),throwMarkers=plan.map(tacticThrowMarker).join(''),players=tacticPlayersFor(map.id).map(tacticPlayerMarkup).join(''),markers=[tacticMapMarker('CT',map.spawns.CT,'spawn-ct'),tacticMapMarker('T',map.spawns.T,'spawn-t'),tacticMapMarker('A',map.bombs.A,'bomb-a'),tacticMapMarker('B',map.bombs.B,'bomb-b')].join(''),utilityOptions=tacticUtilityTypes.map(item=>`<option value="${esc(item.id)}" ${tacticPlaceUtility===item.id?'selected':''}>${esc(item.name)}</option>`).join(''),cal=map.calibration;
    return `<div class="tactics-map-board"><div class="map-image-wrap ${tacticsPlacementMode?'is-place-mode':''}" id="tactic-map-canvas"><img id="tactic-map-image" src="${esc(map.image)}" alt="${esc(map.name)} / ${esc(map.english)} 官方雷达平面图；点击地图可放置自定义道具，拖动圆点调整走位" draggable="false"><svg class="map-overlay" viewBox="0 0 100 100" role="img" aria-label="${esc(map.name)} 的自定义道具效果、投掷点和队员走位叠加图"><defs><filter id="map-glow-${esc(map.id)}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".6" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMerge></filter></defs>${effects}${throwMarkers}${players}${tacticLineupRoute(lineup)}${markers}</svg><div class="map-board-label"><span>${esc(map.overview)}</span><span>雷达快照 · ${esc(tacticsData.snapshot)}</span></div><div class="map-place-cue">${tacticsPlacementMode?'点击地图放置 · 当前时刻 '+tacticDisplayTime(tacticsTimeline.time)+' 秒':''}</div></div><div class="map-board-meta"><span><i class="key-dot bomb"></i>A / B 包点</span><span><i class="key-dot spawn"></i>CT / T 出生</span><span><i class="key-dot player-ct"></i>5 CT + <i class="key-dot player-t"></i>5 T 可拖动</span><span><i class="key-dot effect"></i>方案道具 ${plan.length} 颗</span><span><i class="key-dot timeline"></i>亮起=生效 · 灰显=结束</span></div><p class="tiny map-calibration">官方 overview：pos_x ${esc(cal.posX)} · pos_y ${esc(cal.posY)} · scale ${esc(cal.scale)}${cal.rotate?' · rotate '+esc(cal.rotate):''}。底图只负责点位参照；道具位置、投掷时刻和人物走位都由你在本页自定义。</p>${tacticsTimelineMarkup()}<div class="tactic-map-editor"><div class="editor-head"><div><h3>自定义投掷组合</h3><p class="tiny">先拖动上面的时间轴到投掷时刻，再选择道具和阵营，点击地图落点；重复操作即可编排整套进攻 / 防守方案。</p></div><span class="tiny">${plan.length} 颗已布置</span></div><div class="tactic-map-editor-controls"><label>道具<select id="tactic-place-utility" aria-label="选择要放置的道具">${utilityOptions}</select></label><label>投掷方<select id="tactic-place-side" aria-label="选择投掷方"><option value="T" ${tacticPlaceSide==='T'?'selected':''}>T 方</option><option value="CT" ${tacticPlaceSide==='CT'?'selected':''}>CT 方</option></select></label><label class="editor-label">备注（可选）<input id="tactic-place-label" maxlength="40" placeholder="例如：第一颗中路烟" value=""></label><button class="primary" id="tactic-place-toggle" type="button" aria-pressed="${tacticsPlacementMode}">${tacticsPlacementMode?'退出地图布置':'点击地图添加'}</button><button class="secondary" id="tactic-players-reset" type="button">重置人物位置</button><button class="secondary" id="tactic-plan-clear" type="button" ${plan.length?'':'disabled'}>清空当前方案</button></div><p class="tiny editor-hint">当前时间 ${tacticDisplayTime(tacticsTimeline.time)} 秒 · 时间轴控制投掷时刻；选择“点击地图添加”后，在地图上点击实际落点。拖动地图上的 CT / T 圆点可调整走位。</p></div></div>`;
  }
  function tacticMapBoard(map,lineup){
    const plan=tacticPlanFor(map.id),effects=plan.map(throwItem=>tacticEffectMarkup(tacticThrowZone(throwItem))).join(''),throwMarkers=plan.map(tacticThrowMarker).join(''),players=tacticPlayersFor(map.id).map(tacticPlayerMarkup).join(''),markers=[tacticMapMarker('CT',map.spawns.CT,'spawn-ct'),tacticMapMarker('T',map.spawns.T,'spawn-t'),tacticMapMarker('A',map.bombs.A,'bomb-a'),tacticMapMarker('B',map.bombs.B,'bomb-b')].join(''),utilityOptions=tacticUtilityTypes.map(item=>`<option value="${esc(item.id)}" ${tacticPlaceUtility===item.id?'selected':''}>${esc(tacticUtilityShort(item.id))} · ${esc(item.name)}</option>`).join(''),cal=map.calibration;
    const mapCue=tacticsLineupPickMode?`点击地图选择${tacticsLineupPickMode==='from'?'投掷点':'落点'}`:tacticsPlacementMode?`点击地图放置 · 当前时刻 ${tacticDisplayTime(tacticsTimeline.time)} 秒`:'';
    return `<div class="tactics-map-board"><div class="map-image-wrap ${tacticsPlacementMode?'is-place-mode':''} ${tacticsLineupPickMode?'is-lineup-pick-mode':''}" id="tactic-map-canvas"><img id="tactic-map-image" src="${esc(map.image)}" alt="${esc(map.name)} / ${esc(map.english)} 官方雷达平面图；点击地图可放置自定义道具，拖动圆点调整走位" draggable="false"><svg class="map-overlay" viewBox="0 0 100 100" role="img" aria-label="${esc(map.name)} 的自定义道具效果、投掷点和队员走位叠加图"><defs><filter id="map-glow-${esc(map.id)}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".6" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs>${effects}${throwMarkers}${players}${tacticLineupRoute(lineup)}${markers}</svg><div class="map-board-label"><span>${esc(map.overview)}</span><span>雷达快照 · ${esc(tacticsData.snapshot)}</span></div><div class="map-place-cue" id="map-place-cue">${mapCue}</div></div><div class="map-board-meta"><span><i class="key-dot bomb"></i>A / B 包点</span><span><i class="key-dot spawn"></i>CT / T 出生</span><span><i class="key-dot player-ct"></i>5 CT + <i class="key-dot player-t"></i>5 T 可拖动</span><span><i class="key-dot effect"></i>方案道具 ${plan.length} 颗</span><span><i class="key-dot timeline"></i>亮起=生效 · 灰显=结束</span></div><p class="tiny map-calibration">官方 overview：pos_x ${esc(cal.posX)} · pos_y ${esc(cal.posY)} · scale ${esc(cal.scale)}${cal.rotate?' · rotate '+esc(cal.rotate):''}。底图只负责点位参照；道具位置、投掷时刻和人物走位都由你在本页自定义。</p>${tacticsTimelineMarkup()}<div class="tactic-map-editor"><div class="editor-head"><div><h3>自定义投掷组合</h3><p class="tiny">先拖动上面的时间轴到投掷时刻，再选择道具和阵营，点击地图落点；重复操作即可编排整套进攻 / 防守方案。</p></div><span class="tiny">${plan.length} 颗已布置</span></div><div class="tactic-map-editor-controls"><label>道具<select id="tactic-place-utility" aria-label="选择要放置的道具">${utilityOptions}</select></label><label>投掷方<select id="tactic-place-side" aria-label="选择投掷方"><option value="T" ${tacticPlaceSide==='T'?'selected':''}>T 方</option><option value="CT" ${tacticPlaceSide==='CT'?'selected':''}>CT 方</option></select></label><label class="editor-label">备注（可选）<input id="tactic-place-label" maxlength="40" placeholder="例如：第一颗中路烟" value=""></label><button class="primary" id="tactic-place-toggle" type="button" aria-pressed="${tacticsPlacementMode}">${tacticsPlacementMode?'退出地图布置':'点击地图添加'}</button><button class="secondary" id="tactic-players-reset" type="button">重置人物位置</button><button class="secondary" id="tactic-plan-clear" type="button" ${plan.length?'':'disabled'}>清空当前方案</button></div><p class="tiny editor-hint">当前时间 ${tacticDisplayTime(tacticsTimeline.time)} 秒 · 时间轴控制投掷时刻；选择“点击地图添加”后，在地图上点击实际落点。拖动地图上的 CT / T 圆点可调整走位。</p></div></div>`;
  }
  function tacticInventoryRow(item,mapId){const planned=tacticPlanCount(mapId,item.id),plannedT=tacticPlanCount(mapId,item.id,'T'),plannedCT=tacticPlanCount(mapId,item.id,'CT');return `<button class="tactic-utility-row ${tacticPlaceUtility===item.id?'active':''}" data-utility-type="${esc(item.id)}" aria-pressed="${tacticPlaceUtility===item.id}" title="${esc(item.name)}"><span class="utility-icon" style="--utility-color:${esc(item.color)}">${esc(item.icon)}</span><span class="utility-row-copy"><strong>${esc(tacticUtilityShort(item.id))}</strong><small>${esc(item.duration)}</small></span><span class="utility-count"><span><b>${item.perPlayer}</b><small>每人最多</small></span><span><b>${item.teamMax}</b><small>队伍上限</small></span><span class="planned-count"><b>${planned}</b><small>T${plannedT} / CT${plannedCT}</small></span></span></button>`;}
  function tacticUtilityDetail(item){
    if(!item)return `<div class="tactic-detail-empty"><span class="utility-icon">◎</span><strong>选择一种道具</strong><p>先在这里选中要布置的道具，再把时间轴拖到投掷时刻，最后点击地图上的落点。</p></div>`;
    return `<div class="tactic-detail-card" style="--utility-color:${esc(item.color)}"><div class="tactic-detail-title"><span class="utility-icon">${esc(item.icon)}</span><div><p class="eyebrow">${esc(item.className)}</p><h3>${esc(item.name)}</h3></div></div><div class="utility-stat-row"><span><b>${item.perPlayer}</b>每人最多</span><span><b>${item.teamMax}</b>五人队伍理论上限</span><span><b>${esc(item.duration)}</b>效果持续</span></div><dl class="utility-facts"><div><dt>触发</dt><dd>${esc(item.trigger)}</dd></div><div><dt>游戏效果</dt><dd>${esc(item.effect)}</dd></div><div><dt>地图范围</dt><dd>${esc(item.coverageLabel||'按地图 overview 比例换算')}</dd></div></dl></div>`;
  }
  function lineupGraphic(lineup){
    const fx=tacticPct(lineup.from.x),fy=tacticPct(lineup.from.y),tx=tacticPct(lineup.target.x),ty=tacticPct(lineup.target.y);
    return `<svg class="lineup-graphic" viewBox="0 0 100 64" aria-label="${esc(lineup.from.label)} 到 ${esc(lineup.target.label)} 的路线示意"><defs><marker id="arrow-${esc(lineup.id)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker></defs><path class="graphic-route" d="M ${fx} ${fy*.68} C ${(fx+tx)/2} ${Math.max(4,(fy+ty)/2-8)} ${(fx+tx)/2} ${Math.min(60,(fy+ty)/2+8)} ${tx} ${ty*.68}" marker-end="url(#arrow-${esc(lineup.id)})"></path><circle class="graphic-from" cx="${fx}" cy="${fy*.68}" r="3"></circle><circle class="graphic-target" cx="${tx}" cy="${ty*.68}" r="4"></circle><text x="${Math.min(84,fx+4)}" y="${Math.max(8,fy*.68-5)}">站位</text><text x="${Math.min(84,tx+5)}" y="${Math.min(60,ty*.68+10)}">落点</text><text class="graphic-hint" x="4" y="60">看图记方向 · 进房复核准星</text></svg>`;
  }
  function lineupMedia(lineup){
    const media=lineup.media;if(!media?.poster)return lineupGraphic(lineup);
    if(media.video)return `<figure class="lineup-media"><video controls preload="none" poster="${esc(media.poster)}" aria-label="${esc(lineup.name)} 实际投掷演示"><source src="${esc(media.video)}" type="video/mp4"><img src="${esc(media.poster)}" alt="${esc(lineup.name)} 实际投掷截图" loading="lazy"></video><figcaption><strong>实际投掷画面</strong><span>可直接在卡片内播放完整过程</span></figcaption></figure>`;
    return `<figure class="lineup-media"><img src="${esc(media.poster)}" alt="${esc(lineup.name)} 点位截图" loading="lazy"><figcaption><strong>点位截图</strong><span>来自你填写的资料地址</span></figcaption></figure>`;
  }
  function tacticLineupCard(lineup){
    const active=selectedTacticLineup()?.id===lineup.id,custom=Boolean(lineup.custom),sideClass=lineup.side==='CT'?'ct':'t',source=lineup.source||'',sourceLabel=source.includes('xiaoheihe')?'打开小黑盒原文':'查看原始投掷卡';
    return `<article class="lineup-card lineup-side-${sideClass} ${custom?'is-custom':''} ${active?'active':''}"><button class="lineup-select" data-lineup-id="${esc(lineup.id)}" aria-pressed="${active}"><div class="lineup-card-head"><span class="lineup-utility-tag">${esc(tacticUtilityShort(lineup.utility))}</span><span class="lineup-side-dot" title="${esc(lineup.side==='CT'?'CT 方':'T 方')}" role="img" aria-label="${esc(lineup.side==='CT'?'CT 方':'T 方')}"></span><span class="lineup-method">${esc(lineup.technique)}${lineup.airTime?` · ${esc(lineup.airTime)}`:''}</span></div><h3>${esc(lineup.name)}</h3><p class="lineup-route-label">${esc(lineup.from.label)} <span>→</span> ${esc(lineup.target.label)}</p><span class="lineup-select-hint">${active?'地图上已显示这条路线':'点击在地图上显示这条路线'}</span></button>${lineupMedia(lineup)}<div class="lineup-facts"><span>移动：${esc(lineup.movement||'未填写')}</span><span>类型：${esc(tacticUtilityShort(lineup.utility))}</span></div>${lineup.steps?.length?`<ol>${lineup.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol>`:'<p class="tiny lineup-missing">还没有填写投掷步骤。</p>'}<p class="lineup-result"><strong>用途：</strong>${esc(lineup.result||'还没有填写用途。')}</p>${custom?`<div class="lineup-card-actions"><button class="secondary" type="button" data-edit-lineup="${esc(lineup.id)}">编辑</button><button class="secondary danger-button" type="button" data-delete-lineup="${esc(lineup.id)}">删除</button></div>`:''}${source?`<a class="lineup-source" href="${esc(source)}" target="_blank" rel="noreferrer">${sourceLabel}${lineup.updated?` · 更新 ${esc(lineup.updated)}`:''} ↗</a>`:'<span class="lineup-source no-source">未填写来源链接</span>'}</article>`;
  }
  function tacticLineupFormDefaults(map){return {mapId:map.id,utility:'smoke',side:'T',name:'',from:{label:'',x:null,y:null},target:{label:'',x:null,y:null},technique:'左键',movement:'站定',airTime:'',steps:[],result:'',source:'',updated:today(),media:{poster:'',video:''}};}
  function tacticLineupPointSummary(point){const rawX=point?.x,rawY=point?.y,x=Number(rawX),y=Number(rawY);return rawX!==null&&rawX!==undefined&&rawX!==''&&rawY!==null&&rawY!==undefined&&rawY!==''&&Number.isFinite(x)&&Number.isFinite(y)?`已选择 · ${x.toFixed(1)} / ${y.toFixed(1)}`:'尚未在地图上选择';}
  function tacticLineupPickerMarkup(map){return `<div id="tactic-lineup-picker-dialog" class="tactic-lineup-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="tactic-lineup-picker-title" hidden><div class="lineup-picker-dialog-card"><div class="lineup-picker-head"><div><p class="eyebrow">MAP PICKER</p><h3 id="tactic-lineup-picker-title">选择投掷点</h3><p class="tiny" id="tactic-lineup-picker-hint">请在地图上点击投掷点；选完后会自动切换到落点。</p></div><button class="icon-button" type="button" data-lineup-picker-close="true" aria-label="关闭地图点选">×</button></div><div class="lineup-picker-map is-picking-from" id="tactic-lineup-picker-map"><img src="${esc(map.image)}" alt="${esc(map.name)} 地图点选区域" draggable="false"><svg class="lineup-picker-overlay" viewBox="0 0 100 100" aria-hidden="true"><line id="tactic-lineup-picker-route" x1="0" y1="0" x2="0" y2="0"></line><g id="tactic-lineup-picker-from" class="lineup-picker-point lineup-picker-point-from" style="display:none"><circle r="1.7"></circle><text x="0" y="0">投</text></g><g id="tactic-lineup-picker-target" class="lineup-picker-point lineup-picker-point-target" style="display:none"><circle r="1.7"></circle><text x="0" y="0">落</text></g></svg><div class="lineup-picker-cue" id="tactic-lineup-picker-cue">点击地图选择投掷点</div></div><div class="lineup-picker-footer"><span class="tiny" id="tactic-lineup-picker-status">投掷点：未选择 · 落点：未选择</span><button class="secondary" type="button" data-lineup-picker-close="true">取消</button></div></div></div>`;}
  function tacticLineupEditor(map){
    if(tacticLineupEditingId===null)return '';
    const saved=tacticLineupEditingId==='new'?null:customTacticLineupById(tacticLineupEditingId),lineup=saved||tacticLineupFormDefaults(map),searchUrl=`https://xiaoheihe.cn/app/search/list?q=${encodeURIComponent(`CS2 ${map.english} 道具教学`)}`,optionList=tacticUtilityTypes.map(item=>`<option value="${esc(item.id)}" ${lineup.utility===item.id?'selected':''}>${esc(tacticUtilityShort(item.id))} · ${esc(item.name)}</option>`).join('');
    return `<form class="tactic-lineup-editor-form" id="tactic-lineup-form"><div class="editor-head"><div><p class="eyebrow">MY LINEUP / ${saved?'EDIT':'NEW'}</p><h3>${saved?'编辑我的投掷卡':'新增我的投掷卡'}</h3></div><button class="text-button" id="tactic-lineup-cancel" type="button">取消</button></div><p class="tiny">可以先打开<a href="${searchUrl}" target="_blank" rel="noreferrer">小黑盒 ${esc(map.english)} 道具搜索 ↗</a>。新增时先点下面的按钮，再直接在地图上点击投掷点；选完投掷点后会自动进入落点选择。</p><div class="field-grid tactic-lineup-form-grid"><label class="field full">卡片名称<input id="tactic-lineup-name" name="name" required maxlength="120" placeholder="例如：中路烟 · 暗道站位" value="${esc(lineup.name)}"></label><label class="field">道具<select name="utility">${optionList}</select></label><label class="field">投掷方（只用于颜色区分）<select name="side"><option value="T" ${lineup.side==='T'?'selected':''}>T 方</option><option value="CT" ${lineup.side==='CT'?'selected':''}>CT 方</option></select></label><label class="field">投掷手法<input name="technique" maxlength="80" placeholder="例如：站定 + 跳投" value="${esc(lineup.technique)}"></label><label class="field">移动方式<input name="movement" maxlength="80" placeholder="例如：站定 / 跑动 / 走动" value="${esc(lineup.movement)}"></label><label class="field">飞行时间（可选）<input name="airTime" maxlength="40" placeholder="例如：约 4 秒" value="${esc(lineup.airTime)}"></label><div class="lineup-point-pickers full"><div class="lineup-point-picker"><div><strong>投掷点</strong><span id="tactic-lineup-from-summary">${esc(tacticLineupPointSummary(lineup.from))}</span></div><div class="lineup-point-actions"><button class="secondary" type="button" data-lineup-pick-point="from" aria-pressed="false">在地图上选投掷点</button><button class="text-button" type="button" data-lineup-clear-point="from">清除</button></div><input type="hidden" id="tactic-lineup-from-x" name="fromX" value="${esc(lineup.from?.x??'')}"><input type="hidden" id="tactic-lineup-from-y" name="fromY" value="${esc(lineup.from?.y??'')}"></div><div class="lineup-point-picker"><div><strong>落点</strong><span id="tactic-lineup-target-summary">${esc(tacticLineupPointSummary(lineup.target))}</span></div><div class="lineup-point-actions"><button class="secondary" type="button" data-lineup-pick-point="target" aria-pressed="false">在地图上选落点</button><button class="text-button" type="button" data-lineup-clear-point="target">清除</button></div><input type="hidden" id="tactic-lineup-target-x" name="targetX" value="${esc(lineup.target?.x??'')}"><input type="hidden" id="tactic-lineup-target-y" name="targetY" value="${esc(lineup.target?.y??'')}"></div></div><p class="tiny full lineup-point-help">坐标由地图点击自动记录，不需要手动填写；下面的名称只是方便你记忆报点。</p><label class="field">投掷点名称（可选）<input name="fromLabel" maxlength="80" placeholder="例如：下洞、A Ramp" value="${esc(lineup.from?.label||'')}"></label><label class="field">落点名称（可选）<input name="targetLabel" maxlength="80" placeholder="例如：XBOX、Jungle" value="${esc(lineup.target?.label||'')}"></label><label class="field full">投掷步骤（每行一步）<textarea name="steps" maxlength="2080" placeholder="每行写一步：站位、瞄点、按键、跟进">${esc((lineup.steps||[]).join('\n'))}</textarea></label><label class="field full">用途 / 复核备注<textarea name="result" maxlength="1000" placeholder="例如：封住哪条枪线，和哪颗道具配合">${esc(lineup.result)}</textarea></label><label class="field full">原始来源链接（小黑盒 / 其他教学页）<input name="source" type="url" maxlength="1000" placeholder="https://www.xiaoheihe.cn/..." value="${esc(lineup.source)}"></label><label class="field full">点位截图 / 封面地址<input name="poster" type="url" maxlength="1000" placeholder="https://.../screenshot.jpg" value="${esc(lineup.media?.poster||'')}"></label><label class="field full">演示视频地址（可选）<input name="video" type="url" maxlength="1000" placeholder="https://.../throw.mp4" value="${esc(lineup.media?.video||'')}"></label></div><div class="form-buttons"><button class="primary" type="submit">${saved?'保存修改':'保存投掷卡'} ↗</button><button class="secondary" id="tactic-lineup-cancel-bottom" type="button">取消</button></div><p class="status-text" id="tactic-lineup-form-status" aria-live="polite"></p></form>`;
  }
  function updateTacticLineupPickUI(){
    const canvas=$('#tactic-map-canvas'),cue=$('#map-place-cue');
    if(canvas){canvas.classList.toggle('is-lineup-pick-mode',Boolean(tacticsLineupPickMode));canvas.classList.toggle('is-place-mode',Boolean(tacticsPlacementMode));}
    if(cue)cue.textContent=tacticsLineupPickMode?`点击地图选择${tacticsLineupPickMode==='from'?'投掷点':'落点'}`:tacticsPlacementMode?`点击地图放置 · 当前时刻 ${tacticDisplayTime(tacticsTimeline.time)} 秒`:'';
    const placeButton=$('#tactic-place-toggle');if(placeButton){placeButton.setAttribute('aria-pressed',String(tacticsPlacementMode));placeButton.textContent=tacticsPlacementMode?'退出地图布置':'点击地图添加';}
    for(const key of ['from','target']){
      const xField=$(`#tactic-lineup-${key}-x`),yField=$(`#tactic-lineup-${key}-y`),summary=$(`#tactic-lineup-${key}-summary`),pickButton=$(`[data-lineup-pick-point="${key}"]`);
      if(summary){const x=xField?.value,y=yField?.value;summary.textContent=Number.isFinite(Number(x))&&x!==''&&Number.isFinite(Number(y))&&y!==''?`已选择 · ${Number(x).toFixed(1)} / ${Number(y).toFixed(1)}`:'尚未在地图上选择';}
      if(pickButton){const active=tacticsLineupPickMode===key,hasPoint=Number.isFinite(Number(xField?.value))&&xField?.value!==''&&Number.isFinite(Number(yField?.value))&&yField?.value!=='';pickButton.setAttribute('aria-pressed',String(active));pickButton.textContent=active?'请点击地图':hasPoint?'重新选择':key==='from'?'在地图上选投掷点':'在地图上选落点';pickButton.classList.toggle('active',active);}
    }
    updateTacticLineupPickerUI();
  }
  function tacticLineupPickerPoint(key){const x=Number($(`#tactic-lineup-${key}-x`)?.value),y=Number($(`#tactic-lineup-${key}-y`)?.value);return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=100&&y>=0&&y<=100?{x,y}:null;}
  function updateTacticLineupPickerUI(){
    const picker=$('#tactic-lineup-picker-dialog');if(!picker)return;
    const from=tacticLineupPickerPoint('from'),target=tacticLineupPickerPoint('target'),pickerMap=$('#tactic-lineup-picker-map'),title=$('#tactic-lineup-picker-title'),hint=$('#tactic-lineup-picker-hint'),cue=$('#tactic-lineup-picker-cue'),status=$('#tactic-lineup-picker-status'),route=$('#tactic-lineup-picker-route');
    const setPoint=(key,point)=>{const node=$(`#tactic-lineup-picker-${key}`,picker);if(!node)return;if(point){node.setAttribute('transform',`translate(${point.x} ${point.y})`);node.style.display='';}else node.style.display='none';};
    setPoint('from',from);setPoint('target',target);
    if(route){if(from&&target){route.setAttribute('x1',from.x);route.setAttribute('y1',from.y);route.setAttribute('x2',target.x);route.setAttribute('y2',target.y);route.style.display='';}else route.style.display='none';}
    const mode=tacticsLineupPickMode==='target'?'target':'from';if(pickerMap){pickerMap.classList.toggle('is-picking-from',mode==='from');pickerMap.classList.toggle('is-picking-target',mode==='target');}
    if(title)title.textContent=mode==='from'?'选择投掷点':'选择落点';if(hint)hint.textContent=mode==='from'?'请在地图上点击投掷点；选完后会自动切换到落点。':'投掷点已记录，请在地图上点击落点。';if(cue)cue.textContent=mode==='from'?'点击地图选择投掷点':'点击地图选择落点';if(status)status.textContent=`投掷点：${from?'已选择':'未选择'} · 落点：${target?'已选择':'未选择'}`;
  }
  function ensureTacticLineupPicker(){
    let picker=$('#tactic-lineup-picker-dialog');if(picker)return picker;const map=selectedTacticMap();if(!map)return null;const holder=document.createElement('div');holder.innerHTML=tacticLineupPickerMarkup(map);picker=holder.firstElementChild;if(!picker)return null;document.body.append(picker);
    const pickerMap=$('#tactic-lineup-picker-map',picker);if(pickerMap)pickerMap.addEventListener('click',event=>{if(!tacticsLineupPickMode)return;event.preventDefault();event.stopPropagation();pickTacticLineupPoint(event,pickerMap);});
    $$('[data-lineup-picker-close]',picker).forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();closeTacticLineupPicker();}));
    picker.addEventListener('click',event=>{if(event.target===picker)closeTacticLineupPicker();});picker.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeTacticLineupPicker();}});return picker;
  }
  function bindTacticLineupPointButtons(){$$('[data-lineup-pick-point]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();startTacticLineupPointPick(button.dataset.lineupPickPoint);}));}
  function closeTacticLineupPicker(){tacticsLineupPickMode=null;const picker=$('#tactic-lineup-picker-dialog');if(picker){picker.hidden=true;picker.classList.remove('is-open');}document.body.classList.remove('lineup-picker-open');updateTacticLineupPickUI();}
  function startTacticLineupPointPick(key){
    if(!$('#tactic-lineup-form'))return;const picker=ensureTacticLineupPicker();if(!picker)return;
    tacticsLineupPickMode=key==='target'?'target':'from';tacticsPlacementMode=false;updateTacticLineupPickUI();picker.hidden=false;picker.classList.add('is-open');document.body.classList.add('lineup-picker-open');updateTacticLineupPickerUI();$('[data-lineup-picker-close]',picker)?.focus();
  }
  function clearTacticLineupPoint(key){
    const xField=$(`#tactic-lineup-${key}-x`),yField=$(`#tactic-lineup-${key}-y`);if(xField)xField.value='';if(yField)yField.value='';if(tacticsLineupPickMode===key)tacticsLineupPickMode=null;updateTacticLineupPickUI();
  }
  function pickTacticLineupPoint(event,board){
    const key=tacticsLineupPickMode;if(!key)return;const point=tacticMapPointFromEvent(event,board),xField=$(`#tactic-lineup-${key}-x`),yField=$(`#tactic-lineup-${key}-y`);if(!xField||!yField)return;xField.value=point.x.toFixed(1);yField.value=point.y.toFixed(1);tacticsLineupPickMode=key==='from'?'target':null;updateTacticLineupPickUI();toast(key==='from'?'投掷点已记录，请继续点击地图选择落点。':'投掷点和落点已记录，可以保存这张投掷卡。');if(key==='target')closeTacticLineupPicker();event.preventDefault();
  }
  function updateTacticLineupResults(){
    const map=selectedTacticMap(),matches=tacticLineupMatches(map?.id),grid=$('#tactic-lineup-grid'),count=$('#tactic-lineup-count');
    if(grid)grid.innerHTML=matches.length?matches.map(tacticLineupCard).join(''):`<div class="tactic-lineup-empty"><strong>没有匹配的投掷卡</strong><span>换一个点位关键词，或点击“新增我的投掷卡”建立自己的资料。</span></div>`;
    if(count)count.textContent=`显示 ${matches.length} / ${tacticLineupsFor(map?.id).length} 张卡 · 我的卡 ${customTacticLineupsFor(map?.id).length} 张`;
  }
  function tacticLineupLibrary(map){
    const matches=tacticLineupMatches(map.id),customCount=customTacticLineupsFor(map.id).length;
    return `<section class="panel tactics-lineups" id="tactics-lineups"><div class="section-head"><div><h2>${esc(map.name)} · 关键投掷办法</h2><p class="tiny">内置卡片可直接查阅；“我的投掷卡”支持新增、搜索、编辑、删除，并保存到当前浏览器。</p></div><span class="tiny" id="tactic-lineup-count">显示 ${matches.length} / ${tacticLineupsFor(map.id).length} 张卡 · 我的卡 ${customCount} 张</span></div><div class="lineup-library-toolbar"><label class="lineup-search-field"><span>查找点位、手法或用途</span><input id="tactic-lineup-search" type="search" value="${esc(tacticLineupQuery)}" placeholder="例如：中路、B门、跳投、警家" aria-label="搜索关键投掷办法"></label><label class="lineup-filter-field"><span>道具</span><select id="tactic-lineup-filter" aria-label="按道具筛选"><option value="all" ${tacticLineupFilter==='all'?'selected':''}>全部</option>${tacticUtilityTypes.map(item=>`<option value="${esc(item.id)}" ${tacticLineupFilter===item.id?'selected':''}>${esc(tacticUtilityShort(item.id))}</option>`).join('')}</select></label><button class="primary" id="tactic-lineup-new" type="button">＋新增我的投掷卡</button></div>${tacticLineupEditor(map)}<div class="lineup-grid" id="tactic-lineup-grid">${matches.length?matches.map(tacticLineupCard).join(''):`<div class="tactic-lineup-empty"><strong>还没有匹配的投掷卡</strong><span>换一个关键词，或点击“新增我的投掷卡”建立自己的资料。</span></div>`}</div><p class="tactics-practice-note"><strong>资料口径：</strong>内置卡片保留原始教学页和实际画面；小黑盒社区帖子适合发现点位，但请在当前 CS2 练习房复核出生位、tick、碰撞和烟落点后再纳入固定战术。</p></section>`;
  }
  function tacticSourcesMarkup(map){
    const researchSources=Array.isArray(map.researchSources)?map.researchSources:[],researchLinks=researchSources.length?researchSources.map(source=>`<a href="${esc(source.source)}" target="_blank" rel="noreferrer">${esc(source.title)} ↗</a><br><span class="tiny">${esc(source.note||'公开检索入口')}</span>`).join(''):'<span class="tiny">暂时没有整理好的公开检索入口；可以在上面的“新增我的投掷卡”里补充来源。</span>';
    return `<section class="panel tactics-sources"><div class="section-head"><div><h2>数据口径与来源</h2><p class="tiny">把可验证的地图 / 道具数据、教学投掷卡和社区检索入口分开标注。</p></div><span class="tiny">版本快照 ${esc(tacticsData.snapshot)}</span></div><div class="source-grid"><div><strong>地图底图与坐标</strong><p>三张 PNG 是从官方游戏 depot 同步的雷达快照；overview 的 pos_x、pos_y、scale 和包点 / 出生点归一化坐标随地图一并固定。</p><a href="${esc(tacticsData.radarSource)}" target="_blank" rel="noreferrer">CS2 Map Icons / depot 同步说明 ↗</a><br><a href="${esc(map.overviewSource)}" target="_blank" rel="noreferrer">当前地图 overview：${esc(map.overviewFile)} ↗</a></div><div><strong>道具规则</strong><p>道具分类、游戏实体名与投掷速度按 Valve 的 GameTracking-CS2 数据核对；持续时间按当前竞技模式常用游戏规则记录。真实可见性、伤害、火焰扩散和碰撞仍受距离、视角、材质与地图几何影响。</p><a href="${esc(tacticsData.utilitySource)}" target="_blank" rel="noreferrer">Valve GameTracking / weapons.vdata ↗</a></div><div><strong>投掷卡</strong><p>关键投掷卡保留可追溯的 CSNADES 单颗投掷页，卡片内直接显示原始投掷画面；你可以先看图确认手法，再把最终落点和时刻手动编排进地图方案。</p><a href="${esc(tacticsData.lineupSource)}" target="_blank" rel="noreferrer">CSNADES 当前地图指南 ↗</a><br><span class="tiny">地图底图版权归 Valve Corporation；本项目不是 Valve 官方产品。</span></div><div><strong>小黑盒检索</strong><p>这些是按当前地图整理的公开检索 / 文章入口，用来发现新点位和截图；社区内容会随版本、tick、出生位变化，加入自己的资料库前请在练习房复核。</p>${researchLinks}</div></div></section>`;
  }
  function tacticTimelineThrowRow(throwItem){
    const item=tacticUtilityById(throwItem.utility),short=tacticUtilityShort(throwItem.utility),note=String(throwItem.label||'').trim(),start=tacticTimelineThrowStart(throwItem),duration=tacticTimelineThrowEnd(throwItem)-start,startPct=Math.min(100,Math.max(0,start/tacticTimelineMax*100)),width=Math.max(.8,Math.min(100-startPct,duration/tacticTimelineMax*100)),timing=item?.id==='fire'?(throwItem.side==='CT'?'5.5 秒效果':'7 秒效果'):(item?.id==='flash'||item?.id==='he'?tacticTimelineDurationLabel(item):(item?.duration||''));
    return `<div class="tactic-timeline-row" data-tactic-track="${esc(throwItem.id)}" data-utility="${esc(throwItem.utility)}" data-throw-time="${esc(throwItem.time)}" data-throw-side="${esc(throwItem.side)}"><div class="tactic-track-label"><span class="utility-icon tactic-side-icon-${throwItem.side==='CT'?'ct':'t'}" style="--utility-color:${esc(item?.color||'#c8dd91')}" aria-label="${esc(throwItem.side==='CT'?'CT 方':'T 方')}">${esc(short)}</span><span><strong>${esc(short)}</strong><small>投掷 ${tacticDisplayTime(throwItem.time)} 秒${note?` · ${esc(note)}`:''} · ${esc(timing)}</small></span></div><div class="tactic-track-bar" aria-hidden="true"><span class="tactic-track-fill" style="left:${startPct}%;width:${width}%"></span><span class="tactic-throw-time-marker" style="left:${Math.min(100,Math.max(0,Number(throwItem.time)/tacticTimelineMax*100))}%"></span><span class="tactic-track-cursor" style="left:${tacticsTimeline.time/tacticTimelineMax*100}%"></span></div><span class="tactic-track-state">${esc(tacticTimelineThrowState(throwItem,tacticsTimeline.time))}</span><button class="tactic-delete-throw" data-delete-throw="${esc(throwItem.id)}" type="button" aria-label="删除 ${esc(short)} ${tacticDisplayTime(throwItem.time)} 秒记录">×</button></div>`;
  }
  function tacticsTimelineMarkup(){
    const plan=tacticPlanFor(tacticsMapId),tracks=plan.length?plan.map(tacticTimelineThrowRow).join(''):`<div class="tactic-timeline-empty"><strong>还没有自定义道具</strong><span>把游标拖到投掷时刻，选择道具后点击地图上的落点。</span></div>`;
    return `<section class="tactic-map-timeline" id="tactic-timeline"><div class="section-head"><div><h2>方案时间轴</h2><p class="tiny">时间轴就在当前地图下方；每一行都是你自己布置的道具。橙色竖线是投掷时刻，绿色区间是效果窗口。</p></div><span class="timeline-limit">${plan.length} 颗 · 0–120 秒</span></div><div class="tactic-timeline-toolbar"><button class="primary" id="tactic-timeline-play" type="button" aria-pressed="${tacticsTimeline.running}">${tacticsTimeline.running?'暂停时间轴':'播放时间轴'}</button><button class="secondary" id="tactic-timeline-reset" type="button">重置到 0 秒</button><label class="timeline-side">火焰口径<select id="tactic-side" aria-label="选择火焰阵营口径"><option value="T" ${tacticsTimeline.side==='T'?'selected':''}>T · Molotov 7.0 秒</option><option value="CT" ${tacticsTimeline.side==='CT'?'selected':''}>CT · Incendiary 5.5 秒</option></select></label><span class="timeline-readout" id="tactic-time-readout">${tacticDisplayTime(tacticsTimeline.time)} / ${tacticTimelineMax} 秒</span></div><div class="tactic-slider-wrap"><input id="tactic-timeline-slider" type="range" min="0" max="${tacticTimelineMax}" step="1" value="${tacticsTimeline.time}" aria-label="方案时间轴，单位秒" aria-valuemin="0" aria-valuemax="${tacticTimelineMax}" aria-valuenow="${tacticDisplayTime(tacticsTimeline.time)}"><div class="tactic-time-scale"><span>0</span><span>30</span><span>60</span><span>90</span><span>120 秒</span></div></div><div class="tactic-timeline-tracks">${tracks}</div><div class="tactics-strategy-note" id="tactic-strategy-note">${tacticTimelineStrategy()}</div><p class="tiny timeline-footnote">效果时长按当前 CS2 竞技规则窗口展示：闪光实际致盲取决于距离、视角和遮挡；HE 是瞬时爆炸；火焰按 T / CT 口径分别计时。地图上只显示当前方案，不会预先放入固定道具。</p></section>`;
  }
  function legacyTactics(){
    const map=selectedTacticMap();
    if(!map)return heading('MAP TACTICS / MAP BOARD','地图战术板','暂时没有可用的地图数据。');
    const activeUtility=tacticsUtility==='all'?null:tacticUtilityById(tacticsUtility),lineup=selectedTacticLineup(map.id),lineups=tacticLineupsFor(map.id);
    return heading('MAP TACTICS / MAP BOARD','地图战术板','沙2、Mirage、小镇：用官方雷达底图记点，用当前 CS2 道具规则练投掷。',`<span class="date-badge">数据快照 · ${esc(tacticsData.snapshot)}</span>`)+
      `<section class="tactics-hero"><div><span class="pill">TACTICS BOARD</span><h2>先看地图，再决定这一颗道具要换来什么。</h2><p>地图底图采用官方游戏 depot 同步的雷达快照；数量按单人携带上限与五人队伍理论上限分开显示。烟雾、闪光、HE 和火焰的效果可单独筛选。</p></div><div class="tactics-hero-stats"><div><b>${tacticMaps.length}</b><span>老三张地图</span></div><div><b>${tacticUtilityTypes.length}</b><span>道具类型</span></div><div><b>${lineups.length}</b><span>当前地图投掷卡</span></div></div></section>`+
      `<div class="tactic-map-tabs" role="tablist" aria-label="选择地图">${tacticMaps.map(item=>`<button class="tactic-map-tab ${item.id===map.id?'active':''}" data-map-id="${esc(item.id)}" role="tab" aria-selected="${item.id===map.id}"><span class="map-tab-index">0${tacticMaps.indexOf(item)+1}</span><span><strong>${esc(item.name)}</strong><small>${esc(item.english)}</small></span></button>`).join('')}</div>`+
      `<div class="tactics-layout"><section class="panel tactics-map-panel"><div class="section-head"><div><h2>${esc(map.name)} / ${esc(map.english)}</h2><p class="tiny">${esc(map.note)}</p></div><span class="map-version">${esc(map.overview)}</span></div>${tacticMapBoard(map,lineup)}</section><aside class="panel tactics-side"><div class="section-head"><div><h2>道具与数量</h2><p class="tiny">按竞技模式的每人携带口径</p></div><span class="tiny">5 人队伍</span></div><div class="tactic-utility-filter"><button class="tactic-filter ${tacticsUtility==='all'?'active':''}" data-utility-type="all" aria-pressed="${tacticsUtility==='all'}">全部</button>${tacticUtilityTypes.map(item=>`<button class="tactic-filter ${tacticsUtility===item.id?'active':''}" data-utility-type="${esc(item.id)}" aria-pressed="${tacticsUtility===item.id}">${esc(item.short)}</button>`).join('')}</div><div class="tactic-utility-list">${tacticUtilityTypes.map(tacticInventoryRow).join('')}</div>${tacticsUtility==='all'?`<div class="tactic-count-note"><strong>数量检查：</strong>烟雾、HE、火焰都是每人 1 颗，所以一方最多 5 颗；闪光每人 2 颗，所以队伍上限是 10 颗。这里不会把队伍上限误写成单人数量。</div>`:''}${tacticUtilityDetail(activeUtility)}</aside></div>`+
      tacticsTimelineMarkup()+
      `<section class="panel tactics-lineups" id="tactics-lineups"><div class="section-head"><div><h2>${esc(map.name)} · 关键投掷办法</h2><p class="tiny">每张卡直接显示实际投掷截图，并可在卡片内播放完整演示；下方步骤用于配合画面复核站位、手法和飞行时间。</p></div><span class="tiny">${lineups.length} 张卡</span></div><div class="lineup-grid">${lineups.map(tacticLineupCard).join('')}</div><div class="tactics-practice-note"><strong>练习顺序：</strong>先在练习房打开无限弹药 / 无限手雷，逐张卡确认站位和落点；地图碰撞、出生位和跳投行为可能随 Valve 更新改变，卡片上的“更新日期”用于提醒你复核。画面来自 CSNADES.gg，来源链接仍保留在每张卡底部。</div></section>`+
      `<section class="panel tactics-sources"><div class="section-head"><div><h2>数据口径与来源</h2><p class="tiny">这页把“可验证的游戏数据”和“教学示意”分开标注。</p></div><span class="tiny">版本快照 ${esc(tacticsData.snapshot)}</span></div><div class="source-grid"><div><strong>地图底图与坐标</strong><p>三张 PNG 是从官方游戏 depot 同步的雷达快照；overview 的 pos_x、pos_y、scale 和包点 / 出生点归一化坐标随地图一并固定。</p><a href="${esc(tacticsData.radarSource)}" target="_blank" rel="noreferrer">CS2 Map Icons / depot 同步说明 ↗</a><br><a href="${esc(map.overviewSource)}" target="_blank" rel="noreferrer">当前地图 overview：${esc(map.overviewFile)} ↗</a></div><div><strong>道具规则</strong><p>道具分类、游戏实体名与投掷速度按 Valve 的 GameTracking-CS2 数据核对；持续时间按当前竞技模式常用游戏规则记录。真实可见性、伤害、火焰扩散和碰撞仍受距离、视角、材质与地图几何影响。</p><a href="${esc(tacticsData.utilitySource)}" target="_blank" rel="noreferrer">Valve GameTracking / weapons.vdata ↗</a></div><div><strong>投掷卡</strong><p>关键投掷卡的手法与飞行时间链接到可追溯的 CSNADES 单颗投掷页；卡面图是站位到落点的教学方向示意，具体准星请以原始投掷卡和当前练习房复核。</p><a href="${esc(tacticsData.lineupSource)}" target="_blank" rel="noreferrer">CSNADES 当前地图指南 ↗</a><br><span class="tiny">地图底图版权归 Valve Corporation；本项目不是 Valve 官方产品。</span></div></div></section>`;
  }
  function tactics(){
    const map=selectedTacticMap();
    if(!map)return heading('MAP TACTICS / MAP BOARD','地图战术板','暂时没有可用的地图数据。');
    const activeUtility=tacticUtilityById(tacticPlaceUtility),lineup=selectedTacticLineup(map.id),lineups=tacticLineupsFor(map.id),plan=tacticPlanFor(map.id),countSummary=tacticUtilityTypes.map(item=>`${item.name} ${item.perPlayer} 颗/人 · ${item.teamMax} 颗/方`).join('；');
    return heading('MAP TACTICS / MAP BOARD','地图战术板','沙2、Mirage、小镇：从一张空地图开始，把道具、落点、投掷时间和组合都编排成自己的战术方案。',`<span class="date-badge">数据快照 · ${esc(tacticsData.snapshot)}</span>`)+
      `<section class="tactics-hero"><div><span class="pill">TACTICS BOARD</span><h2>先安排“什么时候丢”，再安排“丢在哪里”。</h2><p>地图默认只保留包点、出生点和雷达底图，不预置任何道具效果。选择右侧道具后，把时间轴拖到投掷时刻，点击地图落点；重复操作即可做出烟火分割、闪光跟进或防守延迟组合。</p></div><div class="tactics-hero-stats"><div><b>${tacticMaps.length}</b><span>老三张地图</span></div><div><b>${tacticUtilityTypes.length}</b><span>可编排道具</span></div><div><b>${plan.length}</b><span>当前方案道具</span></div></div></section>`+
      `<div class="tactic-map-tabs" role="tablist" aria-label="选择地图">${tacticMaps.map(item=>`<button class="tactic-map-tab ${item.id===map.id?'active':''}" data-map-id="${esc(item.id)}" role="tab" aria-selected="${item.id===map.id}"><span class="map-tab-index">0${tacticMaps.indexOf(item)+1}</span><span><strong>${esc(item.name)}</strong><small>${esc(item.english)}</small></span></button>`).join('')}</div>`+
      `<div class="tactics-layout"><section class="panel tactics-map-panel"><div class="section-head"><div><h2>${esc(map.name)} / ${esc(map.english)}</h2><p class="tiny">${esc(map.note)}</p></div><span class="map-version">${esc(map.overview)}</span></div>${tacticMapBoard(map,lineup)}</section><aside class="panel tactics-side"><div class="section-head"><div><h2>选择道具</h2><p class="tiny">点选后作为下一次地图布置的类型</p></div><span class="tiny">T / CT 分开记录</span></div><div class="tactic-utility-list">${tacticUtilityTypes.map(item=>tacticInventoryRow(item,map.id)).join('')}</div><div class="tactic-count-note"><strong>数量检查：</strong>${countSummary}。计划会按 T / CT 方分别计数，超过该阵营的队伍上限时不会继续添加。</div>${tacticUtilityDetail(activeUtility)}</aside></div>`+
      tacticLineupLibrary(map)+
      tacticSourcesMarkup(map);
  }
  function dashboard(){
    const dates=Object.values(state.days).filter(d=>d.tasks.length).length,current=weeks.findIndex((_,i)=>!state.weeks.includes(i+1));
    const heat=[];for(let i=20;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=dateKey(d),n=state.days[key]?.tasks.length||0;heat.push(`<span class="heat-cell ${n?'on':''}" title="${key}：${n} 项" aria-label="${key}完成${n}项"></span>`);}
    return heading('PRACTICE WITH PURPOSE','练得有章法，打得有思路<span class="accent">。</span>','先完成今天的一小步，再把它带进下一场比赛。',`<span class="date-badge">${new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date())}</span>`)+
    `<section class="focus-card"><div><span class="pill">TODAY'S FOCUS</span><h2>停稳，再打出第一枪。</h2><p>动作越稳定，越有余力思考下一步。</p><a class="primary" href="#chapter/${state.lastChapter}">继续学习 · 第 ${Number(state.lastChapter)} 章 ↗</a><div class="focus-editor"><label for="daily-focus">今天只专注一件事</label><input id="daily-focus" class="focus-input" maxlength="300" value="${esc(day().focus)}" placeholder="例如：每次出角，停稳后再开枪"></div></div><div class="key-diagram" aria-label="向右移动、反向制动、停稳开枪"><kbd>D</kbd><span>→</span><kbd>A</kbd><span>→</span><span class="crosshair">⊕</span><small>横向移动 / 反向制动 / 准确射击</small></div></section>
    <section class="stats" aria-label="学习统计">${[[dates,'天','累计训练','▦'],[state.read.length,'/ 17','已学章节','▤'],[state.logs.length,'篇','复盘记录','✎']].map(s=>`<div class="stat"><div><strong>${s[0]}<span> ${s[1]}</span></strong><span>${s[2]}</span></div><span class="stat-symbol">${s[3]}</span></div>`).join('')}</section>
    <div class="two-col"><section class="panel"><div class="section-head"><h2>今天的训练</h2><span class="tiny">${day().tasks.length} / 6 已完成</span></div>${tasks.map((t,i)=>`<div class="task-row ${day().tasks.includes(i)?'done':''}"><label><input type="checkbox" data-task="${i}" ${day().tasks.includes(i)?'checked':''}><span><strong>${t[0]}</strong><small>${t[1]}</small></span></label><span class="minutes">${t[2]}</span><a href="#chapter/${t[3]}" aria-label="学习${t[0]}" class="text-button">↗</a></div>`).join('')}<div class="track" role="progressbar" aria-label="今日训练完成度" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${day().tasks.length}"><span style="width:${day().tasks.length/6*100}%"></span></div></section>
    <aside><section class="panel"><div class="section-head"><h2>${current<0?'八周训练已完成':`第 ${String(current+1).padStart(2,'0')} 周`}</h2><a class="text-button" href="#plan">查看计划 ↗</a></div><p class="muted">${current<0?'回看基线，为下一轮选一个重点。':weeks[current][1]}</p><span class="tiny">最近 21 天 · 完成任一训练即点亮</span><div class="heatmap">${heat.join('')}</div><div class="timer"><label for="timer-length" class="tiny">专注一个动作</label><select id="timer-length" aria-label="训练计时时长" class="chip">${[[480,'8 分钟 · 基础'],[600,'10 分钟 · 专项'],[1200,'20 分钟 · 打狙']].map(t=>`<option value="${t[0]}" ${total===t[0]?'selected':''}>${t[1]}</option>`).join('')}</select><div class="timer-display" id="timer-display">${formatTime(remaining)}</div><div class="timer-actions"><button id="timer-toggle" class="primary">${timerEnd?'暂停计时':'开始计时'}</button><button id="timer-reset" class="secondary">重置</button></div></div></section></aside></div>
    <div class="section-head"><h2>高频技巧，随手查阅</h2><a href="#library" class="text-button">全部 17 章 ↗</a></div><div class="quick-links">${[['02','如何正确急停','按键顺序 · 出枪时机 · 常见纠错','chapter'],['05','把 AWP 打得更稳','架点选择 · 空枪撤退 · 回防处理','chapter'],['11','残局先做哪一步','1v1 / 1v2 · 守包与拆包 · 时间判断','chapter'],['sensitivity','找到你的灵敏度','通用枪械与狙击 / 开镜分开测试','lab'],['recoil','开始压枪训练','AK · M4 · 咖喱 · 可连续扫射武器','lab'],['tactics','打开地图战术板','沙2 · Mirage · 小镇 · 烟闪火雷投掷提示','lab']].map(c=>`<a class="quick-link" href="#${c[3]==='chapter'?'chapter/':''}${c[0]}"><span class="num">${c[3]==='chapter'?'FIELD GUIDE':'TRAINING LAB'} / ${c[0]}</span><strong>${c[1]} ↗</strong><p>${c[2]}</p></a>`).join('')}</div>`;
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
  const weaponPattern=weapon=>weapon.recoilType==='fixed'?(recoilPatterns[weapon.pattern]||[]):[];
  function weaponAmmoLabel(weapon){
    if(weapon.reserveMags)return `${weapon.magazine} 发/匣 · 备用 ${weapon.reserveMags} 匣 · 总 ${weapon.magazine*(weapon.reserveMags+1)} 发`;
    if(weapon.reserveUnits!==undefined)return `${weapon.magazine} 发/匣 · 备用 ${weapon.reserveUnits} 发 · 总 ${weapon.magazine+weapon.reserveUnits} 发`;
    return `${weapon.magazine} 发/匣`;
  }
  function weaponMechanicLabel(weapon){
    return `${weapon.patternShots} 发 · ${weapon.fireRate} RPM · ${recoilInterval(weapon).toFixed(0)} ms/发`;
  }
  function recoilViewSession(weapon){
    if(recoilSession&&recoilSession.weaponId===weapon.id)return recoilSession;
    const saved=state.recoil.sessions.find(item=>item.weaponId===weapon.id);if(!saved)return null;
    const targetShots=Math.min(saved.targetShots||saved.shots||recoilShots,weapon.patternShots),reference=weaponPattern(weapon).slice(0,targetShots),geometry=chartGeometry(reference,760,460);
    return {...saved,active:false,reference,scale:geometry.scale,points:saved.trace||[],sampleTrace:(saved.sampleTrace?.length?saved.sampleTrace:saved.trace||[]).slice(0,reference.length),result:saved};
  }
  function recoilList(){
    const list=weapons.filter(w=>(recoilCategory==='全部'||w.category===recoilCategory)&&(!recoilQuery.trim()||`${w.name} ${w.alias} ${w.category}`.toLowerCase().includes(recoilQuery.trim().toLowerCase())));
    return list.length?list.map(w=>`<button class="weapon-row ${selectedWeapon().id===w.id?'active':''}" data-recoil-weapon="${w.id}"><span class="weapon-icon">${esc(w.alias.slice(0,3))}</span><span><strong>${esc(w.name)}</strong><small>${esc(w.category)} · ${weaponAmmoLabel(w)} · ${weaponMechanicLabel(w)}</small></span></button>`).join(''):'<p class="empty-history">没有匹配的武器。</p>';
  }
  function recoilShotOptions(weapon){const max=weapon.patternShots;return [5,10,15,20,30,40,50,75,100,125,150,max].filter((n,i,a)=>n>0&&n<=max&&a.indexOf(n)===i).sort((a,b)=>a-b);}
  function recoilSuggestions(metrics,weapon){
    const suggestions=[];
    if(metrics.lateShots>0)suggestions.push(`有 ${metrics.lateShots} 发在发射时仍偏离目标（超过 ${recoilErrorThreshold} px）：提前在上一发结束前开始修正，不要等看到下一发再补。`);
    if(metrics.verticalError<-12)suggestions.push('后段下拉不足：从第 3～5 发就开始给鼠标持续向下的补偿。');
    if(metrics.verticalError>12)suggestions.push('下拉过早或过多：先只练前 10 发，让准星停在目标区再继续。');
    if(Math.abs(metrics.lateralError)>14)suggestions.push(metrics.lateralError>0?'整体偏右：左向修正还不够，先把横向摆动放小。':'整体偏左：右向修正过度，尝试只跟随参考线的转折。');
    if(!suggestions.length)suggestions.push(`这轮逐发到点位置已经接近参考线。${weapon.patternShots>10?'下一轮保持同一距离，增加到 '+Math.min(weapon.patternShots,20)+' 发。':'下一轮继续练习每发之间的节奏。'}`);
    return suggestions;
  }
  function recoilSummary(){
    const sessions=state.recoil.sessions.filter(session=>supportedRecoilWeapons.has(session.weaponId)),avg=sessions.length?sessions.reduce((sum,s)=>sum+s.score,0)/sessions.length:0,best=sessions.slice().sort((a,b)=>b.score-a.score)[0];
    return `<div class="recoil-summary"><div><b>${sessions.length}</b><span>总记录</span></div><div><b>${sessions.length?avg.toFixed(0):'—'}</b><span>平均评分</span></div><div><b>${best?best.score.toFixed(0):'—'}</b><span>最高评分</span></div><div><b>${new Set(sessions.map(s=>s.weaponId)).size}</b><span>已练武器</span></div></div>`;
  }
  function recoilHistory(){
    const sessions=state.recoil.sessions.filter(session=>supportedRecoilWeapons.has(session.weaponId)).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,8);
    if(!sessions.length)return '<p class="empty-history">还没有压枪记录。先点开始训练，再点住画布跟随逐发目标。</p>';
    return `<div class="recoil-history">${sessions.map(s=>{const w=weapons.find(item=>item.id===s.weaponId),name=w?.name||s.weaponId;return `<div class="recoil-history-item"><div class="history-top"><strong>${esc(name)}</strong><span class="history-actions"><span class="score">${s.score.toFixed(0)} 分</span><button class="recoil-history-delete" type="button" data-recoil-delete="${esc(s.id)}" aria-label="删除 ${esc(name)} 压枪记录">删除</button></span></div><p>${esc(s.date)} · ${s.shots}/${s.targetShots||s.shots} 发 · 平均误差 ${s.meanError.toFixed(1)} px · 到点偏差 ${s.lateShots||0} 发</p></div>`;}).join('')}</div>`;
  }
  function recoilCanvasMarkup(weapon,shots){
    const session=recoilViewSession(weapon),last=session?.result;
    const legend='<div class="recoil-legend"><span><i class="legend-dot"></i>橙色：实际后坐力参考</span><span><i class="legend-dot ideal"></i>绿色圈：中心目标范围</span><span><i class="legend-dot target"></i>黄色：当前逐发目标</span><span><i class="legend-dot mine"></i>青色：我的完整轨迹</span><span><i class="legend-dot miss"></i>红点：发射时偏差</span></div>';
    return `<div class="recoil-scene-heading"><div><p class="eyebrow">LIVE RANGE / FIRST-PERSON VIEW</p><h3>第一人称压枪视角</h3><p>把准星压回绿色目标区，子弹会在墙面留下实际偏差。</p></div><span class="scene-badge">鼠标点住画面练习</span></div><div class="recoil-scene-frame"><canvas id="recoil-scene-canvas" width="760" height="460" aria-label="${esc(weapon.name)}第一人称压枪模拟画面"></canvas></div><div class="recoil-chart-heading"><div><h3>逐发弹道数据</h3><p>保留精确的参考弹道、完整鼠标轨迹和逐发评分点。</p></div><span class="scene-badge">数据复盘</span></div><div class="recoil-chart-frame"><canvas id="recoil-canvas" width="760" height="460" aria-label="${esc(weapon.name)}逐发计时压枪弹道图"></canvas></div>${legend}${last?`<div class="recoil-result"><h3>本轮建议 · ${last.score.toFixed(0)} 分</h3><p>${recoilSuggestions(last,weapon).map(esc).join('<br>')}</p><div class="result-metrics"><div><b>${last.meanError.toFixed(1)} px</b><span>平均误差</span></div><div><b>${last.lateShots||0} 发</b><span>到点偏差</span></div><div><b>${(last.timingAccuracy??100).toFixed(0)}%</b><span>按时到位率</span></div><div><b>${last.verticalError>0?'+':''}${last.verticalError.toFixed(1)}</b><span>纵向偏差</span></div><div><b>${last.lateralError>0?'+':''}${last.lateralError.toFixed(1)}</b><span>横向偏差</span></div></div></div>`:''}`;
  }
  function chartGeometry(pattern,W,H){
    const maxX=Math.max(1,...pattern.map(point=>Math.abs(point.x))),maxY=Math.max(1,...pattern.map(point=>Math.abs(point.y))),scale=Math.min((W-90)/(2*maxX),(H-90)/(2*maxY),2.2);
    return {scale,origin:{x:W/2,y:H/2}};
  }
  function drawCanvasBackground(ctx,W,H){
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#101710';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#263423';ctx.lineWidth=1;
    for(let x=40;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=20;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  }
  function recoilDisplaySamples(session,reference){
    if(!session)return [];
    if(session.active)return session.samples||[];
    const persisted=session.sampleTrace?.length?session.sampleTrace:session.trace||[];
    return persisted.slice(0,reference.length).map((actual,index)=>{const expected=idealRecoilPoint(session,index),error=Math.hypot(actual.x-expected.x,actual.y-expected.y);return {shot:index+1,actual,expected,error,late:error>recoilErrorThreshold};});
  }
  function recoilClamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function recoilSceneImpact(session,sample,index,center){
    const expected=sample.expected||idealRecoilPoint(session,index),actual=sample.actual||{x:0,y:0};
    return {x:recoilClamp(center.x+(Number(actual.x)||0)-expected.x,35,725),y:recoilClamp(center.y+(Number(actual.y)||0)-expected.y,48,332)};
  }
  function drawRecoilImpact(ctx,point,index,age){
    const angle=(index*1.37)%Math.PI,active=age>=0&&age<170;
    ctx.save();ctx.translate(point.x,point.y);ctx.rotate(angle);
    ctx.fillStyle='#090d0b';ctx.strokeStyle='#020403';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,7.5,4.8,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#263126';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-5,-2);ctx.lineTo(-11,-5);ctx.moveTo(3,-3);ctx.lineTo(9,-7);ctx.moveTo(4,2);ctx.lineTo(11,5);ctx.moveTo(-2,3);ctx.lineTo(-7,8);ctx.stroke();
    if(active){const strength=1-age/170;ctx.globalAlpha=strength;ctx.strokeStyle='#ffd166';ctx.lineWidth=1.5;for(let ray=0;ray<5;ray++){const a=ray*1.26+index*.43;ctx.beginPath();ctx.moveTo(Math.cos(a)*5,Math.sin(a)*5);ctx.lineTo(Math.cos(a)* (12+ray%2*4),Math.sin(a)*(12+ray%2*4));ctx.stroke();}}
    ctx.restore();
  }
  function drawRecoilReticle(ctx,point,color,dashed=false){
    ctx.save();ctx.translate(point.x,point.y);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.setLineDash(dashed?[5,4]:[]);ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(-5,0);ctx.moveTo(5,0);ctx.lineTo(18,0);ctx.moveTo(0,-18);ctx.lineTo(0,-5);ctx.moveTo(0,5);ctx.lineTo(0,18);ctx.stroke();ctx.restore();
  }
  function recoilWeaponVisual(weapon){
    const base={variant:'rifle',metal:'#344139',dark:'#0d130f',highlight:'#71806b',furniture:'#29352c',mag:'straight',stock:'collapsible',sight:'rail',suppressed:false,handguard:'long'};
    const profiles={
      ak47:{variant:'ak',metal:'#30392f',highlight:'#6b7662',furniture:'#85552f',mag:'ak',stock:'wood',sight:'iron',handguard:'wood'},
      m4a4:{variant:'m4',metal:'#3d4a40',highlight:'#7c8d76',furniture:'#273229',mag:'straight',stock:'collapsible',sight:'carry'},
      m4a1s:{variant:'m4',metal:'#36443a',highlight:'#81927b',furniture:'#263229',mag:'straight',stock:'collapsible',sight:'carry',suppressed:true},
      galil:{variant:'galil',metal:'#394239',highlight:'#7b866f',furniture:'#715034',mag:'ak',stock:'fixed',sight:'iron',handguard:'wood'},
      famas:{variant:'famas',metal:'#465247',highlight:'#8a9781',furniture:'#2a342d',mag:'straight',stock:'bullpup',sight:'carry',handguard:'short'},
      aug:{variant:'aug',metal:'#52614f',highlight:'#a4b18c',furniture:'#344437',mag:'straight',stock:'bullpup',sight:'scope',handguard:'short'},
      sg553:{variant:'sg',metal:'#3c493d',highlight:'#829176',furniture:'#2b372e',mag:'ak',stock:'collapsible',sight:'scope'},
      mac10:{variant:'mac10',metal:'#27322b',highlight:'#6d7d6b',furniture:'#1b241e',mag:'straight',stock:'none',sight:'iron',handguard:'short'},
      mp9:{variant:'mp9',metal:'#344239',highlight:'#84947c',furniture:'#28352d',mag:'straight',stock:'wire',sight:'rail',handguard:'short'},
      mp7:{variant:'mp7',metal:'#46554a',highlight:'#96a58c',furniture:'#27342c',mag:'straight',stock:'wire',sight:'rail',handguard:'short'},
      mp5sd:{variant:'mp5sd',metal:'#354238',highlight:'#82947d',furniture:'#202c24',mag:'straight',stock:'collapsible',sight:'iron',suppressed:true,handguard:'short'},
      ump45:{variant:'ump',metal:'#3b493e',highlight:'#8a9a80',furniture:'#29362d',mag:'straight',stock:'collapsible',sight:'rail',handguard:'short'},
      p90:{variant:'p90',metal:'#4a584b',highlight:'#a0ae91',furniture:'#303f35',mag:'top',stock:'bullpup',sight:'rail',handguard:'short'},
      bizon:{variant:'bizon',metal:'#303d34',highlight:'#7d8d78',furniture:'#253229',mag:'drum',stock:'wire',sight:'iron',handguard:'short'},
      m249:{variant:'m249',metal:'#3e4c40',highlight:'#8c9b7d',furniture:'#29382e',mag:'box',stock:'fixed',sight:'rail'},
      negev:{variant:'negev',metal:'#4a5746',highlight:'#a1ad8e',furniture:'#334333',mag:'box',stock:'fixed',sight:'rail'}
    };
    return {...base,...(profiles[weapon?.id]||{})};
  }
  function firstPersonGunMuzzle(W,H,weapon){
    const p=recoilWeaponVisual(weapon),angle=.32,origin={x:W*.80,y:H*.96},x=p.suppressed?-296:-264,y=-43;
    return {x:origin.x+x*Math.cos(angle)-y*Math.sin(angle),y:origin.y+x*Math.sin(angle)+y*Math.cos(angle)};
  }
  function drawFirstPersonGun(ctx,W,H,weapon){
    const p=recoilWeaponVisual(weapon),angle=.32,origin={x:W*.80,y:H*.96},muzzleLocal={x:p.suppressed?-296:-264,y:-43},toScreen=(x,y)=>({x:origin.x+x*Math.cos(angle)-y*Math.sin(angle),y:origin.y+x*Math.sin(angle)+y*Math.cos(angle)}),poly=(points,fill,stroke='#090e0b')=>{ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);points.slice(1).forEach(point=>ctx.lineTo(point[0],point[1]));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}},line=(points,color,width=1)=>{ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);points.slice(1).forEach(point=>ctx.lineTo(point[0],point[1]));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();},rect=(x,y,w,h,fill,stroke)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.strokeRect(x,y,w,h);}};
    ctx.save();ctx.translate(origin.x,origin.y);ctx.rotate(angle);ctx.shadowColor='#000c';ctx.shadowBlur=22;ctx.shadowOffsetY=12;
    poly([[18,18],[84,4],[151,54],[143,126],[86,112],[36,68]],'#1b251e');poly([[-170,50],[-126,3],[-78,17],[-70,95],[-132,130],[-184,108]],'#253128');ctx.shadowColor='transparent';
    poly([[-150,31],[-123,4],[-84,10],[-74,37],[-112,55]],'#b57b5b','#623f30');poly([[30,15],[74,4],[120,36],[109,67],[59,54]],'#bd825f','#623f30');
    if(p.variant==='p90'){
      poly([[-195,-83],[-74,-91],[18,-69],[34,-22],[-28,-7],[-188,-23]],p.metal);
      poly([[-181,-101],[-34,-105],[-21,-83],[-174,-77]],p.highlight);
      for(let i=0;i<6;i++)line([[-164+i*22,-99],[-155+i*22,-82]],'#29352d',2);
      poly([[-157,-24],[-36,-24],[-24,4],[-151,12]],p.furniture);
      rect(-116,-69,88,7,p.dark);rect(-105,-67,72,2,p.highlight);
      poly([[-86,-20],[-37,-15],[-23,49],[-60,61],[-91,43]],p.furniture);
    }else if(p.variant==='bizon'){
      poly([[-190,-69],[-75,-72],[31,-58],[37,-16],[-72,-11],[-195,-24]],p.metal);
      poly([[-209,-60],[-192,-75],[-76,-76],[-72,-60]],p.highlight);
      ctx.beginPath();ctx.ellipse(-91,10,65,23,0,0,Math.PI*2);ctx.fillStyle=p.furniture;ctx.fill();ctx.strokeStyle='#090e0b';ctx.stroke();
      for(let i=-135;i<-48;i+=15)line([[i,-8],[i+10,25]],'#667663',1);
      poly([[5,-46],[42,-42],[69,-15],[47,1],[11,-11]],p.furniture);
    }else if(p.variant==='m249'||p.variant==='negev'){
      poly([[-193,-75],[-49,-81],[51,-59],[59,-13],[-56,-4],[-201,-27]],p.metal);
      poly([[-181,-68],[-62,-71],[-35,-56],[-171,-48]],p.highlight);
      for(let i=0;i<7;i++)rect(-170+i*18,-61,10,4,p.dark);
      poly([[-73,-8],[-8,-4],[4,76],[-55,92],[-87,56]],p.furniture);
      for(let i=0;i<4;i++)line([[-72+i*15,3],[-66+i*15,69]],'#71816b',1);
      line([[-4,55],[26,102],[40,98],[17,42]],'#101710',4);line([[18,43],[35,89]],p.highlight,1);
    }else if(p.variant==='famas'||p.variant==='aug'){
      poly([[-192,-74],[-42,-79],[39,-60],[43,-16],[-44,-5],[-195,-25]],p.metal);
      poly([[-183,-67],[-61,-71],[-35,-56],[-177,-49]],p.highlight);
      poly([[-148,-18],[-106,-14],[-96,63],[-127,77],[-157,48]],p.furniture);
      rect(-122,-89,98,8,p.dark);rect(-112,-87,78,3,p.highlight);
      poly([[-20,-45],[21,-41],[45,-20],[25,-2],[-13,-9]],p.furniture);
    }else{
      const wood=p.variant==='ak'||p.variant==='galil';
      poly([[-212,-72],[-93,-78],[40,-61],[48,-18],[-63,-6],[-217,-27]],p.metal);
      poly([[-201,-64],[-110,-69],[-72,-54],[-194,-47]],wood?p.furniture:p.highlight);
      if(p.handguard==='wood')poly([[-220,-62],[-131,-64],[-115,-43],[-211,-34]],p.furniture);
      else {rect(-207,-61,94,17,p.dark);for(let i=0;i<7;i++)rect(-198+i*13,-61,4,17,p.highlight);}
      poly([[-90,-18],[-34,-14],[-19,62],[-54,75],[-96,44]],p.furniture);
      poly([[-38,-45],[30,-42],[55,-20],[37,-2],[-27,-8]],p.furniture);
    }
    if(p.suppressed){rect(-310,-55,57,22,'#1c2820','#080c09');rect(-301,-51,43,3,p.highlight);for(let i=0;i<4;i++)line([[-302+i*11,-53],[-298+i*11,-35]],'#090e0b',1);}else{rect(-278,-52,30,17,p.dark);rect(-272,-49,18,3,p.highlight);}
    line([[-247,-43],[-30,-43]],'#101610',3);line([[-246,-40],[-34,-40]],p.highlight,1);
    if(p.sight==='scope'){poly([[-119,-96],[-43,-98],[-29,-77],[-105,-75]],'#18221b');rect(-101,-91,45,5,p.highlight);ctx.beginPath();ctx.arc(-34,-87,10,0,Math.PI*2);ctx.strokeStyle='#0a0e0b';ctx.lineWidth=3;ctx.stroke();}
    else if(p.sight==='carry'){poly([[-124,-93],[-64,-96],[-45,-78],[-111,-77]],p.dark);rect(-112,-91,50,3,p.highlight);}
    else {rect(-118,-81,88,6,p.dark);for(let i=0;i<5;i++)rect(-110+i*17,-80,7,3,p.highlight);}
    if(p.variant==='ak'||p.variant==='galil'||p.variant==='sg'){poly([[-69,-5],[-38,1],[-28,70],[-49,94],[-80,72]],p.mag==='ak'?'#1e2921':p.furniture);for(let i=0;i<3;i++)line([[-68+i*10,5],[-58+i*10,70]],'#70806a',1);}
    else if(p.mag==='box'){poly([[-75,-4],[-16,0],[-8,73],[-62,83]],'#1b271e');for(let i=0;i<4;i++)line([[-65+i*13,5],[-60+i*13,70]],p.highlight,1);}
    else if(p.mag==='straight'&&p.variant!=='famas'&&p.variant!=='aug'&&p.variant!=='p90'){poly([[-69,-6],[-39,-2],[-37,62],[-63,67]],'#1c2820');for(let i=0;i<3;i++)line([[-64+i*9,3],[-62+i*9,59]],p.highlight,1);}
    if(p.variant==='famas'||p.variant==='aug'){poly([[-155,-9],[-125,-5],[-121,56],[-149,68]],'#1b2820');for(let i=0;i<3;i++)line([[-150+i*8,-1],[-148+i*8,56]],p.highlight,1);}
    if(p.variant==='mp9'||p.variant==='mp7'||p.variant==='bizon')line([[27,-4],[71,42],[94,40]],'#0b100c',5);
    if(p.stock==='wood')poly([[36,-45],[93,-31],[121,-7],[104,16],[53,2]],p.furniture);
    else if(p.stock==='wire'){line([[37,-36],[105,-18],[127,8],[93,28],[53,8]],'#111812',6);line([[42,-33],[101,-16],[121,6]],p.highlight,1);}
    else if(p.stock==='none')poly([[41,-43],[71,-34],[87,-15],[53,-5]],p.furniture);
    else if(p.stock!=='bullpup')poly([[38,-40],[91,-33],[113,-13],[106,13],[52,4]],p.furniture);
    poly([[8,-2],[33,1],[46,49],[25,70],[5,58]],'#1b261e','#090e0b');rect(13,7,15,3,p.highlight);
    ctx.fillStyle='#c8dd91';ctx.font='bold 8px ui-monospace,monospace';ctx.fillText(String(weapon?.name||'AUTO').toUpperCase(),-88,-34);ctx.fillStyle='#101710';ctx.fillRect(-95,-29,76,2);
    ctx.restore();return toScreen(muzzleLocal.x,muzzleLocal.y);
  }
  function drawRecoilScene(now,weapon,session,reference){
    const canvas=$('#recoil-scene-canvas');if(!canvas)return;
    const ctx=canvas.getContext('2d'),W=760,H=460,center={x:W/2,y:H/2},samples=recoilDisplaySamples(session,reference),active=!!session?.active;
    const background=ctx.createLinearGradient(0,0,0,H);background.addColorStop(0,'#121a15');background.addColorStop(.72,'#263229');background.addColorStop(1,'#0b100d');ctx.fillStyle=background;ctx.fillRect(0,0,W,H);
    const wall={x:18,y:31,w:W-36,h:310};const wallGradient=ctx.createLinearGradient(0,wall.y,0,wall.y+wall.h);wallGradient.addColorStop(0,'#59645a');wallGradient.addColorStop(.55,'#485449');wallGradient.addColorStop(1,'#374337');ctx.fillStyle=wallGradient;ctx.fillRect(wall.x,wall.y,wall.w,wall.h);
    ctx.save();ctx.globalAlpha=.38;ctx.strokeStyle='#a4b19c';ctx.lineWidth=1;for(let y=45;y<wall.y+wall.h;y+=34){ctx.beginPath();ctx.moveTo(wall.x,y);ctx.lineTo(wall.x+wall.w,y);ctx.stroke();}for(let x=38;x<wall.x+wall.w;x+=49){ctx.beginPath();ctx.moveTo(x,wall.y);ctx.lineTo(x,wall.y+wall.h);ctx.stroke();}ctx.restore();
    ctx.fillStyle='#1a231c';ctx.fillRect(0,0,14,H);ctx.fillRect(W-14,0,14,H);ctx.fillStyle='#151d17';ctx.fillRect(0,342,W,118);ctx.strokeStyle='#71816b55';ctx.beginPath();ctx.moveTo(0,342);ctx.lineTo(W,342);ctx.stroke();
    ctx.save();ctx.fillStyle='#c8dd9118';ctx.strokeStyle='#c8dd91';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(center.x,center.y,recoilErrorThreshold*1.15,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(center.x-27,center.y);ctx.lineTo(center.x+27,center.y);ctx.moveTo(center.x,center.y-27);ctx.lineTo(center.x,center.y+27);ctx.stroke();ctx.restore();
    samples.forEach((sample,index)=>drawRecoilImpact(ctx,recoilSceneImpact(session,sample,index,center),index,typeof sample.at==='number'?now-sample.at:-1));
    const currentIndex=Math.min(session?.currentShot||0,Math.max(0,reference.length-1)),expected=session&&reference.length?idealRecoilPoint(session,currentIndex):{x:0,y:0},targetPoint={x:recoilClamp(center.x+expected.x,35,725),y:recoilClamp(center.y+expected.y,48,332)},actual=session?.lastPoint?{x:recoilClamp(center.x+session.lastPoint.x,35,725),y:recoilClamp(center.y+session.lastPoint.y,48,332)}:center;
    if(active&&session.startedAt!==null&&session.currentShot<session.shots){drawRecoilReticle(ctx,targetPoint,'#ffd166',true);drawRecoilReticle(ctx,actual,'#70d6d2',false);}
    const latest=samples.at(-1),muzzle=firstPersonGunMuzzle(W,H,weapon);if(active&&latest&&typeof latest.at==='number'){const age=now-latest.at;if(age>=0&&age<150){const impact=recoilSceneImpact(session,latest,samples.length-1,center),strength=1-age/150;ctx.save();ctx.globalAlpha=strength;ctx.strokeStyle='#ffe08a';ctx.shadowColor='#ffd166';ctx.shadowBlur=8;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(muzzle.x,muzzle.y);ctx.lineTo(impact.x,impact.y);ctx.stroke();ctx.restore();}}
    ctx.fillStyle='#dce8cb';ctx.font='bold 11px ui-monospace,monospace';ctx.fillText('LIVE RECOIL RANGE',26,20);ctx.font='12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';ctx.fillText(`${weapon.name} · 全自动`,26,48);ctx.textAlign='right';ctx.fillStyle='#c8dd91';ctx.font='bold 12px ui-monospace,monospace';ctx.fillText(`${samples.length} / ${reference.length} 发`,W-26,25);ctx.font='10px ui-monospace,monospace';ctx.fillStyle='#aabca2';ctx.fillText(active?(session.startedAt===null?'CLICK TO FIRE':'LIVE · HOLD TO CONTROL'):session?.result?'REPLAY · WALL IMPACTS':'AIM AT CENTER',W-26,46);ctx.textAlign='left';ctx.fillStyle='#b9c8b1';ctx.font='10px ui-monospace,monospace';ctx.fillText(`WALL IMPACTS  ${samples.length}  ·  TARGET ZONE  ${recoilErrorThreshold}px`,26,H-18);
    const gun=drawFirstPersonGun(ctx,W,H,weapon);if(active&&latest&&typeof latest.at==='number'){const age=now-latest.at;if(age>=0&&age<125){const strength=1-age/125;ctx.save();ctx.globalAlpha=strength;ctx.translate(gun.x,gun.y);ctx.fillStyle='#fff0ad';ctx.shadowColor='#ffd166';ctx.shadowBlur=20;ctx.beginPath();ctx.moveTo(-9,4);ctx.lineTo(-3,-31-strength*12);ctx.lineTo(4,-11);ctx.lineTo(14,-24-strength*8);ctx.lineTo(10,5);ctx.closePath();ctx.fill();ctx.fillStyle='#ff955d';ctx.beginPath();ctx.moveTo(-5,3);ctx.lineTo(1,-19-strength*8);ctx.lineTo(7,4);ctx.closePath();ctx.fill();ctx.restore();}}
  }
  function requestRecoilFrame(callback){return globalThis.requestAnimationFrame?globalThis.requestAnimationFrame(callback):setTimeout(()=>callback(performance.now()),16);}
  function cancelRecoilFrame(id){if(id===null)return;if(globalThis.cancelAnimationFrame)globalThis.cancelAnimationFrame(id);else clearTimeout(id);}
  function stopRecoilAnimation(){if(recoilFrame!==null)cancelRecoilFrame(recoilFrame);recoilFrame=null;}
  function idealRecoilPoint(session,index){const p=session.reference[index]||session.reference.at(-1)||{x:0,y:0};return {x:-p.x*session.scale,y:-p.y*session.scale};}
  function recordRecoilShots(now){
    const session=recoilSession;if(!session?.active||session.startedAt===null||now<session.startedAt)return;
    while(session.currentShot<session.shots&&now>=session.startedAt+session.currentShot*session.intervalMs){
      const shot=session.currentShot+1,deadline=session.startedAt+session.currentShot*session.intervalMs,expected=idealRecoilPoint(session,session.currentShot),actual={x:session.lastPoint.x,y:session.lastPoint.y},error=Math.hypot(actual.x-expected.x,actual.y-expected.y);
      session.samples.push({shot,at:deadline,actual,expected,error,late:error>recoilErrorThreshold});session.currentShot++;
    }
    if(session.currentShot>=session.shots){session.running=false;session.completeAt=now;}
  }
  function recoilAnimationLoop(now){
    const session=recoilSession;
    if(!session?.active||session.startedAt===null){recoilFrame=null;return;}
    recordRecoilShots(now);drawRecoil(now);
    if(session.running&&session.currentShot<session.shots)recoilFrame=requestRecoilFrame(recoilAnimationLoop);else recoilFrame=null;
  }
  function startRecoilAnimation(){stopRecoilAnimation();recoilFrame=requestRecoilFrame(recoilAnimationLoop);}
  function drawRecoil(now=performance.now()){
    const canvas=$('#recoil-canvas');if(!canvas)return;
    const ctx=canvas.getContext('2d'),W=760,H=460,weapon=selectedWeapon(),pattern=weaponPattern(weapon).slice(0,Math.min(recoilShots,weapon.patternShots)),session=recoilViewSession(weapon),reference=session?.reference?.length?session.reference:pattern,geometry=chartGeometry(reference,W,H),origin=geometry.origin,scale=session?.scale||geometry.scale;
    drawRecoilScene(now,weapon,session,reference);
    drawCanvasBackground(ctx,W,H);ctx.font='12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    const toBullet=p=>({x:origin.x+p.x*scale,y:origin.y+p.y*scale}),toIdeal=p=>({x:origin.x-p.x*scale,y:origin.y-p.y*scale}),bullet=reference.map(toBullet),ideal=reference.map(toIdeal),active=!!session?.active,samples=recoilDisplaySamples(session,reference),firedCount=samples.length;
    function path(points,color,width,dash=[]){if(!points.length)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();ctx.restore();}
    ctx.strokeStyle='#8fa66b35';ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(origin.x,20);ctx.lineTo(origin.x,H-20);ctx.stroke();ctx.setLineDash([]);
    ctx.save();ctx.fillStyle='#c8dd9122';ctx.strokeStyle='#c8dd91';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(W/2,H/2,recoilErrorThreshold,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(origin.x-9,origin.y);ctx.lineTo(origin.x+9,origin.y);ctx.moveTo(origin.x,origin.y-9);ctx.lineTo(origin.x,origin.y+9);ctx.stroke();ctx.restore();
    path(bullet,active?'#ff955d38':'#ff955d',active?2:2.5);
    const idealCount=active?Math.min(reference.length,Math.max(1,(session.currentShot||0)+1)):reference.length;
    path(ideal.slice(0,idealCount),active?'#c8dd91':'#c8dd91',2,[7,5]);
    bullet.forEach((p,i)=>{ctx.fillStyle=active&&i>=firedCount?'#ff955d48':'#ff955d';ctx.beginPath();ctx.arc(p.x,p.y,i===0?5:3.5,0,Math.PI*2);ctx.fill();if(!active&&(i===0||i%5===4)){ctx.fillStyle='#f8c1a0';ctx.font='10px ui-monospace,monospace';ctx.fillText(String(i+1),p.x+7,p.y-6);}});
    if(session?.points?.length){const mine=session.points.map(p=>({x:origin.x+p.x,y:origin.y+p.y}));path(mine,'#70d6d2',3);const last=mine.at(-1);if(last){ctx.fillStyle='#70d6d2';ctx.beginPath();ctx.arc(last.x,last.y,5,0,Math.PI*2);ctx.fill();}}
    if(samples.length){samples.forEach(sample=>{const p={x:origin.x+sample.actual.x,y:origin.y+sample.actual.y};ctx.fillStyle=sample.late?'#ff6b5b':'#70d6d2';ctx.beginPath();ctx.arc(p.x,p.y,sample.late?5:4,0,Math.PI*2);ctx.fill();ctx.fillStyle=sample.late?'#ffb0a6':'#b6ece5';ctx.font='10px ui-monospace,monospace';ctx.fillText(String(sample.shot),p.x+7,p.y-6);});}
    if(active&&session.startedAt!==null){
      const index=Math.min(session.currentShot,reference.length-1),base=index>0?ideal[index-1]:{x:origin.x,y:origin.y},target=ideal[index]||base,elapsed=now-(session.startedAt+index*session.intervalMs),progress=Math.max(0,Math.min(1,elapsed/session.intervalMs)),moving={x:base.x+(target.x-base.x)*progress,y:base.y+(target.y-base.y)*progress};
      if(session.currentShot<session.shots){
        ctx.save();ctx.shadowColor='#ffd166';ctx.shadowBlur=16;ctx.fillStyle='#ffe08a';ctx.beginPath();ctx.arc(moving.x,moving.y,5.5,0,Math.PI*2);ctx.fill();ctx.restore();
        ctx.save();ctx.strokeStyle='#ffd166';ctx.lineWidth=3;ctx.beginPath();ctx.arc(moving.x,moving.y,15+Math.sin(now/90)*2,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ffd16688';ctx.lineWidth=1;ctx.beginPath();ctx.arc(moving.x,moving.y,23,0,Math.PI*2);ctx.stroke();ctx.restore();
        ctx.fillStyle='#ffe08a';ctx.fillText(`第 ${index+1} 发目标 · ${(session.intervalMs*(1-progress)).toFixed(0)} ms`,moving.x+18,moving.y-10);
      }
    }
    ctx.fillStyle='#c8dd91';ctx.font='12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';ctx.fillText(`${weapon.name} · ${weapon.fireRate} RPM · 每发 ${recoilInterval(weapon).toFixed(0)} ms`,16,active?48:28);ctx.textAlign='right';ctx.fillStyle='#8a9a84';ctx.fillText(`${firedCount} / ${reference.length} 发`,W-16,28);ctx.textAlign='left';ctx.fillStyle='#879685';ctx.fillText(active?'绿色圈固定在中心；黄色点是当前一发目标，到点未跟上就记偏差':'绿色圈是中心目标范围；点击开始后按住画布跟随黄色逐发目标',16,H-18);ctx.textAlign='right';ctx.fillText('无散布参考 · 实际命中仍受散布影响',W-16,H-18);ctx.textAlign='left';
  }
  function recoil(){
    const weapon=selectedWeapon(),options=recoilShotOptions(weapon),fixed=weaponPattern(weapon).length>0;
    if(fixed&&!options.includes(recoilShots))recoilShots=options[options.length-1];
    const session=recoilSession?.weaponId===weapon.id?recoilSession:null;
    const action=session?.active?(session.startedAt===null?'点住画布开始':session.running?'计时进行中…':session.currentShot>=session.shots?'已发完，松开评分':'继续按住画布'): '开始计时训练';
    const controls=fixed?`<div class="recoil-controls"><label>训练弹数<select id="recoil-shots" aria-label="训练弹数">${options.map(n=>`<option value="${n}" ${n===recoilShots?'selected':''}>前 ${n} 发</option>`).join('')}</select></label><span class="timing-badge">${weapon.fireRate} RPM · 每发 ${recoilInterval(weapon).toFixed(0)} ms</span><button class="primary" id="recoil-start">${action}</button>${session?.active?'<button class="secondary" id="recoil-finish">结束并评分</button>':'<button class="secondary" id="recoil-clear">清除本轮</button>'}</div><div class="recoil-instruction"><strong>操作：</strong>先点“开始计时训练”，再点住画布，第一发会立即按当前枪械节奏计时；绿色圈固定在中心，黄色目标沿下一发的补偿方向移动。每一发到点时，系统读取你当下的位置；黄色目标还没跟上，这一发就按发射瞬间的偏差计分。松开鼠标或点击“结束并评分”后保存。建议先练前 10 发，再逐步增加。</div>`:`<div class="recoil-controls"><span class="tiny">当前训练：${esc(weaponMechanicLabel(weapon))}</span></div><div class="recoil-instruction"><strong>当前页面只保留可连续扫射武器：</strong>狙击枪、点射 / 单发手枪和霰弹枪已移出，避免用一条不适用的固定曲线误导训练。</div>`;
    return `<div class="lab-hero"><div><p class="eyebrow">RECOIL LAB / WEAPON CONTROL</p><h2>让每一发都赶在下一发之前到位。</h2><p>这里只练可连续扫射的步枪、冲锋枪和机枪。训练按每把枪的射速逐发播放：到点就记录你的即时位置，来不及完成补偿的子弹会留下红点并进入建议。</p></div><div class="lab-stat-stack"><div class="lab-stat"><strong>${weapons.length}</strong><span>可训练自动武器</span></div><div class="lab-stat"><strong>${state.recoil.sessions.length}</strong><span>压枪记录</span></div></div></div><div class="recoil-layout"><aside class="panel weapon-panel"><div class="section-head"><h2>选择武器</h2><span class="tiny">${weapons.length} 把</span></div><input class="weapon-search" id="recoil-search" type="search" placeholder="搜索 AK、咖喱、M4…" aria-label="搜索武器" value="${esc(recoilQuery)}"><div class="weapon-filters">${recoilCategories.map(c=>`<button class="weapon-filter ${recoilCategory===c?'active':''}" data-recoil-filter="${c}">${c}</button>`).join('')}</div><p class="weapon-count">显示 ${weapons.filter(w=>(recoilCategory==='全部'||w.category===recoilCategory)&&(!recoilQuery.trim()||`${w.name} ${w.alias} ${w.category}`.toLowerCase().includes(recoilQuery.trim().toLowerCase()))).length} 把</p><div class="weapon-list" id="weapon-list">${recoilList()}</div></aside><section class="panel recoil-main"><div class="weapon-heading"><div><p class="eyebrow">${esc(weapon.category)} / ${esc(weapon.difficulty)}</p><h2>${esc(weapon.name)}</h2><p>${esc(weapon.note)}</p></div><span class="weapon-tag">${esc(weaponAmmoLabel(weapon))} · ${esc(weaponMechanicLabel(weapon))}</span></div>${controls}${recoilCanvasMarkup(weapon,recoilShots)}</section><aside class="panel recoil-side"><div class="section-head"><h2>训练概览</h2><span class="tiny">本地保存</span></div>${recoilSummary()}<div class="section-head"><h2>最近记录</h2></div>${recoilHistory()}<div class="chart-note"><strong>数据口径：</strong>参考数据按当前 CS2 的逐发后坐力机制整理，按弹匣长度逐发保存；画布展示的是无散布参考路径和你的发射时坐标，不是带随机散布的命中保证。射速用于动画节拍，站姿、移动、距离、开镜状态和散布仍会改变游戏内实际落点。<br><a href="https://www.counter-strike.net/newsentry/532126482488623360" target="_blank" rel="noreferrer">Valve 弹药机制更新 ↗</a> · <a href="https://csdb.gg/recoil-patterns/" target="_blank" rel="noreferrer">逐发后坐力参考 ↗</a> · <a href="https://github.com/SteamTracking/GameTracking-CS2/blob/master/DumpSource2/schemas/server/CBasePlayerWeaponVData.h" target="_blank" rel="noreferrer">GameTracking 武器字段 ↗</a></div></aside></div>`;
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
  function canvasPoint(event,canvas){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*(canvas.width/rect.width),y:(event.clientY-rect.top)*(canvas.height/rect.height)};}
  function compactPath(points,max=600){
    if(!points?.length)return [];
    if(points.length<=max)return points.map(point=>({x:point.x,y:point.y}));
    return Array.from({length:max},(_,index)=>{const source=points[Math.round(index*(points.length-1)/(max-1))];return {x:source.x,y:source.y};});
  }
  function finishRecoil(){
    if(!recoilSession?.active)return;
    const session=recoilSession,now=performance.now();recordRecoilShots(now);stopRecoilAnimation();
    if(session.samples.length<3){recoilSession=null;render({preserveScroll:true});toast(`本轮只完成 ${session.samples.length} 发，至少完成 3 发后才会评分。`);return;}
    const weapon=weapons.find(w=>w.id===session.weaponId)||selectedWeapon(),samples=session.samples.slice(),actual=samples.map(sample=>sample.actual),errors=samples.map(sample=>sample.error),meanError=errors.reduce((sum,n)=>sum+n,0)/errors.length,verticalError=samples.reduce((sum,sample)=>sum+sample.actual.y-sample.expected.y,0)/samples.length,lateralError=samples.reduce((sum,sample)=>sum+sample.actual.x-sample.expected.x,0)/samples.length,lateShots=samples.filter(sample=>sample.error>recoilErrorThreshold).length,timingAccuracy=(samples.length-lateShots)/samples.length*100,idealLength=Math.hypot(samples.at(-1).expected.x,samples.at(-1).expected.y),actualLength=Math.hypot(samples.at(-1).actual.x,samples.at(-1).actual.y),coverage=idealLength?actualLength/idealLength:1,score=Math.max(0,Math.min(100,100-meanError*.55-(lateShots/samples.length)*20-Math.abs(1-coverage)*18)),trace=compactPath(session.points);
    const result={id:globalThis.crypto?.randomUUID?.()||`recoil-${Date.now()}`,date:today(),weaponId:weapon.id,shots:samples.length,targetShots:session.shots,score,meanError,verticalError,lateralError,lateShots,timingAccuracy,shotErrors:errors,trace,sampleTrace:actual};state.recoil.sessions.unshift(result);state.recoil.sessions=state.recoil.sessions.slice(0,2000);recoilSession={active:false,weaponId:weapon.id,shots:samples.length,targetShots:session.shots,reference:session.reference,scale:session.scale,points:trace,sampleTrace:actual,samples,result};save();render({preserveScroll:true});toast(`${weapon.name} 本轮 ${score.toFixed(0)} 分，${lateShots} 发到点偏差，建议已生成。`);
  }
  function startRecoilRecord(){
    const weapon=selectedWeapon(),shots=Math.min(recoilShots,weapon.patternShots),reference=weaponPattern(weapon).slice(0,shots),geometry=chartGeometry(reference,760,460);if(!reference.length){toast('这把武器没有可用的逐发参考数据。');return;}stopRecoilAnimation();recoilSession={active:true,running:false,weaponId:weapon.id,shots,reference,scale:geometry.scale,intervalMs:recoilInterval(weapon),startedAt:null,currentShot:0,completeAt:null,samples:[],points:[],lastPoint:{x:0,y:0},pointerId:null,drawing:false,result:null};render({preserveScroll:true});
  }
  function updateSensitivityMetrics(){
    const p=profileFor(state.sensitivity.active),eDpi=p.dpi*p.sens;
    const values={edpi:decimal(eDpi),cm:cm360(eDpi).toFixed(1),scoped:decimal(eDpi*p.zoom)};
    Object.entries(values).forEach(([key,value])=>{const node=$(`[data-metric="${key}"]`);if(node)node.textContent=value;});
  }
  function render({preserveScroll=false}={}){
    const savedScroll=preserveScroll?window.scrollY:0,previousRoute=route,parts=location.hash.slice(1).split('/');route=parts[0]||'dashboard';
    if(route!=='sensitivity'&&aimSession?.running){stopAimClock();aimSession=null;}
    if(route!=='recoil'&&recoilSession?.active){stopRecoilAnimation();recoilSession=null;}
    if(route!=='tactics'){if(tacticsTimeline.running)stopTacticsTimeline();tacticsPlacementMode=false;tacticsLineupPickMode=null;tacticDraggingPlayer=null;}
    const routeChanged=previousRoute!==route;
    const nav=route==='chapter'?'library':route,labels={dashboard:'训练台',library:'学习手册',plan:'八周计划',journal:'复盘日志',sensitivity:'灵敏度实验室',recoil:'压枪训练',tactics:'地图战术板',assets:'饰品资产'};
    $('#page-label').textContent=labels[nav]||'训练台';$$('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===nav);if(a.dataset.nav===nav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    const html=route==='assets'?window.CS2Assets.render():route==='library'?library():route==='chapter'?reader(parts[1]):route==='plan'?plan():route==='journal'?journal():route==='sensitivity'?sensitivity():route==='recoil'?recoil():route==='tactics'?tactics():dashboard();
    const lineupPicker=$('#tactic-lineup-picker-dialog');if(lineupPicker){closeTacticLineupPicker();lineupPicker.remove();}
    $('#main').innerHTML=(warning?`<p class="storage-warning" role="alert">${esc(warning)}</p>`:'')+html;$$('[data-check]').forEach(el=>el.checked=!!state.checks[el.dataset.check]);
    document.title=`${route==='chapter'?(chapters.find(c=>c.id===parts[1])?.title||'学习手册'):(labels[nav]||'训练台')} · CS2 FIELDNOTES`;
    if(route==='recoil')drawRecoil();
    if(route==='tactics'){updateTacticTimelineUI();bindTacticLineupPointButtons();}
    if(preserveScroll)window.scrollTo({top:savedScroll,behavior:'instant'});else if(parts[2])document.getElementById(parts[2])?.scrollIntoView({block:'start'});else if(routeChanged)window.scrollTo({top:0,behavior:'instant'});
  }
  function formatTime(s){s=Math.max(0,Math.ceil(s));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
  function timerUI(){if($('#timer-display'))$('#timer-display').textContent=formatTime(remaining);if($('#timer-toggle'))$('#timer-toggle').textContent=timerEnd?'暂停计时':'开始计时';}
  function stopTimer(){if(timerEnd)remaining=Math.max(0,(timerEnd-Date.now())/1000);timerEnd=null;clearInterval(timerInterval);timerInterval=null;timerUI();}
  function toggleTimer(){if(timerEnd){stopTimer();return;}if(remaining<=0)remaining=total;timerEnd=Date.now()+remaining*1000;timerInterval=setInterval(()=>{remaining=Math.max(0,(timerEnd-Date.now())/1000);if(remaining<=0){stopTimer();toast('本组训练结束。确认完成后，勾选对应训练项。');}timerUI();},250);timerUI();}
  function toggleIn(name,id){const i=state[name].indexOf(id);if(i<0)state[name].push(id);else state[name].splice(i,1);save();}
  function backup(){const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`CS2训练备份-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已导出，请妥善保存。');}
  function tacticMapPointFromEvent(event,board){const rect=board.getBoundingClientRect(),width=rect.width||1,height=rect.height||width;return {x:tacticPct(((Number(event.clientX)||rect.left)-rect.left)/width*100),y:tacticPct(((Number(event.clientY)||rect.top)-rect.top)/height*100)};}
  function startTacticPlayerDrag(event,marker){const board=marker.closest?.('#tactic-map-canvas'),playerId=marker.dataset.tacticPlayer;if(tacticsLineupPickMode||!board||!playerId||!tacticPlayerById(tacticsMapId,playerId))return;tacticDraggingPlayer={id:playerId,pointerId:event.pointerId,board,marker};marker.setAttribute('aria-grabbed','true');try{board.setPointerCapture(event.pointerId);}catch{}event.preventDefault();}
  function moveTacticPlayer(event){const drag=tacticDraggingPlayer;if(!drag||drag.pointerId!==event.pointerId)return;const player=tacticPlayerById(tacticsMapId,drag.id);if(!player)return;const point=tacticMapPointFromEvent(event,drag.board);player.x=Number(point.x.toFixed(1));player.y=Number(point.y.toFixed(1));drag.marker.setAttribute('transform',`translate(${player.x} ${player.y})`);event.preventDefault();}
  function stopTacticPlayerDrag(event){if(!tacticDraggingPlayer||tacticDraggingPlayer.pointerId!==event.pointerId)return;tacticDraggingPlayer.marker.setAttribute('aria-grabbed','false');tacticDraggingPlayer=null;event.preventDefault();}
  function addTacticThrow(event,board){
    const item=tacticUtilityById(tacticPlaceUtility),map=selectedTacticMap();if(!item||!map)return;
    const side=tacticPlaceSide==='CT'?'CT':'T',count=tacticPlanCount(map.id,item.id,side);if(count>=Number(item.teamMax)||!Number.isFinite(Number(item.teamMax))){toast(`${side} 方 ${item.name} 已达到 ${item.teamMax} 颗方案上限。`);return;}
    const point=tacticMapPointFromEvent(event,board),label=String($('#tactic-place-label')?.value||'').trim(),throwItem={id:`${map.id}-throw-${Date.now()}-${++tacticThrowSerial}`,utility:item.id,side,x:Number(point.x.toFixed(1)),y:Number(point.y.toFixed(1)),time:Math.round(tacticsTimeline.time),label};
    tacticPlanFor(map.id).push(throwItem);tacticsPlacementMode=false;render({preserveScroll:true});toast(`已添加 ${tacticUtilityShort(item.id)}：第 ${throwItem.time} 秒投掷，地图坐标 ${throwItem.x.toFixed(1)} / ${throwItem.y.toFixed(1)}。`);
  }
  function removeTacticThrow(id){const plan=tacticPlanFor(tacticsMapId),index=plan.findIndex(item=>item.id===id);if(index>=0)plan.splice(index,1);}
  document.addEventListener('click',e=>{
    const pickerBoard=e.target.closest?.('#tactic-lineup-picker-map'),board=e.target.closest?.('#tactic-map-canvas'),player=e.target.closest?.('[data-tactic-player]');if(pickerBoard&&tacticsLineupPickMode){pickTacticLineupPoint(e,pickerBoard);return;}if(board&&tacticsPlacementMode&&!player){addTacticThrow(e,board);return;}if(board&&tacticsLineupPickMode&&!player&&!tacticsPlacementMode){pickTacticLineupPoint(e,board);return;}
    const t=e.target.closest('button');if(!t)return;
    if(t.dataset.sensProfile){stopAimClock();aimSession=null;state.sensitivity.active=t.dataset.sensProfile;save();render();return;}
    if(t.dataset.dpiPreset){const p=profileFor(state.sensitivity.active),oldEdpi=p.dpi*p.sens;p.dpi=Number(t.dataset.dpiPreset);if(t.dataset.preserveEdpi==='true')p.sens=numberIn(oldEdpi/p.dpi,.01,20,p.sens);save();render();return;}
    if(t.dataset.aimStart){startAimTest(t.dataset.aimStart);return;}
    if(t.id==='aim-stop'){finishAimTest(false);return;}
    if(t.id==='tactic-timeline-play'){toggleTacticsTimeline();return;}
    if(t.id==='tactic-timeline-reset'){resetTacticsTimeline();return;}
    if(t.id==='tactic-place-toggle'){tacticsLineupPickMode=null;tacticsPlacementMode=!tacticsPlacementMode;render({preserveScroll:true});return;}
    if(t.id==='tactic-players-reset'){const map=selectedTacticMap();if(map)tacticPlayers[map.id]=tacticPlayerDefaults(map);render({preserveScroll:true});toast('当前地图的 5 名 CT 与 5 名 T 已恢复到出生点附近。');return;}
    if(t.id==='tactic-plan-clear'){tacticPlanFor(tacticsMapId).splice(0);tacticsLineupId='';tacticsPlacementMode=false;tacticsLineupPickMode=null;render({preserveScroll:true});toast('当前地图方案已清空。');return;}
    if(t.dataset.deleteThrow){removeTacticThrow(t.dataset.deleteThrow);render({preserveScroll:true});return;}
    if(t.dataset.mapId){if(tacticMaps.some(map=>map.id===t.dataset.mapId)){tacticsMapId=t.dataset.mapId;tacticsLineupId='';tacticLineupEditingId=null;tacticsLineupPickMode=null;tacticsPlacementMode=false;render();}return;}
    if(t.dataset.utilityType){if(tacticUtilityById(t.dataset.utilityType)){tacticPlaceUtility=t.dataset.utilityType;render({preserveScroll:true});}return;}
    if(t.dataset.lineupId){if(tacticLineupsFor(tacticsMapId).some(item=>item.id===t.dataset.lineupId)){tacticsLineupId=tacticsLineupId===t.dataset.lineupId?'':t.dataset.lineupId;render({preserveScroll:true});}return;}
    if(t.id==='tactic-lineup-new'){tacticLineupEditingId='new';tacticsLineupPickMode=null;render({preserveScroll:true});$('#tactic-lineup-name')?.focus();return;}
    if(t.id==='tactic-lineup-cancel'||t.id==='tactic-lineup-cancel-bottom'){tacticLineupEditingId=null;tacticsLineupPickMode=null;render({preserveScroll:true});return;}
    if(t.dataset.lineupPickerClose){closeTacticLineupPicker();return;}
    if(t.dataset.lineupPickPoint){startTacticLineupPointPick(t.dataset.lineupPickPoint);return;}
    if(t.dataset.lineupClearPoint){clearTacticLineupPoint(t.dataset.lineupClearPoint);return;}
    if(t.dataset.editLineup){if(customTacticLineupById(t.dataset.editLineup)){tacticLineupEditingId=t.dataset.editLineup;render({preserveScroll:true});$('#tactic-lineup-name')?.focus();}return;}
    if(t.dataset.deleteLineup){const lineup=customTacticLineupById(t.dataset.deleteLineup);if(!lineup)return;if(confirm(`删除“${lineup.name}”这张投掷卡？`)){state.tactics.lineups=state.tactics.lineups.filter(item=>item.id!==lineup.id);if(tacticsLineupId===lineup.id)tacticsLineupId='';if(tacticLineupEditingId===lineup.id)tacticLineupEditingId=null;save();render({preserveScroll:true});toast('投掷卡已删除。');}return;}
    if(t.dataset.recoilFilter){
      recoilCategory=t.dataset.recoilFilter;const first=weapons.find(w=>(recoilCategory==='全部'||w.category===recoilCategory)&&(!recoilQuery.trim()||`${w.name} ${w.alias} ${w.category}`.toLowerCase().includes(recoilQuery.trim().toLowerCase())));if(first)recoilWeaponId=first.id;stopRecoilAnimation();recoilSession=null;render({preserveScroll:true});return;
    }
    if(t.dataset.recoilWeapon){recoilWeaponId=t.dataset.recoilWeapon;stopRecoilAnimation();recoilSession=null;render({preserveScroll:true});return;}
    if(t.id==='recoil-start'){if(!recoilSession?.active)startRecoilRecord();return;}
    if(t.id==='recoil-finish'){finishRecoil();return;}
    if(t.id==='recoil-clear'){stopRecoilAnimation();recoilSession=null;render({preserveScroll:true});return;}
    if(t.dataset.recoilDelete){
      const id=t.dataset.recoilDelete;
      if(!state.recoil.sessions.some(session=>session.id===id))return;
      if(confirm('删除这条压枪记录？此操作不可撤销。')){
        state.recoil.sessions=state.recoil.sessions.filter(session=>session.id!==id);
        if(recoilSession&&!recoilSession.active&&recoilSession.result?.id===id)recoilSession=null;
        save();render({preserveScroll:true});toast('压枪记录已删除');
      }
      return;
    }
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
    const tacticPlayer=e.target.closest?.('[data-tactic-player]');
    if(tacticPlayer){startTacticPlayerDrag(e,tacticPlayer);return;}
    const aimBoard=e.target.closest?.('#aim-board');
    if(aimBoard&&aimSession?.running){const hit=!!e.target.closest('.aim-target');aimSession.attempts++;if(hit){aimSession.hits++;aimSession.reactionTimes.push(performance.now()-aimSession.targetAt);setAimTarget();}updateAimLive();e.preventDefault();return;}
    const canvas=e.target.closest?.('#recoil-canvas')||e.target.closest?.('#recoil-scene-canvas');
    if(canvas&&recoilSession?.active&&!recoilSession.drawing){const point=canvasPoint(e,canvas),session=recoilSession;session.pointerId=e.pointerId;session.canvasId=canvas.id;session.drawing=true;session.start=point;session.points=[{x:0,y:0}];session.lastPoint={x:0,y:0};if(session.startedAt===null){session.startedAt=performance.now();session.running=true;session.currentShot=0;session.samples=[];recordRecoilShots(session.startedAt);}startRecoilAnimation();try{canvas.setPointerCapture(e.pointerId);}catch{}drawRecoil();e.preventDefault();}
  });
  document.addEventListener('pointermove',e=>{
    if(tacticDraggingPlayer){moveTacticPlayer(e);return;}
    if(!recoilSession?.active||!recoilSession.drawing||recoilSession.pointerId!==e.pointerId)return;const canvas=$(`#${recoilSession.canvasId||'recoil-canvas'}`);if(!canvas)return;const point=canvasPoint(e,canvas),next={x:point.x-recoilSession.start.x,y:point.y-recoilSession.start.y},last=recoilSession.points.at(-1)||recoilSession.lastPoint;recoilSession.lastPoint=next;if(Math.hypot(next.x-last.x,next.y-last.y)>1){recoilSession.points.push(next);drawRecoil();}e.preventDefault();
  });
  document.addEventListener('pointerup',e=>{if(tacticDraggingPlayer){stopTacticPlayerDrag(e);return;}if(recoilSession?.active&&recoilSession.drawing&&recoilSession.pointerId===e.pointerId){recoilSession.drawing=false;recoilSession.pointerId=null;finishRecoil();}});
  document.addEventListener('pointercancel',e=>{if(tacticDraggingPlayer){stopTacticPlayerDrag(e);return;}if(recoilSession?.active&&recoilSession.pointerId===e.pointerId){recoilSession.drawing=false;recoilSession.pointerId=null;finishRecoil();}});
  document.addEventListener('change',async e=>{
    const t=e.target;
    if(t.matches('[data-task]')){const i=Number(t.dataset.task),d=day();d.tasks=t.checked?[...new Set([...d.tasks,i])]:d.tasks.filter(n=>n!==i);save();const y=window.scrollY;render();window.scrollTo(0,y);}
    if(t.matches('[data-check]')){state.checks[t.dataset.check]=t.checked;save();}
    if(t.id==='timer-length'){stopTimer();total=Number(t.value);remaining=total;timerUI();}
    if(t.id==='log-filter'){logFilter=t.value;$('#log-list').innerHTML=logCards();}
    if(t.id==='recoil-shots'){recoilShots=Number(t.value);if(recoilSession?.active)stopRecoilAnimation();recoilSession=null;render({preserveScroll:true});}
    if(t.id==='tactic-side'){tacticsTimeline.side=t.value==='CT'?'CT':'T';updateTacticTimelineUI();}
    if(t.id==='tactic-place-utility'&&tacticUtilityById(t.value)){tacticPlaceUtility=t.value;render({preserveScroll:true});}
    if(t.id==='tactic-place-side'){tacticPlaceSide=t.value==='CT'?'CT':'T';render({preserveScroll:true});}
    if(t.id==='tactic-lineup-filter'){tacticLineupFilter=tacticUtilityIDs.has(t.value)?t.value:'all';updateTacticLineupResults();}
    if(t.id==='import-data'){
      const file=t.files?.[0];if(!file)return;
      try{
        if(file.size>10*1024*1024)throw Error('备份文件不能超过 10 MB');
        const payload=JSON.parse(await file.text()),imported=validate(payload),hasSensitivity=Object.prototype.hasOwnProperty.call(payload,'sensitivity');
        const importedTests=Object.values(imported.sensitivity.profiles).reduce((sum,p)=>sum+p.tests.length,0),importedRecoil=imported.recoil.sessions.length,importedLineups=imported.tactics.lineups.length;
        if(!confirm(`导入 ${imported.logs.length} 篇复盘、${importedTests} 次灵敏度测试、${importedRecoil} 条压枪记录、${importedLineups} 张投掷卡与 ${Object.keys(imported.days).length} 天训练记录？同编号的数据将以备份为准。`)){t.value='';return;}
        const logs=new Map(state.logs.map(l=>[l.id,l]));imported.logs.forEach(l=>logs.set(l.id,l));
        const mergeById=(current,incoming,limit)=>{const map=new Map(current.map(item=>[item.id,item]));incoming.forEach(item=>map.set(item.id,item));return [...map.values()].slice(0,limit);};
        const importedSensitivity=hasSensitivity?imported.sensitivity:state.sensitivity,importedRecoilData=Object.prototype.hasOwnProperty.call(payload,'recoil')?imported.recoil:state.recoil;
        state={version:1,days:{...state.days,...imported.days},read:[...new Set([...state.read,...imported.read])],bookmarks:[...new Set([...state.bookmarks,...imported.bookmarks])],checks:{...state.checks,...imported.checks},weeks:[...new Set([...state.weeks,...imported.weeks])],logs:[...logs.values()],lastChapter:imported.lastChapter,sensitivity:{active:importedSensitivity.active,profiles:{rifle:{...state.sensitivity.profiles.rifle,...importedSensitivity.profiles.rifle,tests:mergeById(state.sensitivity.profiles.rifle.tests,importedSensitivity.profiles.rifle.tests,500)},sniper:{...state.sensitivity.profiles.sniper,...importedSensitivity.profiles.sniper,tests:mergeById(state.sensitivity.profiles.sniper.tests,importedSensitivity.profiles.sniper.tests,500)}}},recoil:{sessions:mergeById(state.recoil.sessions,importedRecoilData.sessions,2000)},tactics:{lineups:mergeById(state.tactics.lineups,imported.tactics.lineups,500)}};
        storageOK=true;warning='';const persisted=save();$('#backup-dialog').close();render();toast(persisted?'备份已合并并保存。':'已导入到当前页面，但浏览器保存失败，请导出备份。');
      }catch(error){toast(`导入失败：${error.message}。现有记录未改变。`);}t.value='';
    }
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='chapter-search'){query=e.target.value;$('#chapter-grid').innerHTML=cards();$('#result-count').textContent=`共 ${matches().length} 章`;}
    if(e.target.id==='daily-focus'){day().focus=e.target.value;save();}
    if(e.target.matches('[data-sens-field]')){if(e.target.value==='')return;const key=e.target.dataset.sensField,p=profileFor(state.sensitivity.active),limits={dpi:[100,10000,p.dpi],sens:[.01,20,p.sens],zoom:[.1,2,p.zoom]},rule=limits[key];if(!rule)return;p[key]=numberIn(e.target.value,rule[0],rule[1],rule[2]);save();updateSensitivityMetrics();}
    if(e.target.id==='recoil-search'){recoilQuery=e.target.value;const list=$('#weapon-list');if(list)list.innerHTML=recoilList();const count=$('.weapon-count');if(count)count.textContent=`显示 ${weapons.filter(w=>(recoilCategory==='全部'||w.category===recoilCategory)&&(!recoilQuery.trim()||`${w.name} ${w.alias} ${w.category}`.toLowerCase().includes(recoilQuery.trim().toLowerCase()))).length} 把`;}
    if(e.target.id==='tactic-lineup-search'){tacticLineupQuery=e.target.value;updateTacticLineupResults();}
    if(e.target.id==='tactic-timeline-slider'){tacticsTimeline.time=Math.max(0,Math.min(tacticTimelineMax,Number(e.target.value)||0));stopTacticsTimeline();updateTacticTimelineUI();}
  });
  document.addEventListener('submit',e=>{
    if(e.target.id==='tactic-lineup-form'){
      e.preventDefault();
      const f=new FormData(e.target),map=selectedTacticMap(),name=String(f.get('name')||'').trim(),source=String(f.get('source')||'').trim(),poster=String(f.get('poster')||'').trim(),video=String(f.get('video')||'').trim(),status=$('#tactic-lineup-form-status');
      if(!name){if(status)status.textContent='请先填写卡片名称。';return;}
      if((source&&!validHttpUrl(source))||(poster&&!validHttpUrl(poster))||(video&&!validHttpUrl(video))){if(status)status.textContent='来源、截图和视频地址必须是 http / https 链接。';return;}
      const steps=String(f.get('steps')||'').split(/\r?\n/).map(step=>step.trim()).filter(Boolean).slice(0,8);
      if(!steps.length){if(status)status.textContent='至少填写一步投掷步骤，方便之后复核。';return;}
      const utility=tacticUtilityIDs.has(String(f.get('utility')||''))?String(f.get('utility')):'smoke',side=String(f.get('side')||'')==='CT'?'CT':'T',readCoord=key=>{const raw=String(f.get(key)||'').trim(),value=Number(raw);return raw!==''&&Number.isFinite(value)&&value>=0&&value<=100?Number(value.toFixed(1)):null;},existing=tacticLineupEditingId&&tacticLineupEditingId!=='new'?customTacticLineupById(tacticLineupEditingId):null,id=existing?.id||`custom-${map.id}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const record={id,mapId:map.id,utility,side,name,from:{label:String(f.get('fromLabel')||'').trim()||'投掷点',x:readCoord('fromX'),y:readCoord('fromY')},target:{label:String(f.get('targetLabel')||'').trim()||'落点',x:readCoord('targetX'),y:readCoord('targetY')},technique:String(f.get('technique')||'').trim(),movement:String(f.get('movement')||'').trim(),airTime:String(f.get('airTime')||'').trim(),steps,result:String(f.get('result')||'').trim(),source,updated:today(),media:{poster,video},custom:true};
      if(!Number.isFinite(record.from.x)||!Number.isFinite(record.from.y)||!Number.isFinite(record.target.x)||!Number.isFinite(record.target.y)){if(status)status.textContent='请先分别在地图上选择投掷点和落点。';return;}
      if(existing){const index=state.tactics.lineups.findIndex(item=>item.id===existing.id);if(index>=0)state.tactics.lineups[index]=record;}
      else state.tactics.lineups.unshift(record);
      const persisted=save();tacticLineupEditingId=null;tacticsLineupPickMode=null;render({preserveScroll:true});toast(persisted?(existing?'投掷卡已更新。':'投掷卡已保存。'):'投掷卡已暂存，请导出备份。');return;
    }
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

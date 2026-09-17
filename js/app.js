/* 数学建模优秀论文分析库 - 应用逻辑 (无外部依赖) */
(function(){
"use strict";

// ---------- 工具 ----------
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const ALL_MODS = ["摘要","问题分析","模型假设","符号说明","模型建立","模型求解","灵敏度/稳健性","模型检验","模型评价","参考文献","附录","流程图"];

// 深度分析索引: 按 年|题|文件 精确匹配; 年|题 仅用于给未精读论文提示"同年同题有深度分析"
const deepMap = {}, deepFallback = {};
Object.keys(window.ANALYSES).forEach(k=>{
  const parts = k.split("|");
  deepMap[k] = window.ANALYSES[k];
  deepFallback[parts[0]+"|"+parts[1]] = window.ANALYSES[k];
});
function deepFor(p){
  return deepMap[p.year+"|"+p.prob+"|"+p.file] || null;
}
function deepNear(p){
  return deepFallback[p.year+"|"+p.prob] || null;
}

// ---------- 统计 ----------
const byYear = {}, byProb = {}, byAward = {}, methodByYear = {};
const methodCatCount = {};
window.PROFILES.forEach(p=>{
  byYear[p.year]=(byYear[p.year]||0)+1;
  byProb[p.prob]=(byProb[p.prob]||0)+1;
  byAward[p.award]=(byAward[p.award]||0)+1;
  methodByYear[p.year]=methodByYear[p.year]||{};
  Object.keys(p.methods||{}).forEach(c=>{
    methodByYear[p.year][c]=(methodByYear[p.year][c]||0)+1;
    methodCatCount[c]=(methodCatCount[c]||0)+1;
  });
});
const hasDeep = window.PROFILES.filter(p=>deepFor(p)).length;
$("#libCount").textContent = "("+window.PROFILES.length+")";

function completeness(p){
  const m = new Set(p.mods||[]);
  let n = 0; ALL_MODS.forEach(x=>{ if(m.has(x)) n++; });
  return Math.round(n/ALL_MODS.length*100);
}

// ---------- 导航 ----------
$("#nav").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  $$("#nav button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  $$("section.page").forEach(s=>s.classList.remove("active"));
  $("#page-"+b.dataset.page).classList.add("active");
});

// ---------- 图表(纯HTML条形图) ----------
function barChart(data, opts){
  opts = opts||{};
  const max = Math.max(1, ...data.map(d=>d.v));
  const h = opts.height||150;
  const bars = data.map(d=>{
    const hh = Math.max(3, Math.round(d.v/max*(h-30)));
    return `<div class="bar-wrap"><div class="bar" style="height:${hh}px"><span class="v">${d.v}</span></div><div class="x">${esc(d.k)}</div></div>`;
  }).join("");
  return `<div class="bars" style="height:${h}px">${bars}</div>`;
}

// ---------- 总览 ----------
(function renderOverview(){
  const el = $("#page-overview");
  const deepCnt = Object.keys(window.ANALYSES).length;
  const avgPages = Math.round(window.PROFILES.reduce((s,p)=>s+(p.pages||0),0)/window.PROFILES.length);
  const withSens = window.PROFILES.filter(p=>(p.mods||[]).includes("灵敏度/稳健性")).length;
  const withCheck = window.PROFILES.filter(p=>(p.mods||[]).includes("模型检验")).length;
  el.innerHTML = `
  <div class="cards">
    <div class="card"><div class="num">${window.PROFILES.length}</div><div class="lbl">优秀论文总数 (2021-2025)</div></div>
    <div class="card"><div class="num">${deepCnt}</div><div class="lbl">人工精读深度分析</div></div>
    <div class="card"><div class="num">${avgPages}</div><div class="lbl">平均页数</div></div>
    <div class="card"><div class="num">${withSens}</div><div class="lbl">含灵敏度/稳健性分析</div></div>
    <div class="card"><div class="num">${withCheck}</div><div class="lbl">含模型检验/误差分析</div></div>
  </div>
  <div class="panel"><h3>论文数量 · 按年份</h3>${barChart(Object.keys(byYear).sort().map(k=>({k,v:byYear[k]})))}</div>
  <div class="panel"><h3>论文数量 · 按赛题 A-F</h3>${barChart(Object.keys(byProb).sort().map(k=>({k:k+"题",v:byProb[k]})))}
    <p style="color:var(--sub);font-size:12.5px;margin-top:8px">注: 2021 年另有 12 篇「数模之星提名奖」论文归入「星」类。A/B 类奖级论文占比越高, 该题优秀解越多。</p></div>
  <div class="panel"><h3>方法类别使用频次 · 按年份 (论文篇数)</h3>
    <table><thead><tr><th>方法类别</th>${Object.keys(methodByYear).sort().map(y=>"<th>"+y+"</th>").join("")}<th>合计</th></tr></thead>
    <tbody>${Object.keys(methodCatCount).sort((a,b)=>methodCatCount[b]-methodCatCount[a]).map(c=>
      `<tr><td>${esc(c)}</td>${Object.keys(methodByYear).sort().map(y=>"<td>"+(methodByYear[y][c]||0)+"</td>").join("")}<td class="hl">${methodCatCount[c]}</td></tr>`).join("")}
    </tbody></table>
    <p style="color:var(--sub);font-size:12.5px;margin-top:8px">趋势解读: 「机器学习/深度学习」五年始终最热但已从"堆网络"转向特征工程+可解释性; 「启发式/智能算法」与「规划优化」在调度/排布类赛题中稳定高频; 「模拟仿真」(蒙特卡洛验证) 是公认加分项。</p>
  </div>
  <div class="panel"><h3>近五年赛题主题速览</h3>
    <table><thead><tr><th>年份</th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th><th>F</th></tr></thead>
    <tbody>${Object.keys(window.SYNTH.yearThemes).sort().map(y=>
      `<tr><td class="hl">${y}</td>${["A","B","C","D","E","F"].map(pr=>`<td style="font-size:12px">${esc(window.SYNTH.yearThemes[y][pr]||"-")}</td>`).join("")}</tr>`).join("")}
    </tbody></table>
    <p style="color:var(--sub);font-size:12.5px;margin-top:8px">选题观察: A/B 题多为通信/计算硬核题, C/D/E/F 覆盖调度、数据、医学、人文。2025 年 A-F 全部来自真实产业/工程场景 (华为 NPU、5G 链路、煤矿、低空经济、高铁、园林数字化), "机理+数据+优化"融合是共同特征。</p>
  </div>`;
})();

// ---------- 论文库 ----------
const fState = {year:"",prob:"",award:"",cat:"",q:""};
(function initFilters(){
  const F = $("#libFilters");
  const mk = (label, id, opts)=>{
    const o = opts.map(([v,t])=>`<option value="${v}">${t}</option>`).join("");
    return `<label>${label}</label> <select id="f${id}"><option value="">${label}不限</option>${o}</select>`;
  };
  F.innerHTML = mk("年份","Year",["2021","2022","2023","2024","2025"].map(y=>[y,y]))
    + mk("赛题","Prob",[["A","A题"],["B","B题"],["C","C题"],["D","D题"],["E","E题"],["F","F题"],["星","星(提名奖)"]])
    + mk("奖级","Award",[["A","一等奖"],["B","二等奖"],["C","三等奖"],["D","参与奖"],["E","E"],["F","F"]])
    + mk("方法","Cat",Object.keys(methodCatCount).sort((a,b)=>methodCatCount[b]-methodCatCount[a]).map(c=>[c,c]))
    + ` <label>搜索</label> <input type="text" id="fQ" placeholder="标题/摘要关键词…" size="22">`;
  F.addEventListener("change", renderLib);
  F.addEventListener("input", renderLib);
})();
function filtered(){
  return window.PROFILES.filter(p=>{
    if(fState.year && p.year!==fState.year) return false;
    if(fState.prob && p.prob!==fState.prob) return false;
    if(fState.award && p.award!==fState.award) return false;
    if(fState.cat && !(p.methods&&p.methods[fState.cat])) return false;
    if(fState.q){
      const q = fState.q.toLowerCase();
      const hay = ((p.title||"")+" "+(p.abs||"")+" "+(p.kw||"")+" "+(p.file||"")).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}
function readFilters(){
  fState.year=$("#fYear").value; fState.prob=$("#fProb").value;
  fState.award=$("#fAward").value; fState.cat=$("#fCat").value; fState.q=$("#fQ").value.trim();
}
function renderLib(){
  readFilters();
  const rows = filtered();
  $("#libTable tbody").innerHTML = rows.map(p=>{
    const c = completeness(p);
    const d = deepFor(p);
    const mTags = Object.keys(p.methods||{}).slice(0,3).map(m=>`<span class="tag m">${esc(m)}</span>`).join("");
    const title = p.title ? esc(p.title) : `<span style="color:var(--sub)">(${esc(p.file)})</span>`;
    return `<tr class="clickable" data-id="${p.id}">
      <td>${p.year}</td><td>${p.prob}</td>
      <td class="${p.award==="A"?"awardA":""}">${p.award==="星"?"提名":p.award}</td>
      <td>${title} ${d?'<span class="tag deep">★深度</span>':""}<br><span style="color:var(--sub);font-size:11.5px">${esc(p.file)}</span></td>
      <td>${mTags}</td>
      <td><span class="score-bar" style="width:80px;display:inline-block;vertical-align:middle"><i style="width:${c}%"></i></span> <span style="font-size:11.5px;color:var(--sub)">${c}%</span></td>
      <td>${p.pages||"-"}</td></tr>`;
  }).join("") || `<tr><td colspan="7" style="color:var(--sub)">没有匹配的论文</td></tr>`;
}
$("#libTable").addEventListener("click", e=>{
  const tr = e.target.closest("tr.clickable"); if(!tr) return;
  const p = window.PROFILES.find(x=>x.id==tr.dataset.id);
  showPaperDetail(p, $("#libDetail"));
  $("#libDetail").scrollIntoView({behavior:"smooth"});
});
renderLib();

function showPaperDetail(p, container){
  const d = deepFor(p);
  const modChips = ALL_MODS.map(m=>{
    const has = (p.mods||[]).includes(m);
    return `<span class="tag ${has?"m":""}" style="${has?"":"opacity:.35;text-decoration:line-through"}">${m}</span>`;
  }).join("");
  const mTags = Object.entries(p.methods||{}).map(([c,kws])=>
    `<div style="margin-bottom:4px"><span class="tag m">${esc(c)}</span> ${kws.map(k=>`<span class="tag">${esc(k)}</span>`).join("")}</div>`).join("");
  container.innerHTML = `<div class="panel">
    <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:10px">
      <span class="tag y">${p.year} 年 ${p.prob} 题</span>
      <span class="tag">奖级: ${p.award==="星"?"数模之星提名":p.award}</span>
      <span class="tag">${p.pages||"-"} 页</span>
      ${d?'<span class="tag deep">★ 已人工精读</span>':""}
      <span style="color:var(--sub);font-size:12px;margin-left:auto">${esc(p.file)}</span>
    </div>
    <h3 style="margin-top:0">${esc(p.title||"(标题未能自动识别)")}</h3>
    ${p.kw?`<p style="font-size:12.5px;color:var(--sub);margin-bottom:10px">关键词: ${esc(p.kw)}</p>`:""}
    ${p.abs?`<div class="absbox" style="margin-bottom:12px"><b>摘要(自动提取):</b><br>${esc(p.abs)}</div>`:""}
    <h3>结构模块检测 <span style="font-size:12px;color:var(--sub)">(完整度 ${completeness(p)}%)</span></h3>
    <div style="margin-bottom:12px">${modChips}</div>
    <h3>方法体系(自动识别)</h3>
    <div style="margin-bottom:12px">${mTags||'<span style="color:var(--sub)">未识别到方法关键词</span>'}</div>
    ${d?`<h3>人工深度分析</h3>
    <div class="detail-grid">
      <div class="block"><h4>📐 论文架构</h4><p>${esc(d.structure)}</p></div>
      <div class="block"><h4>🎯 解决问题思路</h4><p>${esc(d.approach)}</p></div>
      <div class="block"><h4>⭐ 好在哪里</h4><p>${esc(d.strengths)}</p></div>
      <div class="block"><h4>💡 可借鉴之处</h4><p>${esc(d.takeaways)}</p></div>
    </div>`:`<p style="color:var(--sub);font-size:12.5px">该篇暂无人工精读(每年每题精读 1–2 篇代表), 以上为其自动画像。${deepNear(p)?'可切换至「深度分析」页查看 <b class="hl">'+p.year+" 年 "+p.prob+' 题</b>代表论文的精读。':""}</p>`}
  </div>`;
}

// ---------- 深度分析 ----------
(function renderDeep(){
  const el = $("#deepList");
  ["2021","2022","2023","2024","2025"].forEach(y=>{
    const cards = window.PROFILES.filter(p=>p.year===y && deepFor(p)).map(p=>{
      const d = deepFor(p);
      return `<div class="deep-card" data-id="${p.id}">
        <h4>${p.prob} 题 · ${esc(window.SYNTH.yearThemes[y] && window.SYNTH.yearThemes[y][p.prob] || p.title||p.file)}</h4>
        <div class="sub">${esc(p.title||p.file)} · ${p.pages}页 · 奖级${p.award==="星"?"提名":p.award}</div>
        <div style="margin-top:8px;font-size:12px;color:var(--accent2)">架构 / 思路 / 亮点 / 借鉴 → 点击查看</div>
      </div>`;
    }).join("");
    el.insertAdjacentHTML("beforeend", `<h2>${y} 年（${esc(window.SYNTH.yearThemes[y].A? "A题:"+window.SYNTH.yearThemes[y].A.slice(0,18)+"…" :"")}）</h2><div class="grid-deep">${cards}</div>`);
  });
  el.addEventListener("click", e=>{
    const c = e.target.closest(".deep-card"); if(!c) return;
    const p = window.PROFILES.find(x=>x.id==c.dataset.id);
    const d = deepFor(p);
    $("#modalBody").innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <span class="tag y">${p.year} 年 ${p.prob} 题</span><span class="tag">奖级 ${p.award}</span><span class="tag">${p.pages} 页</span>
      </div>
      <h2 style="margin-bottom:4px">${esc(p.title||p.file)}</h2>
      <p style="color:var(--sub);font-size:12.5px;margin-bottom:14px">${esc(window.SYNTH.yearThemes[p.year][p.prob]||"")}</p>
      <div class="block"><h4>📐 论文架构</h4><p>${esc(d.structure)}</p></div>
      <div class="block"><h4>🎯 解决问题思路</h4><p>${esc(d.approach)}</p></div>
      <div class="block"><h4>⭐ 好在哪里</h4><p>${esc(d.strengths)}</p></div>
      <div class="block"><h4>💡 可借鉴之处</h4><p>${esc(d.takeaways)}</p></div>
      ${p.abs?`<div class="absbox"><b>摘要原文(节选):</b><br>${esc(p.abs)}</div>`:""}`;
    $("#modalMask").classList.add("show");
  });
})();
window.closeModal = ()=> $("#modalMask").classList.remove("show");
$("#modalMask").addEventListener("click", e=>{ if(e.target.id==="modalMask") closeModal(); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });

// ---------- 方法论图谱 ----------
(function renderMethods(){
  const el = $("#page-methods");
  el.innerHTML = `<div class="panel"><h3>八大方法类别 · 五年使用热度</h3>
    ${barChart(Object.keys(methodCatCount).sort((a,b)=>methodCatCount[b]-methodCatCount[a]).map(k=>({k:k.length>6?k.slice(0,6)+"..":k, v:methodCatCount[k]})), {height:180})}
    <p style="color:var(--sub);font-size:12.5px">数值 = 使用了该类方法的论文篇数 (一篇可属多类)</p></div>
  <h3 style="margin:14px 0 10px">各类方法的高分用法要点</h3>
  <div class="grid-deep">${Object.entries(window.SYNTH.methodNotes).map(([k,v])=>
    `<div class="deep-card" style="cursor:default"><h4>${esc(k)}</h4><p style="font-size:12.8px;color:#d5ddef">${esc(v)}</p></div>`).join("")}</div>
  <div class="panel" style="margin-top:18px"><h3>五年方法论趋势总结</h3>
  <ul class="tight" style="font-size:13px;color:#d5ddef">
    <li><b class="hl">2021 数据科学 pipeline 成熟期</b>: 特征筛选(多方法交叉验证)→预测→反向优化的三段式成为标配 (2021D 乳腺癌题)。</li>
    <li><b class="hl">2022 工程拆解+数据洞察</b>: 芯片排布/排产/调度题强调预处理与依赖分析; 疫情物资题示范了"先让数据讲故事再建模"。</li>
    <li><b class="hl">2023 理论深度回归</b>: Bianchi-Markov 解析推导+蒙特卡洛互验; DFT 混合整数规划"一框架五算法"; 因果推理差异化路线。</li>
    <li><b class="hl">2024 改进链叙事+鲁棒性</b>: 基线→诊断→改进→量化收益成为最佳叙事; 最后一问引入噪声/延迟做鲁棒化成为完成度标志。</li>
    <li><b class="hl">2025 算法竞技场+消融实验</b>: 多启发式对比选优、E1-E7 消融实验、算法"适用性分析"小节成为新规范。</li>
  </ul></div>`;
})();

// ---------- 写作指南与量规 ----------
(function renderGuide(){
  const el = $("#page-guide");
  el.innerHTML = `<div class="panel"><h3>评分量规 (基于 189 篇优秀论文反向归纳)</h3>
    <table><thead><tr><th>评分维度</th><th>权重</th><th>优秀标准</th><th>常见失分</th></tr></thead>
    <tbody>${window.SYNTH.rubric.map(r=>`<tr>
      <td class="hl" style="white-space:nowrap">${r.dim}</td><td class="rubric-w">${r.weight}%</td>
      <td style="font-size:12.8px">${esc(r.good)}</td><td style="font-size:12.8px;color:var(--sub)">${esc(r.bad)}</td></tr>`).join("")}
    </tbody></table></div>
  <h3 style="margin:14px 0 10px">十条写作要点 (从 59 篇精读中提炼)</h3>
  <div class="grid-deep">${window.SYNTH.playbook.map((p,i)=>
    `<div class="deep-card play-card" style="cursor:default"><h4>${i+1}. ${esc(p.title)}</h4><p style="font-size:12.8px;color:#d5ddef">${esc(p.body)}</p></div>`).join("")}</div>`;
})();

// ---------- 自评工具 ----------
(function renderSelfcheck(){
  const el = $("#page-selfcheck");
  el.innerHTML = `<div class="panel">
    <h3>论文自评清单</h3>
    <p style="color:var(--sub);font-size:12.5px;margin-bottom:14px">写完论文后逐条勾选你做到的项, 系统会按优秀论文基准给你打分并生成针对性建议。也可以现在就勾一遍, 看看自己离获奖水平差在哪。</p>
    <div class="detail-grid">
      ${window.SYNTH.checklist.map((c,ci)=>`<div>
        <h4 style="color:var(--gold);margin-bottom:10px">${esc(c.cat)}</h4>
        ${c.items.map((it,ii)=>`<label class="check-row"><input type="checkbox" data-cat="${ci}"><span>${esc(it)}</span></label>`).join("")}
      </div>`).join("")}
    </div>
    <div style="margin-top:18px">
      <button id="btnScore" style="background:var(--accent);border:none;color:#0b1020;font-weight:700;padding:10px 26px;border-radius:8px;cursor:pointer;font-size:14px">生成自评报告</button>
    </div>
    <div id="scoreOut" style="margin-top:18px"></div>
  </div>
  <div class="panel"><h3>下一步</h3>
    <p style="font-size:13px;color:#d5ddef">写完自己的论文后, 直接把 PDF/Word 文件发给 Kimi 并说"分析我的建模论文", 我会按本站的量规和 189 篇优秀论文基准, 给出逐维度评分、与优秀论文的差距对照和具体修改建议。</p>
  </div>`;
  el.addEventListener("click", e=>{
    if(e.target.id!=="btnScore") return;
    const boxes = $$('#page-selfcheck input[type=checkbox]');
    const perCat = window.SYNTH.checklist.map(()=>({hit:0,total:0,miss:[]}));
    boxes.forEach((b,i)=>{
      const cat = +b.dataset.cat;
      const itemText = b.nextElementSibling.textContent;
      perCat[cat].total++;
      if(b.checked) perCat[cat].hit++; else perCat[cat].miss.push(itemText);
    });
    const weights = [40,40,20]; // 结构40 建模40 亮点20
    const total = perCat.reduce((s,c,i)=> s + Math.round(c.hit/c.total*weights[i]), 0);
    const verdict = total>=85 ? "🏆 达到一等奖论文的结构特征水平" :
                    total>=70 ? "🥇 达到优秀论文(二等奖以上)水平" :
                    total>=50 ? "🥈 有基础但存在明显短板, 对照下方建议补齐" :
                                "⚠️ 与优秀论文差距较大, 建议先按写作指南重构";
    $("#scoreOut").innerHTML = `<div class="block">
      <h4>自评结果: ${verdict}</h4>
      <div style="font-size:30px;font-weight:800;color:var(--accent2)">${total}<span style="font-size:14px;color:var(--sub)"> / 100</span></div>
      ${perCat.map((c,i)=>`<div style="margin-top:10px"><span class="tag m">${esc(window.SYNTH.checklist[i].cat)}</span>
        <div class="score-bar" style="max-width:340px"><i style="width:${Math.round(c.hit/c.total*100)}%"></i></div>
        ${c.miss.length?`<ul class="tight" style="font-size:12.5px;color:var(--sub)">${c.miss.map(m=>`<li>缺: ${esc(m)}</li>`).join("")}</ul>`:'<span style="color:var(--accent2);font-size:12.5px">✓ 全部做到</span>'}
      </div>`).join("")}
      <h4 style="margin-top:16px">针对性建议</h4>
      <ul class="tight" style="font-size:13px">
        ${perCat.flatMap(c=>c.miss).slice(0,8).map(m=>`<li>优先补齐「${esc(m)}」——这是优秀论文的普遍特征。</li>`).join("") || "<li>结构完整度很高, 接下来把精力投向深度: 增加交叉验证、改进链叙事和模型局限分析 (见'写作指南'第5/6/10条)。</li>"}
      </ul>
    </div>`;
  });
})();

})();

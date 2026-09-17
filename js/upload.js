/* 上传分析 - 浏览器本地解析 PDF/DOCX, 对照 189 篇优秀论文基准给出归纳分析与改进建议 */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = s => (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

// ---------- 方法标签库: 从 189 篇优秀画像动态构建 (含别名归一) ----------
const ALIAS = {
  "SVM":"支持向量机","PCA":"主成分分析","AHP":"层次分析法","TOPSIS":"TOPSIS",
  "K-means":"K-means聚类","Kmeans":"K-means聚类","DBSCAN":"DBSCAN聚类",
  "NSGA":"NSGA多目标优化","NSGA-II":"NSGA多目标优化","GRU":"GRU网络","LSTM":"LSTM网络",
  "CNN":"CNN卷积网络","BERT":"BERT模型","XGBoost":"XGBoost","LightGBM":"LightGBM",
  "ARIMA":"ARIMA时序模型","SMOTE":"SMOTE采样","DTW":"DTW动态时间规整"
};
const tagCat = {};   // 规范标签 -> 类别
const tagName = {};  // 规范标签 -> 展示名
window.PROFILES.forEach(p=>{
  Object.entries(p.methods||{}).forEach(([cat,kws])=>{
    (kws||[]).forEach(k=>{
      const canon = ALIAS[k] || k;
      tagCat[canon] = tagCat[canon] || cat;
      tagName[canon] = tagName[canon] || canon;
    });
  });
});
const ALL_TAGS = Object.keys(tagCat);
const CATS = [...new Set(Object.values(tagCat))];

// ---------- 结构模块识别 ----------
const MOD_PATTERNS = [
  ["摘要", /摘\s*要/],
  ["问题分析", /问题\s*(重述|分析|背景)/],
  ["模型假设", /模型假设|基本假设|合理假设/],
  ["符号说明", /符号说明|符号定义|记号说明/],
  ["模型建立", /模型\s*(建立|构建|设计)/],
  ["模型求解", /模型求解|算法\s*(设计|步骤)|求解算法/],
  ["灵敏度/稳健性", /灵敏度|敏感性分析|稳健性|鲁棒性/],
  ["模型检验", /模型检验|误差分析|结果验证|模型验证/],
  ["模型评价", /模型评价|优缺点|结论与展望|评价与推广/],
  ["参考文献", /参考文献|References/i],
  ["附录", /附\s*录|Appendix/i]
];
const MOD_ADVICE = {
  "摘要":"补一段结构化摘要: 一句话问题 → 核心方法 → 关键量化结果(带具体指标数值), 让评委 30 秒抓住全文。",
  "问题分析":"增加「问题分析/重述」章节, 用流程图或文字把每个子问题的输入、输出、约束讲清楚——优秀论文普遍先分析再建模。",
  "模型假设":"补充「模型假设」并逐条说明理由/合理性, 评委很看重假设与现实的贴合度。",
  "符号说明":"加一页符号表统一记号, 大小写、下标全文一致, 避免同一量多种写法。",
  "模型建立":"模型建立要写清决策变量、目标函数、约束条件三步, 公式编号且首次出现给出定义。",
  "模型求解":"补充求解算法与步骤(伪代码/流程图), 说明参数设置, 不要只给结果。",
  "灵敏度/稳健性":"补灵敏度分析: 对关键参数 ±10%~±20% 扰动观察结果变化——这是优秀论文与平庸论文的分水岭。",
  "模型检验":"增加模型检验/误差分析: 与基线方法对比、残差分析或用独立数据回测。",
  "模型评价":"加「模型评价」客观写出 2-3 条局限与改进方向, 体现批判性思维。",
  "参考文献":"补充规范参考文献(近 5 年文献为主, 有英文文献更佳), 正文引用处标注编号。",
  "附录":"把代码、中间推导、长数据表放附录, 正文保持叙事流畅。"
};

// ---------- 优秀论文基准 ----------
const AVG_CHARS = Math.round(window.PROFILES.reduce((s,p)=>s+(p.chars||0),0)/window.PROFILES.length);
const AVG_PAGES = Math.round(window.PROFILES.reduce((s,p)=>s+(p.pages||0),0)/window.PROFILES.length);

// ---------- 文本提取 ----------
async function extractText(file){
  if(/\.pdf$/i.test(file.name)){
    if(typeof pdfjsLib==="undefined") throw new Error("pdf.js 加载失败(检查网络/CDN)");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data:buf}).promise;
    let text = "", pages = pdf.numPages;
    for(let i=1;i<=pages;i++){
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      text += tc.items.map(it=>it.str).join(" ") + "\n";
      page.cleanup();
    }
    return {text, pages};
  }
  if(/\.docx?$/i.test(file.name)){
    if(typeof mammoth==="undefined") throw new Error("mammoth 加载失败(检查网络/CDN)");
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({arrayBuffer:buf});
    return {text:res.value||"", pages:0};
  }
  throw new Error("仅支持 PDF / DOCX 文件");
}

// ---------- 分析 ----------
function analyze(text, pages){
  const chars = text.replace(/\s/g,"").length;
  const foundMods = MOD_PATTERNS.filter(([,re])=>re.test(text)).map(([m])=>m);
  const modSet = new Set(foundMods);

  // 方法标签: 大小写不敏感计数
  const lower = text.toLowerCase();
  const foundTags = {};
  ALL_TAGS.forEach(t=>{
    const tl = t.toLowerCase();
    if(tl.length<2) return;
    if(lower.includes(tl)) foundTags[t]=(foundTags[t]||0)+1;
  });
  const tagSet = Object.keys(foundTags);
  const catSet = new Set(tagSet.map(t=>tagCat[t]));

  // 与库中优秀论文的方法相似度 (Jaccard)
  const sims = window.PROFILES.map(p=>{
    const pTags = new Set();
    Object.values(p.methods||{}).forEach(kws=>(kws||[]).forEach(k=>pTags.add(ALIAS[k]||k)));
    const union = new Set([...tagSet, ...pTags]);
    if(!union.size) return {p,j:0};
    const inter = tagSet.filter(t=>pTags.has(t)).length;
    return {p, j:inter/union.size, inter};
  }).filter(s=>s.j>0).sort((a,b)=>b.j-a.j).slice(0,3);

  // 评分 (100)
  const sStruct = Math.round(modSet.size/11*30);
  const sMethod = Math.round(catSet.size/8*15) + Math.round(Math.min(tagSet.length,10)/10*10);
  const sLen    = Math.round(Math.min(chars/Math.max(AVG_CHARS,1),1)*15);
  const sVerify = (modSet.has("灵敏度/稳健性")?8:0) + (modSet.has("模型检验")?7:0);
  const sNorm   = (modSet.has("摘要")?5:0) + (modSet.has("参考文献")?5:0);
  const sNarr   = modSet.has("问题分析")?5:0;
  const total = sStruct+sMethod+sLen+sVerify+sNorm+sNarr;
  const verdict = total>=80 ? "🏆 结构与优秀论文高度吻合, 具备冲奖底子" :
                  total>=65 ? "🥇 接近优秀论文水平, 补齐下方短板即可" :
                  total>=45 ? "🥈 框架已有但明显缺项, 按建议逐条补齐" :
                              "⚠️ 与优秀论文差距较大, 建议先对照写作指南重构";
  const missing = MOD_PATTERNS.map(([m])=>m).filter(m=>!modSet.has(m));
  return {chars, pages, foundMods, foundTags, tagSet, catSet, sims, scores:{sStruct,sMethod,sLen,sVerify,sNorm,sNarr,total}, verdict, missing};
}

// ---------- 页面 ----------
(function render(){
  const el = $("#page-upload");
  if(!el) return;
  el.innerHTML = `
  <div class="panel">
    <h3>📤 上传建模论文 · 自动归纳分析</h3>
    <p style="color:var(--sub);font-size:12.5px;margin-bottom:14px">
      上传你的(或任何往年的)建模论文 PDF / DOCX, 系统在<b class="hl">浏览器本地</b>解析全文(文件不会上传到任何服务器),
      自动识别 <b class="hl">结构模块、方法体系</b>, 与库中 189 篇优秀论文基准对比打分, 并给出逐条改进建议与最相似的优秀论文参照。
      纯图片扫描版 PDF 无法提取文字, 分析结果会偏弱。
    </p>
    <div class="dropzone" id="dz">
      <div class="big">点击选择 或 拖拽 PDF / DOCX 文件到此处</div>
      <div>支持多选, 每篇论文生成一张分析报告卡</div>
      <input type="file" id="fileInput" accept=".pdf,.docx" multiple style="display:none">
    </div>
    <div id="upProgress" style="font-size:12.5px;color:var(--sub);margin-bottom:10px"></div>
    <div id="upResults"></div>
  </div>
  <div class="panel">
    <h3>优秀论文基准值 (自动统计自本库 189 篇)</h3>
    <div class="cards">
      <div class="card"><div class="num">${AVG_PAGES}</div><div class="lbl">平均页数</div></div>
      <div class="card"><div class="num">${(AVG_CHARS/10000).toFixed(1)}万</div><div class="lbl">平均正文字数</div></div>
      <div class="card"><div class="num">11</div><div class="lbl">标准结构模块数</div></div>
      <div class="card"><div class="num">${CATS.length}</div><div class="lbl">方法大类</div></div>
    </div>
  </div>`;

  const dz = $("#dz"), fi = $("#fileInput");
  dz.addEventListener("click", ()=>fi.click());
  dz.addEventListener("dragover", e=>{e.preventDefault();dz.classList.add("over")});
  dz.addEventListener("dragleave", ()=>dz.classList.remove("over"));
  dz.addEventListener("drop", e=>{
    e.preventDefault(); dz.classList.remove("over");
    handleFiles(Array.from(e.dataTransfer.files));
  });
  fi.addEventListener("change", ()=>{handleFiles(Array.from(fi.files)); fi.value="";});
})();

async function handleFiles(files){
  const box = $("#upResults");
  for(const f of files){
    if(!/\.(pdf|docx?)$/i.test(f.name)) continue;
    const card = document.createElement("div");
    card.className = "up-file";
    card.innerHTML = `<div class="fname">${esc(f.name)}</div><div class="fmeta">解析中…</div>`;
    box.insertBefore(card, box.firstChild);
    try{
      $("#upProgress").textContent = `正在解析 ${f.name} …`;
      const {text, pages} = await extractText(f);
      if(text.replace(/\s/g,"").length < 200){
        card.querySelector(".fmeta").innerHTML = `<span class="warn">⚠ 未能提取到足够文字(可能是纯扫描件图片), 无法分析。建议提供文字版 PDF 或 DOCX。</span>`;
        continue;
      }
      const r = analyze(text, pages);
      card.innerHTML = reportHTML(f.name, r, pages);
    }catch(err){
      card.querySelector(".fmeta").innerHTML = `<span class="warn">✗ 解析失败: ${esc(err.message||String(err))}</span>`;
    }
  }
  $("#upProgress").textContent = "完成。可继续拖入更多文件。";
}

function reportHTML(name, r, pages){
  const sc = r.scores;
  const dim = (label, v, max)=>`
    <div style="margin-top:8px"><span style="font-size:12.5px">${label}</span>
    <span class="score-bar" style="max-width:320px"><i style="width:${Math.round(v/max*100)}%"></i></span>
    <span style="font-size:12px;color:var(--sub)">${v}/${max}</span></div>`;
  const tagChips = Object.keys(r.foundTags).slice(0,20).map(t=>{
    const c = tagCat[t];
    return `<span class="tag ${c==="机器学习/深度学习"?"m":""}" title="${esc(c)}">${esc(t)}</span>`;
  }).join("") || '<span style="color:var(--sub);font-size:12.5px">未匹配到库中方法标签(可在正文明确写出方法名称, 如"随机森林""蒙特卡洛模拟")</span>';
  const modChips = MOD_PATTERNS.map(([m])=>{
    const has = r.foundMods.includes(m);
    return `<span class="tag ${has?"m":""}" style="${has?"":"opacity:.35;text-decoration:line-through"}">${m}</span>`;
  }).join("");
  const sims = r.sims.map(s=>`<span class="sim-chip">↔ ${s.p.year}年${s.p.prob}题 · ${s.p.award==="星"?"提名":s.p.award}奖 · 方法重合度 ${(s.j*100).toFixed(0)}%${s.p.title?(" · "+esc(s.p.title.slice(0,18))):""}</span>`).join("");
  const advice = r.missing.slice(0,6).map(m=>`<li><b>${m}</b>: ${MOD_ADVICE[m]}</li>`).join("");
  return `
  <div class="fname">${esc(name)}</div>
  <div class="fmeta">${pages?pages+" 页 ·":""}正文 ${(r.chars/10000).toFixed(1)} 万字 · 识别模块 ${r.foundMods.length}/11 · 方法标签 ${r.tagSet.length} 个 / 覆盖 ${r.catSet.size} 大类</div>
  <div style="font-size:22px;font-weight:800;color:var(--accent2)">${sc.total}<span style="font-size:13px;color:var(--sub)"> / 100 · ${r.verdict}</span></div>
  ${dim("结构完整度", sc.sStruct, 30)}${dim("方法体系", sc.sMethod, 25)}${dim("篇幅规模", sc.sLen, 15)}${dim("验证意识(灵敏度+检验)", sc.sVerify, 15)}${dim("规范要素(摘要+文献)", sc.sNorm, 10)}${dim("问题分解叙事", sc.sNarr, 5)}
  <h4 style="margin:14px 0 6px;color:var(--accent2);font-size:13.5px">方法体系识别 <span style="color:var(--sub);font-weight:400;font-size:11.5px">(对照本库 189 篇优秀论文的方法taxonomy)</span></h4>
  <div style="margin-bottom:10px">${tagChips}</div>
  <h4 style="margin:10px 0 6px;color:var(--accent2);font-size:13.5px">结构模块检测</h4>
  <div style="margin-bottom:10px">${modChips}</div>
  ${sims?`<h4 style="margin:10px 0 6px;color:var(--accent2);font-size:13.5px">方法体系最相近的优秀论文</h4><div style="margin-bottom:10px">${sims}</div>`:""}
  <h4 style="margin:10px 0 6px;color:var(--gold);font-size:13.5px">优先补齐 (${r.missing.length} 项缺失)</h4>
  <ul class="tight" style="font-size:12.8px;color:#d5ddef">${advice || "<li>结构完整! 接下来提升深度: 增加交叉验证、改进链叙事与消融对比。</li>"}</ul>`;
}
})();
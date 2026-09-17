/* 论文评价系统 v2 —— 完整内嵌 ARS academic-paper-reviewer 全流程 (v1.10 full mode)
   Phase 0: 领域分析 + 评审团动态配置 (field_analyst)
   Phase 1: 五位审稿人独立评审 (eic / methodology / domain / perspective / devils_advocate)
   Phase 1.5: 逐部分评审意见 (按论文章节聚合, 标注提出人)
   Phase 2: 编辑决议信 + 修改路线图 (editorial_synthesizer; 铁律: DA发现CRITICAL则决议不得为通过档)
   量规: quality_rubrics 5维 0-100 (创新性20 方法严谨25 证据充分25 论证连贯15 写作规范15)
   基准: 189篇优秀论文画像 (按奖级统计) + 59篇精读 (按方法重叠度匹配借鉴) —— 不对标单一赛题 */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = s => (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const ALL_MODS = ["摘要","问题分析","模型假设","符号说明","模型建立","模型求解","灵敏度/稳健性","模型评价","参考文献","附录","流程图"];

// ---------- 语料基准统计 (全体语料, 不按赛题分组) ----------
const corpus = window.PROFILES;
function percentile(arr, v){ if(!arr.length) return 50; return Math.round(arr.filter(x=>x<=v).length/arr.length*100); }
function compOf(p){ const m=new Set(p.mods||[]); let n=0; ALL_MODS.forEach(x=>{if(m.has(x))n++;}); return n/ALL_MODS.length*100; }
function groupStats(pred){
  const g = corpus.filter(pred);
  if(!g.length) return null;
  return {
    n: g.length,
    comp: Math.round(g.reduce((s,p)=>s+compOf(p),0)/g.length),
    mcat: +(g.reduce((s,p)=>s+Object.keys(p.methods||{}).length,0)/g.length).toFixed(1),
    sens: Math.round(g.filter(p=>(p.mods||[]).includes("灵敏度/稳健性")).length/g.length*100),
    check: Math.round(g.filter(p=>(p.mods||[]).includes("模型检验")).length/g.length*100),
    flow: Math.round(g.filter(p=>(p.mods||[]).includes("流程图")).length/g.length*100)
  };
}
const bench = { all: groupStats(()=>true), A: groupStats(p=>p.award==="A") };
const absDensity = corpus.map(p=>((p.abs||"").match(/\d+\.?\d*/g)||[]).length/Math.max(1,(p.abs||"").length)*1000);
// 一等奖论文中覆盖率≥50%的方法类别 = 「优秀标配」
const aCats = {}; corpus.filter(p=>p.award==="A").forEach(p=>Object.keys(p.methods||{}).forEach(c=>aCats[c]=(aCats[c]||0)+1));
const commonCats = Object.entries(aCats).filter(([c,n])=>n/bench.A.n>=0.5).map(([c])=>c);

// ---------- 检测字典 ----------
const METHOD_DICT = {
"启发式/智能算法": /遗传算法|粒子群|模拟退火|禁忌搜索|蚁群|差分进化|NSGA|多目标进化|进化算法|贪心|启发式|ALNS/i,
"机器学习/深度学习": /神经网络|LSTM|GRU|CNN|Transformer|随机森林|XGBoost|LightGBM|支持向量机|SVM|K-Means|K-means|聚类|深度学习|卷积|注意力|U-?Net|YOLO|迁移学习|集成学习|Bagging|Stacking|随机搜索|梯度提升|决策树|BiLSTM|Vision Transformer/i,
"规划优化": /线性规划|整数规划|非线性规划|动态规划|目标规划|混合整数|列生成|最短路|Dijkstra|多目标优化|Pareto|帕累托|0-1|NP-hard|调度/i,
"统计与数据方法": /回归|ARIMA|时间序列|蒙特卡洛|Bootstrap|主成分|PCA|假设检验|方差分析|皮尔逊|Pearson|相关分析|插值|熵值法|DTW|KDE|核密度|正态|Shapiro|Mann-Whitney/i,
"机理建模/方程": /微分方程|马尔科夫|Markov|状态转移|守恒|机理模型|动力学方程|偏微分|常微分|Bianchi|扩散模型|SHAP/i,
"评价决策": /层次分析法|AHP|熵权|TOPSIS|综合评价|模糊评价|权重|组合赋权|Isotonic/i,
"图论/网络": /图论|拓扑|网络流|路径规划|DFS|BFS|DAG|有向无环|最短路/i,
"模拟仿真": /仿真|模拟器|数值模拟|蒙特卡洛|Simulink/i
};
const MOD_PATTERNS = {
"摘要": /摘\s*要/,
"问题分析": /问题重述|问题分析|问题描述/,
"模型假设": /模型假设|基本假设|假设条件/,
"符号说明": /符号说明|符号及变量|变量说明|主要符号/,
"模型建立": /模型建立|模型的建立|数学模型|建模/,
"模型求解": /模型求解|模型的求解|求解算法|算法求解/,
"灵敏度/稳健性": /灵敏度|敏感性分析|稳健性|鲁棒性/,
"模型检验": /模型检验|误差分析|模型验证|精度检验|结果检验|准确性验证/,
"模型评价": /模型评价|优缺点|模型的优点|不足与改进/,
"参考文献": /参考文献/,
"附录": /附\s*录/,
"流程图": /流程图|技术路线|解题流程/
};

// ---------- 页面骨架 ----------
const el = $("#page-eval");
el.innerHTML = `
<div class="panel">
  <h3>🧪 论文评价系统 <span style="font-size:12px;color:var(--sub);font-weight:400">ARS academic-paper-reviewer 全流程 · full mode · 对标 189 篇优秀论文整体基准 + 59 篇精读</span></h3>
  <p style="color:var(--sub);font-size:12.5px;margin-bottom:12px">粘贴论文全文（或上传 .txt/.md），系统将运行完整评审流程：<b class="hl">Phase 0</b> 领域分析+评审团配置 → <b class="hl">Phase 1</b> 五位审稿人独立评审 → <b class="hl">逐部分评审意见</b> → <b class="hl">Phase 2</b> 编辑决议信+修改路线图。PDF 文件请直接在对话中发给我逐段精修。</p>
  <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
    <label>论文标题 <input type="text" id="evTitle" placeholder="我的建模论文" size="28"></label>
    <label>上传 <input type="file" id="evFile" accept=".txt,.md" style="font-size:12px"></label>
    <button id="evDemo" style="background:none;border:1px solid var(--line);color:var(--sub);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px">载入示例文本</button>
  </div>
  <textarea id="evText" rows="8" style="width:100%;background:#0d1526;border:1px solid var(--line);color:#d5ddef;border-radius:8px;padding:10px;font-size:12.5px" placeholder="在此粘贴论文全文（摘要+正文+参考文献）…"></textarea>
  <div style="margin-top:10px">
    <button id="evRun" style="background:var(--accent);border:none;color:#0b1020;font-weight:700;padding:10px 26px;border-radius:8px;cursor:pointer;font-size:14px">开始评审</button>
    <span id="evHint" style="color:var(--sub);font-size:12px;margin-left:10px"></span>
  </div>
  <div id="evMods" style="margin-top:12px"></div>
</div>
<div id="evOut"></div>`;

const DEMO = `摘要：本文研究城市共享单车调度优化问题。针对问题一，本文建立了基于历史骑行数据的站点需求预测模型；针对问题二，建立了车辆调度优化模型。本文提出了一个改进的调度算法，实验表明效果良好。
关键词：共享单车；调度优化；需求预测
一、问题重述
二、模型假设
三、符号说明
四、问题一：建立 LSTM 神经网络需求预测模型，用历史数据训练并预测各站点需求量。
五、问题二：建立线性规划调度模型，用贪心算法求解，最小化总调度距离。
六、模型求解与结果分析
七、模型评价：本文模型有优点也有不足。
参考文献
[1] 王某某. 共享单车调度研究[J]. 2023.
附录`;

function renderModBoxes(detected){
  $("#evMods").innerHTML = `<div style="font-size:12.5px;color:var(--sub);margin-bottom:6px">结构模块自检（已按全文关键词自动勾选，可手动修正后重新评审）：</div>` +
    ALL_MODS.map(m=>`<label class="check-row" style="display:inline-flex;width:auto;margin-right:12px"><input type="checkbox" data-mod="${m}" ${detected.has(m)?"checked":""}><span>${m}</span></label>`).join("");
}

// ---------- 信号抽取 ----------
function extractSignals(text){
  const s = {text, chars: text.length};
  const mAbs = text.match(/摘\s*要[:：]?([\s\S]{50,1200}?)(关键词|关\s*键\s*词|Abstract|一、|1[\.\s])/);
  s.abstract = mAbs ? mAbs[1].trim() : "";
  const mKw = text.match(/关键词[:：]?([^\n]{4,120})/);
  s.keywords = mKw ? mKw[1].trim() : "";
  const mRefSec = text.split(/参考文献/)[1]||"";
  const refMarks = text.match(/\[\d{1,2}\]/g)||[];
  s.refs = Math.max(mRefSec.split(/\n/).filter(l=>/^\s*\[?\d+\]?/.test(l)).length, refMarks.length? Math.max.apply(null, refMarks.map(r=>+r.replace(/\D/g,""))) : 0, 0);
  s.nums = (text.match(/\d+\.?\d*/g)||[]).length;
  s.density = s.nums/Math.max(1,s.chars)*1000;
  s.figs = (text.match(/图\s?\d+/g)||[]).length + (text.match(/表\s?\d+/g)||[]).length;
  s.methods = {};
  Object.entries(METHOD_DICT).forEach(([c,re])=>{ if(re.test(text)) s.methods[c]=true; });
  s.methodCats = Object.keys(s.methods).length;
  s.mods = new Set(Object.entries(MOD_PATTERNS).filter(([,re])=>re.test(text)).map(([m])=>m));
  s.qCount = (text.match(/问题[一二三四五六1-6]/g)||[]).length;
  s.perQ = (text.match(/针对问题[一二三四五六1-6]|问题[一二三四五六1-6][:：,，]/g)||[]).length;
  s.compare = /对比|比较|优于|baseline|基线|相比/.test(text);
  s.tune = /调参|超参数|参数设置|随机搜索|网格搜索|交叉验证/.test(text);
  s.complexity = /复杂度|时间复杂度|空间复杂度|O\(|收敛/.test(text);
  s.innov = /改进|提出|构建|设计|创新性地|本文提出|本文构建/.test(text);
  s.apply = /推广|应用价值|实际应用|政策建议|改进方向/.test(text);
  s.absNums = s.abstract ? (s.abstract.match(/\d+\.?\d*/g)||[]).length : 0;
  return s;
}

// ---------- 章节切分 (逐部分评审用) ----------
function splitSections(text){
  const marks = [
    ["摘要", /摘\s*要[:：]?/],
    ["问题重述与分析", /问题重述|问题分析|问题描述/],
    ["模型假设", /模型假设|基本假设|假设条件/],
    ["符号说明", /符号说明|符号及变量|变量说明|主要符号/],
    ["模型建立", /模型建立|模型的建立|数学模型/],
    ["模型求解", /模型求解|模型的求解|求解算法/],
    ["结果分析", /结果分析|结果与讨论|算例分析|实验结果|结果展示/],
    ["灵敏度/稳健性", /灵敏度|敏感性分析|稳健性|鲁棒性/],
    ["模型检验", /模型检验|误差分析|模型验证|精度检验|准确性验证/],
    ["模型评价", /模型评价|模型的优点|不足与改进|结论与展望/],
    ["参考文献", /参考文献/],
    ["附录", /附\s*录/]
  ];
  const found = [];
  marks.forEach(([name,re])=>{
    const m = re.exec(text);
    if(m) found.push({name, idx:m.index});
  });
  found.sort((a,b)=>a.idx-b.idx);
  const segs = [];
  found.forEach((f,i)=>{
    const end = i+1<found.length ? found[i+1].idx : Math.min(text.length, f.idx+8000);
    segs.push({name:f.name, text:text.slice(f.idx, end)});
  });
  return segs;
}

// ---------- 逐部分评审规则: 返回 [{who, icon, txt}] ----------
function sectionReview(seg, s, mods){
  const t = seg.text, L = t.length, out = [];
  const who = {eic:"EIC", met:"方法学审稿人", dom:"领域审稿人", per:"视角审稿人", da:"魔鬼代言人"};
  const push = (w,i,x)=>out.push({who:w, icon:i, txt:x});
  switch(seg.name){
    case "摘要":
      if(L>=200&&L<=900) push(who.eic,"✓",`长度 ${L} 字, 处于优秀区间 (200-900)。`);
      else push(who.eic,"⚠",`长度 ${L} 字, ${L<200?"过短, 贡献讲不完":"过长, 评委抓不住重点"}; 建议控制在 300-600 字。`);
      if(s.absNums>=3) push(who.eic,"✓",`含 ${s.absNums} 个量化结果, 结论可验证。`);
      else push(who.da,"⚠",`量化结果不足 (${s.absNums} 个数字) —— 评委扫 30 秒抓不到「你比别人好多少」。`);
      if(s.perQ>=3) push(who.eic,"✓",`逐问分述结构清晰 (命中 ${s.perQ} 处), 与题目对齐。`);
      else push(who.da,"⚠","未见「针对问题一/二/三」式分述, 摘要与题目要求的对应关系不明。");
      push(who.dom,"✎","优秀论文摘要公式: 背景一句 → 逐问「方法+量化结果」 → 一句总评。对标 59 篇精读摘要可体会。");
      break;
    case "问题重述与分析":
      if(/数据|附件|指标/.test(t)) push(who.dom,"✓","有数据/指标层面的题意解读, 不只是抄题。");
      else push(who.dom,"⚠","缺少对数据与评价指标的分析——优秀论文在此交代「我们手里有什么、要优化什么」。");
      if(/思路|技术路线|总体/.test(t)) push(who.dom,"✓","给出了解题思路/总体框架。");
      else push(who.met,"✎","建议补一段总体技术路线 (文字或流程图), 先讲清「问题→模型→求解→验证」的主线。");
      break;
    case "模型假设":
      { const n = (t.match(/假设|假定/g)||[]).length;
        if(n>=4) push(who.met,"✓",`识别到约 ${n} 处假设表述, 数量合理。`);
        else push(who.met,"⚠",`假设偏少 (${n} 处) —— 数学建模的假设是评审第一眼, 建议 5-9 条, 逐条编号。`);
        if(/合理性|依据|为什么/.test(t)) push(who.met,"✓","对假设给出了合理性说明。");
        else push(who.da,"⚠","假设无理由说明 —— 魔鬼代言人必问: 「这条假设为什么成立? 不成立时你的模型还准吗?」"); }
      break;
    case "符号说明":
      if(/单位|量纲/.test(t)) push(who.met,"✓","符号带单位/量纲, 规范。");
      else push(who.met,"✎","建议符号表注明单位与量纲; 维度不一致是建模论文最常见的隐性错误。");
      if(L>400) push(who.met,"✓","符号表体量充实。");
      else push(who.met,"⚠","符号说明过简, 检查是否遗漏关键变量定义。");
      break;
    case "模型建立":
      { const f = (t.match(/式\s*\(|s\.t\.|约束|目标函数|max|min|≥|≤|=/)||[]).length;
        if(f>=3) push(who.met,"✓",`公式化程度高 (命中 ${f} 处公式/约束信号), 模型是「写出来」的。`);
        else push(who.da,"⚠",`公式信号少 (命中 ${f} 处) —— 模型描述偏文字化。评委找的是: 决策变量、目标函数、约束条件, 一个都不能少。`);
        if(/假设检验|推导|证明|等价/.test(t)) push(who.dom,"✓","有推导/等价变换过程, 理论深度加分。");
        else push(who.dom,"✎","关键步骤给推导 (哪怕一句话说明「由 XX 可得」), 比直接甩公式得分高。"); }
      break;
    case "模型求解":
      if(/复杂度|O\(|收敛/.test(t)) push(who.met,"✓","给出复杂度/收敛性分析。");
      else push(who.met,"⚠","缺复杂度或收敛性说明 —— 算法题评委必问「多快、何时停」。");
      if(/参数|调参|超参数|随机搜索|网格搜索/.test(t)) push(who.met,"✓","有参数设置/调参过程, 可复现性好。");
      else push(who.met,"⚠","未交代算法参数 —— 结果不可复现, 方法学审稿人按 ARS 标准记 MAJOR。");
      break;
    case "结果分析":
      { const d = ((t.match(/\d+\.?\d*/g)||[]).length)/Math.max(1,L)*1000;
        if(d>=8) push(who.dom,"✓",`数字密度 ${d.toFixed(1)}/千字, 结果量化充分。`);
        else push(who.da,"⚠",`数字密度 ${d.toFixed(1)}/千字 偏低 —— 「效果良好」不是结果, 「误差降至 3.2%」才是。`);
        const ft = (t.match(/图\s?\d+|表\s?\d+/g)||[]).length;
        if(ft>=3) push(who.dom,"✓",`有 ${ft} 处图表引用, 呈现规范。`);
        else push(who.dom,"✎",`图表引用仅 ${ft} 处; 每个问题的结果至少配一图或一表。`); }
      break;
    case "灵敏度/稳健性":
      if(/扰动|±|变化率|改变/.test(t)) push(who.met,"✓","有参数扰动实验, 灵敏度分析做实了。");
      else push(who.met,"⚠","提到灵敏度但未见扰动实验细节 —— 要给出「参数变了, 结果怎么变」的数据或曲线。");
      break;
    case "模型检验":
      if(/对比|真实值|误差|仿真|解析解/.test(t)) push(who.met,"✓","用对比/误差/仿真做验证, 双轨思路正确。");
      else push(who.met,"✎","补一个验证锚点: 与解析解、基线方法或真实数据对比, 给出误差百分比。");
      break;
    case "模型评价":
      if(/缺点|不足|局限/.test(t)&&/优点|优势/.test(t)) push(who.per,"✓","优缺点并陈, 评价客观。");
      else if(/优点|优势/.test(t)) push(who.da,"⚠","只写优点不写缺点 —— 显得不诚实; ARS 评审标准要求 self-critique 必须具体 (如 2022B 直言「变量随规模爆炸」)。");
      else push(who.per,"⚠","模型评价过于简略。");
      if(/改进|推广|展望/.test(t)) push(who.per,"✓","给出改进与推广方向。");
      else push(who.per,"✎","补「模型改进与推广」小节: 优秀论文的收尾落在具体决策建议或下一代方法 (对照写作指南第 10 条)。");
      break;
    case "参考文献":
      if(s.refs>=15) push(who.dom,"✓",`约 ${s.refs} 条文献, 达到优秀论文标配 (≥15)。`);
      else if(s.refs>=8) push(who.dom,"⚠",`约 ${s.refs} 条, 偏少; 建议 ≥15 条并覆盖方法出处与领域背景。`);
      else push(who.dom,"⚠",`仅约 ${s.refs} 条文献 —— 支撑单薄, 评委质疑文献阅读量。`);
      break;
    case "附录":
      if(/def |function|import|#include|clc|for |while /.test(t)) push(who.met,"✓","附录含代码, 可复现性加分。");
      else push(who.met,"✎","附录建议附核心代码 (求解算法+画图), 并标注运行环境。");
      break;
  }
  return out;
}

// ---------- 5 维量规评分 ----------
function clamp(v){ return Math.max(8, Math.min(95, Math.round(v))); }
function scoreDims(s, mods){
  const A = bench.A, ALL = bench.all;
  const evid = {orig:[], rig:[], ev:[], coh:[], wri:[]};
  let orig = 45;
  if(s.innov){ orig += 12; evid.orig.push("有「提出/改进/构建」类自创表述 (+12)"); }
  if(s.methodCats>=3){ orig += 10; evid.orig.push("方法类别≥3, 呈组合拳而非单模型 (+10)"); }
  else if(s.methodCats===2){ orig += 5; evid.orig.push("方法类别=2 (+5)"); }
  else evid.orig.push("仅识别到 1 类方法, 创新性受限");
  if(/改进/.test(s.text)&&/算法|模型/.test(s.text)){ orig += 8; evid.orig.push("有明确的改进型算法/模型 (+8)"); }
  if(/GAN|扩散|注意力|Transformer|混合|联合|BSVD/i.test(s.text)){ orig += 6; evid.orig.push("使用了新型结构或混合架构 (+6)"); }
  let rig = 40;
  if(s.compare){ rig += 15; evid.rig.push("有对比/基线实验 (+15)"); }
  if(mods.has("灵敏度/稳健性")){ rig += 12; evid.rig.push("含灵敏度/稳健性分析 (+12)"); }
  if(mods.has("模型检验")){ rig += 12; evid.rig.push("含模型检验/误差分析 (+12)"); }
  if(s.tune){ rig += 8; evid.rig.push("有调参/交叉验证描述 (+8)"); }
  if(s.complexity){ rig += 8; evid.rig.push("有复杂度/收敛性分析 (+8)"); }
  if(s.methodCats >= A.mcat){ rig += 7; evid.rig.push(`方法类别数 ${s.methodCats} 达到一等奖均值 ${A.mcat} (+7)`); }
  else if(s.methodCats >= ALL.mcat){ rig += 3; evid.rig.push(`方法类别数 ${s.methodCats} 达到全体均值 ${ALL.mcat} (+3)`); }
  let ev = 35;
  const densPct = percentile(absDensity, s.abstract? (s.abstract.match(/\d+\.?\d*/g)||[]).length/Math.max(1,s.abstract.length)*1000 : 0);
  ev += Math.round(densPct/100*20); evid.ev.push(`摘要数字密度位于 189 篇语料第 ${densPct} 百分位 (+${Math.round(densPct/100*20)})`);
  ev += Math.min(15, Math.round(s.figs/8*15)); evid.ev.push(`图表引用 ${s.figs} 处 (+${Math.min(15,Math.round(s.figs/8*15))})`);
  if(s.refs>=15){ ev += 12; evid.ev.push(`参考文献 ${s.refs} 条 (优秀标配 ≥15) (+12)`); }
  else if(s.refs>=8){ ev += 7; evid.ev.push(`参考文献 ${s.refs} 条 (+7)`); }
  else if(s.refs>0){ ev += 3; evid.ev.push(`参考文献 ${s.refs} 条, 偏少 (+3)`); }
  if(mods.has("模型检验")&&mods.has("灵敏度/稳健性")){ ev += 10; evid.ev.push("检验+灵敏度双证据链 (+10)"); }
  if(/结果分析|结果与讨论/.test(s.text)){ ev += 8; evid.ev.push("有独立结果分析章节 (+8)"); }
  let coh = 40;
  if(s.perQ>=3){ coh += 20; evid.coh.push(`逐问结构清晰 (命中 ${s.perQ} 处「问题N」分述) (+20)`); }
  else if(s.perQ>=1){ coh += 10; evid.coh.push("有按问题分述结构 (+10)"); }
  if(s.abstract && s.abstract.length>=200 && s.abstract.length<=900){ coh += 12; evid.coh.push(`摘要长度 ${s.abstract.length} 字在优秀区间 (+12)`); }
  if(s.absNums>=3){ coh += 10; evid.coh.push("摘要含具体量化结果 (≥3 个数字) (+10)"); }
  else evid.coh.push("摘要缺量化结果");
  if(mods.has("问题分析")){ coh += 8; evid.coh.push("有问题分析/重述章节 (+8)"); }
  if(mods.has("流程图")){ coh += 10; evid.coh.push("含流程图/技术路线 (+10)"); }
  let wri = 35;
  let n=0; ALL_MODS.forEach(m=>{if(mods.has(m))n++;});
  const comp = n/ALL_MODS.length*100;
  const compPct = percentile(corpus.map(compOf), comp);
  wri += Math.round(compPct/100*25); evid.wri.push(`结构完整度 ${Math.round(comp)}% (一等奖均值 ${bench.A.comp}%), 语料第 ${compPct} 百分位 (+${Math.round(compPct/100*25)})`);
  if(s.keywords){ wri += 10; evid.wri.push("有关键词 (+10)"); }
  if(/符号说明|符号表/.test(s.text)){ wri += 8; evid.wri.push("符号表规范 (+8)"); }
  if(s.chars>=30000){ wri += 10; evid.wri.push(`全文 ${Math.round(s.chars/1000)}k 字符, 工作量饱满 (+10)`); }
  else if(s.chars>=10000){ wri += 5; evid.wri.push(`全文 ${Math.round(s.chars/1000)}k 字符 (+5)`); }
  else evid.wri.push("文本量偏小, 若为全文则篇幅明显不足");
  return { orig:{v:clamp(orig),w:20,name:"创新性",evid:evid.orig}, rig:{v:clamp(rig),w:25,name:"方法严谨性",evid:evid.rig},
           ev:{v:clamp(ev),w:25,name:"证据充分性",evid:evid.ev}, coh:{v:clamp(coh),w:15,name:"论证连贯性",evid:evid.coh},
           wri:{v:clamp(wri),w:15,name:"写作规范",evid:evid.wri}, comp: Math.round(comp) };
}

// ---------- Phase 0: 领域分析与评审团配置 ----------
function fieldAnalysis(s){
  const has = c=>!!s.methods[c];
  let field, paradigm;
  if(has("机器学习/深度学习")&&has("规划优化")){ field="数据驱动 + 运筹优化类工程问题"; paradigm="数据挖掘 → 预测 → 优化决策"; }
  else if(has("机器学习/深度学习")){ field="数据科学/机器学习应用类"; paradigm="特征工程 → 模型训练 → 评估校准"; }
  else if(has("规划优化")||has("图论/网络")){ field="运筹优化/调度排布类"; paradigm="建模 → 算法设计 → 复杂度分析"; }
  else if(has("机理建模/方程")){ field="机理建模/数值仿真类"; paradigm="机理推导 → 数值求解 → 仿真验证"; }
  else if(has("统计与数据方法")){ field="统计分析/评价决策类"; paradigm="指标构建 → 统计检验 → 综合评价"; }
  else { field="综合建模类 (信号较弱, 建议补充方法表述)"; paradigm="问题 → 模型 → 求解 → 验证"; }
  const metExpertise = has("规划优化")?"运筹优化与启发式算法专家 (关注目标函数/约束/复杂度)":
    has("机器学习/深度学习")?"统计学习与实验设计专家 (关注基线对比/调参/泄漏防护)":
    has("机理建模/方程")?"数值方法与仿真验证专家 (关注离散化误差/守恒性/解析-仿真互验)":"建模方法论专家";
  return {field, paradigm, metExpertise,
    maturity: s.chars>=30000?"接近成稿":(s.chars>=10000?"中期草稿":"早期草稿/仅部分章节")};
}

// ---------- 精读匹配: 按方法类别重叠度 (不对标赛题) ----------
function deepMatches(s){
  const scored = Object.entries(window.ANALYSES).map(([k,d])=>{
    const txt = d.approach+" "+d.takeaways+" "+d.strengths;
    let score = 0, cats = [];
    Object.entries(METHOD_DICT).forEach(([c,re])=>{ if(s.methods[c] && re.test(txt)){ score+=2; cats.push(c); } });
    return {k, d, score, cats};
  }).filter(x=>x.score>=2).sort((a,b)=>b.score-a.score).slice(0,3);
  return scored;
}

// ---------- 魔鬼代言人 ----------
function devilsAdvocate(s, mods){
  const issues = [];
  if(!s.compare && !mods.has("模型检验"))
    issues.push({sev:"CRITICAL", txt:"没有任何对比实验或模型检验——评委无法确认你的模型比基线更好, 结论不可证。这是获奖硬门槛 (一等奖论文含灵敏度分析 ${A_SENS}%, 含模型检验 ${A_CHK}%).".replace("${A_SENS}",bench.A.sens).replace("${A_CHK}",bench.A.check)});
  if(!mods.has("灵敏度/稳健性"))
    issues.push({sev:"MAJOR", txt:"缺灵敏度/稳健性分析——参数一变结果是否还成立? 没有它, 「最优」只是偶然。"});
  if(s.absNums<2)
    issues.push({sev:"MAJOR", txt:"摘要没有给出量化结果 (精度/误差/提升百分比), 评委扫 30 秒抓不到贡献点。"});
  if(s.methodCats<=1)
    issues.push({sev:"MAJOR", txt:"全文只见到一类方法信号——单一模型无对照; 优秀论文普遍「物理/统计打底 + 学习增强 + 优化决策」组合。"});
  if(s.qCount<2)
    issues.push({sev:"MINOR", txt:"「问题一/二/三」的分问结构不明显, 可能与题目要求不完全对齐。"});
  if(s.refs<8)
    issues.push({sev:"MINOR", txt:"参考文献 <8 条, 文献支撑单薄。"});
  const counter = "最强反方质疑：如果把你的模型换成一个更简单的基线 (线性回归/贪心规则), 在你的评价指标上可能只损失几个百分点, 却省去大量调参与解释成本——请用对比实验证明那「几个百分点」值得。";
  return {issues, counter, hasCritical: issues.some(i=>i.sev==="CRITICAL")};
}

function decision(total, hasCritical){
  if(hasCritical) return {label:"大修后再议 (Major Revision)", cls:"#e8734a", note:"魔鬼代言人发现 CRITICAL 问题——按 ARS 评审铁律 #4, 决议不得为通过档。先补验证, 再谈创新。"};
  if(total>=80) return {label:"通过档 · 具一等奖竞争力 (Accept)", cls:"#3ecf8e", note:"各维度均衡且证据链完整, 达到语料一等奖论文的行为特征水平。"};
  if(total>=65) return {label:"小修后通过 (Minor Revision)", cls:"#a7d489", note:"主体扎实, 按修改路线图补齐短板即可。"};
  if(total>=50) return {label:"大修 (Major Revision)", cls:"#e8c547", note:"框架尚在, 但证据链或结构存在系统性缺口。"};
  return {label:"重大返工 (Reject & Rework)", cls:"#e8734a", note:"与优秀论文基准差距较大, 建议先按「写作指南」重构再评审。"};
}

// ---------- 主流程 ----------
function run(){
  const text = $("#evText").value.trim();
  if(text.length<200){ $("#evHint").textContent = "请先粘贴至少 200 字的论文内容。"; return; }
  $("#evHint").textContent = "";
  const s = extractSignals(text);
  const mods = new Set(Array.from(document.querySelectorAll('#evMods input:checked')).map(b=>b.dataset.mod));
  const dims = scoreDims(s, mods);
  const total = Math.round(dims.orig.v*0.20 + dims.rig.v*0.25 + dims.ev.v*0.25 + dims.coh.v*0.15 + dims.wri.v*0.15);
  const fa = fieldAnalysis(s);
  const matches = deepMatches(s);
  const missingCats = commonCats.filter(c=>!s.methods[c]);
  const da = devilsAdvocate(s, mods);
  const dec = decision(total, da.hasCritical);
  const segs = splitSections(text);
  const title = $("#evTitle").value || "该文";

  const fixes = [];
  if(!mods.has("模型检验")) fixes.push({p:1, t:"补一节模型检验/误差分析: 用自构造小数据集或解析解验证模型正确性 (学 2022C 自构造验证集拿 99.367 分的做法)"});
  if(!s.compare) fixes.push({p:2, t:"补对比实验: 至少与 1-2 个基线方法同指标对比, 并说明「什么数据/场景下用什么算法」"});
  if(!mods.has("灵敏度/稳健性")) fixes.push({p:3, t:"补灵敏度分析: 对关键参数 ±20% 扰动, 报告结果变化幅度"});
  if(s.absNums<3) fixes.push({p:4, t:"重写摘要末句: 必须落到量化结果 (「精度达 X%/误差降至 Y/提升 Z%」)"});
  if(missingCats.length) fixes.push({p:5, t:`对标一等奖标配方法类别, 你尚未覆盖: ${missingCats.slice(0,3).join("、")} —— 考虑纳入方法体系`});
  if(!mods.has("流程图")) fixes.push({p:6, t:"加一张总体技术路线图/流程图, 把「问题→模型→求解→验证」一次讲清"});
  if(s.refs<15) fixes.push({p:7, t:`扩充参考文献至 15 条以上 (当前约 ${s.refs} 条)`});
  fixes.sort((a,b)=>a.p-b.p);

  const dimRow = d => `
    <div style="margin:10px 0">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <b>${d.name}</b><span style="font-size:12px;color:var(--sub)">权重 ${d.w}%</span>
        <span style="font-weight:800;color:var(--accent2)">${d.v}</span>
      </div>
      <div class="score-bar" style="max-width:420px"><i style="width:${d.v}%"></i></div>
      <ul class="tight" style="font-size:12px;color:var(--sub);margin-top:4px">${d.evid.map(e=>"<li>"+esc(e)+"</li>").join("")}</ul>
    </div>`;

  const sevColor = {CRITICAL:"#e8734a", MAJOR:"#e8c547", MINOR:"var(--sub)"};

  $("#evOut").innerHTML = `
  <div class="panel">
    <h3>Phase 0 · 领域分析与评审团配置 <span style="font-size:12px;color:var(--sub);font-weight:400">field_analyst</span></h3>
    <table><tbody>
      <tr><td class="hl" style="white-space:nowrap">领域判定</td><td>${esc(fa.field)}</td></tr>
      <tr><td class="hl">研究范式</td><td>${esc(fa.paradigm)}</td></tr>
      <tr><td class="hl">成稿度</td><td>${esc(fa.maturity)} (全文 ${Math.round(s.chars/1000)}k 字符 · 方法类别 ${s.methodCats} · 图表引用 ${s.figs} · 参考文献约 ${s.refs})</td></tr>
      <tr><td class="hl">评审团</td><td>EIC 总编 ｜ 方法学审稿人 (${esc(fa.metExpertise)}) ｜ 领域审稿人 (对标 189 篇优秀论文整体基准) ｜ 视角审稿人 (应用与推广) ｜ 魔鬼代言人 (最强反方, 铁律: 其 CRITICAL 问题可一票否决通过档决议)</td></tr>
    </tbody></table>
  </div>

  <h3 style="margin:16px 0 10px">Phase 1 · 五人独立评审报告 <span style="font-size:12px;color:var(--sub);font-weight:400">互不见面 · 独立出具 (ARS IRON RULE #2)</span></h3>
  <div class="grid-deep">
    <div class="deep-card" style="cursor:default"><h4>① EIC 总编 · 总体定位</h4>
      <p style="font-size:12.8px;color:#d5ddef">《${esc(title)}》定位为「${esc(fa.field)}」。结构完整度 ${dims.comp}%（一等奖均值 ${bench.A.comp}%，全体均值 ${bench.all.comp}%），方法类别 ${s.methodCats} 类（一等奖均值 ${bench.A.mcat}）。${total>=65?"整体具备优秀论文骨架，争议点在证据深度而非框架。":"骨架尚不完整，先补结构再谈深度。"}${s.apply?"已见推广/应用表述，收尾姿态良好。":"结尾缺推广与改进方向。"} originality 判断: ${s.innov?"有自创表述, 属「方法改进或新应用」档 (75-89 分档特征)":"偏「复现已有框架」档, 需强化「本文提出/改进」的明确主张"}。</p></div>
    <div class="deep-card" style="cursor:default"><h4>② 方法学审稿人 · 严谨性</h4>
      <p style="font-size:12.8px;color:#d5ddef">${dims.rig.evid.map(e=>esc(e)).join("；")}。${s.complexity?"":"未见复杂度/收敛性分析。 "}${s.tune?"":"未见调参与超参搜索过程, 结果难以复现。"}${(!mods.has("灵敏度/稳健性")&&!mods.has("模型检验"))?" ⚠️ 验证章节双缺——这是方法学的结构性短板, 直接压低证据充分性维度。":""}</p></div>
    <div class="deep-card" style="cursor:default"><h4>③ 领域审稿人 · 对标优秀论文基准</h4>
      <p style="font-size:12.8px;color:#d5ddef">你的方法类别覆盖: <b class="hl">${Object.keys(s.methods).join("、")||"未识别"}</b>。一等奖论文中覆盖率 ≥50% 的「标配」类别: ${commonCats.join("、")}。${missingCats.length?`你尚未覆盖: <b style="color:#e8c547">${missingCats.join("、")}</b>。`:"已全覆盖, 方法面达标。"}${matches.length?`<br>▸ 按方法重叠度为你匹配的精读借鉴:<br>${matches.map(m=>{const [y,pr,f]=m.k.split("|");return `<span class="tag y">${y} ${pr}题</span> ${esc(m.d.takeaways)}`;}).join("<br>").slice(0,700)}`:""}</p></div>
    <div class="deep-card" style="cursor:default"><h4>④ 视角审稿人 · 应用与推广</h4>
      <p style="font-size:12.8px;color:#d5ddef">${s.apply?"已覆盖应用/推广视角, 符合近年获奖趋势 (SHAP 可解释性、政策情景、工程建议落坐标)。":"缺「应用价值/推广/改进方向」维度——优秀论文把最后一问落到具体决策建议 (补充钻孔坐标/提前10分钟预警/三个情景)。 "}${mods.has("模型评价")?"模型评价章节在, 检查是否优缺点并陈且缺点具体。":"缺模型评价章节。"} 建议对照写作指南第 10 条补「模型局限与改进」。</p></div>
    <div class="deep-card" style="cursor:default"><h4>⑤ 魔鬼代言人 · 最强反方</h4>
      <p style="font-size:12.8px;color:#d5ddef">${esc(da.counter)}</p>
      <ul class="tight" style="font-size:12.5px;margin-top:6px">${da.issues.map(i=>`<li><b style="color:${sevColor[i.sev]}">[${i.sev}]</b> ${esc(i.txt)}</li>`).join("")||"<li>未发现 CRITICAL/MAJOR 级问题。</li>"}</ul></div>
  </div>

  <h3 style="margin:16px 0 10px">逐部分评审意见 <span style="font-size:12px;color:var(--sub);font-weight:400">按论文章节聚合 · 标注提出人</span></h3>
  ${segs.length? segs.map(sg=>{
      const cs = sectionReview(sg, s, mods);
      if(!cs.length) return "";
      return `<div class="panel" style="margin-bottom:10px"><h4 style="margin-bottom:6px">${esc(sg.name)} <span style="font-size:11.5px;color:var(--sub);font-weight:400">约 ${sg.text.length} 字</span></h4>
      <ul class="tight" style="font-size:12.8px">${cs.map(c=>`<li><span style="color:${c.icon==="✓"?"#3ecf8e":c.icon==="⚠"?"#e8c547":"var(--accent2)"}">${c.icon}</span> ${esc(c.txt)} <span style="color:var(--sub);font-size:11px">— ${c.who}</span></li>`).join("")}</ul></div>`;
    }).join("") : `<div class="panel"><p style="color:var(--sub);font-size:12.5px">未能识别出标准章节结构——建议先按「摘要→问题重述→假设→符号→建模→求解→检验→评价→参考文献」重构框架。</p></div>`}

  <div class="panel" style="margin-top:16px">
    <h3>Phase 2 · 编辑决议信 <span style="font-size:12px;color:var(--sub);font-weight:400">editorial_synthesizer · 决议基于五人报告, 不得虚构评审意见 (IRON RULE #3)</span></h3>
    <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:10px 0">
      <div style="font-size:44px;font-weight:800;color:${dec.cls}">${total}</div>
      <div><div style="font-size:17px;font-weight:700;color:${dec.cls}">${dec.label}</div>
      <div style="font-size:12.5px;color:var(--sub);max-width:560px">${dec.note}</div></div>
    </div>
    ${dimRow(dims.orig)}${dimRow(dims.rig)}${dimRow(dims.ev)}${dimRow(dims.coh)}${dimRow(dims.wri)}
    <p style="font-size:11.5px;color:var(--sub);margin-top:8px">校准注记 (ARS quality_rubrics): 规则化评分仅有次序意义 (85&gt;65), 不代表真实奖级保证; 量规定义「测什么」, 不测「测得多准」。</p>
  </div>
  <div class="panel" style="margin-top:16px"><h3>修改路线图 <span style="font-size:12px;color:var(--sub);font-weight:400">按优先级排序 · 可直接作为下一轮评审输入 (Revision Roadmap)</span></h3>
    <ol class="tight" style="font-size:13px;color:#d5ddef">${fixes.map(f=>`<li>${esc(f.t)}</li>`).join("")||"<li>当前无明显短板, 把精力投向深度: 消融实验、跨数据集验证、局限分析。</li>"}</ol>
    <p style="font-size:12px;color:var(--sub);margin-top:8px">提示: 把论文全文直接发给 Kimi 并说「分析我的建模论文」, 可获得逐段精修 (本系统负责结构化体检, 逐段诊断走对话)。</p>
  </div>`;
  $("#evOut").scrollIntoView({behavior:"smooth"});
}

$("#evRun").addEventListener("click", run);
$("#evDemo").addEventListener("click", ()=>{ $("#evText").value = DEMO; autoDetect(); });
$("#evText").addEventListener("input", ()=>{ if($("#evText").value.length>300) autoDetect(); });
$("#evFile").addEventListener("change", e=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{ $("#evText").value = String(r.result).slice(0,200000); autoDetect(); };
  r.readAsText(f, "utf-8");
});
function autoDetect(){
  const t = $("#evText").value;
  if(t.length<100) return;
  const s = extractSignals(t);
  renderModBoxes(s.mods);
  $("#evHint").textContent = `已抽取: 摘要 ${s.abstract.length} 字 · 方法类别 ${s.methodCats} · 图表引用 ${s.figs} · 参考文献约 ${s.refs} 条`;
}
renderModBoxes(new Set());
})();

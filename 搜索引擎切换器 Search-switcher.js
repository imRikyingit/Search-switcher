// ==UserScript==
// @name         搜索引擎切换器
// @namespace    https://greasyfork.org/scripts/search-switcher
// @version      2.1.1
// @description  多搜索引擎切换｜自动收起｜添加/删除搜索引擎｜新增“添加当前页面”功能 | Easily switch between popular search engines and manage custom ones
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @license      MIT
// ==/UserScript==

/* ================== 搜索引擎定义 ================== */
const BUILTIN_ENGINES = [
  { id: "google", name: "Google", searchUrl: "https://www.google.com/search?q=", key: "q", test: /google\.[^/]+\/search/i },
  { id: "bing", name: "Bing", searchUrl: "https://www.bing.com/search?q=", key: "q", test: /bing\.com\/search/i },
  { id: "bilibili", name: "哔哩哔哩", searchUrl: "https://search.bilibili.com/all?keyword=", key: "keyword", test: /bilibili\.com/i },
  { id: "xiaohongshu", name: "小红书", searchUrl: "https://www.xiaohongshu.com/search_result?keyword=", key: "keyword", test: /xiaohongshu\.com/i },
  { id: "douyin", name: "抖音", searchUrl: "https://www.douyin.com/search/", key: "", test: /douyin\.com\/search/i },
  { id: "youtube", name: "YouTube", searchUrl: "https://www.youtube.com/results?search_query=", key: "search_query", test: /youtube\.com\/results/i },
  { id: "douban", name: "豆瓣", searchUrl: "https://www.douban.com/search?q=", key: "q", test: /douban\.com\/search/i },
  { id: "wechat", name: "微信", searchUrl: "https://weixin.sogou.com/weixin?type=2&s_from=input&query=", key: "query", test: /weixin\.sogou\.com\/weixin/i },
  { id: "zhihu", name: "知乎", searchUrl: "https://www.zhihu.com/search?q=", key: "q", test: /zhihu\.com\/search/i },
  { id: "duckduckgo", name: "DuckDuckGo", searchUrl: "https://duckduckgo.com/?q=", key: "q", test: /duckduckgo\.com\/\?q=/i }
];

const COMMON_KEYS = ["q", "keyword", "query", "s", "wd", "search"];

/* ================== 用户数据 ================== */
let USER_ENGINES = GM_getValue("user_engines", []);
let HIDDEN_BUILTIN = GM_getValue("hidden_builtin", []);

const getAllEngines = () => [
  ...BUILTIN_ENGINES.filter(e => !HIDDEN_BUILTIN.includes(e.id)),
  ...USER_ENGINES
];

/* ================== 工具函数 ================== */
function getKeywords(engine) {
  const params = new URLSearchParams(location.search);
  if (engine?.id === "douyin") {
    const m = location.pathname.match(/\/search\/([^/?]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }
  if (engine?.key && params.get(engine.key)) return params.get(engine.key);
  for (const k of COMMON_KEYS) {
    if (params.get(k)) return params.get(k);
  }
  return "";
}

function getCurrentEngine() {
  let engine = BUILTIN_ENGINES.find(e => e.test?.test(location.href));
  if (engine) return engine;

  engine = USER_ENGINES.find(e => {
    try { return e.test?.test(location.href); } catch { return false; }
  });
  if (engine) return engine;

  const params = new URLSearchParams(location.search);
  const key = COMMON_KEYS.find(k => params.has(k));
  if (key) return { id: "__site__", name: "站内搜索", key, searchUrl: "" };

  return { id: "__unknown__", name: "未识别搜索引擎", key: "", searchUrl: "" };
}

function isGenericSearchPage() {
  return new URLSearchParams(location.search).has("s");
}

function whenDomReady(fn) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    requestAnimationFrame(fn);
  } else {
    document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(fn), { once: true });
  }
}

/* ================== 添加搜索引擎 ================== */
function openAddEngine(defaultData = {}) {
  const mask = document.createElement("div");
  mask.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  const dialog = document.createElement("div");
  dialog.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 12px;
    width: 480px;
    max-width: 92%;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    font-family: system-ui, sans-serif;
  `;
  dialog.innerHTML = `
    <h3 style="margin:0 0 20px;">添加新搜索引擎</h3>
    <label style="display:block; margin-bottom:8px; font-weight:600;">搜索引擎名称</label>
    <input id="eng-name" type="text" placeholder="例如：哔哩哔哩" style="width:100%; padding:10px; margin-bottom:20px; box-sizing:border-box;" value="${defaultData.name || ''}">
    <label style="display:block; margin-bottom:8px; font-weight:600;">搜索链接模板（必须包含 {query}）</label>
    <div style="margin-bottom:8px; color:#555; font-size:13px; line-height:1.5;">
      示例：<br>
      • https://search.bilibili.com/all?keyword={query}<br>
      • https://www.google.com/search?q={query}<br>
      • https://www.baidu.com/s?wd={query}<br>
      • https://blog.mingdao.com/?s={query}
    </div>
    <input id="eng-url" type="text" placeholder="https://search.bilibili.com/all?keyword={query}" style="width:100%; padding:10px; font-family:monospace; box-sizing:border-box;" value="${defaultData.url || ''}">
    <div style="margin-top:24px; text-align:right;">
      <button id="btn-cancel" style="padding:8px 20px; margin-right:12px; background:#f0f0f0; border:none; border-radius:6px; cursor:pointer;">取消</button>
      <button id="btn-save" style="padding:8px 24px; background:#4da3ff; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:500;">保存</button>
    </div>
  `;
  mask.appendChild(dialog);
  document.body.appendChild(mask);

  const nameInput = dialog.querySelector("#eng-name");
  const urlInput = dialog.querySelector("#eng-url");
  const btnCancel = dialog.querySelector("#btn-cancel");
  const btnSave = dialog.querySelector("#btn-save");

  btnCancel.onclick = () => mask.remove();

  btnSave.onclick = () => {
    const name = nameInput.value.trim();
    let template = urlInput.value.trim();

    if (!name) { alert("请输入搜索引擎名称"); return; }
    if (!template) { alert("请输入搜索链接模板"); return; }
    if (!template.includes("{query}")) { alert("链接模板必须包含 {query} 作为关键词占位符"); return; }

    const searchUrl = template.replace("{query}", "");
    const domainMatch = searchUrl.match(/https?:\/\/([^/?#]+)/i);
    const regStr = domainMatch ? domainMatch[1].replace(/\./g, '\\.') + '[\\/]?' : '.*';

    USER_ENGINES.push({
      id: "user_" + Date.now(),
      name: name,
      searchUrl: searchUrl,
      key: "",
      test: new RegExp(regStr, "i")
    });

    GM_setValue("user_engines", USER_ENGINES);
    mask.remove();
    location.reload();
  };

  nameInput.focus();
}

/* ================== UI 渲染 ================== */
function render() {
  const current = getCurrentEngine();
  const keywords = getKeywords(current);

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.zIndex = "2147483647";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      .box { position: fixed; top: 140px; left: 0; width: 190px; background: #fff; border-radius: 0 14px 14px 0; box-shadow: 0 8px 20px rgba(0,0,0,.18); font: 13px system-ui; transition: transform .25s; }
      .box.collapsed { transform: translateX(-155px); }
      .title { padding: 10px 14px; font-weight: 600; border-bottom: 1px solid #eee; display:flex; justify-content:space-between; align-items:center; }
      a { display: block; padding: 7px 14px; color: #333; text-decoration: none; }
      a.active { color: #4da3ff; font-weight: 600; }
      .action { padding: 8px 14px; cursor: pointer; color: #666; border-top: 1px solid #eee; }
      .gear { cursor:pointer; }
    </style>
    <div class="box" id="box">
      <div class="title">搜索引擎 <span class="gear" id="gear">⚙️</span></div>
      ${getAllEngines().map(e => `
        <a class="${current.id === e.id ? "active" : ""}"
           href="${e.searchUrl ? e.searchUrl + encodeURIComponent(keywords) : "#"}">
          ${e.name}
        </a>
      `).join("")}
      <div class="action" id="add-current">➕ 添加当前页面</div>
    </div>
  `;

  const box = shadow.getElementById("box");
  let timer;
  const collapse = () => timer = setTimeout(() => box.classList.add("collapsed"), 1000);
  const expand = () => { clearTimeout(timer); box.classList.remove("collapsed"); };
  box.addEventListener("mouseenter", expand);
  box.addEventListener("mouseleave", collapse);
  collapse();

  shadow.getElementById("gear").onclick = openManager;

  shadow.getElementById("add-current").onclick = () => {
    const params = new URLSearchParams(location.search);
    const searchKey = COMMON_KEYS.find(k => params.has(k));

    let urlTemplate = location.origin + location.pathname;

    if (searchKey) {
      // 只保留第一个搜索参数，后面全部丢弃
      urlTemplate += "?" + searchKey + "={query}";
    } else {
      urlTemplate += "?q={query}";
    }

    // 改进名称自动填充逻辑
    let suggestedName = "自定义搜索引擎";

    // 优先级1：如果当前页面已被识别为某个引擎，使用该引擎的名称
    if (current.id !== "__site__" && current.id !== "__unknown__") {
      suggestedName = current.name;
    }
    // 优先级2：尝试从标题中提取站点名（取最后一个看起来像品牌的部分）
    else if (document.title) {
      const titleParts = document.title.split(/[-|–—|·|｜]/);
      for (let i = titleParts.length - 1; i >= 0; i--) {
        const part = titleParts[i].trim();
        if (part && part.length > 2 && !/\d{4}/.test(part) && !/搜索|search/i.test(part)) {
          suggestedName = part;
          break;
        }
      }
    }
    // 优先级3：fallback 到域名（去掉 www. 并首字母大写）
    if (suggestedName === "自定义搜索引擎") {
      const domain = location.hostname.replace(/^www\./, '');
      suggestedName = domain.charAt(0).toUpperCase() + domain.slice(1).split('.')[0];
    }

    openAddEngine({ name: suggestedName, url: urlTemplate });
  };
}

/* ================== 管理面板 ================== */
function openManager() {
  const mask = document.createElement("div");
  mask.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2147483647;display:flex;align-items:center;justify-content:center;`;
  const panel = document.createElement("div");
  panel.style.cssText = `background:#fff;width:460px;max-height:80vh;overflow-y:auto;border-radius:10px;padding:20px;font:13px system-ui;box-shadow:0 10px 30px rgba(0,0,0,0.25);`;
  let html = `<h3 style="margin:0 0 16px;">搜索引擎管理</h3><hr style="margin:12px 0;"><div style="margin-bottom:20px;"><strong>内置搜索引擎（可隐藏）</strong></div>`;
  BUILTIN_ENGINES.forEach(e => {
    const checked = !HIDDEN_BUILTIN.includes(e.id);
    html += `<div style="margin:8px 0;"><label style="user-select:none; cursor:pointer;"><input type="checkbox" ${checked ? 'checked' : ''} data-id="${e.id}">${e.name}</label></div>`;
  });
  html += `<hr style="margin:20px 0 12px;"><div style="margin-bottom:16px;"><strong>自定义搜索引擎（可删除）</strong></div>`;
  if (USER_ENGINES.length === 0) html += `<div style="color:#888; font-style:italic;">暂无自定义搜索引擎</div>`;
  else USER_ENGINES.forEach((e, index) => {
    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin:10px 0; padding:6px 10px; background:#f9f9f9; border-radius:6px;">
      <span>${e.name}</span>
      <button class="delete-btn" data-index="${index}" style="background:#ff4d4f; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:12px;">删除</button>
    </div>`;
  });
  html += `<hr style="margin:20px 0;"><div style="text-align:right;"><button id="close-btn" style="padding:8px 16px; background:#eee; border:none; border-radius:6px; cursor:pointer; margin-right:12px;">关闭</button></div>`;
  panel.innerHTML = html;
  mask.appendChild(panel);
  document.body.appendChild(mask);

  panel.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.id;
      if (cb.checked) HIDDEN_BUILTIN = HIDDEN_BUILTIN.filter(x => x !== id);
      else if (!HIDDEN_BUILTIN.includes(id)) HIDDEN_BUILTIN.push(id);
      GM_setValue("hidden_builtin", HIDDEN_BUILTIN);
      location.reload();
    });
  });

  panel.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      const engineName = USER_ENGINES[index].name;
      if (confirm(`确定要删除自定义搜索引擎「${engineName}」吗？\n\n点击确定后将自动刷新页面。`)) {
        USER_ENGINES.splice(index, 1);
        GM_setValue("user_engines", USER_ENGINES);
        mask.remove();
        location.reload();
      }
    });
  });

  panel.querySelector("#close-btn").onclick = () => mask.remove();
  mask.onclick = e => { if (e.target === mask) mask.remove(); };
}

/* ================== 启动 ================== */
whenDomReady(render);// ==UserScript==
// @name        New script
// @namespace   Violentmonkey Scripts
// @match       *://example.org/*
// @grant       none
// @version     1.0
// @author      -
// @description 2026/1/30 21:17:27
// ==/UserScript==



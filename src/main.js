import "./style.css";
import {
  MessageCircle,
  UserRound,
  FolderOpen,
  Send,
  Mic,
  Upload,
  Check,
  Trash2,
  Quote,
  Menu,
  X,
} from "lucide";
const icons = {
    MessageCircle,
    UserRound,
    FolderOpen,
    Send,
    Mic,
    Upload,
    Check,
    Trash2,
    Quote,
    Menu,
    X,
  },
  attrs = (o) =>
    Object.entries(o)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" "),
  node = ([t, a, c = []]) => `<${t} ${attrs(a)}>${c.map(node).join("")}</${t}>`,
  icon = (n, s = 18) => {
    const [t, a, c] = icons[n];
    return node([
      t,
      { ...a, width: s, height: s, "stroke-width": 1.8, "aria-hidden": true },
      c,
    ]);
  };
let state = { messages: [], observations: [], facts: [], documents: [] },
  view = "chat",
  sending = false;
let recognition = null,
  listening = false;
const $ = (id) => document.getElementById(id),
  esc = (s) =>
    String(s || "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
document.querySelector("#app").innerHTML =
  `<div class="shell"><aside><div class="brand"><b>知</b><span><strong>知我</strong><small>PRIVATE AI MIRROR</small></span></div><nav><button data-view="chat">${icon("MessageCircle")}<span>对话</span></button><button data-view="insights">${icon("UserRound")}<span>关于我</span><i id="insight-count">0</i></button><button data-view="profile">${icon("FolderOpen")}<span>个人资料</span><i id="fact-count">0</i></button></nav><div class="privacy">数据保存在这台电脑<br><span id="connection">检查 AI 连接中</span></div></aside><main><header><button id="menu" aria-label="打开导航">${icon("Menu")}</button><div><small id="eyebrow">CONVERSATION</small><h1 id="title">和自己聊一会儿</h1></div></header><div id="content"></div></main><div class="mobile-nav"><button data-view="chat">${icon("MessageCircle")}<span>对话</span></button><button data-view="insights">${icon("UserRound")}<span>关于我</span></button><button data-view="profile">${icon("FolderOpen")}<span>资料</span></button></div></div><button class="toast" id="toast" type="button"></button>`;
async function load() {
  state = await fetch("/api/state").then((r) => r.json());
  render();
}
function fmt(s) {
  return esc(s).replace(/\n/g, "<br>");
}
function nav() {
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("insight-count").textContent = state.observations.length;
  $("fact-count").textContent = state.facts.length;
}
function render() {
  nav();
  if (view === "chat") chat();
  if (view === "insights") insights();
  if (view === "profile") profile();
}
function chat() {
  $("eyebrow").textContent = "CONVERSATION";
  $("title").textContent = "和自己聊一会儿";
  $("content").innerHTML =
    `<section class="chat"><div class="messages">${state.messages.length ? state.messages.map((m) => `<article class="message ${m.role}"><span>${m.role === "user" ? "你" : "知我"}</span><div>${fmt(m.content)}</div></article>`).join("") : `<div class="empty"><b>从一句真实的话开始</b><p>可以说说你正在做的事、最近在意的问题，或一个反复出现的想法。你的原话会成为分析依据。</p></div>`}</div><form id="chat-form"><textarea id="chat-input" rows="1" enterkeyhint="send" placeholder="记录想法或提出问题" maxlength="10000"></textarea><button class="voice-button${listening ? " listening" : ""}" id="voice-button" aria-label="${listening ? "停止语音输入" : "语音输入"}" type="button">${icon("Mic")}</button><button aria-label="发送" type="submit" ${sending ? "disabled" : ""}>${icon("Send")}</button></form><p class="note">AI 观察仅用于自我了解，不构成心理或医疗诊断。</p></section>`;
  const box = document.querySelector(".messages");
  box.scrollTop = box.scrollHeight;
  $("chat-form").onsubmit = sendChat;
  $("voice-button").onclick = toggleVoice;
  $("chat-input").onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      e.currentTarget.form.requestSubmit();
    }
  };
}
function toggleVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast([], "当前浏览器不支持语音输入，请使用最新版 Safari 或 Chrome");
    return;
  }
  if (listening) {
    recognition?.stop();
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = false;
  const input = $("chat-input");
  const base = input.value.trim();
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results).map((r) => r[0].transcript).join("");
    input.value = base ? `${base} ${transcript}` : transcript;
  };
  recognition.onstart = () => { listening = true; chat(); $("chat-input")?.focus(); };
  recognition.onend = () => { listening = false; if ($("voice-button")) chat(); };
  recognition.onerror = () => { listening = false; showToast([], "语音输入未完成，请检查麦克风权限"); chat(); };
  recognition.start();
}
async function sendChat(e) {
  e.preventDefault();
  const input = $("chat-input"),
    text = input.value.trim();
  if (!text || sending) return;
  sending = true;
  state.messages.push({ role: "user", content: text });
  render();
  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) throw new Error((await r.json()).error);
    const reader = r.body.getReader(),
      decoder = new TextDecoder();
    let answer = "",
      buffer = "",
      memory = null;
    state.messages.push({ role: "assistant", content: "" });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines)
        if (line.startsWith("data:") && !line.includes("[DONE]"))
          try {
            const data = JSON.parse(line.slice(5));
            if (data.memory) memory = data.memory;
            else answer += data.choices?.[0]?.delta?.content || "";
          } catch {}
      state.messages.at(-1).content = answer;
      chat();
    }
    await load();
    if (memory?.facts?.length) showToast(memory.facts);
    else if (memory?.observations) showToast([], memory.observations);
  } catch (err) {
    state.messages.push({
      role: "assistant",
      content: `请求失败：${err.message}`,
    });
  } finally {
    sending = false;
    render();
  }
}
function showToast(facts, observations = 0) {
  const toast = $("toast");
  if (facts.length) {
    const first = facts[0];
    toast.innerHTML = `${icon("Check", 16)}<span>已归入个人资料：<b>${esc(first.label)}</b>${facts.length > 1 ? ` 等 ${facts.length} 条` : ""}</span>`;
    toast.onclick = () => {
      view = "profile";
      render();
      toast.classList.remove("show");
    };
  } else {
    toast.innerHTML = `${icon("Check", 16)}<span>已从原话中整理 ${observations} 条观察</span>`;
    toast.onclick = () => {
      view = "insights";
      render();
      toast.classList.remove("show");
    };
  }
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 5000);
}
function insights() {
  $("eyebrow").textContent = "OBSERVATIONS";
  $("title").textContent = "从你的原话里看见你";
  $("content").innerHTML =
    `<section class="page intro"><p>这些是 AI 根据你的表达形成的观察，不是确定结论。确认代表“这符合我”，删除代表“不要这样理解我”。</p></section><section class="list">${state.observations.length ? state.observations.map((o) => `<article class="observation"><div class="meta"><span>${esc(o.category)}</span><i class="confidence ${o.confidence}">可信度 ${esc(o.confidence)}</i>${o.status === "confirmed" ? "<b>已确认</b>" : ""}</div><h2>${esc(o.claim)}</h2><blockquote>${icon("Quote", 15)}<span>${esc(o.evidence)}</span></blockquote><footer><time>${new Date(o.createdAt).toLocaleDateString()}</time><button data-confirm="${o.id}">${icon("Check", 15)} 符合我</button><button data-delete-observation="${o.id}">${icon("Trash2", 15)} 删除</button></footer></article>`).join("") : `<div class="empty"><b>还没有形成观察</b><p>在对话中多说一些真实想法，AI 会逐步整理有长期价值的线索。</p></div>`}</section>`;
  bindActions();
}
function profile() {
  $("eyebrow").textContent = "PERSONAL ARCHIVE";
  $("title").textContent = "个人历史档案";
  const order = [
    "基本信息",
    "联系方式",
    "教育经历",
    "工作经历",
    "项目经历",
    "技能",
    "重要事件",
    "人物关系",
    "目标",
    "其他资料",
  ];
  const groups = order
    .map((category) => ({
      category,
      items: state.facts.filter((f) => f.category === category),
    }))
    .filter((group) => group.items.length);
  const archive = groups
    .map(
      (group) =>
        `<section class="archive-group"><div class="archive-title"><h2>${esc(group.category)}</h2><span>${group.items.length} 条</span></div>${group.items
          .map(
            (f) =>
              `<article class="fact"><div><small>${esc(f.label)}</small><strong>${esc(f.value)}</strong><em>来源：${esc((f.sources || [f.sourceName]).filter(Boolean).join("、"))}</em></div><button data-confirm-fact="${f.id}" class="${f.confirmed ? "confirmed" : ""}" title="${f.confirmed ? "已确认" : "确认事实"}">${icon("Check", 16)}</button><button data-delete-fact="${f.id}" title="删除">${icon("Trash2", 16)}</button></article>`,
          )
          .join("")}</section>`,
    )
    .join("");
  $("content").innerHTML =
    `<section class="import"><div><h2>添加一份资料</h2><p>粘贴文字，或上传 TXT、Markdown、JSON、CSV、PDF、DOCX。系统会按固定档案章节整理，并合并重复内容。</p></div><form id="document-form"><input id="doc-file" type="file" accept=".txt,.md,.json,.csv,.pdf,.docx"><textarea id="doc-text" rows="5" placeholder="也可以直接粘贴简历、经历或其他个人资料"></textarea><button>${icon("Upload", 16)} 整理资料</button><span id="upload-state"></span></form></section><section class="facts"><div class="section-head"><h2>档案目录</h2><span>${state.facts.length} 条去重资料</span></div>${archive || `<div class="empty"><b>还没有个人资料</b><p>添加资料后，AI 会按固定章节整理为可确认的事实条目。</p></div>`}</section>`;
  $("document-form").onsubmit = uploadDoc;
  bindActions();
}
async function uploadDoc(e) {
  e.preventDefault();
  const fd = new FormData(),
    file = $("doc-file").files[0],
    text = $("doc-text").value.trim();
  if (file) fd.append("file", file);
  if (text) fd.append("text", text);
  if (!file && !text) return;
  $("upload-state").textContent = "正在整理…";
  const r = await fetch("/api/documents", { method: "POST", body: fd });
  if (!r.ok) {
    $("upload-state").textContent = (await r.json()).error;
    return;
  }
  state = await r.json();
  render();
}
function bindActions() {
  document
    .querySelectorAll("[data-confirm]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          patch("observations", b.dataset.confirm, { status: "confirmed" })),
    );
  document
    .querySelectorAll("[data-delete-observation]")
    .forEach(
      (b) =>
        (b.onclick = () => del("observations", b.dataset.deleteObservation)),
    );
  document
    .querySelectorAll("[data-confirm-fact]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          patch("facts", b.dataset.confirmFact, { confirmed: true })),
    );
  document
    .querySelectorAll("[data-delete-fact]")
    .forEach((b) => (b.onclick = () => del("facts", b.dataset.deleteFact)));
}
async function patch(type, id, body) {
  state = await fetch(`/api/${type}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
  render();
}
async function del(type, id) {
  if (!confirm("确认删除这条内容？")) return;
  state = await fetch(`/api/${type}/${id}`, { method: "DELETE" }).then((r) =>
    r.json(),
  );
  render();
}
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      view = b.dataset.view;
      render();
    }),
);
fetch("/api/health")
  .then((r) => r.json())
  .then(
    (d) =>
      ($("connection").textContent = d.configured
        ? "AI 已连接"
        : "AI 尚未配置"),
  )
  .catch(() => ($("connection").textContent = "服务未连接"));
load();

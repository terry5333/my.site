import "./styles.css";
import { db, auth, googleProvider } from "./firebase";

import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc,
  increment
} from "firebase/firestore";

import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || "";
const $ = (s) => document.querySelector(s);

/** ===== Gate (Turnstile) ===== */
const gate = $("#gate");
const gateMsg = $("#gateMsg");
let gatePassed = false;

function unlockSite() {
  gatePassed = true;
  gate?.classList.add("is-hidden");
}
function lockSite(msg = "") {
  gatePassed = false;
  gate?.classList.remove("is-hidden");
  if (gateMsg) gateMsg.textContent = msg;
}

// Turnstile needs global functions
function onTurnstileSuccess() { unlockSite(); }
function onTurnstileExpired() { lockSite("驗證已過期，請重新驗證。"); }
function onTurnstileError() { lockSite("驗證發生錯誤，請重整頁面或稍後再試。"); }

window.onTurnstileSuccess = onTurnstileSuccess;
window.onTurnstileExpired = onTurnstileExpired;
window.onTurnstileError = onTurnstileError;

lockSite("");

/** ===== DOM ===== */
const btnLogin = $("#btnLogin");
const btnLogout = $("#btnLogout");
const btnAdd = $("#btnAdd");
const btnEditProfile = $("#btnEditProfile");
const authHint = $("#authHint");

const projectCount = $("#projectCount");
const lastUpdated = $("#lastUpdated");

const searchInput = $("#search");
const sortSelect = $("#sort");
const routeRoot = $("#routeRoot");
const listToolbar = $("#listToolbar");

const modalProject = $("#modalProject");
const projectForm = $("#projectForm");
const modalTitle = $("#modalTitle");
const btnCloseProject = $("#btnCloseProject");
const btnCancelProject = $("#btnCancelProject");

const modalProfile = $("#modalProfile");
const profileForm = $("#profileForm");
const btnCloseProfile = $("#btnCloseProfile");
const btnCancelProfile = $("#btnCancelProfile");

const nameEl = $("#name");
const taglineEl = $("#tagline");
const aboutEl = $("#aboutText");
const socialList = $("#socialList");
const pageTitle = $("#pageTitle");
const pageHint = $("#pageHint");

/** ===== State ===== */
let isAdmin = false;
let projects = [];
let profile = {
  name: "我的作品集",
  tagline: "LINE Bot / 校園系統 / 各種快速原型與自動化。",
  about:
    "我是一位工程師，習慣用 vibe coding 把想法快速做成可用系統。\n擅長從需求拆解、資料流設計到前後端串接，並善用 AI prompt 加速迭代。",
  github: "",
  linkedin: "",
  instagram: "",
  email: "",
};

let loadingProjects = true;

/** ===== Helpers ===== */
function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultThumb(title = "Project") {
  const t = encodeURIComponent(title.slice(0, 24));
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#cf9893" stop-opacity="0.75"/>
        <stop offset="0.5" stop-color="#a96da3" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#3b3b58" stop-opacity="0.95"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#g)"/>
    <circle cx="220" cy="160" r="180" fill="#bc7c9c" fill-opacity="0.25"/>
    <circle cx="1040" cy="560" r="240" fill="#7a5980" fill-opacity="0.22"/>
    <text x="70" y="560" font-family="ui-sans-serif,system-ui" font-size="64" fill="rgba(255,255,255,0.92)">${t}</text>
    <text x="70" y="630" font-family="ui-sans-serif,system-ui" font-size="28" fill="rgba(255,255,255,0.70)">Portfolio</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function setMeta({ title, description }) {
  document.title = title || "工程師作品集";
  const d = document.querySelector('meta[name="description"]');
  if (d && description) d.setAttribute("content", description);

  const ogt = document.querySelector('meta[property="og:title"]');
  const ogd = document.querySelector('meta[property="og:description"]');
  const twt = document.querySelector('meta[name="twitter:title"]');
  const twd = document.querySelector('meta[name="twitter:description"]');

  if (ogt && title) ogt.setAttribute("content", title);
  if (twt && title) twt.setAttribute("content", title);
  if (ogd && description) ogd.setAttribute("content", description);
  if (twd && description) twd.setAttribute("content", description);
}

function navigate(hash) {
  window.location.hash = hash;
}

function getRoute() {
  const h = window.location.hash || "#/";
  // #/project/<id>
  const m = h.match(/^#\/project\/(.+)$/);
  if (m) return { name: "project", id: m[1] };
  return { name: "home" };
}

function renderSkeleton() {
  routeRoot.innerHTML = `
    <div class="skeleton-grid">
      ${Array.from({ length: 6 }).map(() => `<div class="skeleton"></div>`).join("")}
    </div>
  `;
}

/** ===== Auth ===== */
btnLogin.addEventListener("click", async () => {
  if (!gatePassed) return;
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error(err);
    alert(`登入失敗：${err.code || err.message}`);
  }
});

btnLogout.addEventListener("click", async () => {
  if (!gatePassed) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
    alert(`登出失敗：${err.code || err.message}`);
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) isAdmin = false;
  else isAdmin = ADMIN_UID ? user.uid === ADMIN_UID : true;

  btnLogin.hidden = !!user;
  btnLogout.hidden = !user;

  btnAdd.hidden = !isAdmin;
  btnEditProfile.hidden = !isAdmin;

  authHint.textContent = isAdmin
    ? `管理員模式：你已登入，可新增/編輯/刪除（UID：${user.uid.slice(0, 8)}...)`
    : (user ? "你已登入，但不是管理員（只能瀏覽）。" : "訪客模式：只能瀏覽。登入後可新增/編輯/刪除。");

  renderRoute();
});

/** ===== Firestore refs ===== */
const projectsCol = collection(db, "projects");
const profileDocRef = doc(db, "site", "profile");

/** ===== Ensure profile doc exists ===== */
(async function ensureProfileDoc() {
  try {
    const snap = await getDoc(profileDocRef);
    if (!snap.exists()) {
      await setDoc(profileDocRef, { ...profile, updatedAt: serverTimestamp() });
    }
  } catch (err) {
    console.error(err);
  }
})();

/** ===== Profile listener ===== */
onSnapshot(profileDocRef, (snap) => {
  if (!snap.exists()) return;
  profile = { ...profile, ...snap.data() };
  renderProfile(profile);
}, (err) => console.error(err));

function renderProfile(p) {
  nameEl.textContent = p.name || "我的作品集";
  taglineEl.textContent = p.tagline || "";
  aboutEl.textContent = p.about || "";

  const items = [
    ["GitHub", p.github],
    ["LinkedIn", p.linkedin],
    ["Instagram", p.instagram],
    ["Email", p.email ? `mailto:${p.email}` : ""],
  ].filter(([, v]) => !!v);

  if (!items.length) {
    socialList.innerHTML = `<div class="muted">尚未設定社群連結。</div>`;
    return;
  }

  socialList.innerHTML = items.map(([label, url]) => `
    <div class="social-item">
      <div class="muted">${escapeHtml(label)}</div>
      <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">前往</a>
    </div>
  `).join("");
}

/** ===== Edit profile ===== */
btnEditProfile.addEventListener("click", () => {
  if (!gatePassed) return;
  if (!isAdmin) return;

  profileForm.name.value = profile.name || "";
  profileForm.tagline.value = profile.tagline || "";
  profileForm.about.value = profile.about || "";
  profileForm.github.value = profile.github || "";
  profileForm.linkedin.value = profile.linkedin || "";
  profileForm.instagram.value = profile.instagram || "";
  profileForm.email.value = profile.email || "";

  modalProfile.showModal();
});

btnCloseProfile.addEventListener("click", () => modalProfile.close());
btnCancelProfile.addEventListener("click", () => modalProfile.close());

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!gatePassed) return;
  if (!isAdmin) return;

  try {
    await setDoc(profileDocRef, {
      name: profileForm.name.value.trim(),
      tagline: profileForm.tagline.value.trim(),
      about: profileForm.about.value.trim(),
      github: profileForm.github.value.trim(),
      linkedin: profileForm.linkedin.value.trim(),
      instagram: profileForm.instagram.value.trim(),
      email: profileForm.email.value.trim(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    modalProfile.close();
  } catch (err) {
    console.error(err);
    alert(`儲存個人資料失敗：${err.code || err.message}`);
  }
});

/** ===== Projects listener ===== */
const q = query(projectsCol, orderBy("updatedAt", "desc"));
renderSkeleton();

onSnapshot(q, (snap) => {
  loadingProjects = false;
  projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  updateStats(projects);
  renderRoute();
}, (err) => {
  console.error(err);
  loadingProjects = false;
  routeRoot.innerHTML = `<div class="empty">
    <div class="title">讀取作品失敗</div>
    <div class="desc">${escapeHtml(err.code || err.message)}</div>
  </div>`;
});

/** ===== Project modal ===== */
btnCloseProject.addEventListener("click", () => modalProject.close());
btnCancelProject.addEventListener("click", () => modalProject.close());

btnAdd.addEventListener("click", () => {
  if (!gatePassed) return;
  if (!isAdmin) return;

  modalTitle.textContent = "新增作品";
  projectForm.reset();
  projectForm.id.value = "";
  modalProject.showModal();
});

projectForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!gatePassed) return;
  if (!isAdmin) return;

  const id = projectForm.id.value.trim();
  const title = projectForm.title.value.trim();
  const url = projectForm.url.value.trim();
  const description = projectForm.description.value.trim();
  const prompt = projectForm.prompt.value.trim();
  const thumb = projectForm.thumb.value.trim() || defaultThumb(title);

  try {
    if (!id) {
      await addDoc(projectsCol, {
        title, url, description, prompt, thumb,
        views: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, "projects", id), {
        title, url, description, prompt, thumb,
        updatedAt: serverTimestamp(),
      });
    }
    modalProject.close();
  } catch (err) {
    console.error(err);
    alert(`儲存作品失敗：${err.code || err.message}`);
  }
});

/** ===== Search/sort ===== */
function getFilteredSorted() {
  const term = (searchInput?.value || "").trim().toLowerCase();
  let list = [...projects];

  if (term) {
    list = list.filter((p) =>
      (p.title || "").toLowerCase().includes(term) ||
      (p.description || "").toLowerCase().includes(term) ||
      (p.prompt || "").toLowerCase().includes(term)
    );
  }

  const sort = sortSelect?.value || "updated_desc";
  if (sort === "updated_asc") {
    list.sort((a, b) => (a.updatedAt?.seconds || 0) - (b.updatedAt?.seconds || 0));
  } else if (sort === "name_asc") {
    list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else if (sort === "name_desc") {
    list.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
  } else {
    list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  }
  return list;
}

searchInput?.addEventListener("input", () => renderRoute());
sortSelect?.addEventListener("change", () => renderRoute());

/** ===== Routing ===== */
window.addEventListener("hashchange", () => renderRoute());

function renderRoute() {
  const r = getRoute();

  if (r.name === "home") {
    pageTitle.textContent = "作品列表";
    pageHint.textContent = "提示：點作品卡片可進入詳細頁；縮圖可用圖片網址。";
    listToolbar.style.display = "";
    setMeta({
      title: `${profile.name || "工程師作品集"}`,
      description: profile.tagline || "作品集網站"
    });

    if (loadingProjects) return renderSkeleton();
    return renderProjects(getFilteredSorted());
  }

  if (r.name === "project") {
    listToolbar.style.display = "none";
    return renderProjectDetail(r.id);
  }
}

function renderProjects(list) {
  if (!list.length) {
    routeRoot.innerHTML = `<div class="empty">
      <div class="title">目前沒有作品</div>
      <div class="desc">${isAdmin ? "點右上角新增一個作品吧。" : "等待管理員新增作品後就會出現。"}</div>
    </div>`;
    return;
  }

  routeRoot.innerHTML = `
    <div class="grid" id="projectGrid">
      ${list.map((p, i) => {
        const thumb = p.thumb || defaultThumb(p.title || "Project");
        const updated = p.updatedAt ? fmtDate(p.updatedAt) : "—";
        const delay = Math.min(i * 60, 360);
        return `
          <div class="project" data-id="${p.id}" style="animation-delay:${delay}ms">
            <div class="thumb"><img src="${thumb}" alt="${escapeHtml(p.title || "")}"></div>
            <h3>${escapeHtml(p.title || "")}</h3>
            <div class="muted" style="font-size:13px; line-height:1.5;">
              ${p.description ? escapeHtml(p.description) : "（尚未填寫作品介紹）"}
            </div>
            <div class="meta">
              <div class="chip">更新：${escapeHtml(updated)}</div>
              ${isAdmin ? `<div class="chip">👁 ${Number(p.views || 0)}</div>` : ``}
              ${isAdmin ? `
                <div class="actions">
                  <button class="link-btn" data-act="edit" data-id="${p.id}">編輯</button>
                  <button class="link-btn" data-act="del" data-id="${p.id}">刪除</button>
                </div>
              ` : `<div></div>`}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  const grid = routeRoot.querySelector("#projectGrid");

  // 點卡片進詳細頁（但點編輯/刪除不跳）
  grid.querySelectorAll(".project").forEach((card) => {
    card.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn) return;
      navigate(`#/project/${card.dataset.id}`);
    });
  });

  // 編輯/刪除
  grid.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!gatePassed) return;
      if (!isAdmin) return;

      const act = btn.dataset.act;
      const id = btn.dataset.id;
      const item = projects.find((x) => x.id === id);
      if (!item) return;

      if (act === "edit") {
        modalTitle.textContent = "編輯作品";
        projectForm.id.value = item.id;
        projectForm.title.value = item.title || "";
        projectForm.url.value = item.url || "";
        projectForm.description.value = item.description || "";
        projectForm.prompt.value = item.prompt || "";
        projectForm.thumb.value = (item.thumb && !String(item.thumb).startsWith("data:image")) ? item.thumb : "";
        modalProject.showModal();
      }

      if (act === "del") {
        const ok = confirm(`確定要刪除「${item.title || "這個作品"}」？`);
        if (!ok) return;
        try {
          await deleteDoc(doc(db, "projects", id));
        } catch (err) {
          console.error(err);
          alert(`刪除失敗：${err.code || err.message}`);
        }
      }
    });
  });
}

function renderProjectDetail(id) {
  const p = projects.find((x) => x.id === id);
  pageTitle.textContent = "作品詳細";
  pageHint.textContent = "提示：可分享此頁面網址（hash route）。";

  if (!p) {
    routeRoot.innerHTML = `<div class="empty">
      <div class="title">找不到作品</div>
      <div class="desc">可能作品已刪除或尚未載入完成。</div>
      <div style="margin-top:10px;">
        <button class="btn ghost" id="backBtn">← 返回作品列表</button>
      </div>
    </div>`;
    routeRoot.querySelector("#backBtn")?.addEventListener("click", () => navigate("#/"));
    setMeta({ title: "找不到作品 - 工程師作品集", description: "作品不存在或已移除。" });
    return;
  }

  const title = p.title || "作品";
  const desc = (p.description || "").slice(0, 80) || "作品詳細介紹";
  setMeta({ title: `${title} - ${profile.name || "作品集"}`, description: desc });

  const thumb = p.thumb || defaultThumb(title);
  const updated = p.updatedAt ? fmtDate(p.updatedAt) : "—";
  const views = Number(p.views || 0);

  routeRoot.innerHTML = `
    <div class="detail">
      <div class="detail-card">
        <button class="btn ghost" id="backBtn">← 返回作品列表</button>

        <div class="detail-title">${escapeHtml(title)}</div>

        <div class="thumb" style="margin-top:10px;">
          <img src="${thumb}" alt="${escapeHtml(title)}" />
        </div>

        <div class="kv">
          <div class="chip">更新：${escapeHtml(updated)}</div>
          ${isAdmin ? `<div class="chip">👁 ${views}</div>` : ``}
        </div>

        <h3 style="margin-top:12px;">作品介紹</h3>
        <div class="muted" style="line-height:1.6;">
          ${p.description ? escapeHtml(p.description).replaceAll("\n","<br/>") : "（尚未填寫作品介紹）"}
        </div>

        <h3 style="margin-top:12px;">AI Prompt</h3>
        <div class="pre">${p.prompt ? escapeHtml(p.prompt) : "（尚未填寫 prompt）"}</div>
      </div>

      <div class="detail-card">
        <h3>快速操作</h3>

        <div style="display:grid; gap:10px; margin-top:10px;">
          <a class="btn" id="openLink" href="${escapeHtml(p.url || "")}" target="_blank" rel="noreferrer">🔗 開啟作品連結</a>
          <button class="btn ghost" id="copyLink">📎 複製此頁網址</button>
          ${isAdmin ? `<button class="btn ghost" id="editBtn">✏️ 編輯此作品</button>` : ``}
        </div>

        <div class="muted mini" style="margin-top:10px;">
          views 會在你點「開啟作品連結」時累加。
        </div>
      </div>
    </div>
  `;

  routeRoot.querySelector("#backBtn")?.addEventListener("click", () => navigate("#/"));

  routeRoot.querySelector("#copyLink")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("已複製！");
    } catch {
      alert("複製失敗（可能瀏覽器限制）");
    }
  });

  // 點外連 views+1（不擋跳轉）
  routeRoot.querySelector("#openLink")?.addEventListener("click", async () => {
    if (!gatePassed) return;
    try {
      await updateDoc(doc(db, "projects", id), { views: increment(1) });
    } catch (err) {
      console.error("views increment failed", err);
    }
  });

  // 管理員編輯
  routeRoot.querySelector("#editBtn")?.addEventListener("click", () => {
    if (!gatePassed) return;
    if (!isAdmin) return;

    modalTitle.textContent = "編輯作品";
    projectForm.id.value = p.id;
    projectForm.title.value = p.title || "";
    projectForm.url.value = p.url || "";
    projectForm.description.value = p.description || "";
    projectForm.prompt.value = p.prompt || "";
    projectForm.thumb.value = (p.thumb && !String(p.thumb).startsWith("data:image")) ? p.thumb : "";
    modalProject.showModal();
  });
}

function updateStats(list) {
  projectCount.textContent = String(list.length);

  let latest = null;
  for (const p of list) {
    if (!p.updatedAt) continue;
    if (!latest) latest = p.updatedAt;
    else if ((p.updatedAt.seconds || 0) > (latest.seconds || 0)) latest = p.updatedAt;
  }
  lastUpdated.textContent = latest ? fmtDate(latest) : "—";
}

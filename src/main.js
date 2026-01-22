import "./styles.css";
import { db, auth, googleProvider } from "./firebase";

import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc
} from "firebase/firestore";

import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || "";
const $ = (s) => document.querySelector(s);

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
const projectGrid = $("#projectGrid");

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

/** ===== Auth ===== */
btnLogin.addEventListener("click", async () => {
  await signInWithPopup(auth, googleProvider);
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
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

  renderProjects(getFilteredSorted());
});

/** ===== Firestore refs ===== */
const projectsCol = collection(db, "projects");
const profileDocRef = doc(db, "site", "profile");

/** ===== Ensure profile doc exists ===== */
async function ensureProfileDoc() {
  const snap = await getDoc(profileDocRef);
  if (!snap.exists()) {
    await setDoc(profileDocRef, {
      ...profile,
      updatedAt: serverTimestamp(),
    });
  }
}
ensureProfileDoc();

/** ===== Profile listener ===== */
onSnapshot(profileDocRef, (snap) => {
  if (!snap.exists()) return;
  profile = { ...profile, ...snap.data() };
  renderProfile(profile);
});

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

  socialList.innerHTML = items.map(([label, url]) => {
    const safeUrl = escapeHtml(url);
    return `
      <div class="social-item">
        <div class="muted">${label}</div>
        <a href="${safeUrl}" target="_blank" rel="noreferrer">前往</a>
      </div>
    `;
  }).join("");
}

/** ===== Edit profile ===== */
btnEditProfile.addEventListener("click", () => {
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
  if (!isAdmin) return;

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
});

/** ===== Projects listener ===== */
const q = query(projectsCol, orderBy("updatedAt", "desc"));
onSnapshot(q, (snap) => {
  projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderProjects(getFilteredSorted());
  updateStats(projects);
});

/** ===== Project modal close/cancel fix ===== */
btnCloseProject.addEventListener("click", () => modalProject.close());
btnCancelProject.addEventListener("click", () => modalProject.close());

/** ===== Add project ===== */
btnAdd.addEventListener("click", () => {
  if (!isAdmin) return;
  modalTitle.textContent = "新增作品";
  projectForm.reset();
  projectForm.id.value = "";
  modalProject.showModal();
});

/** ===== Submit create/edit ===== */
projectForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  const id = projectForm.id.value.trim();
  const title = projectForm.title.value.trim();
  const url = projectForm.url.value.trim();
  const description = projectForm.description.value.trim();
  const prompt = projectForm.prompt.value.trim();
  const thumb = projectForm.thumb.value.trim() || defaultThumb(title);

  if (!id) {
    await addDoc(projectsCol, {
      title, url, description, prompt, thumb,
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

searchInput?.addEventListener("input", () => renderProjects(getFilteredSorted()));
sortSelect?.addEventListener("change", () => renderProjects(getFilteredSorted()));

/** ===== Render projects ===== */
function renderProjects(list) {
  if (!list.length) {
    projectGrid.innerHTML = `<div class="muted">目前沒有作品，${isAdmin ? "點右上角新增一個吧。" : "等管理員新增作品後就會出現。"}</div>`;
    return;
  }

  projectGrid.innerHTML = list.map((p, i) => {
    const thumb = p.thumb || defaultThumb(p.title || "Project");
    const updated = p.updatedAt ? fmtDate(p.updatedAt) : "—";

    // ✅ 讓每張卡片 stagger 進場（動畫更多）
    const delay = Math.min(i * 60, 360);

    return `
      <div class="project" style="animation-delay:${delay}ms">
        <div class="thumb"><img src="${thumb}" alt="${escapeHtml(p.title || "")}"></div>

        <h3>${escapeHtml(p.title || "")}</h3>
        <div class="muted" style="font-size:13px; line-height:1.5;">
          ${p.description ? escapeHtml(p.description) : "（尚未填寫作品介紹）"}
        </div>

        <div style="margin-top:10px;">
          <a href="${escapeHtml(p.url || "")}" target="_blank" rel="noreferrer">🔗 開啟作品連結</a>
        </div>

        <details style="margin-top:10px;">
          <summary class="muted" style="cursor:pointer;">查看 AI Prompt</summary>
          <div class="muted" style="white-space:pre-wrap; margin-top:8px; font-size:13px; line-height:1.5;">
            ${p.prompt ? escapeHtml(p.prompt) : "（尚未填寫 prompt）"}
          </div>
        </details>

        <div class="meta">
          <div class="chip">更新：${escapeHtml(updated)}</div>

          ${isAdmin ? `
            <div class="actions">
              <button class="link-btn" data-act="edit" data-id="${p.id}">編輯</button>
              <button class="link-btn" data-act="del" data-id="${p.id}">刪除</button>
            </div>
          ` : `<div></div>`}
        </div>
      </div>
    `;
  }).join("");

  projectGrid.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
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
        await deleteDoc(doc(db, "projects", id));
      }
    });
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

import "./styles.css";
import { db, auth, googleProvider } from "./firebase";

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";

import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || "";

const btnLogin = document.querySelector("#btnLogin");
const btnLogout = document.querySelector("#btnLogout");
const btnAdd = document.querySelector("#btnAdd");
const grid = document.querySelector("#projectGrid");

const modal = document.querySelector("#modalProject");
const form = document.querySelector("#projectForm");
const modalTitle = document.querySelector("#modalTitle");
const btnCancel = document.querySelector("#btnCancel");

let isAdmin = false;
let projects = [];

/** ====== 小工具：預設縮圖（不用給圖也不難看） ====== */
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

function escapeHtml(s = "") {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** ====== Auth ====== */
btnLogin.addEventListener("click", async () => {
  await signInWithPopup(auth, googleProvider);
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (!user) isAdmin = false;
  else isAdmin = ADMIN_UID ? user.uid === ADMIN_UID : true; // 沒填 ADMIN_UID 就是所有登入者都能管理（不建議上線）

  btnLogin.hidden = !!user;
  btnLogout.hidden = !user;
  btnAdd.hidden = !isAdmin;

  render();
});

/** ====== Firestore ====== */
const colRef = collection(db, "projects");
const q = query(colRef, orderBy("updatedAt", "desc"));

onSnapshot(q, (snap) => {
  projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
});

/** ====== UI: Modal ====== */
btnAdd.addEventListener("click", () => {
  if (!isAdmin) return;
  modalTitle.textContent = "新增作品";
  form.reset();
  form.id.value = "";
  modal.showModal();
});

btnCancel.addEventListener("click", () => {
  modal.close();
});

/** ====== Create / Update ====== */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  const id = form.id.value.trim();
  const title = form.title.value.trim();
  const url = form.url.value.trim();
  const description = form.description.value.trim();
  const prompt = form.prompt.value.trim();

  // ✅ 只用圖片網址（沒填就用預設 SVG）
  const thumb = form.thumb.value.trim() || defaultThumb(title);

  if (!id) {
    await addDoc(colRef, {
      title,
      url,
      thumb,
      description,
      prompt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    await updateDoc(doc(db, "projects", id), {
      title,
      url,
      thumb,
      description,
      prompt,
      updatedAt: serverTimestamp()
    });
  }

  modal.close();
});

/** ====== Delete ====== */
window.delProject = async (id) => {
  if (!isAdmin) return;
  const ok = confirm("確定要刪除這個作品？");
  if (!ok) return;
  await deleteDoc(doc(db, "projects", id));
};

/** ====== Edit ====== */
window.editProject = (id) => {
  if (!isAdmin) return;
  const p = projects.find((x) => x.id === id);
  if (!p) return;

  modalTitle.textContent = "編輯作品";
  form.id.value = p.id;
  form.title.value = p.title || "";
  form.url.value = p.url || "";
  form.thumb.value = (p.thumb && !p.thumb.startsWith("data:image")) ? p.thumb : "";
  form.description.value = p.description || "";
  form.prompt.value = p.prompt || "";

  modal.showModal();
};

/** ====== Render ====== */
function render() {
  if (!projects.length) {
    grid.innerHTML = `<p class="muted">目前沒有作品。${isAdmin ? "點「新增作品」建立第一筆吧！" : "等待管理員新增作品。"}</p>`;
    return;
  }

  grid.innerHTML = projects.map((p) => {
    const thumb = p.thumb || defaultThumb(p.title || "Project");

    return `
      <div class="card">
        <img class="thumb" src="${thumb}" alt="${escapeHtml(p.title || "")}" />
        <h3>${escapeHtml(p.title || "")}</h3>
        <a href="${escapeHtml(p.url || "")}" target="_blank" rel="noreferrer">🔗 作品連結</a>
        <p class="muted">${escapeHtml(p.description || "")}</p>

        <details>
          <summary class="muted">查看 AI Prompt</summary>
          <pre class="prompt">${escapeHtml(p.prompt || "")}</pre>
        </details>

        ${isAdmin ? `
          <div class="row">
            <button onclick="editProject('${p.id}')">編輯</button>
            <button onclick="delProject('${p.id}')">刪除</button>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

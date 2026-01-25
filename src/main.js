// ⚠️ 這行一定要在最上面，確保 CSS 進 bundle
import "./styles.css";

import { db, auth, googleProvider } from "./firebase";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp,
  increment, setDoc, getDoc
} from "firebase/firestore";
import {
  signInWithPopup, signOut, onAuthStateChanged
} from "firebase/auth";

/* ======================
   基本設定
====================== */
const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || "";
const $ = (s) => document.querySelector(s);

/* ======================
   Turnstile Gate（穩定版）
====================== */
const gate = $("#gate");
const gateMsg = $("#gateMsg");
const PASS_KEY = "turnstile_passed_session";
let gatePassed = sessionStorage.getItem(PASS_KEY) === "1";

function unlockSite(reason = "success") {
  gatePassed = true;
  sessionStorage.setItem(PASS_KEY, "1");
  gate?.classList.add("is-hidden");
  gateMsg && (gateMsg.textContent = "");
  console.log("Gate unlocked ✅", reason);
}

function lockSite(msg = "") {
  gatePassed = false;
  sessionStorage.removeItem(PASS_KEY);
  gate?.classList.remove("is-hidden");
  gateMsg && (gateMsg.textContent = msg);
  console.log("Gate locked 🔒", msg);
}

// Turnstile callback（一定要全域）
window.onTurnstileSuccess = () => unlockSite("callback");
window.onTurnstileExpired = () => lockSite("驗證已過期，請重新驗證");
window.onTurnstileError = () => lockSite("驗證錯誤，請重新整理");

if (gatePassed) unlockSite("session");
else lockSite();

/* 救援機制：避免 callback 偶發沒觸發 */
let rescueTry = 0;
const rescueTimer = setInterval(() => {
  if (gatePassed) return clearInterval(rescueTimer);
  rescueTry++;
  const token = document.querySelector('input[name="cf-turnstile-response"]')?.value;
  if (token) {
    unlockSite("rescue");
    clearInterval(rescueTimer);
  }
  if (rescueTry > 25) clearInterval(rescueTimer);
}, 400);

/* ======================
   DOM
====================== */
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

const modalProfile = $("#modalProfile");
const profileForm = $("#profileForm");

const nameEl = $("#name");
const taglineEl = $("#tagline");
const aboutEl = $("#aboutText");
const socialList = $("#socialList");

/* ======================
   狀態
====================== */
let isAdmin = false;
let projects = [];
let profile = {
  name: "我的作品集",
  tagline: "LINE Bot / 校園系統 / 各種快速原型與自動化。",
  about: "我是一位工程師，習慣用 vibe coding 把想法快速做成可用系統。",
};

/* ======================
   Auth
====================== */
btnLogin.onclick = async () => {
  if (!gatePassed) return;
  await signInWithPopup(auth, googleProvider);
};

btnLogout.onclick = async () => {
  if (!gatePassed) return;
  await signOut(auth);
};

onAuthStateChanged(auth, (user) => {
  isAdmin = user && (!ADMIN_UID || user.uid === ADMIN_UID);

  btnLogin.hidden = !!user;
  btnLogout.hidden = !user;
  btnAdd.hidden = !isAdmin;
  btnEditProfile.hidden = !isAdmin;

  authHint.textContent = isAdmin
    ? "管理員模式"
    : user ? "已登入（非管理員）" : "訪客模式";

  render();
});

/* ======================
   Firestore
====================== */
const projectsCol = collection(db, "projects");
const profileDoc = doc(db, "site", "profile");

(async () => {
  const snap = await getDoc(profileDoc);
  if (!snap.exists()) {
    await setDoc(profileDoc, {
      ...profile,
      updatedAt: serverTimestamp(),
    });
  }
})();

onSnapshot(profileDoc, (snap) => {
  if (!snap.exists()) return;
  profile = { ...profile, ...snap.data() };
  renderProfile();
});

onSnapshot(
  query(projectsCol, orderBy("updatedAt", "desc")),
  (snap) => {
    projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  }
);

/* ======================
   Render
====================== */
function renderProfile() {
  nameEl.textContent = profile.name;
  taglineEl.textContent = profile.tagline;
  aboutEl.textContent = profile.about;
}

function render() {
  projectCount.textContent = projects.length;
  lastUpdated.textContent =
    projects[0]?.updatedAt?.toDate?.().toLocaleString() || "—";

  renderList();
}

function renderList() {
  let list = [...projects];
  const term = searchInput.value.trim().toLowerCase();
  if (term) {
    list = list.filter(
      (p) =>
        p.title?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.prompt?.toLowerCase().includes(term)
    );
  }

  routeRoot.innerHTML = `
    <div class="grid">
      ${list
        .map(
          (p) => `
        <div class="project">
          <div class="thumb"><img src="${p.thumb || ""}"></div>
          <h3>${p.title}</h3>
          <p class="muted">${p.description || ""}</p>
          ${isAdmin ? `<div class="chip">👁 ${p.views || 0}</div>` : ""}
          <a class="btn" target="_blank" href="${p.url}">開啟作品</a>
        </div>`
        )
        .join("")}
    </div>
  `;
}

/* ======================
   新增作品
====================== */
btnAdd.onclick = () => {
  modalTitle.textContent = "新增作品";
  projectForm.reset();
  modalProject.showModal();
};

projectForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  const f = projectForm;
  await addDoc(projectsCol, {
    title: f.title.value,
    url: f.url.value,
    description: f.description.value,
    prompt: f.prompt.value,
    thumb: f.thumb.value,
    views: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  modalProject.close();
};

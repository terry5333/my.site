import { db, storage, auth, googleProvider } from "./firebase";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const ADMIN_UID = import.meta.env.VITE_ADMIN_UID;

const btnLogin = document.querySelector("#btnLogin");
const btnLogout = document.querySelector("#btnLogout");
const btnAdd = document.querySelector("#btnAdd");
const modal = document.querySelector("#modalProject");
const form = document.querySelector("#projectForm");
const grid = document.querySelector("#projectGrid");

let isAdmin = false;
let projects = [];

btnLogin.onclick = () => signInWithPopup(auth, googleProvider);
btnLogout.onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  isAdmin = user && user.uid === ADMIN_UID;
  btnLogin.hidden = !!user;
  btnLogout.hidden = !user;
  btnAdd.hidden = !isAdmin;
});

const colRef = collection(db, "projects");

onSnapshot(colRef, (snap) => {
  projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
});

btnAdd.onclick = () => {
  form.reset();
  modal.showModal();
};

form.onsubmit = async (e) => {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(form));
  let thumb = "";

  if (form.thumbFile.files[0]) {
    const file = form.thumbFile.files[0];
    const fileRef = ref(storage, `thumbs/${crypto.randomUUID()}`);
    await uploadBytes(fileRef, file);
    thumb = await getDownloadURL(fileRef);
  }

  await addDoc(colRef, {
    title: data.title,
    url: data.url,
    description: data.description,
    prompt: data.prompt,
    thumb,
    createdAt: serverTimestamp()
  });

  modal.close();
};

function render() {
  grid.innerHTML = projects.map(p => `
    <div>
      <img src="${p.thumb}" width="200" />
      <h3>${p.title}</h3>
      <a href="${p.url}" target="_blank">作品連結</a>
      <p>${p.description}</p>
      <details><summary>AI Prompt</summary>${p.prompt}</details>
      ${isAdmin ? `<button onclick="del('${p.id}')">刪除</button>` : ""}
    </div>
  `).join("");
}

window.del = async (id) => {
  if (!isAdmin) return;
  await deleteDoc(doc(db, "projects", id));
};

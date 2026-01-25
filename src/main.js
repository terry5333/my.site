/** ===== Gate (Turnstile) - 穩定版 ===== */
const gate = $("#gate");
const gateMsg = $("#gateMsg");

// 同一個分頁：通過一次就放行（直到關閉分頁）
const PASS_KEY = "turnstile_passed_session";
let gatePassed = sessionStorage.getItem(PASS_KEY) === "1";

function unlockSite(reason = "success") {
  gatePassed = true;
  sessionStorage.setItem(PASS_KEY, "1");
  gate?.classList.add("is-hidden");
  if (gateMsg) gateMsg.textContent = "";
  console.log("Gate unlocked ✅", reason);
}

function lockSite(msg = "") {
  gatePassed = false;
  sessionStorage.removeItem(PASS_KEY);
  gate?.classList.remove("is-hidden");
  if (gateMsg) gateMsg.textContent = msg;
  console.log("Gate locked 🔒", msg);
}

// ✅ Turnstile callbacks (global)
function onTurnstileSuccess(token) {
  console.log("Turnstile success ✅", token ? token.slice(0, 10) : "(no token)");
  unlockSite("callback");
}

function onTurnstileExpired() {
  console.log("Turnstile expired");
  lockSite("驗證已過期，請重新驗證。");
}

function onTurnstileError() {
  console.log("Turnstile error");
  lockSite("驗證發生錯誤，請重整頁面或稍後再試。");
}

window.onTurnstileSuccess = onTurnstileSuccess;
window.onTurnstileExpired = onTurnstileExpired;
window.onTurnstileError = onTurnstileError;

// 進站：如果 session 已通過就直接放行
if (gatePassed) {
  unlockSite("session");
} else {
  lockSite("");
}

/**
 * ✅ 救援機制：如果 callback 偶發沒觸發，就輪詢找 token input
 * Turnstile 會產生 <input name="cf-turnstile-response">
 */
let rescueTries = 0;
const rescueTimer = setInterval(() => {
  if (gatePassed) {
    clearInterval(rescueTimer);
    return;
  }

  rescueTries++;
  const tokenEl = document.querySelector('input[name="cf-turnstile-response"]');
  const token = tokenEl?.value?.trim();

  // token 出現代表使用者已通過（至少前端已拿到 token）
  if (token) {
    unlockSite("rescue-token");
    clearInterval(rescueTimer);
    return;
  }

  // 最多跑 25 次（約 10 秒）
  if (rescueTries >= 25) {
    clearInterval(rescueTimer);
  }
}, 400);

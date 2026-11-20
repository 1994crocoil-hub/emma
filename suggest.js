import { projectUrl, publishableKey } from "./supabase-config.js?v=5";

const form = document.querySelector("#suggest-form");
const status = document.querySelector("#suggest-status");
const success = document.querySelector("#suggest-success");
const submit = form.querySelector('button[type="submit"]');
let payloadSignature;
let receipt;

function showSuccess() {
  form.reset();
  form.hidden = true;
  success.hidden = false;
  success.focus();
  payloadSignature = undefined;
}

function isHttps(value) {
  try { return new URL(value).protocol === "https:"; }
  catch { return false; }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  const { website, ...payload } = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value.trim()]));
  if (website) { showSuccess(); return; }
  if (payload.name.length < 2 || payload.reason.length < 5) {
    status.textContent = "請填景點名稱和至少五個字的推薦理由。";
    return;
  }

  const links = [payload.official_url, payload.map_url].filter(Boolean);
  if (!links.length || links.some((value) => !isHttps(value))) {
    status.textContent = "請至少填一個有效的 HTTPS 網址。";
    form.elements.namedItem("official_url").focus();
    return;
  }

  const signature = JSON.stringify(payload);
  if (payloadSignature !== signature) {
    receipt = crypto.randomUUID();
    payloadSignature = signature;
  }
  submit.disabled = true;
  status.textContent = "正在送出…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(new URL("/rest/v1/rpc/kansai_submit_suggestion", projectUrl), {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ receipt, payload }),
      signal: controller.signal
    });
    if (response.status === 429) {
      status.textContent = "目前投稿較多，請稍等一分鐘再試。";
      return;
    }
    if (!response.ok) throw new Error();
    showSuccess();
  } catch {
    status.textContent = "暫時送不出去。填寫內容已保留，請稍後再試。";
  } finally {
    clearTimeout(timeout);
    submit.disabled = false;
  }
});

document.querySelector("#suggest-again").addEventListener("click", () => {
  success.hidden = true;
  form.hidden = false;
  status.textContent = "";
  form.elements.namedItem("name").focus();
});

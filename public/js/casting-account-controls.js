const TRANSFER_DRAFT_KEY = "el-laboratorio-casting-draft:transfer";
let accountState = null;

async function loadAccountState() {
  const response = await fetch("/api/casting/me", { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  return response.json();
}

function currentDraftKey() {
  const discordId = accountState?.identity?.discord?.id;
  return discordId ? `el-laboratorio-casting-draft:${discordId}` : "";
}

function restoreTransferredDraftIfNeeded() {
  if (!accountState || accountState.application) return false;
  const targetKey = currentDraftKey();
  if (!targetKey) return false;

  try {
    const transferred = localStorage.getItem(TRANSFER_DRAFT_KEY);
    if (!transferred) return false;

    if (!localStorage.getItem(targetKey)) {
      localStorage.setItem(targetKey, transferred);
    }
    localStorage.removeItem(TRANSFER_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

function preserveDraftForDiscordSwitch() {
  const sourceKey = currentDraftKey();
  if (!sourceKey) return;

  try {
    const draft = localStorage.getItem(sourceKey);
    if (draft) localStorage.setItem(TRANSFER_DRAFT_KEY, draft);
  } catch {}
}

function makeButton(label, className, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `account-action ${className}`;
  button.textContent = label;
  button.dataset.accountAction = action;
  return button;
}

function ensureAccountActions() {
  const discordCard = document.querySelector('[data-key="q5"] .identity-card');
  const robloxCard = document.querySelector('[data-key="q6"] .identity-card');

  if (discordCard && !discordCard.querySelector('[data-account-action="switch-discord"]')) {
    discordCard.appendChild(makeButton("Cambiar Discord", "secondary-action", "switch-discord"));
  }

  if (
    robloxCard &&
    accountState?.identity?.roblox &&
    !robloxCard.querySelector('[data-account-action="unlink-roblox"]')
  ) {
    robloxCard.appendChild(makeButton("Desvincular Roblox", "danger-action", "unlink-roblox"));
  }
}

async function unlinkRoblox(button) {
  if (!accountState?.csrfToken) return;

  const confirmed = window.confirm(
    "¿Desvincular esta cuenta de Roblox? Tus respuestas guardadas en este dispositivo no se borrarán."
  );
  if (!confirmed) return;

  button.disabled = true;
  const original = button.textContent;
  button.textContent = "Desvinculando...";

  try {
    const response = await fetch("/auth/roblox/unlink", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": accountState.csrfToken,
      },
      body: "{}",
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No se pudo desvincular Roblox.");

    location.reload();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
    button.textContent = original;
  }
}

async function switchDiscord(button) {
  const confirmed = window.confirm(
    "¿Cambiar la cuenta de Discord? Tu borrador se conservará para continuar después de iniciar sesión con la otra cuenta."
  );
  if (!confirmed) return;

  preserveDraftForDiscordSwitch();
  button.disabled = true;
  button.textContent = "Cambiando...";

  try {
    await fetch("/auth/logout", { method: "POST" });
  } finally {
    location.href = "/auth/login?returnTo=%2Fcasting";
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-account-action]");
  if (!button) return;

  if (button.dataset.accountAction === "unlink-roblox") {
    unlinkRoblox(button);
  } else if (button.dataset.accountAction === "switch-discord") {
    switchDiscord(button);
  }
});

const observer = new MutationObserver(() => ensureAccountActions());
observer.observe(document.body, { childList: true, subtree: true });

(async () => {
  try {
    accountState = await loadAccountState();
    if (!accountState) return;

    if (restoreTransferredDraftIfNeeded()) {
      location.reload();
      return;
    }

    ensureAccountActions();
  } catch (error) {
    console.error("Casting account controls error:", error);
  }
})();

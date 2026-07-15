const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("chat-input");
const briefBtn = document.getElementById("generate-brief");
const jobDescEl = document.getElementById("job-description");
const briefStatusEl = document.getElementById("brief-status");
const briefOutputEl = document.getElementById("brief-output");
const newConvBtn = document.getElementById("new-conversation");

// Identifies the current brief run. Bumping it orphans any in-flight poll, which
// would otherwise write a stale brief back into a panel that was just cleared.
let briefRunId = 0;
let briefTimer = null;

function clearBriefPanel() {
  briefRunId++;
  if (briefTimer !== null) {
    clearTimeout(briefTimer);
    briefTimer = null;
  }
  briefStatusEl.textContent = "";
  briefOutputEl.textContent = "";
}

function renderMessage(role, content) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = content;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadHistory() {
  const res = await fetch("/api/history");
  if (!res.ok) return;
  const state = await res.json();
  messagesEl.innerHTML = "";
  for (const m of state.messages) renderMessage(m.role, m.content);
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = "";
  renderMessage("user", text);

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text }),
  });
  const state = await res.json();
  const last = state.messages[state.messages.length - 1];
  if (last?.role === "assistant") renderMessage("assistant", last.content);
});

newConvBtn.addEventListener("click", async () => {
  const confirmed = confirm(
    "Start a new conversation? The stored message history and extracted candidate profile will be permanently deleted."
  );
  if (!confirmed) return;

  newConvBtn.disabled = true;
  try {
    const res = await fetch("/api/reset", { method: "POST" });
    if (!res.ok) {
      briefStatusEl.textContent = "Could not clear the conversation. Please try again.";
      return;
    }

    // The brief is derived from the conversation, so it is stale once cleared.
    messagesEl.innerHTML = "";
    clearBriefPanel();
    inputEl.focus();
  } catch {
    briefStatusEl.textContent = "Could not clear the conversation. Please try again.";
  } finally {
    newConvBtn.disabled = false;
  }
});

briefBtn.addEventListener("click", async () => {
  // Supersede any previous run, then claim this one.
  clearBriefPanel();
  const runId = briefRunId;
  const isCurrent = () => runId === briefRunId;

  briefStatusEl.textContent = "Starting screening workflow...";

  const startRes = await fetch("/api/screen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobDescription: jobDescEl.value }),
  });
  if (!isCurrent()) return;
  const { workflowInstanceId } = await startRes.json();
  if (!isCurrent()) return;

  const poll = async () => {
    if (!isCurrent()) return;
    const statusRes = await fetch(`/api/screen/${workflowInstanceId}/status`);
    const status = await statusRes.json();
    // The conversation may have been cleared while this request was in flight.
    if (!isCurrent()) return;

    if (status.status === "complete") {
      briefStatusEl.textContent = "Done.";
      briefOutputEl.textContent = JSON.stringify(status.output, null, 2);
      return;
    }
    if (status.status === "errored" || status.status === "terminated") {
      briefStatusEl.textContent = `Workflow ${status.status}.`;
      return;
    }
    briefStatusEl.textContent = `Status: ${status.status}...`;
    briefTimer = setTimeout(poll, 2000);
  };

  poll();
});

loadHistory();

const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("chat-input");
const briefBtn = document.getElementById("generate-brief");
const jobDescEl = document.getElementById("job-description");
const briefStatusEl = document.getElementById("brief-status");
const briefOutputEl = document.getElementById("brief-output");

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

briefBtn.addEventListener("click", async () => {
  briefStatusEl.textContent = "Starting screening workflow...";
  briefOutputEl.textContent = "";

  const startRes = await fetch("/api/screen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobDescription: jobDescEl.value }),
  });
  const { workflowInstanceId } = await startRes.json();

  const poll = async () => {
    const statusRes = await fetch(`/api/screen/${workflowInstanceId}/status`);
    const status = await statusRes.json();

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
    setTimeout(poll, 2000);
  };

  poll();
});

loadHistory();

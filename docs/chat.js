const enableButton = document.getElementById("enable-chat");
const loading = document.getElementById("chat-loading");
const progress = document.getElementById("chat-progress");
const progressText = document.getElementById("chat-progress-text");
const status = document.getElementById("chat-status");
const interfacePanel = document.getElementById("chat-interface");
const messagesElement = document.getElementById("chat-messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const sendButton = document.getElementById("chat-send");

let engine;
let conversation = [];
let generating = false;

function handleDeviceLoss(error) {
  if (!/Device was lost|disposed/i.test(String(error?.message || error))) return false;
  engine = null;
  input.disabled = true;
  sendButton.disabled = true;
  enableButton.disabled = true;
  setStatus("The chat model stopped because this device’s graphics memory ran out. Reload the page to try again — the rest of the exhibit still works");
  return true;
}

function setStatus(message) {
  status.textContent = message;
}

function appendMessage(role, content) {
  const element = document.createElement("div");
  element.className = `chat-message ${role}`;
  element.textContent = content;
  messagesElement.append(element);
  messagesElement.scrollTop = messagesElement.scrollHeight;
  return element;
}

enableButton.addEventListener("click", async () => {
  if (!navigator.gpu) {
    setStatus("Chat needs WebGPU (try Chrome or Edge on a recent laptop) — the rest of the exhibit still works");
    return;
  }
  enableButton.disabled = true;
  loading.hidden = false;
  setStatus("");
  try {
    const guideResponse = await fetch("data/guide.md");
    if (!guideResponse.ok) throw new Error("Guide unavailable");
    const guide = await guideResponse.text();
    const webllm = await import("https://esm.run/@mlc-ai/web-llm");
    const available = new Set(webllm.prebuiltAppConfig.model_list.map((entry) => entry.model_id));
    const preferred = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
    const fallback = "SmolLM2-360M-Instruct-q4f16_1-MLC";
    const modelId = available.has(preferred) ? preferred : available.has(fallback) ? fallback : null;
    if (!modelId) throw new Error("No supported chat model found");

    engine = await webllm.CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        progress.value = Math.max(0, Math.min(100, (report.progress || 0) * 100));
        progressText.textContent = report.text || "Loading chat model…";
      },
    }, { context_window_size: 2048, prefill_chunk_size: 256 });
    conversation = [{
      role: "system",
      content: "You are the guide for this exhibit. Answer ONLY using the guide below. If the guide does not contain the answer, say: ‘The site guide doesn’t cover that.’ Keep answers to 3 sentences or fewer.\n\n" + guide,
    }];
    loading.hidden = true;
    enableButton.hidden = true;
    interfacePanel.hidden = false;
    setStatus("Chat is ready.");
    input.focus();
  } catch (error) {
    loading.hidden = true;
    if (!handleDeviceLoss(error)) {
      enableButton.disabled = false;
      setStatus("Chat could not start. Please try again later; the rest of the exhibit still works.");
    }
    console.error("Chat initialization failed:", error);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!engine || generating || !question) return;
  generating = true;
  input.disabled = true;
  sendButton.disabled = true;
  setStatus("Thinking…");
  appendMessage("user", question);
  const answerElement = appendMessage("assistant", "");
  input.value = "";
  try {
    const pending = [conversation[0], { role: "user", content: question }];
    const chunks = await engine.chat.completions.create({
      messages: pending,
      temperature: 0.2,
      max_tokens: 200,
      stream: true,
    });
    let answer = "";
    for await (const chunk of chunks) {
      answer += chunk.choices[0]?.delta?.content || "";
      answerElement.textContent = answer;
      messagesElement.scrollTop = messagesElement.scrollHeight;
    }
    if (!answer.trim()) throw new Error("Empty response");
    setStatus("");
  } catch (error) {
    answerElement.textContent = "Sorry, I couldn't answer that. Please try again.";
    if (!handleDeviceLoss(error)) setStatus("Chat had a problem; you can try another question.");
    console.error("Chat generation failed:", error);
  } finally {
    generating = false;
    if (engine) {
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
    }
  }
});

const ACTIVITIES = ["WALKING", "WALKING_UPSTAIRS", "WALKING_DOWNSTAIRS", "SITTING", "STANDING", "LAYING"];
const COLORS = { x: "#dc674b", y: "#148ca1", z: "#7968b2" };
const $ = (id) => document.getElementById(id);

let windows = [];
let current = null;
let previousId = null;
let answered = false;
let visitorCorrect = 0;
let modelCorrect = 0;
let rounds = 0;

function percent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function eligibleWindows() {
  return $("mistakes-only").checked ? windows.filter((window) => !window.correct) : windows;
}

function nextWindow() {
  const pool = eligibleWindows();
  if (!pool.length) {
    current = null;
    $("window-number").textContent = "No model mistakes in the exported windows";
    $("status").textContent = "Turn off the filter to keep playing.";
    $("guess-buttons").replaceChildren();
    $("next-button").disabled = true;
    $("reveal").hidden = true;
    drawChart();
    return;
  }
  const alternatives = pool.length > 1 ? pool.filter((window) => window.id !== previousId) : pool;
  current = alternatives[Math.floor(Math.random() * alternatives.length)];
  previousId = current.id;
  answered = false;
  $("window-number").textContent = `Window ${current.id} · subject ${current.subject}`;
  $("status").textContent = "";
  $("reveal").hidden = true;
  $("next-button").disabled = true;
  renderButtons();
  drawChart();
}

function renderButtons() {
  const container = $("guess-buttons");
  container.replaceChildren();
  for (const activity of ACTIVITIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = activity.replaceAll("_", " ");
    button.disabled = !current || answered;
    button.addEventListener("click", () => revealAnswer(activity));
    container.append(button);
  }
}

function revealAnswer(guess) {
  if (!current || answered) return;
  answered = true;
  rounds++;
  if (guess === current.true_label) visitorCorrect++;
  if (current.correct) modelCorrect++;
  $("visitor-score").textContent = `${visitorCorrect} / ${rounds}`;
  $("model-score").textContent = `${modelCorrect} / ${rounds}`;
  $("status").textContent = guess === current.true_label ? "You got it!" : "A tricky one. Look at the answer below.";
  $("true-label").textContent = current.true_label.replaceAll("_", " ");
  $("predicted-label").textContent = current.predicted_label.replaceAll("_", " ");
  const list = $("probabilities");
  list.replaceChildren();
  for (const [label, probability] of Object.entries(current.class_probabilities).sort((a, b) => b[1] - a[1])) {
    const row = document.createElement("div");
    row.className = "probability-row";
    const name = document.createElement("span");
    name.textContent = label.replaceAll("_", " ");
    const track = document.createElement("div");
    track.className = "probability-track";
    const fill = document.createElement("div");
    fill.className = "probability-fill";
    fill.style.width = `${Math.max(0, Math.min(100, probability * 100))}%`;
    track.append(fill);
    const value = document.createElement("span");
    value.className = "probability-value";
    value.textContent = percent(probability);
    row.append(name, track, value);
    list.append(row);
  }
  $("reveal").hidden = false;
  $("next-button").disabled = false;
  [...$("guess-buttons").children].forEach((button) => {
    button.disabled = true;
    if (button.textContent === guess.replaceAll("_", " ")) button.classList.add("chosen");
  });
}

function drawChart() {
  const canvas = $("signal-chart");
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  const width = bounds.width;
  const height = bounds.height;
  context.clearRect(0, 0, width, height);
  if (!current) return;

  const signals = current.total_acc;
  const count = signals.x.length;
  const allValues = [...signals.x, ...signals.y, ...signals.z];
  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  const padding = (max - min || 1) * 0.12;
  min -= padding;
  max += padding;
  const left = 47, right = 14, top = 13, bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xAt = (index) => left + (index / (count - 1)) * plotWidth;
  const yAt = (value) => top + (1 - (value - min) / (max - min)) * plotHeight;
  context.font = "12px system-ui, sans-serif";
  context.lineWidth = 1;
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (let step = 0; step <= 4; step++) {
    const value = min + (max - min) * (step / 4);
    const y = yAt(value);
    context.strokeStyle = "#d9e4e9";
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(width - right, y);
    context.stroke();
    context.fillStyle = "#607789";
    context.fillText(value.toFixed(1), left - 8, y);
  }
  context.textAlign = "center";
  context.textBaseline = "top";
  for (let second = 0; second <= 2.5; second += 0.5) {
    const x = xAt(second * 50);
    context.fillText(second.toFixed(1), x, height - bottom + 8);
  }
  context.fillText("Seconds", left + plotWidth / 2, height - 15);
  for (const axis of ["x", "y", "z"]) {
    context.strokeStyle = COLORS[axis];
    context.lineWidth = 2;
    context.beginPath();
    signals[axis].forEach((value, index) => {
      if (index === 0) context.moveTo(xAt(index), yAt(value));
      else context.lineTo(xAt(index), yAt(value));
    });
    context.stroke();
  }
}

function showSpotlight(metrics) {
  const walking = new Set(["WALKING", "WALKING_UPSTAIRS", "WALKING_DOWNSTAIRS"]);
  const pair = (metrics.top_confusions || []).find(
    (item) => walking.has(item.true_label) && walking.has(item.predicted_label)
  );
  $("spotlight-copy").textContent = pair
    ? `The model most often confused ${pair.true_label.replaceAll("_", " ")} with ${pair.predicted_label.replaceAll("_", " ")} among its top mistakes (${pair.count} test windows). The similar step rhythm makes this an interesting pair to compare. Try the mistake filter to inspect examples.`
    : "Walking and stair movements can have similar step rhythms. Use the mistake filter to inspect windows the model classified incorrectly.";
}

async function start() {
  try {
    const [predictionsResponse, metricsResponse] = await Promise.all([
      fetch("data/predictions.json"),
      fetch("data/metrics.json"),
    ]);
    if (!predictionsResponse.ok || !metricsResponse.ok) throw new Error("Data files could not be loaded.");
    const [predictions, metrics] = await Promise.all([
      predictionsResponse.json(),
      metricsResponse.json(),
    ]);
    if (!Array.isArray(predictions) || !predictions.length) throw new Error("No prediction windows are available.");
    windows = predictions;
    $("baseline-accuracy").textContent = percent(metrics.baseline_accuracy);
    $("model-accuracy").textContent = percent(metrics.model_accuracy);
    showSpotlight(metrics);
    nextWindow();
  } catch (error) {
    $("window-number").textContent = "Data unavailable";
    $("status").textContent = `${error.message} Generate the JSON files with notebooks/02_model.ipynb, then serve this folder over HTTP.`;
    $("spotlight-copy").textContent = "Confusion data will appear after metrics.json is generated.";
  }
}

$("mistakes-only").addEventListener("change", nextWindow);
$("next-button").addEventListener("click", nextWindow);
window.addEventListener("resize", drawChart);
start();

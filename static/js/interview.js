const video = document.getElementById('video');
const canvas = document.getElementById('snapshot');
const faceStatus = document.getElementById('faceStatus');
const emotionStatus = document.getElementById('emotionStatus');
let activeAnswerId = `answer-${window.QUESTIONS[0]?.id || 1}`;

document.querySelectorAll('textarea').forEach((textarea) => {
  textarea.addEventListener('focus', () => {
    activeAnswerId = textarea.id;
  });
});

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    setInterval(sendFrame, 2500);
  } catch (e) {
    faceStatus.innerText = 'Camera permission denied. Text interview still works.';
  }
}

async function sendFrame() {
  if (!video.videoWidth) return;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const image = canvas.toDataURL('image/jpeg', 0.65);
  try {
    const res = await fetch('/api/analyze-frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    if (data.face_detected) {
      faceStatus.innerText = 'Face detected';
      emotionStatus.innerText = `Emotion: ${data.emotion} - ${data.confidence_hint}`;
    } else {
      faceStatus.innerText = 'Face not centered';
      emotionStatus.innerText = data.confidence_hint || 'Adjust camera position';
    }
  } catch (e) {}
}

function updateAnsweredCount() {
  const count = window.QUESTIONS.filter((q) => {
    const answerBox = document.getElementById(`answer-${q.id}`);
    return answerBox && answerBox.value.trim().length > 0;
  }).length;
  document.getElementById('answeredCount').innerText = count;
}

function startSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Speech recognition is not supported in this browser. Please use Chrome or type your answer.');
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onstart = () => {
    emotionStatus.innerText = 'Listening... speak your answer clearly';
  };
  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    const box = document.getElementById(activeAnswerId);
    box.value = `${box.value} ${text}`.trim();
    updateAnsweredCount();
  };
  recognition.onerror = () => alert('Speech capture failed. Please try again or type your answer.');
  recognition.start();
}

async function submitInterview() {
  const answers = {};
  window.QUESTIONS.forEach((q) => {
    answers[q.id] = document.getElementById(`answer-${q.id}`).value.trim();
  });
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  const data = await res.json();
  renderResults(data);
}

function renderResults(data) {
  const results = document.getElementById('results');
  results.hidden = false;
  results.innerHTML = `
    <div class="result-card">
      <h2>Interview Submitted</h2>
      <p>${data.message || 'Interview submitted successfully. The admin will review your report.'}</p>
    </div>
  `;
  results.scrollIntoView({ behavior: 'smooth' });
}

startCamera();
updateAnsweredCount();

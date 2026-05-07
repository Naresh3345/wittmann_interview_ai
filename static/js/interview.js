const video = document.getElementById('video');
const canvas = document.getElementById('snapshot');
const faceStatus = document.getElementById('faceStatus');
const emotionStatus = document.getElementById('emotionStatus');
const alarmBox = document.getElementById('alarmBox');
const alarmMessage = document.getElementById('alarmMessage');
const violationCount = document.getElementById('violationCount');
let activeAnswerId = `answer-${window.QUESTIONS[0]?.id || 1}`;
let proctoringViolations = [];
let missingFaceFrames = 0;
let audioContext;

document.querySelectorAll('[data-start-section]').forEach((button) => {
  button.addEventListener('click', () => startSection(button.dataset.startSection));
});

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
    faceStatus.innerText = 'Camera permission denied.';
    triggerAlarm('Camera permission denied or camera unavailable.');
  }
}

function playAlarmTone() {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.05, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.8);
  } catch (e) {}
}

function triggerAlarm(reason) {
  const event = {
    reason,
    time: new Date().toISOString(),
  };
  proctoringViolations.push(event);
  violationCount.innerText = proctoringViolations.length;
  alarmMessage.innerText = reason;
  alarmBox.classList.add('active');
  playAlarmTone();
  setTimeout(() => alarmBox.classList.remove('active'), 3500);
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
      missingFaceFrames = 0;
      faceStatus.innerText = 'Face detected';
      emotionStatus.innerText = `Emotion: ${data.emotion} - ${data.confidence_hint}`;
    } else {
      missingFaceFrames += 1;
      faceStatus.innerText = 'Face not centered';
      emotionStatus.innerText = data.confidence_hint || 'Adjust camera position';
      if (missingFaceFrames >= 2) {
        triggerAlarm('Suspicious camera activity: candidate face is missing or not centered.');
        missingFaceFrames = 0;
      }
    }
    if (data.multiple_faces) {
      triggerAlarm(data.alert_reason || 'Suspicious camera activity: multiple faces detected.');
    }
  } catch (e) {}
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    triggerAlarm('Tab switch detected during interview.');
  }
});

function startSection(sectionName) {
  document.querySelectorAll('.test-section').forEach((item) => {
    item.hidden = item.dataset.section !== sectionName;
  });
  document.getElementById('sectionLauncher').hidden = false;
  const firstBox = document.querySelector(`.question-card[data-section="${sectionName}"] textarea`);
  if (firstBox) {
    firstBox.focus();
    activeAnswerId = firstBox.id;
  }
}

window.addEventListener('blur', () => {
  triggerAlarm('Window focus changed during interview.');
});

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
    body: JSON.stringify({ answers, proctoring_violations: proctoringViolations }),
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
      <p>${data.message || 'Interview submitted successfully. Result is available only for admin review.'}</p>
    </div>
  `;
  results.scrollIntoView({ behavior: 'smooth' });
}

startCamera();
updateAnsweredCount();

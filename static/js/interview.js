const video = document.getElementById('video');
const canvas = document.getElementById('snapshot');
const faceStatus = document.getElementById('faceStatus');
const emotionStatus = document.getElementById('emotionStatus');
const alarmBox = document.getElementById('alarmBox');
const alarmMessage = document.getElementById('alarmMessage');
const violationCount = document.getElementById('violationCount');
const tabSwitchCount = document.getElementById('tabSwitchCount');
const warningCount = document.getElementById('warningCount');
const timerSection = document.getElementById('timerSection');
const timerDisplay = document.getElementById('timerDisplay');
const warningPopup = document.getElementById('warningPopup');
const warningPopupMessage = document.getElementById('warningPopupMessage');
let activeAnswerId = `answer-${window.QUESTIONS[0]?.id || 1}`;
let proctoringViolations = [];
let missingFaceFrames = 0;
let audioContext;
let warningTotal = 0;
let tabSwitchTotal = 0;
let submitted = false;
let timerInterval;
let activeSection = '';
const SECTION_SECONDS = 20 * 60;
const sectionRemaining = {
  Aptitude: SECTION_SECONDS,
  Programming: SECTION_SECONDS,
};

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

function showWarningPopup(reason) {
  warningPopupMessage.innerText = reason;
  warningPopup.hidden = false;
  setTimeout(() => {
    warningPopup.hidden = true;
  }, 3500);
}

function triggerAlarm(reason, kind = 'warning') {
  if (submitted) return;
  const event = {
    reason,
    kind,
    time: new Date().toISOString(),
  };
  proctoringViolations.push(event);
  warningTotal += 1;
  if (kind === 'tab-switch') {
    tabSwitchTotal += 1;
  }
  violationCount.innerText = proctoringViolations.length;
  warningCount.innerText = warningTotal;
  tabSwitchCount.innerText = tabSwitchTotal;
  alarmMessage.innerText = reason;
  alarmBox.classList.add('active');
  playAlarmTone();
  showWarningPopup(reason);
  setTimeout(() => alarmBox.classList.remove('active'), 3500);
  if (tabSwitchTotal >= 5) {
    submitInterview('Auto submitted because tab switching reached the limit.');
  } else if (warningTotal >= 10) {
    submitInterview('Auto submitted because warning limit was reached.');
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
  if (document.hidden && activeSection) {
    triggerAlarm('Tab switch detected during interview.', 'tab-switch');
  }
});

function startSection(sectionName) {
  if (submitted) return;
  activeSection = sectionName;
  document.querySelectorAll('.test-section').forEach((item) => {
    item.hidden = item.dataset.section !== sectionName;
  });
  document.getElementById('sectionLauncher').hidden = false;
  timerSection.innerText = `${sectionName} Timer`;
  updateTimerDisplay();
  startSectionTimer();
  const firstInput = document.querySelector(`.question-card[data-section="${sectionName}"] textarea, .question-card[data-section="${sectionName}"] input`);
  if (firstInput) {
    firstInput.focus();
    activeAnswerId = firstInput.id || activeAnswerId;
  }
}

window.addEventListener('blur', () => {
  if (activeSection) {
    triggerAlarm('Window focus changed during interview.', 'focus-change');
  }
});

function startSectionTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!activeSection || submitted) return;
    sectionRemaining[activeSection] -= 1;
    updateTimerDisplay();
    if (sectionRemaining[activeSection] <= 0) {
      submitInterview(`${activeSection} time limit ended. Test auto submitted.`);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const remaining = Math.max(sectionRemaining[activeSection] ?? SECTION_SECONDS, 0);
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  timerDisplay.innerText = `${minutes}:${seconds}`;
}

function updateAnsweredCount() {
  const count = window.QUESTIONS.filter((q) => {
    const answerBox = document.getElementById(`answer-${q.id}`);
    const selectedOption = document.querySelector(`input[name="answer-${q.id}"]:checked`);
    return (answerBox && answerBox.value.trim().length > 0) || Boolean(selectedOption);
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

async function submitInterview(autoSubmitReason = '') {
  if (submitted) return;
  submitted = true;
  clearInterval(timerInterval);
  document.querySelectorAll('button, input, textarea').forEach((control) => {
    control.disabled = true;
  });
  const answers = {};
  window.QUESTIONS.forEach((q) => {
    const selectedOption = document.querySelector(`input[name="answer-${q.id}"]:checked`);
    const answerBox = document.getElementById(`answer-${q.id}`);
    answers[q.id] = selectedOption ? selectedOption.value : (answerBox ? answerBox.value.trim() : '');
  });
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, proctoring_violations: proctoringViolations, auto_submit_reason: autoSubmitReason }),
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
      <p>${data.message || 'Thank you. Once you are shortlisted, you will be notified.'}</p>
    </div>
  `;
  results.scrollIntoView({ behavior: 'smooth' });
}

startCamera();
updateAnsweredCount();

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
const proctoringNotice = document.getElementById('proctoringNotice');
const acceptProctoringNotice = document.getElementById('acceptProctoringNotice');
const cancelProctoringNotice = document.getElementById('cancelProctoringNotice');
const lanCameraGuide = document.getElementById('lanCameraGuide');
const lanOriginValue = document.getElementById('lanOriginValue');
const copyLanOriginButton = document.getElementById('copyLanOriginButton');
const sectionLauncher = document.getElementById('sectionLauncher');
const nextSectionButton = document.getElementById('nextSectionButton');
const submitInterviewButton = document.getElementById('submitInterviewButton');
const programmingLauncher = document.getElementById('programmingLauncher');
let activeAnswerId = `answer-${window.QUESTIONS[0]?.id || 1}`;
let proctoringViolations = [];
let missingFaceFrames = 0;
let audioContext;
let warningTotal = 0;
let tabSwitchTotal = 0;
let submitted = false;
let timerInterval;
let activeSection = '';
let cameraReady = false;
let proctoringActive = false;
let frameInterval;
let proctoringNoticeAccepted = false;
let aptitudeCompleted = false;
const SECTION_SECONDS = 20 * 60;
const sectionRemaining = {
  Aptitude: SECTION_SECONDS,
  Programming: SECTION_SECONDS,
};
const isLanHttp = !window.isSecureContext && location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
const lanOrigin = location.origin;

if (lanOriginValue) {
  lanOriginValue.textContent = lanOrigin;
}

copyLanOriginButton?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(lanOrigin);
    copyLanOriginButton.textContent = 'Copied';
  } catch (error) {
    copyLanOriginButton.textContent = 'Copy Failed';
  }
  setTimeout(() => {
    copyLanOriginButton.textContent = 'Copy Site Address';
  }, 1800);
});

function showLanCameraGuide() {
  if (lanCameraGuide && isLanHttp) {
    lanCameraGuide.hidden = false;
  }
}

document.querySelectorAll('[data-start-section]').forEach((button) => {
  button.addEventListener('click', () => startSection(button.dataset.startSection));
});

nextSectionButton?.addEventListener('click', () => {
  aptitudeCompleted = true;
  startSection('Programming');
});

submitInterviewButton?.addEventListener('click', () => submitInterview());

document.querySelectorAll('textarea').forEach((textarea) => {
  textarea.addEventListener('focus', () => {
    activeAnswerId = textarea.id;
  });
});

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    faceStatus.innerText = 'Camera monitoring unavailable.';
    emotionStatus.innerText = isLanHttp ? 'Chrome camera setting required' : 'Text scoring enabled';
    alarmMessage.innerText = isLanHttp
      ? 'Chrome blocks camera on LAN HTTP. Apply the Chrome secure-origin setting shown above.'
      : 'Camera monitoring is unavailable in this browser or connection.';
    showLanCameraGuide();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    cameraReady = true;
    faceStatus.innerText = 'Camera enabled';
    emotionStatus.innerText = 'Ready for interview';
    alarmMessage.innerText = 'Camera access is enabled. Proctoring starts after you start the test.';
  } catch (e) {
    cameraReady = false;
    faceStatus.innerText = 'Camera monitoring unavailable.';
    emotionStatus.innerText = isLanHttp ? 'Chrome camera setting required' : 'Text scoring enabled';
    alarmMessage.innerText = isLanHttp
      ? 'Chrome blocks camera on LAN HTTP. Apply the Chrome secure-origin setting shown above.'
      : 'Camera permission was denied or the camera is unavailable.';
    showLanCameraGuide();
  }
}

function showProctoringNotice() {
  if (proctoringNoticeAccepted) return Promise.resolve(true);
  return new Promise((resolve) => {
    proctoringNotice.hidden = false;
    acceptProctoringNotice.focus();

    const cleanup = (accepted) => {
      proctoringNotice.hidden = true;
      acceptProctoringNotice.removeEventListener('click', acceptHandler);
      cancelProctoringNotice.removeEventListener('click', cancelHandler);
      if (accepted) {
        proctoringNoticeAccepted = true;
      }
      resolve(accepted);
    };

    const acceptHandler = () => cleanup(true);
    const cancelHandler = () => cleanup(false);

    acceptProctoringNotice.addEventListener('click', acceptHandler);
    cancelProctoringNotice.addEventListener('click', cancelHandler);
  });
}

function armProctoring() {
  if (proctoringActive) return;
  proctoringActive = true;
  alarmMessage.innerText = 'Monitoring camera and tab focus.';
  emotionStatus.innerText = 'Monitoring active';
  if (!frameInterval) {
    frameInterval = setInterval(sendFrame, 2500);
  }
}

async function ensureCameraReady() {
  if (cameraReady) return true;
  await startCamera();
  if (cameraReady) return true;
  const message = isLanHttp
    ? 'Camera is blocked on this LAN HTTP link. Enable the Chrome secure-origin setting shown in the camera panel, then reload and allow camera access.'
    : 'Camera access is required before starting the interview. Please allow camera permission and try again.';
  alarmMessage.innerText = message;
  showWarningPopup(message);
  return false;
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
  if (submitted || !proctoringActive) return;
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
  if (!proctoringActive || submitted) return;
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
  if (document.hidden && activeSection && proctoringActive) {
    triggerAlarm('Tab switch detected during interview.', 'tab-switch');
  }
});

async function startSection(sectionName) {
  if (submitted) return;
  if (sectionName === 'Programming' && !aptitudeCompleted) {
    showWarningPopup('Please complete Aptitude first, then continue to Programming.');
    return;
  }
  if (!(await showProctoringNotice())) return;
  if (!(await ensureCameraReady())) return;
  armProctoring();
  requestFullscreenMode();
  activeSection = sectionName;
  document.querySelectorAll('.test-section').forEach((item) => {
    item.hidden = item.dataset.section !== sectionName;
  });
  sectionLauncher.hidden = true;
  nextSectionButton.hidden = sectionName !== 'Aptitude';
  submitInterviewButton.hidden = sectionName !== 'Programming';
  updateSectionActions();
  timerSection.innerText = `${sectionName} Timer`;
  updateTimerDisplay();
  startSectionTimer();
  const firstInput = document.querySelector(`.question-card[data-section="${sectionName}"] textarea, .question-card[data-section="${sectionName}"] input`);
  if (firstInput) {
    firstInput.focus();
    activeAnswerId = firstInput.id || activeAnswerId;
  }
}

function isQuestionAnswered(question) {
  const answerBox = document.getElementById(`answer-${question.id}`);
  const selectedOption = document.querySelector(`input[name="answer-${question.id}"]:checked`);
  return (answerBox && answerBox.value.trim().length > 0) || Boolean(selectedOption);
}

function isSectionAnswered(sectionName) {
  const sectionQuestions = window.QUESTIONS.filter((q) => q.category === sectionName);
  return sectionQuestions.length > 0 && sectionQuestions.every(isQuestionAnswered);
}

function updateSectionActions() {
  if (nextSectionButton) {
    nextSectionButton.disabled = activeSection !== 'Aptitude' || !isSectionAnswered('Aptitude');
  }
  if (submitInterviewButton) {
    submitInterviewButton.disabled = activeSection !== 'Programming' || !isSectionAnswered('Programming');
  }
}

function showSectionLauncher() {
  document.querySelectorAll('.test-section').forEach((item) => {
    item.hidden = true;
  });
  sectionLauncher.hidden = false;
  if (programmingLauncher && aptitudeCompleted) {
    programmingLauncher.classList.remove('locked');
    const button = programmingLauncher.querySelector('button');
    if (button) {
      button.disabled = false;
      button.textContent = 'Start Programming';
    }
  }
}

function requestFullscreenMode() {
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement.requestFullscreen().catch(() => {
    alarmMessage.innerText = 'Fullscreen could not be started. Please allow fullscreen mode for the interview.';
  });
}

window.addEventListener('blur', () => {
  if (activeSection && proctoringActive) {
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
      if (activeSection === 'Aptitude') {
        aptitudeCompleted = true;
        activeSection = '';
        clearInterval(timerInterval);
        nextSectionButton.hidden = true;
        submitInterviewButton.hidden = true;
        timerSection.innerText = 'Aptitude completed';
        showSectionLauncher();
        showWarningPopup('Aptitude time ended. Please start Programming.');
      } else {
        submitInterview(`${activeSection} time limit ended. Test auto submitted.`);
      }
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
  const count = window.QUESTIONS.filter(isQuestionAnswered).length;
  document.getElementById('answeredCount').innerText = count;
  updateSectionActions();
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
  clearInterval(frameInterval);
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
  if (data.redirect_url) {
    window.location.href = data.redirect_url;
    return;
  }
  window.location.href = '/interview/result';
}

startCamera();
updateAnsweredCount();

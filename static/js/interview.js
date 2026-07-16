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
const browserCameraGuide = document.getElementById('browserCameraGuide');
const lanOriginValue = document.getElementById('lanOriginValue');
const copyLanOriginButton = document.getElementById('copyLanOriginButton');
const copyBrowserLinkButton = document.getElementById('copyBrowserLinkButton');
const sectionLauncher = document.getElementById('sectionLauncher');
const nextSectionButton = document.getElementById('nextSectionButton');
const submitInterviewButton = document.getElementById('submitInterviewButton');
const programmingLauncher = document.getElementById('programmingLauncher');
const programmingTransition = document.getElementById('programmingTransition');
const startProgrammingButton = document.getElementById('startProgrammingButton');
const progressSection = document.getElementById('progressSection');
const answeredCountDisplay = document.getElementById('answeredCount');
const sectionQuestionCount = document.getElementById('sectionQuestionCount');
let activeAnswerId = `answer-${window.QUESTIONS[0]?.id || 1}`;
let proctoringViolations = [];
let missingFaceFrames = 0;
let multipleFaceFrames = 0;
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
const MIN_APTITUDE_ANSWERS = 5;
const sectionRemaining = {
  Aptitude: SECTION_SECONDS,
  Programming: SECTION_SECONDS,
};
const secureOrigin = `https://${location.host}`;
const secureCurrentUrl = `${secureOrigin}${location.pathname}${location.search}${location.hash}`;
const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname);
const isTryCloudflare = location.hostname.endsWith('.trycloudflare.com');
const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth <= 720;
const frameCheckMs = isMobileDevice ? 4000 : 2500;
const missingFaceLimit = isMobileDevice ? 2 : 3;
const multipleFaceLimit = isMobileDevice ? 2 : 1;
const isLanHttp = !window.isSecureContext && location.protocol === 'http:' && !isLocalHost && !isTryCloudflare;
const isInsecurePublicTunnel = isTryCloudflare && location.protocol === 'http:';
const lanOrigin = isInsecurePublicTunnel ? secureOrigin : location.origin;

if (isInsecurePublicTunnel) {
  window.location.replace(secureCurrentUrl);
}

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

copyBrowserLinkButton?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.isSecureContext ? location.href : secureCurrentUrl);
    copyBrowserLinkButton.textContent = 'Copied';
  } catch (error) {
    copyBrowserLinkButton.textContent = 'Copy Failed';
  }
  setTimeout(() => {
    copyBrowserLinkButton.textContent = 'Copy Secure Link';
  }, 1800);
});

function showLanCameraGuide() {
  if (lanCameraGuide && isLanHttp) {
    lanCameraGuide.hidden = false;
  }
}

function showBrowserCameraGuide() {
  if (browserCameraGuide && !isLanHttp) {
    browserCameraGuide.hidden = false;
  }
}

document.querySelectorAll('[data-start-section]').forEach((button) => {
  button.addEventListener('click', () => startSection(button.dataset.startSection));
});

nextSectionButton?.addEventListener('click', () => {
  aptitudeCompleted = true;
  showProgrammingTransition();
});

startProgrammingButton?.addEventListener('click', () => startSection('Programming'));

submitInterviewButton?.addEventListener('click', () => submitInterview());

document.querySelectorAll('textarea').forEach((textarea) => {
  textarea.addEventListener('focus', () => {
    activeAnswerId = textarea.id;
  });
});

document.addEventListener('copy', (event) => event.preventDefault());
document.addEventListener('cut', (event) => event.preventDefault());
document.addEventListener('paste', (event) => event.preventDefault());
document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('selectstart', (event) => {
  if (!event.target.closest('textarea, input')) {
    event.preventDefault();
  }
});

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    faceStatus.innerText = 'Camera monitoring unavailable.';
    emotionStatus.innerText = isLanHttp ? 'Chrome camera setting required' : 'Open in Safari or Chrome';
    alarmMessage.innerText = isLanHttp
      ? 'Chrome blocks camera on LAN HTTP. Apply the Chrome secure-origin setting shown above.'
      : 'This browser does not allow camera access. Open the secure interview link in Safari or Chrome, not inside Gmail or another app browser.';
    showLanCameraGuide();
    showBrowserCameraGuide();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
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
    if (!isLanHttp) {
      showBrowserCameraGuide();
    }
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
    frameInterval = setInterval(sendFrame, frameCheckMs);
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

function getActiveQuestionContext() {
  if (!activeSection) {
    return {
      question_id: '',
      question_number: '',
      question_category: '',
      question_text: '',
    };
  }
  const activeElement = document.activeElement;
  let questionCard = activeElement?.closest?.('.question-card');
  if (!questionCard || questionCard.hidden || questionCard.dataset.section !== activeSection) {
    questionCard = document.querySelector(`.question-card[data-section="${activeSection}"]:not([hidden])`);
  }
  if (!questionCard) {
    return {
      question_id: '',
      question_number: '',
      question_category: activeSection,
      question_text: '',
    };
  }
  const visibleQuestionCards = [...document.querySelectorAll(`.question-card[data-section="${activeSection}"]`)];
  const questionIndex = visibleQuestionCards.indexOf(questionCard);
  return {
    question_id: questionCard.dataset.questionId || '',
    question_number: questionIndex >= 0 ? questionIndex + 1 : '',
    question_category: activeSection,
    question_text: questionCard.querySelector('h3')?.innerText?.trim() || '',
  };
}

function triggerAlarm(reason, kind = 'warning') {
  if (submitted || !proctoringActive) return;
  const event = {
    reason,
    kind,
    time: new Date().toISOString(),
    ...getActiveQuestionContext(),
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
      faceStatus.innerText = 'Face out of camera';
      emotionStatus.innerText = data.confidence_hint || 'Adjust camera position';
      if (missingFaceFrames >= missingFaceLimit) {
        const missingFaceMessage = isMobileDevice
          ? 'Face is fully out of camera. Please keep your face visible on the mobile screen.'
          : 'Suspicious camera activity: candidate face is continuously missing or fully turned away.';
        triggerAlarm(missingFaceMessage);
        missingFaceFrames = 0;
      }
    }
    if (data.multiple_faces) {
      multipleFaceFrames += 1;
      if (multipleFaceFrames >= multipleFaceLimit) {
        triggerAlarm(data.alert_reason || 'Suspicious camera activity: multiple faces detected.');
        multipleFaceFrames = 0;
      }
    } else {
      multipleFaceFrames = 0;
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
  if (programmingTransition) {
    programmingTransition.hidden = true;
  }
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

function sectionAnsweredCount(sectionName) {
  return window.QUESTIONS.filter((q) => q.category === sectionName && isQuestionAnswered(q)).length;
}

function sectionQuestionTotal(sectionName) {
  return window.QUESTIONS.filter((q) => q.category === sectionName).length;
}

function updateSectionActions() {
  if (nextSectionButton) {
    nextSectionButton.disabled = activeSection !== 'Aptitude' || sectionAnsweredCount('Aptitude') < MIN_APTITUDE_ANSWERS;
  }
  if (submitInterviewButton) {
    submitInterviewButton.disabled = activeSection !== 'Programming' || !isSectionAnswered('Programming');
  }
}

function showProgrammingTransition() {
  activeSection = '';
  clearInterval(timerInterval);
  document.querySelectorAll('.test-section').forEach((item) => {
    item.hidden = true;
  });
  sectionLauncher.hidden = true;
  if (programmingTransition) {
    programmingTransition.hidden = false;
  }
  nextSectionButton.hidden = true;
  submitInterviewButton.hidden = true;
  timerSection.innerText = 'Aptitude completed';
  progressSection.innerText = 'Programming';
  answeredCountDisplay.innerText = '0';
  sectionQuestionCount.innerText = sectionQuestionTotal('Programming');
}

function showSectionLauncher() {
  document.querySelectorAll('.test-section').forEach((item) => {
    item.hidden = true;
  });
  sectionLauncher.hidden = false;
  if (programmingTransition) {
    programmingTransition.hidden = true;
  }
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
        showProgrammingTransition();
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
  const sectionName = activeSection || (aptitudeCompleted ? 'Programming' : 'Aptitude');
  const count = sectionAnsweredCount(sectionName);
  progressSection.innerText = sectionName;
  sectionQuestionCount.innerText = sectionQuestionTotal(sectionName);
  answeredCountDisplay.innerText = count;
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

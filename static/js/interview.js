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
const questionMapPanel = document.getElementById('questionMapPanel');
const questionMapRound = document.getElementById('questionMapRound');
const questionMapSummary = document.getElementById('questionMapSummary');
const questionDotGrid = document.getElementById('questionDotGrid');
const questionFloatNav = document.getElementById('questionFloatNav');
const questionBackButton = document.getElementById('questionBackButton');
const questionNextButton = document.getElementById('questionNextButton');
const questionStepLabel = document.getElementById('questionStepLabel');
const finishNotice = document.getElementById('finishNotice');
const reviewLastQuestionButton = document.getElementById('reviewLastQuestionButton');
const confirmFinishButton = document.getElementById('confirmFinishButton');
let activeAnswerId = `answer-${window.QUESTIONS[0]?.id || 1}`;
let proctoringViolations = [];
let missingFaceFrames = 0;
let multipleFaceFrames = 0;
let audioContext;
let warningTotal = 0;
let tabSwitchTotal = 0;
let submitted = false;
let timerInterval;
let totalTimerInterval;
let progressTimer;
let activeSection = '';
let activeQuestionIndex = 0;
const skippedQuestionIds = new Set();
let cameraReady = false;
let proctoringActive = false;
let frameInterval;
let proctoringNoticeAccepted = false;
let aptitudeCompleted = false;
let testStarted = false;
const sectionDurations = window.SECTION_DURATIONS || {};
const DEFAULT_SECTION_SECONDS = 20 * 60;
const MIN_APTITUDE_ANSWERS = 5;
const sectionRemaining = {
  Aptitude: Number(sectionDurations.Aptitude) || DEFAULT_SECTION_SECONDS,
  Programming: Number(sectionDurations.Programming) || DEFAULT_SECTION_SECONDS,
};
let totalTestRemaining = Number(window.TOTAL_TEST_SECONDS) || (sectionRemaining.Aptitude + sectionRemaining.Programming);
const proctoringSettings = window.PROCTORING_SETTINGS || {};
const protectedTestEnabled = proctoringSettings.protected_test_enabled !== false;
const tabSwitchWarningEnabled = proctoringSettings.tab_switch_enabled !== false;
const focusWarningEnabled = proctoringSettings.focus_warning_enabled !== false;
const cameraWarningEnabled = proctoringSettings.camera_warning_enabled !== false;
const multipleFaceWarningEnabled = proctoringSettings.multiple_face_warning_enabled !== false;
const tabSwitchLimit = Math.min(Math.max(Number(proctoringSettings.tab_switch_limit) || 5, 1), 100);
const warningLimit = Math.min(Math.max(Number(proctoringSettings.warning_limit) || 10, 1), 100);
const secureOrigin = `https://${location.host}`;
const secureCurrentUrl = `${secureOrigin}${location.pathname}${location.search}${location.hash}`;
const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname);
const isTryCloudflare = location.hostname.endsWith('.trycloudflare.com');
const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth <= 720;
const frameCheckMs = isMobileDevice ? 4000 : 2500;
const missingFaceLimit = isMobileDevice ? 4 : 3;
const multipleFaceLimit = isMobileDevice ? 4 : 2;
const isLanHttp = !window.isSecureContext && location.protocol === 'http:' && !isLocalHost && !isTryCloudflare;
const isInsecurePublicTunnel = isTryCloudflare && location.protocol === 'http:';
const lanOrigin = isInsecurePublicTunnel ? secureOrigin : location.origin;

if (isInsecurePublicTunnel) {
  window.location.replace(secureCurrentUrl);
}

if (lanOriginValue) {
  lanOriginValue.textContent = lanOrigin;
}

if (!protectedTestEnabled) {
  alarmMessage.innerText = 'Test protection is disabled by HR.';
  warningCount.innerText = '0';
  tabSwitchCount.innerText = '0';
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

submitInterviewButton?.addEventListener('click', () => showFinishNotice());

questionBackButton?.addEventListener('click', () => goToPreviousQuestion());

questionNextButton?.addEventListener('click', () => goToNextQuestion());

reviewLastQuestionButton?.addEventListener('click', () => {
  finishNotice.hidden = true;
});

confirmFinishButton?.addEventListener('click', () => submitInterview());

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
  if (!event.target.closest('textarea, input, select')) {
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
  if (!protectedTestEnabled) {
    proctoringNoticeAccepted = true;
    return Promise.resolve(true);
  }
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
  if (proctoringActive || !protectedTestEnabled) return;
  proctoringActive = true;
  alarmMessage.innerText = 'Monitoring camera and tab focus.';
  emotionStatus.innerText = 'Monitoring active';
  if (!frameInterval) {
    frameInterval = setInterval(sendFrame, frameCheckMs);
  }
}

async function ensureCameraReady() {
  if (!protectedTestEnabled) return true;
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
    questionCard = getCurrentQuestionCard();
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
  if (!protectedTestEnabled) return;
  if (kind === 'tab-switch' && !tabSwitchWarningEnabled) return;
  if (kind === 'focus-change' && !focusWarningEnabled) return;
  if (kind === 'missing-face' && !cameraWarningEnabled) return;
  if (kind === 'multiple-face' && !multipleFaceWarningEnabled) return;
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
  if (tabSwitchTotal >= tabSwitchLimit) {
    submitInterview('Auto submitted because tab switching reached the limit.');
  } else if (warningTotal >= warningLimit) {
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
      multipleFaceFrames = 0;
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
        triggerAlarm(missingFaceMessage, 'missing-face');
        missingFaceFrames = 0;
      }
    }
    if (data.multiple_faces && data.alert_level === 'danger') {
      multipleFaceFrames += 1;
      if (multipleFaceFrames >= multipleFaceLimit) {
        triggerAlarm(data.alert_reason || 'Suspicious camera activity: multiple faces detected.', 'multiple-face');
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
  startTotalTestTimer();
  activeSection = sectionName;
  activeQuestionIndex = 0;
  document.querySelectorAll('.test-section').forEach((item) => {
    item.hidden = true;
  });
  sectionLauncher.hidden = true;
  if (programmingTransition) {
    programmingTransition.hidden = true;
  }
  nextSectionButton.hidden = true;
  submitInterviewButton.hidden = sectionName !== 'Programming';
  if (questionFloatNav) {
    questionFloatNav.hidden = false;
  }
  showCurrentQuestion();
  updateSectionActions();
  timerSection.innerText = `${sectionName} Timer`;
  updateTimerDisplay();
  startSectionTimer();
  const firstInput = getCurrentQuestionCard()?.querySelector('textarea, input, select');
  if (firstInput) {
    firstInput.focus();
    activeAnswerId = firstInput.id || activeAnswerId;
  }
}

function isQuestionAnswered(question) {
  const answerBox = document.getElementById(`answer-${question.id}`);
  const selectedOption = document.querySelector(`input[name="answer-${question.id}"]:checked`);
  const tableAnswer = collectTableAnswer(question.id);
  return (answerBox && answerBox.value.trim().length > 0) || Boolean(selectedOption) || tableAnswer.trim().length > 0;
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

function sectionQuestions(sectionName = activeSection) {
  return window.QUESTIONS.filter((q) => q.category === sectionName);
}

function getCurrentQuestion() {
  return sectionQuestions()[activeQuestionIndex];
}

function getCurrentQuestionCard() {
  const question = getCurrentQuestion();
  if (!question) return null;
  return document.querySelector(`.question-card[data-question-id="${question.id}"]`);
}

function questionKey(question) {
  return String(question?.id ?? '');
}

function markCurrentQuestionSkippedIfNeeded() {
  const currentQuestion = getCurrentQuestion();
  if (currentQuestion && !isQuestionAnswered(currentQuestion)) {
    skippedQuestionIds.add(questionKey(currentQuestion));
  }
}

function clearSkippedIfAnswered(question) {
  if (question && isQuestionAnswered(question)) {
    skippedQuestionIds.delete(questionKey(question));
  }
}

function reportProgress() {
  if (!activeSection || submitted) return;
  const question = getCurrentQuestion();
  if (!question) return;
  clearTimeout(progressTimer);
  progressTimer = setTimeout(() => {
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: activeSection,
        question_number: activeQuestionIndex + 1,
        question_text: question.question || '',
      }),
    }).catch(() => {});
  }, 250);
}

function renderQuestionMap() {
  if (!questionMapPanel || !questionDotGrid) return;
  const questions = sectionQuestions();
  if (!activeSection || !questions.length) {
    questionMapPanel.hidden = true;
    questionDotGrid.innerHTML = '';
    return;
  }
  questionMapPanel.hidden = false;
  if (questionMapRound) {
    questionMapRound.innerText = `${activeSection} Round`;
  }
  if (questionMapSummary) {
    const answered = sectionAnsweredCount(activeSection);
    const skipped = questions.filter((question) => skippedQuestionIds.has(questionKey(question)) && !isQuestionAnswered(question)).length;
    questionMapSummary.innerText = `${answered}/${questions.length} answered, ${skipped} skipped`;
  }
  questionDotGrid.innerHTML = questions.map((question, index) => {
    const answered = isQuestionAnswered(question);
    const skipped = skippedQuestionIds.has(questionKey(question)) && !answered;
    const status = answered ? 'answered' : (skipped ? 'skipped' : 'unanswered');
    const active = index === activeQuestionIndex ? ' active' : '';
    return `<button class="question-dot ${status}${active}" type="button" data-question-index="${index}" aria-label="${activeSection} question ${index + 1} of ${questions.length}, ${status}">${index + 1}</button>`;
  }).join('');
}

questionDotGrid?.addEventListener('click', (event) => {
  const button = event.target.closest('.question-dot');
  if (!button || !activeSection || submitted) return;
  const targetIndex = Number(button.dataset.questionIndex);
  if (!Number.isInteger(targetIndex) || targetIndex === activeQuestionIndex) return;
  markCurrentQuestionSkippedIfNeeded();
  activeQuestionIndex = targetIndex;
  showCurrentQuestion();
  const input = getCurrentQuestionCard()?.querySelector('textarea, input:checked, input, select');
  if (input) {
    input.focus();
    activeAnswerId = input.id || activeAnswerId;
  }
});

function showCurrentQuestion() {
  const questions = sectionQuestions();
  const total = questions.length;
  document.querySelectorAll('.section-divider').forEach((item) => {
    item.hidden = true;
  });
  document.querySelectorAll('.question-card').forEach((item) => {
    item.hidden = true;
  });
  if (!activeSection || !total) {
    if (questionFloatNav) questionFloatNav.hidden = true;
    renderQuestionMap();
    return;
  }
  activeQuestionIndex = Math.min(Math.max(activeQuestionIndex, 0), total - 1);
  const card = getCurrentQuestionCard();
  if (card) {
    card.hidden = false;
    card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  if (questionFloatNav) {
    questionFloatNav.hidden = false;
  }
  renderQuestionMap();
  updateQuestionNavigation();
  reportProgress();
}

function updateQuestionNavigation() {
  const questions = sectionQuestions();
  const total = questions.length;
  const currentQuestion = getCurrentQuestion();
  const isLastQuestion = activeQuestionIndex >= total - 1;
  if (questionStepLabel) {
    questionStepLabel.innerText = total
      ? `${activeSection} Question ${activeQuestionIndex + 1} of ${total}`
      : 'No question available';
  }
  if (questionBackButton) {
    questionBackButton.disabled = activeQuestionIndex <= 0;
  }
  if (questionNextButton) {
    questionNextButton.disabled = !currentQuestion || !isQuestionAnswered(currentQuestion);
    if (activeSection === 'Aptitude') {
      questionNextButton.textContent = isLastQuestion ? 'Next Programming Session' : 'Next';
    } else {
      questionNextButton.textContent = isLastQuestion ? 'Finish Test' : 'Next';
    }
  }
  if (submitInterviewButton) {
    submitInterviewButton.hidden = activeSection !== 'Programming' || !isLastQuestion;
    submitInterviewButton.disabled = activeSection !== 'Programming' || !currentQuestion || !isQuestionAnswered(currentQuestion);
  }
}

function goToPreviousQuestion() {
  if (!activeSection || submitted || activeQuestionIndex <= 0) return;
  markCurrentQuestionSkippedIfNeeded();
  activeQuestionIndex -= 1;
  showCurrentQuestion();
  const input = getCurrentQuestionCard()?.querySelector('textarea, input:checked, input, select');
  if (input) {
    input.focus();
    activeAnswerId = input.id || activeAnswerId;
  }
}

function goToNextQuestion() {
  if (!activeSection || submitted) return;
  const currentQuestion = getCurrentQuestion();
  if (currentQuestion && !isQuestionAnswered(currentQuestion)) {
    showWarningPopup('Please answer this question before continuing.');
    updateQuestionNavigation();
    return;
  }
  const total = sectionQuestionTotal(activeSection);
  if (activeQuestionIndex < total - 1) {
    clearSkippedIfAnswered(currentQuestion);
    activeQuestionIndex += 1;
    showCurrentQuestion();
    const input = getCurrentQuestionCard()?.querySelector('textarea, input, select');
    if (input) {
      input.focus();
      activeAnswerId = input.id || activeAnswerId;
    }
    return;
  }
  if (activeSection === 'Aptitude') {
    clearSkippedIfAnswered(currentQuestion);
    aptitudeCompleted = true;
    showProgrammingTransition();
    return;
  }
  clearSkippedIfAnswered(currentQuestion);
  showFinishNotice();
}

function updateSectionActions() {
  if (nextSectionButton) {
    nextSectionButton.hidden = true;
  }
  updateQuestionNavigation();
}

function showProgrammingTransition() {
  fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      section: 'Aptitude completed',
      question_number: null,
      question_text: 'Waiting to start Programming',
    }),
  }).catch(() => {});
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
  if (questionFloatNav) {
    questionFloatNav.hidden = true;
  }
  if (questionMapPanel) {
    questionMapPanel.hidden = true;
  }
  timerSection.innerText = 'Aptitude completed';
  progressSection.innerText = 'Programming';
  answeredCountDisplay.innerText = '0';
  sectionQuestionCount.innerText = sectionQuestionTotal('Programming');
  updateTimerDisplay('Programming');
}

function showSectionLauncher() {
  document.querySelectorAll('.test-section').forEach((item) => {
    item.hidden = true;
  });
  sectionLauncher.hidden = false;
  if (programmingTransition) {
    programmingTransition.hidden = true;
  }
  if (questionFloatNav) {
    questionFloatNav.hidden = true;
  }
  if (questionMapPanel) {
    questionMapPanel.hidden = true;
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
  if (!isMobileDevice && activeSection && proctoringActive) {
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

function startTotalTestTimer() {
  if (testStarted || submitted) return;
  testStarted = true;
  clearInterval(totalTimerInterval);
  totalTimerInterval = setInterval(() => {
    if (submitted) return;
    totalTestRemaining -= 1;
    if (totalTestRemaining <= 0) {
      submitInterview('Total interview time limit ended. Test auto submitted.');
    }
  }, 1000);
}

function updateTimerDisplay(sectionName = activeSection) {
  const fallbackSection = aptitudeCompleted ? 'Programming' : 'Aptitude';
  const displaySection = sectionName || fallbackSection;
  const remaining = Math.max(sectionRemaining[displaySection] ?? DEFAULT_SECTION_SECONDS, 0);
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  timerDisplay.innerText = `${minutes}:${seconds}`;
}

function updateAnsweredCount() {
  const sectionName = activeSection || (aptitudeCompleted ? 'Programming' : 'Aptitude');
  if (activeSection) {
    const currentQuestion = getCurrentQuestion();
    clearSkippedIfAnswered(currentQuestion);
  }
  const count = sectionAnsweredCount(sectionName);
  progressSection.innerText = sectionName;
  sectionQuestionCount.innerText = sectionQuestionTotal(sectionName);
  answeredCountDisplay.innerText = count;
  renderQuestionMap();
  updateSectionActions();
  reportProgress();
}

function showFinishNotice() {
  if (!isSectionAnswered('Programming')) {
    showWarningPopup('Please answer all Programming questions before submitting.');
    return;
  }
  if (finishNotice) {
    finishNotice.hidden = false;
    confirmFinishButton?.focus();
    return;
  }
  submitInterview();
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
    if (!box) return;
    box.value = `${box.value} ${text}`.trim();
    updateAnsweredCount();
  };
  recognition.onerror = () => alert('Speech capture failed. Please try again or type your answer.');
  recognition.start();
}

function collectTableAnswer(questionId) {
  const tableWrap = document.querySelector(`[data-table-answer="${questionId}"]`);
  if (!tableWrap) return '';
  const rows = [...tableWrap.querySelectorAll('tbody tr')];
  const answerRows = rows.map((row, index) => {
    const pan = row.querySelector('[data-pan-field="pan"]')?.value.trim() || '';
    const result = row.querySelector('[data-pan-field="result"]')?.value.trim() || '';
    const remarks = row.querySelector('[data-pan-field="remarks"]')?.value.trim() || '';
    return {
      id: `TC ${String(index + 1).padStart(2, '0')}`,
      pan,
      result,
      remarks,
    };
  });
  const hasAnswer = answerRows.some((row) => row.pan || row.result || row.remarks);
  if (!hasAnswer) return '';
  return [
    '| Test Case ID | PAN Number | Result | Remarks |',
    '| --- | --- | --- | --- |',
    ...answerRows.map((row) => `| ${row.id} | ${row.pan || '-'} | ${row.result || '-'} | ${row.remarks || '-'} |`),
  ].join('\n');
}

async function submitInterview(autoSubmitReason = '') {
  if (submitted) return;
  submitted = true;
  clearTimeout(progressTimer);
  clearInterval(timerInterval);
  clearInterval(totalTimerInterval);
  clearInterval(frameInterval);
  document.querySelectorAll('button, input, textarea, select').forEach((control) => {
    control.disabled = true;
  });
  const answers = {};
  window.QUESTIONS.forEach((q) => {
    const selectedOption = document.querySelector(`input[name="answer-${q.id}"]:checked`);
    const answerBox = document.getElementById(`answer-${q.id}`);
    const tableAnswer = collectTableAnswer(q.id);
    const typedAnswer = answerBox ? answerBox.value.trim() : '';
    answers[q.id] = selectedOption ? selectedOption.value : (tableAnswer || typedAnswer);
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

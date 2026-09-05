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
const aiInterviewLauncher = document.getElementById('aiInterviewLauncher');
const programmingTransition = document.getElementById('programmingTransition');
const aiInterviewTransition = document.getElementById('aiInterviewTransition');
const startProgrammingButton = document.getElementById('startProgrammingButton');
const startAiInterviewLauncher = document.getElementById('startAiInterviewLauncher');
const startAiInterviewButton = document.getElementById('startAiInterviewButton');
const aiInterviewPanel = document.getElementById('aiInterviewPanel');
const aiInterviewStatus = document.getElementById('aiInterviewStatus');
const aiQuestionCounter = document.getElementById('aiQuestionCounter');
const aiSubtitle = document.getElementById('aiSubtitle');
const candidateSubtitle = document.getElementById('candidateSubtitle');
const aiManualAnswer = document.getElementById('aiManualAnswer');
const repeatAiQuestionButton = document.getElementById('repeatAiQuestionButton');
const saveAiAnswerButton = document.getElementById('saveAiAnswerButton');
const finishAiInterviewButton = document.getElementById('finishAiInterviewButton');
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
let programmingCompleted = false;
let aiInterviewStarted = false;
let aiInterviewCompleted = false;
let testStarted = false;
const sectionDurations = window.SECTION_DURATIONS || {};
const enabledSections = window.ENABLED_SECTIONS || { Aptitude: true, Programming: true, 'AI Interview': false };
const aiInterviewQuestions = window.AI_INTERVIEW_QUESTIONS || [];
const DEFAULT_SECTION_SECONDS = 20 * 60;
const MIN_APTITUDE_ANSWERS = 5;
const sectionRemaining = {
  Aptitude: Number(sectionDurations.Aptitude) || DEFAULT_SECTION_SECONDS,
  Programming: Number(sectionDurations.Programming) || DEFAULT_SECTION_SECONDS,
  'AI Interview': Number(sectionDurations['AI Interview']) || (25 * 60),
};
let totalTestRemaining = Number(window.TOTAL_TEST_SECONDS) || Object.entries(sectionRemaining).reduce((total, [section, seconds]) => {
  return total + (enabledSections[section] ? seconds : 0);
}, 0);
let aiRecognition;
let isListeningToCandidate = false;
let aiCurrentIndex = 0;
let aiCurrentTurn = null;
let aiTranscript = [];
let aiInterviewStartedAt = '';
let aiReportSaved = false;
let aiAnswerTimer;
let aiAnswerStatusTimer;
let aiMediaRecorder;
let aiAudioStream;
let aiAudioChunks = [];
let aiAudioSaved = false;
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

function aiPerQuestionSeconds() {
  return 40;
}

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
startAiInterviewLauncher?.addEventListener('click', () => startAiInterview());
startAiInterviewButton?.addEventListener('click', () => startAiInterview());

submitInterviewButton?.addEventListener('click', () => showFinishNotice());

questionBackButton?.addEventListener('click', () => goToPreviousQuestion());

questionNextButton?.addEventListener('click', () => goToNextQuestion());

reviewLastQuestionButton?.addEventListener('click', () => {
  finishNotice.hidden = true;
});

confirmFinishButton?.addEventListener('click', () => submitInterview());
repeatAiQuestionButton?.addEventListener('click', () => {
  const question = aiInterviewQuestions[aiCurrentIndex];
  if (!question) return;
  isListeningToCandidate = false;
  try { aiRecognition?.stop?.(); } catch (e) {}
  const reply = `Certainly! Here is the question again: ${question}`;
  if (aiSubtitle) aiSubtitle.innerText = reply;
  setAiEmotion('speaking', 'Repeating Question...');
  speakTextWithFallback(reply, () => {
    if (aiSubtitle) aiSubtitle.innerText = question;
    startCandidateListening();
  });
});
saveAiAnswerButton?.addEventListener('click', () => saveCurrentAiAnswer());
finishAiInterviewButton?.addEventListener('click', () => finishAiInterview());
aiManualAnswer?.addEventListener('input', () => {
  if (candidateSubtitle) {
    candidateSubtitle.innerText = aiManualAnswer.value.trim() || 'Listening for your answer...';
  }
  if (saveAiAnswerButton) {
    saveAiAnswerButton.disabled = !aiManualAnswer.value.trim();
  }
});

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
  if (sectionName === 'Aptitude' && !enabledSections.Aptitude) {
    showWarningPopup('Aptitude is disabled for this role.');
    return;
  }
  if (sectionName === 'Programming' && (!enabledSections.Programming || (enabledSections.Aptitude && !aptitudeCompleted))) {
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
  if (aiInterviewTransition) {
    aiInterviewTransition.hidden = true;
  }
  if (aiInterviewPanel) {
    aiInterviewPanel.hidden = true;
  }
  nextSectionButton.hidden = true;
  submitInterviewButton.hidden = !canSubmitFromWrittenSection(sectionName);
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

function hasEnabledWrittenSection(sectionName) {
  return enabledSections[sectionName] && sectionQuestionTotal(sectionName) > 0;
}

function lastWrittenSection() {
  if (hasEnabledWrittenSection('Programming')) return 'Programming';
  if (hasEnabledWrittenSection('Aptitude')) return 'Aptitude';
  return '';
}

function canSubmitFromWrittenSection(sectionName) {
  return !enabledSections['AI Interview'] && sectionName === lastWrittenSection();
}

function nextAfterWrittenSection(sectionName) {
  if (sectionName === 'Aptitude' && hasEnabledWrittenSection('Programming')) return 'Programming';
  if (enabledSections['AI Interview']) return 'AI Interview';
  return 'Submit';
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
    const nextSection = nextAfterWrittenSection(activeSection);
    if (isLastQuestion && nextSection === 'Programming') {
      questionNextButton.textContent = 'Next Programming Session';
    } else if (isLastQuestion && nextSection === 'AI Interview') {
      questionNextButton.textContent = 'Next AI HR Interview';
    } else if (isLastQuestion) {
      questionNextButton.textContent = 'Finish Test';
    } else {
      questionNextButton.textContent = 'Next';
    }
  }
  if (submitInterviewButton) {
    submitInterviewButton.hidden = !canSubmitFromWrittenSection(activeSection) || !isLastQuestion;
    submitInterviewButton.disabled = !canSubmitFromWrittenSection(activeSection) || !currentQuestion || !isQuestionAnswered(currentQuestion);
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
  const nextSection = nextAfterWrittenSection(activeSection);
  if (nextSection === 'Programming') {
    clearSkippedIfAnswered(currentQuestion);
    aptitudeCompleted = true;
    showProgrammingTransition();
    return;
  }
  if (nextSection === 'AI Interview') {
    clearSkippedIfAnswered(currentQuestion);
    if (activeSection === 'Aptitude') aptitudeCompleted = true;
    if (activeSection === 'Programming') programmingCompleted = true;
    showAiInterviewTransition();
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

function showAiInterviewTransition() {
  fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      section: 'Written test completed',
      question_number: null,
      question_text: 'Waiting to start AI HR Interview',
    }),
  }).catch(() => {});
  activeSection = '';
  clearInterval(timerInterval);
  document.querySelectorAll('.test-section').forEach((item) => {
    item.hidden = true;
  });
  sectionLauncher.hidden = true;
  if (programmingTransition) programmingTransition.hidden = true;
  if (aiInterviewTransition) aiInterviewTransition.hidden = false;
  nextSectionButton.hidden = true;
  submitInterviewButton.hidden = true;
  if (questionFloatNav) questionFloatNav.hidden = true;
  if (questionMapPanel) questionMapPanel.hidden = true;
  timerSection.innerText = 'AI HR Interview ready';
  progressSection.innerText = 'AI Interview';
  answeredCountDisplay.innerText = '0';
  sectionQuestionCount.innerText = aiInterviewQuestions.length;
  updateTimerDisplay('AI Interview');
}

const aiEmotionBadge = document.getElementById('aiEmotionBadge');
const voiceEqualizer = document.getElementById('voiceEqualizer');
const aiEncouragingBanner = document.getElementById('aiEncouragingBanner');
const candidateName = window.CANDIDATE_NAME || 'candidate';
let aiHesitationTimer;

function setAiEmotion(state, label) {
  if (aiEmotionBadge) {
    aiEmotionBadge.innerText = label;
    aiEmotionBadge.className = `emotion-badge ${state}`;
  }
  if (voiceEqualizer) {
    if (state === 'speaking') {
      voiceEqualizer.classList.add('active');
    } else {
      voiceEqualizer.classList.remove('active');
    }
  }
}

function showEncouragingBanner(show) {
  if (aiEncouragingBanner) {
    aiEncouragingBanner.hidden = !show;
  }
}

aiManualAnswer?.addEventListener('input', () => {
  showEncouragingBanner(false);
  setAiEmotion('listening', 'Listening Attentively...');
  const val = (aiManualAnswer.value || '').trim();
  if (candidateSubtitle) candidateSubtitle.innerText = val || 'Listening for your answer...';
  if (saveAiAnswerButton) saveAiAnswerButton.disabled = !val;
});

async function startAiInterview() {
  if (submitted || aiInterviewStarted || !enabledSections['AI Interview']) return;
  if (enabledSections.Aptitude && !aptitudeCompleted) {
    showWarningPopup('Please complete Aptitude before Round 3: AI HR Interview.');
    return;
  }
  if (enabledSections.Programming && !programmingCompleted) {
    showWarningPopup('Please complete Programming before Round 3: AI HR Interview.');
    return;
  }
  if (!(await showProctoringNotice())) return;
  if (!(await ensureCameraReady())) return;
  armProctoring();
  await startAiAudioRecording();
  requestFullscreenMode();
  startTotalTestTimer();
  aiInterviewStarted = true;
  activeSection = 'AI Interview';
  aiInterviewStartedAt = new Date().toISOString();
  sectionLauncher.hidden = true;
  if (programmingTransition) programmingTransition.hidden = true;
  if (aiInterviewTransition) aiInterviewTransition.hidden = true;
  if (aiInterviewPanel) aiInterviewPanel.hidden = false;
  if (questionFloatNav) questionFloatNav.hidden = true;
  if (questionMapPanel) questionMapPanel.hidden = true;
  timerSection.innerText = 'Round 3: AI HR Interview';
  updateTimerDisplay('AI Interview');
  startSectionTimer();
  playAiIntroSpeech();
}

let aiSupervisorInterval = null;
let candidateTranscript = '';
let candidateQuestionCheckTimer = null;
let lastProcessedQuestionText = '';

function escapeHtml(text) {
  return (text || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let candidateAudioContext = null;
let candidateAnalyser = null;
let candidateGainNode = null;
let candidateAnimFrame = null;

function initCandidateAudioVisualizer(stream) {
  if (!stream || candidateAudioContext) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    candidateAudioContext = new AudioCtx();
    const source = candidateAudioContext.createMediaStreamSource(stream);

    // High-pass filter to eliminate low Bluetooth/AirPods proximity rumble
    const highpass = candidateAudioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(80, candidateAudioContext.currentTime);

    // Dynamic Range Compressor to equalize soft / quiet candidate speech
    const compressor = candidateAudioContext.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-50, candidateAudioContext.currentTime);
    compressor.knee.setValueAtTime(40, candidateAudioContext.currentTime);
    compressor.ratio.setValueAtTime(12, candidateAudioContext.currentTime);
    compressor.attack.setValueAtTime(0, candidateAudioContext.currentTime);
    compressor.release.setValueAtTime(0.25, candidateAudioContext.currentTime);

    // 8.0x Gain sensitivity boost for AirPods / Bluetooth microphone input
    candidateGainNode = candidateAudioContext.createGain();
    candidateGainNode.gain.value = 8.0;

    candidateAnalyser = candidateAudioContext.createAnalyser();
    candidateAnalyser.fftSize = 64;

    source.connect(highpass);
    highpass.connect(compressor);
    compressor.connect(candidateGainNode);
    candidateGainNode.connect(candidateAnalyser);

    const eqEl = document.getElementById('candidateVoiceEqualizer');
    const bars = eqEl ? eqEl.querySelectorAll('.bar') : [];
    const dataArray = new Uint8Array(candidateAnalyser.frequencyBinCount);

    let quietCount = 0;

    function renderEqualizer() {
      if (candidateAudioContext && candidateAudioContext.state === 'suspended') {
        candidateAudioContext.resume().catch(() => {});
      }

      if (!isListeningToCandidate || aiInterviewCompleted) {
        bars.forEach((b) => { b.style.height = '4px'; });
        if (eqEl) eqEl.classList.remove('active');
        candidateAnimFrame = requestAnimationFrame(renderEqualizer);
        return;
      }

      candidateAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i += 1) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;

      if (avg >= 1 && avg <= 6) {
        quietCount += 1;
        if (quietCount > 500) {
          quietCount = 0;
          speakVolumePrompt();
        }
      } else {
        quietCount = 0;
      }

      if (avg > 1) {
        if (eqEl) eqEl.classList.add('active');
        bars.forEach((bar, idx) => {
          const sampleIdx = Math.floor((idx / bars.length) * dataArray.length);
          const val = dataArray[sampleIdx] || avg;
          const dynamicFactor = Math.sin(Date.now() / 150 + idx) * 3 + 2;
          const h = Math.min(Math.max(Math.round((val / 128) * 16 + dynamicFactor), 5), 16);
          bar.style.height = `${h}px`;
        });
      } else {
        if (eqEl) eqEl.classList.remove('active');
        bars.forEach((b) => { b.style.height = '4px'; });
      }

      candidateAnimFrame = requestAnimationFrame(renderEqualizer);
    }

    renderEqualizer();
  } catch (e) {}
}

function speakVolumePrompt() {
  const promptText = "Could you please speak a little louder so I can capture your answer clearly?";
  showEncouragingBanner(true);
  setAiEmotion('encouraging', 'Volume Check — Speak Louder');
  const currentQuestionText = aiInterviewQuestions[aiCurrentIndex] || '';

  isListeningToCandidate = false;
  try { aiRecognition?.stop?.(); } catch (e) {}

  speakTextWithWordHighlight(promptText, () => {
    if (aiSubtitle) aiSubtitle.innerText = currentQuestionText;
    startCandidateListening();
  });
}

function evaluateVoiceCommands(rawText) {
  const lower = (rawText || '').toLowerCase().trim();
  if (!lower || !isListeningToCandidate || aiInterviewCompleted) return false;

  // Voice Command 1: Next Question
  if (/\b(next question|move next|save and next|go to next|next)\b/i.test(lower)) {
    saveCurrentAiAnswer();
    return true;
  }

  // Voice Command 2: Repeat Question
  if (/\b(repeat question|repeat the question|say again|pardon|repeat)\b/i.test(lower)) {
    const question = aiInterviewQuestions[aiCurrentIndex];
    if (!question) return true;
    isListeningToCandidate = false;
    try { aiRecognition?.stop?.(); } catch (e) {}
    const reply = `Certainly! Here is the question again: ${question}`;
    setAiEmotion('speaking', 'Repeating Question...');
    speakTextWithWordHighlight(reply, () => {
      if (aiSubtitle) aiSubtitle.innerText = question;
      startCandidateListening();
    });
    return true;
  }

  return false;
}

let aiSTTLoopTimer = null;

function sendAudioChunkForSTT() {
  if (!isListeningToCandidate || aiInterviewCompleted || !aiAudioStream) return;

  let recorder;
  try {
    const preferredType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');

    recorder = preferredType ? new MediaRecorder(aiAudioStream, { mimeType: preferredType }) : new MediaRecorder(aiAudioStream);
  } catch (e) {
    return;
  }

  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = async () => {
    if (chunks.length === 0 || !isListeningToCandidate || aiInterviewCompleted) return;
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    if (blob.size < 300) return;

    const formData = new FormData();
    formData.append('audio', blob, 'chunk.webm');
    try {
      const res = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.text && data.text.trim()) {
        const newText = data.text.trim();
        showEncouragingBanner(false);
        setAiEmotion('listening', 'Listening Attentively...');

        if (evaluateVoiceCommands(newText)) return;

        let currentVal = (aiManualAnswer?.value || '').trim();
        const words = newText.split(/\s+/);
        const missingWords = words.filter((w) => w.length > 1 && !currentVal.toLowerCase().includes(w.toLowerCase()));
        if (missingWords.length > 0) {
          const appendText = missingWords.join(' ');
          currentVal = currentVal ? `${currentVal} ${appendText}` : newText;
          if (aiManualAnswer) {
            aiManualAnswer.value = currentVal;
            aiManualAnswer.scrollTop = aiManualAnswer.scrollHeight;
          }
          if (candidateSubtitle) {
            candidateSubtitle.innerText = currentVal;
          }
          if (saveAiAnswerButton) {
            saveAiAnswerButton.disabled = false;
          }
          checkAndAnswerCandidateQuestion(currentVal);
        }
      }
    } catch (err) {}
  };

  recorder.start();
  setTimeout(() => {
    if (recorder.state === 'recording') {
      try { recorder.stop(); } catch (e) {}
    }
  }, 2200);
}

function startContinuousAudioTranscribe() {
  stopContinuousAudioTranscribe();
  aiSTTLoopTimer = setInterval(() => {
    if (isListeningToCandidate && !aiInterviewCompleted) {
      sendAudioChunkForSTT();
    }
  }, 2500);
}

function stopContinuousAudioTranscribe() {
  if (aiSTTLoopTimer) {
    clearInterval(aiSTTLoopTimer);
    aiSTTLoopTimer = null;
  }
}

function speakTextWithWordHighlight(text, onEnd) {
  window.speechSynthesis?.cancel();
  let called = false;
  const safeDone = () => {
    if (called) return;
    called = true;
    clearTimeout(fallbackTimer);
    onEnd?.();
  };

  if (aiSubtitle) {
    const rawWords = text.split(/(\s+)/);
    let html = '';
    let currOffset = 0;
    rawWords.forEach((token) => {
      if (token.trim()) {
        html += `<span class="word-span" data-start="${currOffset}" data-end="${currOffset + token.length}">${escapeHtml(token)}</span>`;
      } else {
        html += token;
      }
      currOffset += token.length;
    });
    aiSubtitle.innerHTML = html;
  }

  const estimatedMs = Math.max(Math.round(text.length * 90) + 1800, 3000);
  const fallbackTimer = setTimeout(safeDone, estimatedMs);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-IN';
  utterance.rate = 0.88;
  utterance.pitch = 1.02;
  utterance.onend = safeDone;
  utterance.onerror = safeDone;

  utterance.onboundary = (event) => {
    if (event.name === 'word' && aiSubtitle) {
      const charIdx = event.charIndex;
      const spans = aiSubtitle.querySelectorAll('.word-span');
      spans.forEach((span) => {
        const start = parseInt(span.getAttribute('data-start') || '0', 10);
        const end = parseInt(span.getAttribute('data-end') || '0', 10);
        if (charIdx >= start && charIdx < end) {
          span.classList.add('word-highlight');
        } else {
          span.classList.remove('word-highlight');
        }
      });
    }
  };

function prepareBluetoothAudioRouting() {
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'WITTMANN AI Interviewer',
        artist: 'AI Interviewer Bot',
        album: 'Round 3: AI Interview',
      });
      navigator.mediaSession.setActionHandler('play', () => {});
      navigator.mediaSession.setActionHandler('pause', () => {});
    } catch (e) {}
  }
  if (window.speechSynthesis) {
    try {
      window.speechSynthesis.resume();
    } catch (e) {}
  }
}

  prepareBluetoothAudioRouting();
  if (window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      safeDone();
    }
  } else {
    safeDone();
  }
}

function startSpeechSupervisor() {
  if (aiSupervisorInterval) return;
  aiSupervisorInterval = setInterval(() => {
    if (isListeningToCandidate && !aiInterviewCompleted && activeSection === 'AI Interview') {
      try {
        aiRecognition?.start?.();
      } catch (e) {
        // Recognition active
      }
    }
  }, 1200);
}

function stopSpeechSupervisor() {
  if (aiSupervisorInterval) {
    clearInterval(aiSupervisorInterval);
    aiSupervisorInterval = null;
  }
}

function playAiIntroSpeech() {
  const introText = `Hello ${candidateName}, welcome to Round 3 of your interview! I am your WITTMANN AI Interviewer. Please relax, feel comfortable, and share your experiences naturally. If you ever need a moment or have any questions, feel free to ask me anytime. Ready? Let's get started with your first question!`;
  if (aiInterviewStatus) aiInterviewStatus.innerText = 'AI Interview Introduction';
  if (candidateSubtitle) candidateSubtitle.innerText = 'Please listen to the AI Interviewer introduction...';
  setAiEmotion('speaking', 'Speaking Introduction...');
  showEncouragingBanner(false);

  speakTextWithWordHighlight(introText, () => {
    setAiEmotion('warm', 'Attentive & Professional');
    askAiQuestion();
  });
}

function checkAndAnswerCandidateQuestion(transcriptText) {
  const clean = (transcriptText || '').trim();
  if (!clean || clean === lastProcessedQuestionText || clean.length < 3) return;

  if (evaluateVoiceCommands(clean)) return;

  const lower = clean.toLowerCase();
  const questionTriggers = ['repeat', 'say again', 'pardon', 'didn\'t hear', 'what do you mean', 'explain', 'clarify', 'what is', 'can you', 'could you', 'how do'];
  const isQuestion = lower.endsWith('?') || questionTriggers.some((w) => lower.includes(w));

  if (!isQuestion) return;
  lastProcessedQuestionText = clean;

  const currentQuestionText = aiInterviewQuestions[aiCurrentIndex] || '';
  fetch('/api/ai-hr-reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candidate_text: clean,
      current_question: currentQuestionText,
    }),
  })
  .then((res) => res.json())
  .then((data) => {
    if (!data.reply) return;
    isListeningToCandidate = false;
    try { aiRecognition?.stop?.(); } catch (e) {}

    const originalQuestion = currentQuestionText;
    setAiEmotion('speaking', 'Answering Candidate...');

    speakTextWithWordHighlight(data.reply, () => {
      if (aiSubtitle) aiSubtitle.innerText = originalQuestion;
      startCandidateListening();
    });
  })
  .catch(() => {});
}

function speakEncouragement() {
  const reassureText = "Don't panic — take a deep breath and feel free to answer in your own words.";
  showEncouragingBanner(true);
  setAiEmotion('encouraging', 'Empathetic Guide');
  const currentQuestionText = aiInterviewQuestions[aiCurrentIndex] || '';

  isListeningToCandidate = false;
  try { aiRecognition?.stop?.(); } catch (e) {}

  speakTextWithWordHighlight(reassureText, () => {
    if (aiSubtitle) aiSubtitle.innerText = currentQuestionText;
    startCandidateListening();
  });
}

async function startAiAudioRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || aiMediaRecorder) return;
  try {
    const audioConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    };
    aiAudioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
    initCandidateAudioVisualizer(aiAudioStream);
    const preferredType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    aiMediaRecorder = preferredType
      ? new MediaRecorder(aiAudioStream, { mimeType: preferredType })
      : new MediaRecorder(aiAudioStream);
    aiAudioChunks = [];
    aiMediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        aiAudioChunks.push(event.data);
      }
    };
    aiMediaRecorder.start(1000);
  } catch (error) {
    showWarningPopup('Microphone recording could not start. The AI transcript will still be saved.');
  }
}

function stopAiAudioRecording() {
  if (aiAudioSaved) return Promise.resolve();
  if (!aiMediaRecorder || aiMediaRecorder.state === 'inactive') {
    aiAudioStream?.getTracks?.().forEach((track) => track.stop());
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    aiMediaRecorder.onstop = async () => {
      try {
        aiAudioStream?.getTracks?.().forEach((track) => track.stop());
        const blob = new Blob(aiAudioChunks, { type: aiMediaRecorder.mimeType || 'audio/webm' });
        if (blob.size > 0) {
          const formData = new FormData();
          formData.append('audio', blob, 'ai-hr-interview.webm');
          await fetch('/api/ai-interview-audio', {
            method: 'POST',
            body: formData,
          });
          aiAudioSaved = true;
        }
      } catch (error) {
        showWarningPopup('AI audio recording could not be uploaded. The transcript report will still be saved.');
      }
      resolve();
    };
    aiMediaRecorder.stop();
  });
}

function speakCurrentAiQuestion() {
  const question = aiInterviewQuestions[aiCurrentIndex];
  if (!question) return;
  isListeningToCandidate = false;
  try { aiRecognition?.stop?.(); } catch (e) {}
  showEncouragingBanner(false);
  setAiEmotion('speaking', 'Speaking Question...');
  aiCurrentTurn.ai_started_at = aiCurrentTurn.ai_started_at || new Date().toISOString();

  speakTextWithWordHighlight(question, () => {
    aiCurrentTurn.ai_finished_at = new Date().toISOString();
    startCandidateListening();
  });
}

function askAiQuestion() {
  clearTimeout(aiAnswerTimer);
  clearInterval(aiAnswerStatusTimer);
  clearTimeout(aiHesitationTimer);
  clearTimeout(candidateQuestionCheckTimer);
  showEncouragingBanner(false);

  const question = aiInterviewQuestions[aiCurrentIndex];
  if (!question) {
    finishAiInterview();
    return;
  }

  candidateTranscript = '';
  lastProcessedQuestionText = '';
  aiCurrentTurn = {
    question_number: aiCurrentIndex + 1,
    question_text: question,
    ai_started_at: '',
    ai_finished_at: '',
    candidate_started_at: '',
    candidate_finished_at: '',
    candidate_answer: '',
    answer_seconds: 0,
    timed_out: false,
  };

  if (aiInterviewStatus) aiInterviewStatus.innerText = `Question ${aiCurrentIndex + 1} of ${aiInterviewQuestions.length}`;
  if (aiQuestionCounter) aiQuestionCounter.innerText = `${aiCurrentIndex + 1}/${aiInterviewQuestions.length} questions`;
  if (candidateSubtitle) candidateSubtitle.innerText = 'Please listen to the question.';
  if (aiManualAnswer) aiManualAnswer.value = '';
  if (saveAiAnswerButton) saveAiAnswerButton.disabled = true;

  fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      section: 'AI Interview',
      question_number: aiCurrentIndex + 1,
      question_text: question,
    }),
  }).catch(() => {});

  speakCurrentAiQuestion();
}

function startCandidateListening() {
  if (!aiCurrentTurn) return;
  isListeningToCandidate = true;
  if (candidateAudioContext && candidateAudioContext.state === 'suspended') {
    try { candidateAudioContext.resume(); } catch (e) {}
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  aiCurrentTurn.candidate_started_at = aiCurrentTurn.candidate_started_at || new Date().toISOString();
  
  const currentVal = (aiManualAnswer?.value || '').trim();
  if (candidateSubtitle) candidateSubtitle.innerText = currentVal || 'Listening for your answer...';
  if (aiInterviewStatus) aiInterviewStatus.innerText = `Question ${aiCurrentIndex + 1} - Listening`;
  setAiEmotion('listening', 'Listening Attentively...');
  showEncouragingBanner(false);

  startAiAnswerTimer();
  startSpeechSupervisor();
  startContinuousAudioTranscribe();

  clearTimeout(aiHesitationTimer);
  aiHesitationTimer = setTimeout(() => {
    if (isListeningToCandidate && !aiCurrentTurn.candidate_answer && !(aiManualAnswer?.value || '').trim()) {
      speakEncouragement();
    }
  }, 15000);

  if (!SpeechRecognition) {
    aiManualAnswer?.focus();
    return;
  }

  try { aiRecognition?.stop?.(); } catch (e) {}

  aiRecognition = new SpeechRecognition();
  aiRecognition.lang = 'en-IN';
  aiRecognition.continuous = true;
  aiRecognition.interimResults = true;

  aiRecognition.onresult = (event) => {
    showEncouragingBanner(false);
    setAiEmotion('listening', 'Listening Attentively...');
    let interim = '';
    let currentFinal = (aiManualAnswer?.value || '').trim();
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const text = event.results[index][0].transcript;
      if (event.results[index].isFinal) {
        const trimmed = text.trim();
        if (trimmed && !currentFinal.toLowerCase().includes(trimmed.toLowerCase())) {
          currentFinal = currentFinal ? `${currentFinal} ${trimmed}` : trimmed;
        }
      } else {
        interim = `${interim} ${text}`.trim();
      }
    }
    const combined = `${currentFinal} ${interim}`.trim();
    if (evaluateVoiceCommands(combined)) return;

    if (aiManualAnswer) {
      aiManualAnswer.value = combined;
      aiManualAnswer.scrollTop = aiManualAnswer.scrollHeight;
    }
    if (candidateSubtitle) {
      candidateSubtitle.innerText = combined || 'Listening for your answer...';
    }
    if (saveAiAnswerButton) {
      saveAiAnswerButton.disabled = !combined;
    }

    clearTimeout(candidateQuestionCheckTimer);
    candidateQuestionCheckTimer = setTimeout(() => {
      checkAndAnswerCandidateQuestion(combined);
    }, 1800);
  };

  aiRecognition.onerror = () => {
    showEncouragingBanner(false);
    if (saveAiAnswerButton) saveAiAnswerButton.disabled = !(aiManualAnswer?.value || '').trim();
  };

  aiRecognition.onend = () => {
    if (isListeningToCandidate && !aiInterviewCompleted) {
      try {
        aiRecognition.start();
      } catch (e) {}
    }
  };

  try {
    aiRecognition.start();
  } catch (e) {}
}

function startAiAnswerTimer() {
  clearTimeout(aiAnswerTimer);
  clearInterval(aiAnswerStatusTimer);
  const limit = aiPerQuestionSeconds();
  const started = Date.now();
  const updateStatus = () => {
    const elapsed = Math.floor((Date.now() - started) / 1000);
    const remaining = Math.max(limit - elapsed, 0);
    if (aiInterviewStatus) {
      aiInterviewStatus.innerText = `Question ${aiCurrentIndex + 1} - Listening (${remaining}s left)`;
    }
  };
  updateStatus();
  aiAnswerStatusTimer = setInterval(updateStatus, 1000);
  aiAnswerTimer = setTimeout(() => {
    showWarningPopup('Answer time ended. Moving to the next AI HR question.');
    saveCurrentAiAnswer({ allowBlank: true, timedOut: true });
  }, limit * 1000);
}

function speakTransitionAndAskNext() {
  const transitions = [
    "Thank you! Let's move on to your next question.",
    "Thank you for sharing that answer. Here is your next question.",
    "Good response. Let's continue to your next question.",
  ];
  const transitionText = transitions[aiCurrentIndex % transitions.length];
  if (candidateSubtitle) candidateSubtitle.innerText = 'Please listen to the AI HR Interviewer...';
  setAiEmotion('speaking', 'Human Transition...');

  speakTextWithWordHighlight(transitionText, () => {
    askAiQuestion();
  });
}

function saveCurrentAiAnswer(options = {}) {
  if (!aiCurrentTurn) return;
  isListeningToCandidate = false;
  stopSpeechSupervisor();
  stopContinuousAudioTranscribe();
  const answer = (aiManualAnswer?.value || '').trim();
  if (!answer && !options.allowBlank) {
    showWarningPopup('Please answer before saving, or wait for the timer to move forward.');
    return;
  }
  clearTimeout(aiAnswerTimer);
  clearInterval(aiAnswerStatusTimer);
  clearTimeout(aiHesitationTimer);
  showEncouragingBanner(false);
  setAiEmotion('warm', 'Attentive & Professional');
  try { aiRecognition?.stop?.(); } catch (e) {}
  aiCurrentTurn.candidate_finished_at = new Date().toISOString();
  aiCurrentTurn.candidate_answer = answer;
  aiCurrentTurn.timed_out = Boolean(options.timedOut);
  const started = Date.parse(aiCurrentTurn.candidate_started_at || '');
  const finished = Date.parse(aiCurrentTurn.candidate_finished_at || '');
  aiCurrentTurn.answer_seconds = Number.isFinite(started) && Number.isFinite(finished)
    ? Math.max(Math.round((finished - started) / 1000), 0)
    : 0;
  aiTranscript.push(aiCurrentTurn);
  answeredCountDisplay.innerText = String(aiTranscript.length);

  const maxQuestions = Math.min(aiInterviewQuestions.length || 15, 15);
  if (aiCurrentIndex >= maxQuestions - 1) {
    aiInterviewCompleted = true;
    if (aiInterviewStatus) aiInterviewStatus.innerText = 'All 15 questions completed';
    if (finishAiInterviewButton) finishAiInterviewButton.hidden = false;
    if (saveAiAnswerButton) saveAiAnswerButton.disabled = true;
    finishAiInterview();
    return;
  }
  aiCurrentIndex += 1;
  speakTransitionAndAskNext();
}

async function saveAiInterviewReport(autoSubmitReason = '') {
  if (!enabledSections['AI Interview'] || !aiTranscript.length || aiReportSaved) return;
  await fetch('/api/ai-interview-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      started_at: aiInterviewStartedAt,
      completed_at: new Date().toISOString(),
      auto_submit_reason: autoSubmitReason,
      turns: aiTranscript,
    }),
  }).then(() => {
    aiReportSaved = true;
  }).catch(() => {});
}

async function finishAiInterview() {
  if (submitted) return;
  isListeningToCandidate = false;
  stopSpeechSupervisor();
  clearTimeout(aiAnswerTimer);
  clearInterval(aiAnswerStatusTimer);
  if (aiCurrentTurn && !aiTranscript.includes(aiCurrentTurn)) {
    const answer = (aiManualAnswer?.value || '').trim();
    if (answer) {
      aiCurrentTurn.candidate_finished_at = new Date().toISOString();
      aiCurrentTurn.candidate_answer = answer;
      const started = Date.parse(aiCurrentTurn.candidate_started_at || '');
      const finished = Date.parse(aiCurrentTurn.candidate_finished_at || '');
      aiCurrentTurn.answer_seconds = Number.isFinite(started) && Number.isFinite(finished)
        ? Math.max(Math.round((finished - started) / 1000), 0)
        : 0;
      aiTranscript.push(aiCurrentTurn);
    }
  }
  aiInterviewCompleted = true;

  const closingText = `Thank you so much, ${candidateName}. You have completed Round 3 of your interview. Your responses have been saved successfully. Have a wonderful day!`;
  if (aiSubtitle) aiSubtitle.innerText = closingText;
  if (candidateSubtitle) candidateSubtitle.innerText = 'Interview completed. Submitting results...';
  setAiEmotion('speaking', 'Interview Completed');

  await new Promise((resolve) => {
    speakTextWithWordHighlight(closingText, resolve);
  });

  await stopAiAudioRecording();
  await saveAiInterviewReport();
  submitInterview();
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
  if (aiInterviewLauncher && (!enabledSections.Aptitude || aptitudeCompleted) && (!enabledSections.Programming || programmingCompleted)) {
    aiInterviewLauncher.classList.remove('locked');
    const button = aiInterviewLauncher.querySelector('button');
    if (button) {
      button.disabled = false;
      button.textContent = 'Start AI Interview';
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
        if (hasEnabledWrittenSection('Programming')) {
          showProgrammingTransition();
          showWarningPopup('Aptitude time ended. Please start Programming.');
        } else if (enabledSections['AI Interview']) {
          showAiInterviewTransition();
          showWarningPopup('Aptitude time ended. Please start the AI HR Interview.');
        } else {
          submitInterview('Aptitude time limit ended. Test auto submitted.');
        }
      } else if (activeSection === 'Programming' && enabledSections['AI Interview']) {
        programmingCompleted = true;
        activeSection = '';
        clearInterval(timerInterval);
        showAiInterviewTransition();
        showWarningPopup('Programming time ended. Please start the AI HR Interview.');
      } else if (activeSection === 'AI Interview') {
        finishAiInterview();
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
  const fallbackSection = enabledSections.Aptitude && !aptitudeCompleted
    ? 'Aptitude'
    : (enabledSections.Programming && !programmingCompleted ? 'Programming' : 'AI Interview');
  const displaySection = sectionName || fallbackSection;
  const remaining = Math.max(sectionRemaining[displaySection] ?? DEFAULT_SECTION_SECONDS, 0);
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  timerDisplay.innerText = `${minutes}:${seconds}`;
}

function updateAnsweredCount() {
  const sectionName = activeSection || (enabledSections.Aptitude && !aptitudeCompleted ? 'Aptitude' : (enabledSections.Programming ? 'Programming' : 'AI Interview'));
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
  const finalSection = lastWrittenSection();
  if (finalSection && !isSectionAnswered(finalSection)) {
    showWarningPopup(`Please answer all ${finalSection} questions before submitting.`);
    return;
  }
  if (enabledSections['AI Interview'] && !aiInterviewCompleted) {
    showAiInterviewTransition();
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
  clearTimeout(aiAnswerTimer);
  clearInterval(aiAnswerStatusTimer);
  if (aiCurrentTurn && !aiTranscript.includes(aiCurrentTurn)) {
    const answer = (aiManualAnswer?.value || '').trim();
    aiCurrentTurn.candidate_finished_at = new Date().toISOString();
    aiCurrentTurn.candidate_answer = answer;
    aiCurrentTurn.timed_out = Boolean(autoSubmitReason);
    const started = Date.parse(aiCurrentTurn.candidate_started_at || '');
    const finished = Date.parse(aiCurrentTurn.candidate_finished_at || '');
    aiCurrentTurn.answer_seconds = Number.isFinite(started) && Number.isFinite(finished)
      ? Math.max(Math.round((finished - started) / 1000), 0)
      : 0;
    if (answer || activeSection === 'AI Interview') {
      aiTranscript.push(aiCurrentTurn);
    }
  }
  aiRecognition?.stop?.();
  await stopAiAudioRecording();
  await saveAiInterviewReport(autoSubmitReason);
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

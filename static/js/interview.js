const video = document.getElementById('video');
const canvas = document.getElementById('snapshot');
const faceStatus = document.getElementById('faceStatus');
const emotionStatus = document.getElementById('emotionStatus');
let activeAnswerId = 'answer-1';

document.querySelectorAll('textarea').forEach(t => {
  t.addEventListener('focus', () => activeAnswerId = t.id);
});

async function startCamera(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    video.srcObject = stream;
    setInterval(sendFrame, 2500);
  }catch(e){
    faceStatus.innerText = 'Camera permission denied. Text interview still works.';
  }
}

async function sendFrame(){
  if(!video.videoWidth) return;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const image = canvas.toDataURL('image/jpeg',0.65);
  try{
    const res = await fetch('/api/analyze-frame',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image})});
    const data = await res.json();
    if(data.face_detected){
      faceStatus.innerText = 'Face detected ✓';
      emotionStatus.innerText = `Emotion: ${data.emotion} — ${data.confidence_hint}`;
    }else{
      faceStatus.innerText = 'Face not centered';
      emotionStatus.innerText = data.confidence_hint || 'Adjust camera position';
    }
  }catch(e){ }
}

function updateAnsweredCount(){
  const count = window.QUESTIONS.filter(q => document.getElementById(`answer-${q.id}`).value.trim().length > 0).length;
  document.getElementById('answeredCount').innerText = count;
}

function startSpeech(){
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognition){ alert('Speech recognition is not supported in this browser. Please use Chrome or type your answer.'); return; }
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onstart = () => emotionStatus.innerText = 'Listening... speak your answer clearly';
  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    const box = document.getElementById(activeAnswerId);
    box.value = `${box.value} ${text}`.trim();
    updateAnsweredCount();
  };
  recognition.onerror = () => alert('Speech capture failed. Please try again or type your answer.');
  recognition.start();
}

async function submitInterview(){
  const candidate_name = document.getElementById('candidateName').value || 'Candidate';
  const answers = {};
  window.QUESTIONS.forEach(q => answers[q.id] = document.getElementById(`answer-${q.id}`).value.trim());
  const res = await fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({candidate_name,answers})});
  const data = await res.json();
  renderResults(data);
}

function renderResults(data){
  const results = document.getElementById('results');
  results.hidden = false;
  results.innerHTML = `<h2>Interview Results</h2><h3>Overall Score: ${data.overall_score}%</h3><p><strong>Face Confidence Index:</strong> ${data.face_summary.confidence_index}%</p>`;
  data.results.forEach((r,i)=>{
    results.innerHTML += `<div class="result-card"><h3>${i+1}. ${r.question.category} — ${r.score.total_score}%</h3><div class="score-line"><div class="score-fill" style="width:${r.score.total_score}%"></div></div><p>${r.feedback}</p><p><strong>Matched:</strong> ${r.score.matched_keywords.join(', ') || 'None'}</p><p><strong>Improve with:</strong> ${r.score.missing_keywords.slice(0,4).join(', ') || 'Good coverage'}</p></div>`;
  });
  results.innerHTML += `<a class="btn primary download-link" href="${data.report_url}">Download PDF Report</a>`;
  results.scrollIntoView({behavior:'smooth'});
}

startCamera();
updateAnsweredCount();

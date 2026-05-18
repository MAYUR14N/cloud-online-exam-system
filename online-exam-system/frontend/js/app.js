// js/app.js – Frontend logic for Online Exam System
// This script works across admin.html, student.html, exam.html, and result.html
// It uses sessionStorage for simple authentication (no JWT, cookies).

// Helper: Determine current page by filename
const page = location.pathname.split('/').pop();

// API base (same origin)
const API = '';

// Utility fetch wrappers
async function apiPost(path, data) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  return res.json();
}
async function apiDelete(path, data) {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ---------- ADMIN PAGE LOGIC ----------
if (page === 'admin.html') {
  const loginForm = document.getElementById('admin-login-form');
  const dashboard = document.getElementById('admin-dashboard');
  const questionsTableBody = document.querySelector('#questions-table tbody');
  const addForm = document.getElementById('add-question-form');

  // Show dashboard if already logged in
  if (sessionStorage.getItem('adminUser')) {
    loginForm.style.display = 'none';
    dashboard.classList.remove('hidden');
    loadQuestions();
  }

  loginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    const resp = await apiPost('/login', { username, password });
    if (resp.success && resp.role === 'admin') {
      sessionStorage.setItem('adminUser', JSON.stringify({ username, password }));
      loginForm.style.display = 'none';
      dashboard.classList.remove('hidden');
      loadQuestions();
    } else {
      alert('Invalid admin credentials');
    }
  });

  async function loadQuestions() {
    const questions = await apiGet('/questions');
    questionsTableBody.innerHTML = '';
    questions.forEach(q => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${q.id}</td>
        <td>${q.question}</td>
        <td><button class="btn delete-btn" data-id="${q.id}">Delete</button></td>`;
      questionsTableBody.appendChild(tr);
    });
    // Attach delete handlers
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { username, password } = JSON.parse(sessionStorage.getItem('adminUser'));
        const id = btn.dataset.id;
        await apiDelete(`/delete-question/${id}`, { username, password });
        loadQuestions();
      });
    });
  }

  addForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const { username, password } = JSON.parse(sessionStorage.getItem('adminUser'));
    const question = {
      question: document.getElementById('new-question').value.trim(),
      optionA: document.getElementById('option-a').value.trim(),
      optionB: document.getElementById('option-b').value.trim(),
      optionC: document.getElementById('option-c').value.trim(),
      optionD: document.getElementById('option-d').value.trim(),
      answer: document.getElementById('correct-option').value.trim().toLowerCase()
    };
    await apiPost('/add-question', { username, password, question });
    addForm.reset();
    loadQuestions();
  });
}

// ---------- STUDENT PAGE LOGIC ----------
if (page === 'student.html') {
  const loginForm = document.getElementById('student-login-form');
  loginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('student-username').value.trim();
    const password = document.getElementById('student-password').value.trim();
    const resp = await apiPost('/login', { username, password });
    if (resp.success && resp.role === 'student') {
      sessionStorage.setItem('studentUser', JSON.stringify({ username, password }));
      // Redirect to exam page
      location.href = 'exam.html';
    } else {
      alert('Invalid student credentials');
    }
  });
}

// ---------- EXAM PAGE LOGIC ----------
if (page === 'exam.html') {
  const examForm = document.getElementById('exam-form');
  const timerEl = document.getElementById('timer');
  const submitBtn = document.getElementById('submit-exam');
  const STUDENT = JSON.parse(sessionStorage.getItem('studentUser'))?.username;

  if (!STUDENT) {
    alert('Please log in as a student first');
    location.href = 'student.html';
  }

  const EXAM_DURATION = 30 * 60; // 30 minutes in seconds
  let timeLeft = EXAM_DURATION;
  let timerInterval;

  async function startExam() {
    const questions = await apiGet('/questions');
    // Render each question
    questions.forEach(q => {
      const div = document.createElement('div');
      div.className = 'question card';
      div.innerHTML = `
        <p><strong>${q.id}. ${q.question}</strong></p>
        <div class="options">
          <label><input type="radio" name="q${q.id}" value="a" required /> ${q.optionA}</label>
          <label><input type="radio" name="q${q.id}" value="b" /> ${q.optionB}</label>
          <label><input type="radio" name="q${q.id}" value="c" /> ${q.optionC}</label>
          <label><input type="radio" name="q${q.id}" value="d" /> ${q.optionD}</label>
        </div>`;
      examForm.appendChild(div);
    });
    // Start timer
    updateTimer();
    timerInterval = setInterval(() => {
      timeLeft--;
      updateTimer();
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        submitExam();
      }
    }, 1000);
  }

  function updateTimer() {
    const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const secs = (timeLeft % 60).toString().padStart(2, '0');
    timerEl.textContent = `Time Remaining: ${mins}:${secs}`;
  }

  async function submitExam() {
    const questions = await apiGet('/questions');
    const answers = questions.map(q => {
      const selector = `input[name="q${q.id}"]:checked`;
      const el = document.querySelector(selector);
      const answer = el ? el.value : null;
      return { id: q.id, answer };
    });
    const { username, password } = JSON.parse(sessionStorage.getItem('studentUser'));
    const resp = await apiPost('/submit-exam', { username, password, answers });
    if (resp.success) {
      // Attach student's answers to result for detailed view
      const resultWithAnswers = { ...resp.result, answers };
      sessionStorage.setItem('lastResult', JSON.stringify(resultWithAnswers));
      location.href = 'result.html';
    } else {
      alert('Failed to submit exam');
    }
  }

  submitBtn?.addEventListener('click', e => {
    e.preventDefault();
    clearInterval(timerInterval);
    submitExam();
  });

  startExam();
}

// ---------- RESULT PAGE LOGIC ----------
if (page === 'result.html') {
  const summaryEl = document.getElementById('result-summary');
  const tableBody = document.querySelector('#result-table tbody');
  const result = JSON.parse(sessionStorage.getItem('lastResult'));
  if (!result) {
    alert('No result data found');
    location.href = 'student.html';
  } else {
    const statusClass = result.pass ? 'pass' : 'fail';
    summaryEl.className = `result ${statusClass}`;
    summaryEl.textContent = `Score: ${result.correctAnswers}/${result.totalQuestions} (${result.percentage}%). ${result.pass ? 'Passed' : 'Failed'}`;
    (async () => {
      const questions = await apiGet('/questions');
      const answerMap = {};
      result.answers?.forEach(a => { answerMap[a.id] = a.answer; });
      questions.forEach(q => {
        const tr = document.createElement('tr');
        const studentAns = answerMap[q.id] || '—';
        const correctAns = q.answer;
        const status = studentAns === correctAns ? '✅' : '❌';
        tr.innerHTML = `
          <td>${q.question}</td>
          <td>${studentAns}</td>
          <td>${correctAns}</td>
          <td>${status}</td>`;
        tableBody.appendChild(tr);
      });
    })();
  }
}

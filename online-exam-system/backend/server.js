// backend/server.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve the frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Helper functions to read/write JSON files
const DATA_DIR = __dirname; // backend directory
async function readJSON(file) {
  const filePath = path.join(DATA_DIR, file);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Read error', file, err);
    return [];
  }
}
async function writeJSON(file, data) {
  const filePath = path.join(DATA_DIR, file);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// POST /login – simple credential check
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const users = await readJSON('users.json');
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    res.json({ success: true, role: user.role });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

// GET /questions – return all MCQs
app.get('/questions', async (req, res) => {
  const questions = await readJSON('questions.json');
  res.json(questions);
});

// POST /add-question – admin adds a new question
app.post('/add-question', async (req, res) => {
  const { username, password, question } = req.body;
  const users = await readJSON('users.json');
  const admin = users.find(u => u.username === username && u.password === password && u.role === 'admin');
  if (!admin) {
    return res.status(403).json({ success: false, message: 'Admin authentication required' });
  }
  const questions = await readJSON('questions.json');
  const newId = questions.length ? Math.max(...questions.map(q => q.id)) + 1 : 1;
  const newQuestion = { id: newId, ...question };
  questions.push(newQuestion);
  await writeJSON('questions.json', questions);
  res.json({ success: true, question: newQuestion });
});

// DELETE /delete-question/:id – admin removes a question
app.delete('/delete-question/:id', async (req, res) => {
  const { username, password } = req.body;
  const users = await readJSON('users.json');
  const admin = users.find(u => u.username === username && u.password === password && u.role === 'admin');
  if (!admin) {
    return res.status(403).json({ success: false, message: 'Admin authentication required' });
  }
  const qId = parseInt(req.params.id, 10);
  let questions = await readJSON('questions.json');
  const beforeCount = questions.length;
  questions = questions.filter(q => q.id !== qId);
  if (questions.length === beforeCount) {
    return res.status(404).json({ success: false, message: 'Question not found' });
  }
  await writeJSON('questions.json', questions);
  res.json({ success: true, deletedId: qId });
});

// POST /submit-exam – student submits answers (or auto‑submit)
app.post('/submit-exam', async (req, res) => {
  const { username, answers } = req.body; // answers: [{id, answer}]
  const users = await readJSON('users.json');
  const student = users.find(u => u.username === username && u.role === 'student');
  if (!student) {
    return res.status(403).json({ success: false, message: 'Student authentication required' });
  }
  const questions = await readJSON('questions.json');
  let correct = 0;
  answers.forEach(a => {
    const q = questions.find(q => q.id === a.id);
    if (q && q.answer === a.answer) correct++;
  });
  const total = questions.length;
  const percentage = (correct / total) * 100;
  const pass = percentage >= 40; // 40% pass threshold
  const result = {
    student: username,
    totalQuestions: total,
    correctAnswers: correct,
    percentage: Number(percentage.toFixed(2)),
    pass,
    date: new Date().toISOString()
  };
  const results = await readJSON('results.json');
  results.push(result);
  await writeJSON('results.json', results);
  res.json({ success: true, result });
});

// GET /results – fetch results for a specific student
app.get('/results', async (req, res) => {
  const { student } = req.query;
  const results = await readJSON('results.json');
  if (student) {
    const filtered = results.filter(r => r.student === student);
    return res.json(filtered);
  }
  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

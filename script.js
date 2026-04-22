// Firebase 설정
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDW4o6zfkA7zbuBw4_MHG0NpLDOry9lWEs",
  authDomain: "temporal-distance.firebaseapp.com",
  databaseURL: "https://temporal-distance-default-rtdb.firebaseio.com",
  projectId: "temporal-distance",
  storageBucket: "temporal-distance.firebasestorage.app",
  messagingSenderId: "419709629531",
  appId: "1:419709629531:web:3fe6a013d5ccaf98ddbb7e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Sections
const sections = ['WAKE UP', 'WORK', 'SLEEP'];
const sectionKeys = ['wakeup', 'work', 'sleep'];
let currentIndex = 0;
let userData = {};
let allData = { wakeup: [], work: [], sleep: [] };

// Firebase에서 실시간 데이터 받기
sectionKeys.forEach(key => {
  const dbRef = ref(db, `times/${key}`);
  onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    allData[key] = data ? Object.values(data) : [];
    updateAvgDisplay(key);
    if (document.getElementById('page-viz').classList.contains('active')) renderViz();
    if (document.getElementById('page-archive').classList.contains('active')) renderArchive();
  });
});

// Page navigation
function goTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  if (pageId === 'page-viz') renderViz();
  if (pageId === 'page-archive') renderArchive();
}

// Menu toggle
function toggleMenu() {
  const navLinks = document.querySelectorAll('.nav-links');
  navLinks.forEach(n => n.classList.toggle('open'));
}

// Section navigation
function updateSection() {
  const key = sectionKeys[currentIndex];
  document.getElementById('current-section').textContent = sections[currentIndex];
  if (userData[key]) {
    document.getElementById('user-display').textContent = userData[key];
  } else {
    document.getElementById('user-display').textContent = '--:--';
  }
  updateAvgDisplay(key);
}

function updateAvgDisplay(key) {
  const data = allData[key];
  if (currentIndex !== sectionKeys.indexOf(key)) return;
  if (data.length === 0) {
    document.getElementById('avg-display').textContent = '--:--';
    document.getElementById('avg-count').textContent = '';
    return;
  }
  const avg = calcAverage(data);
  document.getElementById('avg-display').textContent = avg;
  document.getElementById('avg-count').textContent = `Based on ${data.length} entries`;
}

function nextSection() {
  if (currentIndex < sections.length - 1) {
    currentIndex++;
    updateSection();
  }
}

function prevSection() {
  if (currentIndex > 0) {
    currentIndex--;
    updateSection();
  }
}

// Submit time
function submitTime() {
  const input = document.getElementById('time-input').value;
  if (!input) return;

  const key = sectionKeys[currentIndex];
  userData[key] = input;

  // Firebase에 저장
  push(ref(db, `times/${key}`), input);

  document.getElementById('user-display').textContent = input;

  if (currentIndex < sections.length - 1) {
    setTimeout(() => {
      currentIndex++;
      updateSection();
    }, 800);
  } else {
    setTimeout(() => goTo('page-viz'), 800);
  }
}

// Calculate average time
function calcAverage(times) {
  const minutes = times.map(t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  });
  const avg = Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length);
  const h = Math.floor(avg / 60) % 24;
  const m = avg % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Render visualization
function renderViz() {
  const container = document.getElementById('viz-container');
  container.innerHTML = '';

  sectionKeys.forEach((key, i) => {
    const data = allData[key];
    const userTime = userData[key];
    const avg = data.length > 0 ? calcAverage(data) : null;

    const block = document.createElement('div');
    block.style.marginBottom = '48px';
    block.innerHTML = `
      <h3 style="font-size:13px;letter-spacing:3px;color:#888;margin-bottom:16px">${sections[i]}</h3>
      <div style="display:flex;align-items:center;gap:40px">
        <div style="text-align:center">
          <div style="font-size:11px;letter-spacing:2px;color:#aaa;margin-bottom:8px">AVERAGE</div>
          <div style="font-size:36px;font-weight:200">${avg || '--:--'}</div>
          <div style="font-size:11px;color:#aaa">${data.length} entries</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;letter-spacing:2px;color:#c0392b;margin-bottom:8px">YOU</div>
          <div style="font-size:36px;font-weight:200;color:#c0392b">${userTime || '--:--'}</div>
        </div>
        ${avg && userTime ? `
        <div style="text-align:center">
          <div style="font-size:11px;letter-spacing:2px;color:#aaa;margin-bottom:8px">DIFFERENCE</div>
          <div style="font-size:36px;font-weight:200">${calcDiff(avg, userTime)}</div>
        </div>` : ''}
      </div>
    `;
    container.appendChild(block);
  });
}

// Calculate difference
function calcDiff(avg, user) {
  const toMin = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const diff = toMin(user) - toMin(avg);
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = diff > 0 ? '+' : '-';
  return `${sign}${h > 0 ? h + 'h ' : ''}${m}m`;
}

// Render archive
function renderArchive() {
  const container = document.getElementById('archive-container');
  container.innerHTML = '';

  sectionKeys.forEach((key, i) => {
    const data = allData[key];
    const avg = data.length > 0 ? calcAverage(data) : '--:--';

    const block = document.createElement('div');
    block.style.marginBottom = '40px';
    block.innerHTML = `
      <h3 style="font-size:13px;letter-spacing:3px;margin-bottom:4px">${sections[i]}</h3>
      <p style="font-size:11px;color:#aaa;margin-bottom:16px">Current Average: ${avg} · Entries: ${data.length}</p>
      <table style="width:100%;border-collapse:collapse">
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:8px;font-size:11px;color:#aaa;letter-spacing:2px">#</td>
          <td style="padding:8px;font-size:11px;color:#aaa;letter-spacing:2px">TIME</td>
        </tr>
        ${data.map((t, idx) => `
        <tr style="border-bottom:1px solid #f5f5f5">
          <td style="padding:8px;font-size:13px;color:#aaa">${idx + 1}</td>
          <td style="padding:8px;font-size:16px">${t}</td>
        </tr>`).join('')}
      </table>
    `;
    container.appendChild(block);
  });
}

// Global functions
window.goTo = goTo;
window.toggleMenu = toggleMenu;
window.nextSection = nextSection;
window.prevSection = prevSection;
window.submitTime = submitTime;

// Init
updateSection();

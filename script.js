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

// State
const sections = ['WAKE UP', 'WORK', 'SLEEP'];
const sectionKeys = ['wakeup', 'work', 'sleep'];
const sectionDescs = [
  'The time you opened your eyes to begin your day. When do you actually wake up today?',
  'The time you started your working or studying hours. When does your productive day begin?',
  'The time you went to bed. When do you actually end your day?'
];

let currentSection = 0;
let userData = {};
let allData = { wakeup: [], work: [], sleep: [] };
let vizSortOrder = { wakeup: 'latest', work: 'latest', sleep: 'latest' };
let archiveSortOrder = { wakeup: 'latest', work: 'latest', sleep: 'latest' };
let currentVizType = 'line';
let popup = null;

// Firebase listeners
sectionKeys.forEach(key => {
  const dbRef = ref(db, `times/${key}`);
  onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      allData[key] = Object.entries(data).map(([id, val]) => ({
        id,
        time: typeof val === 'string' ? val : val.time,
        timestamp: typeof val === 'string' ? 0 : val.timestamp
      }));
    } else {
      allData[key] = [];
    }
    updateAvgDisplay();
    if (document.getElementById('page-viz').classList.contains('active')) renderViz();
    if (document.getElementById('page-archive').classList.contains('active')) renderArchive();
  });
});

// Navigation
function goTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  if (pageId === 'page-viz') renderViz();
  if (pageId === 'page-archive') renderArchive();
}

function toggleMenu() {
  document.getElementById('side-menu').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('active');
}

function closeMenu() {
  document.getElementById('side-menu').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
}

// Time Deviation
function switchSection(index) {
  currentSection = index;
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active-tab', i === index);
  });
  document.getElementById('deviation-title').textContent = sections[index];
  document.getElementById('deviation-desc').textContent = sectionDescs[index];
  document.getElementById('user-display').textContent = userData[sectionKeys[index]] || '00:00';
  updateAvgDisplay();
}

function updateUserDisplay() {
  const val = document.getElementById('time-input').value;
  if (val) document.getElementById('user-display').textContent = val;
}

function updateAvgDisplay() {
  const key = sectionKeys[currentSection];
  const data = allData[key];
  if (data.length === 0) {
    document.getElementById('avg-display').textContent = '--:--';
    document.getElementById('submission-count').textContent = '';
    return;
  }
  document.getElementById('avg-display').textContent = calcAverage(data.map(d => d.time));
  document.getElementById('submission-count').textContent = `Based on ${data.length} submissions`;
}

function submitTime() {
  const input = document.getElementById('time-input').value;
  if (!input) return;
  const key = sectionKeys[currentSection];
  userData[key] = input;
  document.getElementById('user-display').textContent = input;
  push(ref(db, `times/${key}`), {
    time: input,
    timestamp: Date.now()
  });
}

// Calc average
function calcAverage(times) {
  const mins = times.map(t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  });
  const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
  const h = Math.floor(avg / 60) % 24;
  const m = avg % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Viz type switch
function switchVizType(type) {
  currentVizType = type;
  document.querySelectorAll('.viz-type-tabs .tab').forEach((t, i) => {
    t.classList.toggle('active-tab', (i === 0 && type === 'line') || (i === 1 && type === 'heatmap'));
  });
  renderViz();
}

// Render Visualization
function renderViz() {
  const container = document.getElementById('viz-content');
  container.innerHTML = '';
  if (currentVizType === 'line') renderLineViz(container);
  else renderHeatmapViz(container);
}

function renderLineViz(container) {
  sectionKeys.forEach((key, i) => {
    const data = [...allData[key]];
    if (data.length === 0) return;

    const avg = calcAverage(data.map(d => d.time));
    const avgMins = timeToMins(avg);

    let sorted = [...data];
    if (vizSortOrder[key] === 'latest') {
      sorted.sort((a, b) => b.timestamp - a.timestamp);
    } else if (vizSortOrder[key] === 'asc') {
      sorted.sort((a, b) => timeToMins(a.time) - timeToMins(b.time));
    } else {
      sorted.sort((a, b) => timeToMins(b.time) - timeToMins(a.time));
    }

    const maxDiff = Math.max(...data.map(d => Math.abs(timeToMins(d.time) - avgMins)));
    const maxWidth = 340;

    const section = document.createElement('div');
    section.className = 'viz-section';
    section.innerHTML = `
      <div class="viz-section-header">
        <span class="viz-section-title">${sections[i]}</span>
        <div class="viz-sort">
          Latest
          <span onclick="setVizSort('${key}','asc')">↑</span>
          <span onclick="setVizSort('${key}','desc')">↓</span>
        </div>
      </div>
      <div class="viz-sub">Based on ${data.length} submissions</div>
      <div class="viz-line"></div>
      <div class="avg-label">Average time</div>
      <div class="avg-time-label">${avg}</div>
      <div class="chart-area" id="chart-${key}">
        <div class="chart-center-line"></div>
      </div>
      <div class="chart-legend">
        <div class="legend-item"><div class="legend-line earlier"></div> Earlier</div>
        <div class="legend-item"><div class="legend-line avg"></div> Average</div>
        <div class="legend-item"><div class="legend-line later"></div> Later</div>
      </div>
    `;
    container.appendChild(section);

    const chartArea = section.querySelector(`#chart-${key}`);
    sorted.forEach(d => {
      const diff = timeToMins(d.time) - avgMins;
      const width = maxDiff > 0 ? (Math.abs(diff) / maxDiff) * maxWidth : 0;
      const isEarlier = diff < 0;

      const row = document.createElement('div');
      row.className = 'data-row';

      const line = document.createElement('div');
      line.className = `data-line ${isEarlier ? 'earlier' : 'later'}`;
      line.style.width = `${width}px`;

      const label = document.createElement('div');
      label.className = `data-time-label ${isEarlier ? 'earlier' : 'later'}`;
      label.textContent = d.time;

      row.appendChild(line);
      row.appendChild(label);
      chartArea.appendChild(row);
    });
  });
}

function setVizSort(key, order) {
  vizSortOrder[key] = order;
  renderViz();
}

function renderHeatmapViz(container) {
  sectionKeys.forEach((key, i) => {
    const data = allData[key];

    const section = document.createElement('div');
    section.className = 'viz-section';

    const grid = Array.from({length: 24}, () => Array(12).fill(0));
    data.forEach(d => {
      const [h, m] = d.time.split(':').map(Number);
      const col = Math.floor(m / 5);
      if (h < 24 && col < 12) grid[h][col]++;
    });

    const maxCount = Math.max(...grid.flat());

    let xLabels = '<div class="heatmap-x-labels"><div class="heatmap-x-label"></div>';
    for (let m = 0; m < 60; m += 5) {
      xLabels += `<div class="heatmap-x-label">:${String(m).padStart(2,'0')}</div>`;
    }
    xLabels += '</div>';

    let gridHTML = '<div class="heatmap-grid">';
    for (let h = 0; h < 24; h++) {
      gridHTML += `<div class="heatmap-axis-label">${String(h).padStart(2,'0')}:00</div>`;
      for (let m = 0; m < 12; m++) {
        const count = grid[h][m];
        const color = getHeatColor(count, maxCount);
        gridHTML += `<div class="heatmap-cell" style="background:${color}" 
          onmouseenter="showPopup(event,${count})" 
          onmouseleave="hidePopup()"></div>`;
      }
    }
    gridHTML += '</div>';

    section.innerHTML = `
      <div class="viz-section-header">
        <span class="viz-section-title">${sections[i]}</span>
      </div>
      <div class="viz-sub">Based on ${data.length} submissions</div>
      <div class="viz-line"></div>
      ${xLabels}
      ${gridHTML}
    `;
    container.appendChild(section);
  });
}

function getHeatColor(count, max) {
  if (count === 0 || max === 0) return '#f5f5f5';
  const ratio = count / max;
  if (ratio < 0.5) {
    const t = ratio * 2;
    const r = Math.round(107 + (147 - 107) * t);
    const g = Math.round(174 + (112 - 174) * t);
    const b = Math.round(214 + (219 - 214) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = (ratio - 0.5) * 2;
    const r = Math.round(147 + (192 - 147) * t);
    const g = Math.round(112 + (97 - 112) * t);
    const b = Math.round(219 + (109 - 219) * t);
    return `rgb(${r},${g},${b})`;
  }
}

function showPopup(event, count) {
  if (!popup) {
    popup = document.createElement('div');
    popup.className = 'popup';
    document.body.appendChild(popup);
  }
  popup.textContent = `${count} submission${count !== 1 ? 's' : ''}`;
  popup.classList.add('active');
  popup.style.left = `${event.clientX + 12}px`;
  popup.style.top = `${event.clientY + 12}px`;
}

function hidePopup() {
  if (popup) popup.classList.remove('active');
}

// Render Archive
function renderArchive() {
  const container = document.getElementById('archive-content');
  container.innerHTML = '';

  sectionKeys.forEach((key, i) => {
    const data = [...allData[key]];
    if (data.length === 0) return;

    const avg = calcAverage(data.map(d => d.time));

    let sorted = [...data];
    if (archiveSortOrder[key] === 'latest') {
      sorted.sort((a, b) => b.timestamp - a.timestamp);
    } else if (archiveSortOrder[key] === 'asc') {
      sorted.sort((a, b) => timeToMins(a.time) - timeToMins(b.time));
    } else {
      sorted.sort((a, b) => timeToMins(b.time) - timeToMins(a.time));
    }

    const section = document.createElement('div');
    section.className = 'archive-section';
    section.innerHTML = `
      <div class="archive-section-header">
        <span class="archive-title">${sections[i]}</span>
        <div class="viz-sort">
          Latest
          <span onclick="setArchiveSort('${key}','asc')">↑</span>
          <span onclick="setArchiveSort('${key}','desc')">↓</span>
        </div>
      </div>
      <div class="archive-meta">Average time: ${avg} &nbsp;&nbsp; Submissions: ${data.length}</div>
      <div class="archive-line"></div>
      <table class="archive-table">
        <thead>
          <tr>
            <th>#</th>
            <th>TIME</th>
            <th>SUBMITTED</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map((d, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${d.time}</td>
              <td>${formatTimestamp(d.timestamp)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.appendChild(section);
  });
}

function setArchiveSort(key, order) {
  archiveSortOrder[key] = order;
  renderArchive();
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2,'0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${month} ${day}, ${year} ${h}:${m} ${ampm}`;
}

// Global
window.goTo = goTo;
window.toggleMenu = toggleMenu;
window.closeMenu = closeMenu;
window.switchSection = switchSection;
window.updateUserDisplay = updateUserDisplay;
window.submitTime = submitTime;
window.switchVizType = switchVizType;
window.setVizSort = setVizSort;
window.setArchiveSort = setArchiveSort;
window.showPopup = showPopup;
window.hidePopup = hidePopup;
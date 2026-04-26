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

const sections = ['WAKE UP', 'WORK', 'SLEEP'];
const sectionKeys = ['wakeup', 'work', 'sleep'];
const sectionDescs = [
  'The time you opened your eyes to begin your day.<br>When do you actually wake up today?',
  'The time you started your working or studying hours.<br>When does your productive day begin?',
  'The time you went to bed. When do you actually end your day?'
];

let currentSection = 0;
let userData = {};
let allData = { wakeup: [], work: [], sleep: [] };
let vizSortOrder = { wakeup: 'latest', work: 'latest', sleep: 'latest' };
let archiveSortOrder = { wakeup: 'latest', work: 'latest', sleep: 'latest' };
let currentVizType = 'line';
let popup = null;
let inputMode = false;
let currentInput = '';

// Firebase
sectionKeys.forEach(key => {
  onValue(ref(db, `times/${key}`), (snapshot) => {
    const data = snapshot.val();
    if (data) {
      allData[key] = Object.entries(data).map(([id, val]) => ({
        id,
        time: typeof val === 'string' ? val : val.time,
        timestamp: typeof val === 'string' ? 0 : (val.timestamp || 0)
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
  if (pageId === 'page-viz') {
    document.getElementById('tab-line').classList.add('active-tab');
    document.getElementById('tab-heatmap').classList.remove('active-tab');
    currentVizType = 'line';
    renderViz();
  }
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

// Section switch
function switchSection(index) {
  currentSection = index;
  inputMode = false;
  currentInput = '';

  document.querySelectorAll('.section-tabs .tab').forEach((t, i) => {
    t.classList.toggle('active-tab', i === index);
  });

  document.getElementById('deviation-title').textContent = sections[index];
  document.getElementById('deviation-desc').innerHTML = sectionDescs[index];

  const key = sectionKeys[index];
  const userTime = userData[key] || '00:00';
  animateTime('user-display', userTime);
  document.getElementById('input-hint').textContent = 'Input';
  document.getElementById('user-display').classList.remove('editing');
  document.onkeydown = null;
  updateAvgDisplay();
}

// Animate time
function animateTime(elId, newTime) {
  const el = document.getElementById(elId);
  el.style.opacity = '0';
  el.style.transform = 'translateY(-8px)';
  setTimeout(() => {
    el.textContent = newTime;
    el.style.transition = 'all 0.3s ease';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }, 150);
}

// Click YOU to input
function startInput() {
  inputMode = true;
  currentInput = '';
  const el = document.getElementById('user-display');
  el.textContent = '--:--';
  el.classList.add('editing');
  document.getElementById('input-hint').textContent = 'Type time (e.g. 18:00)';

  document.onkeydown = (e) => {
    if (!inputMode) return;
    if (e.key >= '0' && e.key <= '9') {
      if (currentInput.length < 4) {
        currentInput += e.key;
        updateInputDisplay();
      }
    } else if (e.key === 'Backspace') {
      currentInput = currentInput.slice(0, -1);
      updateInputDisplay();
    }
  };
}

function updateInputDisplay() {
  const el = document.getElementById('user-display');
  const padded = currentInput.padEnd(4, '-');
  const h = padded.slice(0, 2);
  const m = padded.slice(2, 4);
  el.textContent = `${h}:${m}`;
}

function updateAvgDisplay() {
  const key = sectionKeys[currentSection];
  const data = allData[key];
  if (!data || data.length === 0) {
    document.getElementById('avg-display').textContent = '--:--';
    document.getElementById('submission-count').textContent = '';
    return;
  }
  const avg = calcAverage(data.map(d => d.time));
  animateTime('avg-display', avg);
  document.getElementById('submission-count').textContent = `Based on ${data.length} submissions`;
}

// Submit
function submitTime() {
  const key = sectionKeys[currentSection];

  // Get current displayed time
  let userTime = '';
  if (currentInput.length === 4) {
    const h = currentInput.slice(0, 2);
    const m = currentInput.slice(2, 4);
    if (parseInt(h) <= 23 && parseInt(m) <= 59) {
      userTime = `${h}:${m}`;
    }
  } else if (userData[key]) {
    userTime = userData[key];
  }

  if (!userTime) return;

  userData[key] = userTime;
  inputMode = false;
  document.onkeydown = null;
  document.getElementById('user-display').classList.remove('editing');
  document.getElementById('input-hint').textContent = 'Input';
  animateTime('user-display', userTime);

  push(ref(db, `times/${key}`), {
    time: userTime,
    timestamp: Date.now()
  });

  const data = allData[key];
  const avg = data.length > 0 ? calcAverage(data.map(d => d.time)) : '--:--';
  const diff = data.length > 0 ? calcDiff(avg, userTime) : '--';

  document.getElementById('result-your-time').textContent = userTime;
  document.getElementById('result-avg-time').textContent = avg;
  document.getElementById('result-diff').textContent = diff;
  document.getElementById('result-popup').classList.add('active');
}

function closeResultPopup() {
  document.getElementById('result-popup').classList.remove('active');
}

// Calc
function calcAverage(times) {
  const valid = times.filter(t => t && t.includes(':'));
  if (valid.length === 0) return '--:--';
  const mins = valid.map(t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  });
  const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
  const h = Math.floor(avg / 60) % 24;
  const m = avg % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function timeToMins(t) {
  if (!t || !t.includes(':')) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function calcDiff(avg, user) {
  const diff = timeToMins(user) - timeToMins(avg);
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = diff > 0 ? '+' : '-';
  return `${sign}${h > 0 ? h + 'h ' : ''}${m}m`;
}

// Viz type
function switchVizType(type) {
  currentVizType = type;
  document.getElementById('tab-line').classList.toggle('active-tab', type === 'line');
  document.getElementById('tab-heatmap').classList.toggle('active-tab', type === 'heatmap');
  renderViz();
}

function renderViz() {
  const container = document.getElementById('viz-content');
  container.innerHTML = '';
  if (currentVizType === 'line') renderLineViz(container);
  else renderHeatmapViz(container);
}

// LINE VIZ
function renderLineViz(container) {
  sectionKeys.forEach((key, i) => {
    const data = [...allData[key]];
    if (data.length === 0) return;

    const avg = calcAverage(data.map(d => d.time));
    const avgMins = timeToMins(avg);

    const currentSort = vizSortOrder[key];
    let sorted = [...data];
    if (currentSort === 'latest') sorted.sort((a, b) => b.timestamp - a.timestamp);
    else if (currentSort === 'asc') sorted.sort((a, b) => timeToMins(a.time) - timeToMins(b.time));
    else sorted.sort((a, b) => timeToMins(b.time) - timeToMins(a.time));

    const maxDiff = Math.max(...data.map(d => Math.abs(timeToMins(d.time) - avgMins)), 1);
    const maxWidth = window.innerWidth < 600 ? 120 : 320;

    const section = document.createElement('div');
    section.className = 'viz-section';
    section.innerHTML = `
      <div class="viz-header-row">
        <span class="viz-section-title">${sections[i]}</span>
      </div>
      <div class="viz-meta-row">
        <span class="viz-sub">Based on ${data.length} submissions</span>
        <div class="viz-sort">
          <span class="viz-sort-label ${currentSort === 'latest' ? 'sort-active' : ''}" onclick="setVizSort('${key}','latest')">Latest</span>
          <div class="viz-sort-divider"></div>
          <span class="arrow ${currentSort === 'asc' ? 'sort-active' : ''}" onclick="setVizSort('${key}','asc')">↑</span>
          <span class="arrow ${currentSort === 'desc' ? 'sort-active' : ''}" onclick="setVizSort('${key}','desc')">↓</span>
        </div>
      </div>
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
      const width = (Math.abs(diff) / maxDiff) * maxWidth;
      const isEarlier = diff < 0;

      const row = document.createElement('div');
      row.className = 'data-row';

      const line = document.createElement('div');
      line.className = `data-line ${isEarlier ? 'earlier' : 'later'}`;
      line.style.width = `${width}px`;

      const label = document.createElement('div');
      label.className = `data-time-label ${isEarlier ? 'earlier' : 'later'}`;
      label.style.setProperty('--line-width', `${width}px`);
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

// HEATMAP
function renderHeatmapViz(container) {
  sectionKeys.forEach((key, i) => {
    const data = allData[key];
    const grid = Array.from({length: 24}, () => Array(12).fill(0));
    data.forEach(d => {
      if (!d.time || !d.time.includes(':')) return;
      const [h, m] = d.time.split(':').map(Number);
      const col = Math.floor(m / 5);
      if (h < 24 && col < 12) grid[h][col]++;
    });
    const maxCount = Math.max(...grid.flat(), 1);

    const section = document.createElement('div');
    section.className = 'viz-section';

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
      <div class="viz-header-row">
        <span class="viz-section-title">${sections[i]}</span>
      </div>
      <div class="viz-meta-row">
        <span class="viz-sub">Based on ${data.length} submissions</span>
      </div>
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

// ARCHIVE
function renderArchive() {
  const container = document.getElementById('archive-content');
  container.innerHTML = '';

  sectionKeys.forEach((key, i) => {
    const data = [...allData[key]];
    if (data.length === 0) return;

    const avg = calcAverage(data.map(d => d.time));
    const currentSort = archiveSortOrder[key];

    let sorted = [...data];
    if (currentSort === 'latest') sorted.sort((a, b) => b.timestamp - a.timestamp);
    else if (currentSort === 'asc') sorted.sort((a, b) => timeToMins(a.time) - timeToMins(b.time));
    else sorted.sort((a, b) => timeToMins(b.time) - timeToMins(a.time));

    const section = document.createElement('div');
    section.className = 'archive-section';
    section.innerHTML = `
      <div class="archive-header-row">
        <span class="archive-title">${sections[i]}</span>
      </div>
      <div class="archive-meta-row">
        <span class="archive-meta">Average time: ${avg} &nbsp;&nbsp; Submissions: ${data.length}</span>
        <div class="viz-sort">
          <span class="viz-sort-label ${currentSort === 'latest' ? 'sort-active' : ''}" onclick="setArchiveSort('${key}','latest')">Latest</span>
          <div class="viz-sort-divider"></div>
          <span class="arrow ${currentSort === 'asc' ? 'sort-active' : ''}" onclick="setArchiveSort('${key}','asc')">↑</span>
          <span class="arrow ${currentSort === 'desc' ? 'sort-active' : ''}" onclick="setArchiveSort('${key}','desc')">↓</span>
        </div>
      </div>
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
window.startInput = startInput;
window.submitTime = submitTime;
window.closeResultPopup = closeResultPopup;
window.switchVizType = switchVizType;
window.setVizSort = setVizSort;
window.setArchiveSort = setArchiveSort;
window.showPopup = showPopup;
window.hidePopup = hidePopup;

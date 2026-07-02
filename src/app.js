// Chronos Study Timer & Tracker - Supabase Serverless Engine
import { createClient } from '@supabase/supabase-js';

// Global State
let timerInterval = null;
let endTime = null;
let timeLeft = 50 * 60;
let isRunning = false;
let mode = 'study';
let fastMode = false;

// Audio Context for synthesized alarms
let audioCtx = null;

// Supabase State
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || '';
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || '';
let supabase = null;
let userId = localStorage.getItem('user_id') || null;
let userEmail = localStorage.getItem('user_email') || null;

// Initialize Supabase if credentials are provided
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Supabase initialization failed:', err);
  }
}

// Local Slots Storage (Offline-first / Caching)
let slots = JSON.parse(localStorage.getItem('study_slots')) || [];

// DOM Elements
const timerCountdown = document.getElementById('timer-countdown');
const timerDisplaySub = document.getElementById('timer-display-sub');
const modeBadge = document.getElementById('timer-mode-badge');
const modeText = document.getElementById('mode-text');
const playBtn = document.getElementById('play-timer-btn');
const playIcon = document.getElementById('play-icon');
const skipBtn = document.getElementById('skip-timer-btn');
const resetBtn = document.getElementById('reset-timer-btn');
const fastModeCheckbox = document.getElementById('fast-mode-checkbox');
const progressCircle = document.getElementById('progress-circle');
const slotsGrid = document.getElementById('slots-grid');
const todayFraction = document.getElementById('today-fraction');
const todayProgressBar = document.getElementById('today-progress-bar');

// Stats Elements
const statDailyAvg = document.getElementById('stat-daily-avg');
const statToday = document.getElementById('stat-today');
const statTotal = document.getElementById('stat-total');
const statDaysTracked = document.getElementById('stat-days-tracked');
const historyList = document.getElementById('history-list');

// Auth, Sync, Settings Elements
const syncStatus = document.getElementById('sync-status');
const authBtn = document.getElementById('auth-btn');
const configBtn = document.getElementById('config-btn');
const userProfile = document.getElementById('user-profile');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const authModal = document.getElementById('auth-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authErrorMsg = document.getElementById('auth-error');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const submitAuthBtn = document.getElementById('submit-auth-btn');
const togglePasswordBtn = document.getElementById('toggle-password-btn');
const togglePasswordIcon = document.getElementById('toggle-password-icon');

// Config Modal Elements
const configModal = document.getElementById('config-modal');
const closeConfigBtn = document.getElementById('close-config-btn');
const configForm = document.getElementById('config-form');
const configUrlInput = document.getElementById('config-url');
const configKeyInput = document.getElementById('config-key');

let authMode = 'login'; // 'login' or 'register'

// SVG Progress Circle setup
const radius = progressCircle.r.baseVal.value;
const circumference = radius * 2 * Math.PI;
progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressCircle.style.strokeDashoffset = 0;

// Initialize Application
function init() {
  setupEventListeners();
  updateUI();
  updateStats();
  drawSlotsGrid();
  checkAuth();
  
  // Set values in config form if stored in localStorage
  if (configUrlInput && configKeyInput) {
    configUrlInput.value = localStorage.getItem('supabase_url') || '';
    configKeyInput.value = localStorage.getItem('supabase_anon_key') || '';
  }
}

// Event Listeners Setup
function setupEventListeners() {
  playBtn.addEventListener('click', () => {
    initAudio();
    toggleTimer();
  });
  skipBtn.addEventListener('click', () => {
    initAudio();
    skipSession();
  });
  resetBtn.addEventListener('click', () => {
    initAudio();
    resetTimer();
  });
  
  fastModeCheckbox.addEventListener('change', (e) => {
    fastMode = e.target.checked;
    resetTimer();
  });

  // Auth Modals
  authBtn.addEventListener('click', () => showAuthModal('login'));
  closeModalBtn.addEventListener('click', hideAuthModal);
  
  tabLogin.addEventListener('click', () => setAuthTab('login'));
  tabRegister.addEventListener('click', () => setAuthTab('register'));
  
  authForm.addEventListener('submit', handleAuthSubmit);
  logoutBtn.addEventListener('click', handleLogout);

  // Password Visibility Toggle
  togglePasswordBtn.addEventListener('click', () => {
    if (authPasswordInput.type === 'password') {
      authPasswordInput.type = 'text';
      togglePasswordIcon.setAttribute('data-lucide', 'eye-off');
    } else {
      authPasswordInput.type = 'password';
      togglePasswordIcon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
  });

  // Config Modal
  configBtn.addEventListener('click', showConfigModal);
  closeConfigBtn.addEventListener('click', hideConfigModal);
  configForm.addEventListener('submit', handleConfigSubmit);
}

// Check Authentication Session via Supabase
async function checkAuth() {
  if (!supabase) {
    // If Supabase URL/Key are not set, display setup warning
    syncStatus.className = 'sync-status offline';
    syncStatus.querySelector('.status-dot').style.backgroundColor = 'hsl(36, 100%, 50%)'; // Warning Orange
    syncStatus.querySelector('.status-text').textContent = 'Setup Supabase';
    authBtn.classList.add('hidden');
    userProfile.classList.add('hidden');
    return;
  }

  // Restore session
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (session) {
    userId = session.user.id;
    userEmail = session.user.email;
    localStorage.setItem('user_id', userId);
    localStorage.setItem('user_email', userEmail);

    authBtn.classList.add('hidden');
    userProfile.classList.remove('hidden');
    userEmailSpan.textContent = userEmail;
    syncStatus.className = 'sync-status online';
    syncStatus.querySelector('.status-dot').removeAttribute('style'); // reset style override
    syncStatus.querySelector('.status-text').textContent = 'Cloud Synced';
    
    // Sync slots after auth confirmed
    syncSlotsWithCloud();
  } else {
    userId = null;
    userEmail = null;
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');

    authBtn.classList.remove('hidden');
    userProfile.classList.add('hidden');
    syncStatus.className = 'sync-status offline';
    syncStatus.querySelector('.status-dot').removeAttribute('style');
    syncStatus.querySelector('.status-text').textContent = 'Local Only';
  }
}

// Initialize Web Audio API
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Synthesize premium notification chimes
function playAlarm(type) {
  if (!audioCtx) return;
  
  const now = audioCtx.currentTime;
  
  if (type === 'study_end') {
    // Study end chime: 4 notes C5 -> E5 -> G5 -> C6
    // Staggered by 0.18 seconds, each ringing for 0.7 seconds (total ~1.24s)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.18);
      
      gainNode.gain.setValueAtTime(0, now + idx * 0.18);
      gainNode.gain.linearRampToValueAtTime(0.3, now + idx * 0.18 + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.6);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start(now + idx * 0.18);
      osc.stop(now + idx * 0.18 + 0.7);
    });
  } else if (type === 'break_end') {
    // Break end alarm: 2 short double-tone pulses
    // Pulsed 0.4s apart, each pulse runs for 0.4s (total ~0.8s)
    const pulses = [0, 0.4];
    pulses.forEach((delay) => {
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(440.00, now + delay); // A4
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + delay); // E5
      
      gainNode.gain.setValueAtTime(0, now + delay);
      gainNode.gain.linearRampToValueAtTime(0.2, now + delay + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc1.start(now + delay);
      osc1.stop(now + delay + 0.4);
      osc2.start(now + delay);
      osc2.stop(now + delay + 0.4);
    });
  }
}

// Timer loops
function toggleTimer() {
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  isRunning = true;
  endTime = Date.now() + timeLeft * 1000;
  
  playIcon.setAttribute('data-lucide', 'pause');
  lucide.createIcons();
  
  timerInterval = setInterval(() => {
    const now = Date.now();
    const diff = Math.ceil((endTime - now) / 1000);
    
    if (diff <= 0) {
      timeLeft = 0;
      updateUI();
      handleSessionComplete();
    } else {
      timeLeft = diff;
      updateUI();
    }
  }, 200);
}

function pauseTimer() {
  isRunning = false;
  clearInterval(timerInterval);
  playIcon.setAttribute('data-lucide', 'play');
  lucide.createIcons();
}

function resetTimer() {
  pauseTimer();
  timeLeft = getDuration();
  updateUI();
}

function skipSession() {
  pauseTimer();
  if (mode === 'study') {
    logStudySlot();
    transitionToBreak();
  } else {
    transitionToStudy();
  }
}

function getDuration() {
  if (mode === 'study') {
    return fastMode ? 50 : 50 * 60;
  } else {
    return fastMode ? 10 : 10 * 60;
  }
}

function updateUI() {
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeString = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  timerCountdown.textContent = timeString;
  
  document.title = `${timeString} - ${mode === 'study' ? 'Study' : 'Break'} | Chronos`;

  const totalDuration = getDuration();
  const progressRatio = totalDuration > 0 ? (totalDuration - timeLeft) / totalDuration : 0;
  const offset = circumference - progressRatio * circumference;
  progressCircle.style.strokeDashoffset = offset;

  if (mode === 'study') {
    document.body.classList.remove('break-active');
    modeBadge.style.borderColor = 'var(--card-border)';
    modeText.textContent = 'STUDY SESSION';
    timerDisplaySub.textContent = 'Keep Focusing';
  } else {
    document.body.classList.add('break-active');
    modeBadge.style.borderColor = 'var(--break-color)';
    modeText.textContent = 'BREAK TIME';
    timerDisplaySub.textContent = 'Relax & Recharge';
  }
}

function handleSessionComplete() {
  pauseTimer();
  if (mode === 'study') {
    playAlarm('study_end');
    logStudySlot();
    transitionToBreak();
  } else {
    playAlarm('break_end');
    transitionToStudy();
  }
  startTimer();
}

function transitionToBreak() {
  mode = 'break';
  timeLeft = getDuration();
  updateUI();
}

function transitionToStudy() {
  mode = 'study';
  timeLeft = getDuration();
  updateUI();
}

// Helper to generate local UUID
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Log study slot
async function logStudySlot() {
  const now = new Date();
  const timestampISO = now.toISOString();
  
  // Format dayOfWeek
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = days[now.getDay()];
  
  const slotId = generateUUID();
  const newSlot = {
    id: slotId,
    userId: userId, // Can be null if local only
    timestamp: timestampISO,
    dayOfWeek: dayOfWeek,
    durationMinutes: 50
  };
  
  // Add to local cache list
  slots.unshift(newSlot);
  localStorage.setItem('study_slots', JSON.stringify(slots));
  
  drawSlotsGrid();
  updateStats();
  
  // Sync to Cloud if online and Supabase setup
  if (supabase && userId) {
    try {
      const { error } = await supabase.from('slots').insert({
        id: newSlot.id,
        userId: userId,
        timestamp: newSlot.timestamp,
        dayOfWeek: newSlot.dayOfWeek,
        durationMinutes: newSlot.durationMinutes
      });
      if (error) throw error;
      
      syncStatus.className = 'sync-status online';
      syncStatus.querySelector('.status-text').textContent = 'Cloud Synced';
    } catch (err) {
      console.error('Cloud slot logging failed:', err);
      syncStatus.className = 'sync-status offline';
      syncStatus.querySelector('.status-text').textContent = 'Sync Pending';
    }
  }
}

// Draw today's study progress grid
function drawSlotsGrid() {
  slotsGrid.innerHTML = '';
  
  const todayStr = new Date().toISOString().split('T')[0]; // UTC date comparison
  const todaySlots = slots.filter(s => s.timestamp.startsWith(todayStr));
  const todayCount = todaySlots.length;
  
  todayFraction.textContent = `${todayCount} / 12 Slots`;
  const progressPercent = Math.min((todayCount / 12) * 100, 100);
  todayProgressBar.style.width = `${progressPercent}%`;
  
  for (let i = 1; i <= 12; i++) {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'slot-item';
    
    if (i <= todayCount) {
      slotDiv.classList.add('completed');
      slotDiv.innerHTML = `
        <i data-lucide="check-circle-2"></i>
        <span class="slot-num">Slot ${i}</span>
      `;
    } else {
      slotDiv.innerHTML = `
        <span>${i}</span>
        <span class="slot-num">Slot ${i}</span>
      `;
    }
    slotsGrid.appendChild(slotDiv);
  }
  lucide.createIcons();
}

// Compute Statistics (Strictly excluding Sundays)
function updateStats() {
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySlots = slots.filter(s => s.timestamp.startsWith(todayStr));
  
  statToday.textContent = todaySlots.length;
  statTotal.textContent = slots.length;
  
  // Metric Logic Update: Exclude Sundays
  const nonSundaySlots = slots.filter(s => s.dayOfWeek !== 'Sunday');
  const totalCompletedSlots = nonSundaySlots.length;
  
  // Total distinct logged calendar days where dayOfWeek != 'Sunday'
  const uniqueDates = new Set(nonSundaySlots.map(s => s.timestamp.split('T')[0]));
  const activeDays = uniqueDates.size || 0;
  
  const avg = activeDays > 0 ? (totalCompletedSlots / activeDays) : 0;
  statDailyAvg.textContent = avg.toFixed(1);
  statDaysTracked.textContent = `${activeDays} study day${activeDays !== 1 ? 's' : ''} logged`;
  
  renderHistory();
}

// History groups
function renderHistory() {
  historyList.innerHTML = '';
  
  if (slots.length === 0) {
    historyList.innerHTML = '<div class="empty-history">No sessions completed yet. Start studying to log your first slot!</div>';
    return;
  }
  
  // Group slots by date
  const groups = {};
  slots.forEach(slot => {
    const dateStr = slot.timestamp.split('T')[0];
    if (!groups[dateStr]) {
      groups[dateStr] = { count: 0, dayOfWeek: slot.dayOfWeek };
    }
    groups[dateStr].count++;
  });
  
  const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));
  
  sortedDates.forEach(dateStr => {
    const { count, dayOfWeek } = groups[dateStr];
    const isSunday = dayOfWeek === 'Sunday';
    
    // Format options: "July 2"
    const dateObj = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    const formattedDate = dateObj.toLocaleDateString('en-US', options);
    
    const item = document.createElement('div');
    item.className = 'history-item';
    
    item.innerHTML = `
      <div class="history-date">
        <span>${formattedDate}</span>
        ${isSunday ? '<span class="history-day-tag">Sunday</span>' : ''}
      </div>
      <div class="history-slots">
        <span class="history-slots-count">${count}</span>
        <span class="history-total-lbl">/ 12 slots</span>
      </div>
    `;
    historyList.appendChild(item);
  });
}

// Modal management
function showAuthModal(modeType) {
  if (!supabase) {
    alert('Please configure Supabase Project URL and Anon Key first.');
    showConfigModal();
    return;
  }
  authMode = modeType;
  authModal.classList.remove('hidden');
  setAuthTab(modeType);
}

function hideAuthModal() {
  authModal.classList.add('hidden');
  authErrorMsg.classList.add('hidden');
  authForm.reset();
}

function setAuthTab(tab) {
  authMode = tab;
  authErrorMsg.classList.add('hidden');
  
  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    submitAuthBtn.textContent = 'Log In';
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    submitAuthBtn.textContent = 'Create Account';
  }
}

// Config Modal UI
function showConfigModal() {
  configModal.classList.remove('hidden');
}

function hideConfigModal() {
  configModal.classList.add('hidden');
}

function handleConfigSubmit(e) {
  e.preventDefault();
  const url = configUrlInput.value.trim();
  const key = configKeyInput.value.trim();
  
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_anon_key', key);
  
  alert('Supabase credentials updated! Reloading application...');
  window.location.reload();
}

// Supabase registration and login
async function handleAuthSubmit(e) {
  e.preventDefault();
  authErrorMsg.classList.add('hidden');
  
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  
  try {
    if (authMode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      alert('Registration successful! Please check your email for a verification link if required.');
    }
    
    hideAuthModal();
    checkAuth();
  } catch (error) {
    authErrorMsg.textContent = error.message;
    authErrorMsg.classList.remove('hidden');
  }
}

// Logout
async function handleLogout() {
  if (confirm('Are you sure you want to log out? Local progress data will remain on this device.')) {
    if (supabase) {
      await supabase.auth.signOut();
    }
    userId = null;
    userEmail = null;
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('auth_token');
    
    checkAuth();
  }
}

// Cloud Synchronizer
async function syncSlotsWithCloud() {
  if (!supabase || !userId) return;
  
  syncStatus.className = 'sync-status offline';
  syncStatus.querySelector('.status-text').textContent = 'Syncing...';
  
  try {
    // 1. Fetch all cloud slots for this user
    const { data: cloudSlots, error } = await supabase
      .from('slots')
      .select('*')
      .eq('userId', userId);
      
    if (error) throw error;
    
    // 2. Perform a bidirectional merge
    const localSlotsById = {};
    slots.forEach(s => {
      localSlotsById[s.id] = s;
    });
    
    const cloudSlotsById = {};
    cloudSlots.forEach(s => {
      cloudSlotsById[s.id] = s;
    });
    
    // Write any missing cloud slots to local storage
    let localChanged = false;
    cloudSlots.forEach(cs => {
      if (!localSlotsById[cs.id]) {
        // Map snake_case or double-quoted back to local properties if needed
        slots.push({
          id: cs.id,
          userId: cs.userId,
          timestamp: cs.timestamp,
          dayOfWeek: cs.dayOfWeek,
          durationMinutes: cs.durationMinutes
        });
        localChanged = true;
      }
    });
    
    // Find local slots that are not present in the cloud database
    const pendingUploads = slots.filter(ls => !cloudSlotsById[ls.id]);
    
    if (pendingUploads.length > 0) {
      // Map to Supabase insertion documents
      const docs = pendingUploads.map(ls => ({
        id: ls.id,
        userId: userId,
        timestamp: ls.timestamp,
        dayOfWeek: ls.dayOfWeek,
        durationMinutes: ls.durationMinutes
      }));
      
      const { error: uploadError } = await supabase.from('slots').insert(docs);
      if (uploadError) throw uploadError;
    }
    
    // If local was changed, sort and save
    if (localChanged || pendingUploads.length > 0) {
      slots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      localStorage.setItem('study_slots', JSON.stringify(slots));
    }
    
    // Redraw interface
    drawSlotsGrid();
    updateStats();
    
    syncStatus.className = 'sync-status online';
    syncStatus.querySelector('.status-text').textContent = 'Cloud Synced';
  } catch (err) {
    console.error('Bidirectional sync failed:', err);
    syncStatus.className = 'sync-status offline';
    syncStatus.querySelector('.status-text').textContent = 'Sync Connection Error';
  }
}

// Initial Loading
window.addEventListener('DOMContentLoaded', init);

// Motivational To-Do App with rewarding animations, progress, confetti, edit-in-place, export/import
(function(){
  const STORAGE_KEY = 'motivational_todo.tasks.v1';

  // DOM
  const form = document.getElementById('task-form');
  const input = document.getElementById('task-input');
  const list = document.getElementById('task-list');
  const empty = document.getElementById('empty');
  const template = document.getElementById('task-template');
  const progressBar = document.getElementById('progress-bar');
  const progressLabel = document.getElementById('progress-label');
  const counter = document.getElementById('counter');
  const celebration = document.getElementById('celebration');
  const confettiLayer = document.getElementById('confetti-layer');
  const celebrationClose = document.getElementById('celebration-close');
  const clearCompletedBtn = document.getElementById('clear-completed');
  const exportBtn = document.getElementById('export');
  const importBtn = document.getElementById('import');
  const importFile = document.getElementById('import-file');

  // In-memory tasks array: {id:string, text:string, completed:boolean}
  let tasks = [];

  // Helpers
  function uid(){
    return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
  }

  function save(){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to save tasks', e);
    }
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      tasks = raw ? JSON.parse(raw) : [];
    }catch(e){
      console.error('Failed to load tasks', e);
      tasks = [];
    }
  }

  // Progress
  function computeProgress(){
    if (!tasks.length) return 0;
    const done = tasks.filter(t => t.completed).length;
    return Math.round((done / tasks.length) * 100);
  }

  function updateProgressUI(){
    const pct = computeProgress();
    progressBar.style.setProperty('--pct', pct + '%');
    // update pseudo-element width via inline style
    const inner = progressBar.querySelector(':scope::after');
    // can't access pseudo-element; instead set style on element
    progressBar.style.setProperty('--width', pct + '%');
    // set actual width by manipulating a child-like approach:
    // we use the after rule, but simpler: directly set transform via attribute on bar
    progressBar.style.setProperty('background','linear-gradient(90deg,#e6eefc,#f2f8ff)');
    progressBar.querySelectorAll('*'); // no-op to avoid lint
    // set computed width via inline style on a generated inner element
    if (!progressBar._fill) {
      const fill = document.createElement('div');
      fill.style.position = 'absolute';
      fill.style.left = '0';
      fill.style.top = '0';
      fill.style.bottom = '0';
      fill.style.borderRadius = '999px';
      fill.style.background = 'linear-gradient(90deg,var(--accent),var(--success))';
      fill.style.boxShadow = '0 6px 18px rgba(37,99,235,0.12)';
      fill.style.transition = 'width .6s cubic-bezier(.2,.9,.2,1)';
      progressBar.appendChild(fill);
      progressBar._fill = fill;
    }
    progressBar._fill.style.width = pct + '%';
    progressLabel.textContent = pct + '% done';
  }

  // Create DOM for a task
  function createTaskElement(task){
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;
    if (task.completed) node.classList.add('completed');

    const chk = node.querySelector('.check');
    const txt = node.querySelector('.task-text');
    const editBtn = node.querySelector('.edit');
    const delBtn = node.querySelector('.actions button:last-child');

    // initial content
    txt.textContent = task.text;
    setCheckVisual(chk, task.completed);

    // toggle complete
    chk.addEventListener('click', () => {
      toggleComplete(task.id, chk);
    });

    // delete with animation
    delBtn.addEventListener('click', () => {
      // animate then remove
      node.style.animation = 'shrinkOut .24s ease both';
      node.addEventListener('animationend', () => removeTask(task.id), { once: true });
    });

    // edit button toggles contentEditable
    function enableEdit(){
      txt.contentEditable = 'true';
      txt.focus();
      placeCaretAtEnd(txt);
      node.classList.add('editing');
    }

    function disableEdit(saveText = true){
      if (saveText){
        const newText = txt.textContent.trim();
        if (!newText){
          txt.textContent = task.text;
        } else {
          updateTaskText(task.id, newText);
        }
      } else {
        txt.textContent = task.text;
      }
      txt.contentEditable = 'false';
      node.classList.remove('editing');
    }

    editBtn.addEventListener('click', () => enableEdit());

    txt.addEventListener('dblclick', () => enableEdit());

    txt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter'){
        e.preventDefault();
        disableEdit(true);
      } else if (e.key === 'Escape'){
        e.preventDefault();
        disableEdit(false);
      }
    });

    txt.addEventListener('blur', () => disableEdit(true));

    return node;
  }

  // place caret helper
  function placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function setCheckVisual(chk, completed){
    if (completed){
      chk.classList.add('checked');
      const svg = chk.querySelector('.check-svg');
      if (svg) svg.style.color = 'white';
      // quick pop animation
      chk.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.16)' },
        { transform: 'scale(1)' }
      ], { duration: 420, easing: 'cubic-bezier(.2,.9,.2,1)' });
    } else {
      chk.classList.remove('checked');
      const svg = chk.querySelector('.check-svg');
      if (svg) svg.style.color = 'transparent';
    }
  }

  // Render
  function render(){
    list.innerHTML = '';
    if (!tasks.length){
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
    }

    tasks.forEach(task => {
      const el = createTaskElement(task);
      list.appendChild(el);
    });

    updateProgressUI();
    updateCounter();
    // if all completed and at least one task, celebrate
    const pct = computeProgress();
    if (pct === 100 && tasks.length > 0){
      triggerCelebration();
    }
  }

  // Operations
  function addTask(text){
    const trimmed = (text || '').trim();
    if (!trimmed) return false;

    const newTask = { id: uid(), text: trimmed, completed: false };
    tasks.unshift(newTask); // newest on top
    save();
    render();
    // gentle highlight on new
    const el = list.querySelector(`[data-id="${newTask.id}"]`);
    if (el){
      el.animate([
        { boxShadow: '0 0 0 rgba(37,99,235,0)' },
        { boxShadow: '0 0 28px rgba(37,99,235,0.12)' },
        { boxShadow: '0 0 0 rgba(37,99,235,0)' }
      ], { duration: 700 });
    }
    return true;
  }

  function removeTask(id){
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    tasks.splice(idx,1);
    save();
    render();
  }

  function toggleComplete(id, chkElement){
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    t.completed = !t.completed;
    save();
    // visual update for the clicked element if provided
    if (chkElement) setCheckVisual(chkElement, t.completed);
    // reorder: completed to bottom
    tasks = tasks.filter(x => x.id !== id);
    if (t.completed) tasks.push(t);
    else tasks.unshift(t);
    render();
    // if just completed, spawn confetti for that item
    if (t.completed) spawnConfettiBurst(chkElement || document.body, 18);
  }

  function updateTaskText(id, newText){
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    t.text = newText;
    save();
    render();
  }

  function updateCounter(){
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    counter.textContent = `${total} ${total === 1 ? 'task' : 'tasks'} • ${done} done`;
  }

  // Confetti utilities (lightweight, DOM particles)
  function spawnConfettiBurst(originEl, count=20){
    // compute origin position
    const rect = originEl.getBoundingClientRect();
    const layerRect = confettiLayer.getBoundingClientRect();
    const startX = rect.left + rect.width / 2 - layerRect.left;
    const startY = rect.top + rect.height / 2 - layerRect.top;

    for (let i=0;i<count;i++){
      const el = document.createElement('div');
      el.className = 'confetti';
      // random size & color
      const w = Math.random()*10 + 6;
      el.style.width = w + 'px';
      el.style.height = (w*0.55) + 'px';
      const colors = ['#ffca28','#34d399','#60a5fa','#f472b6','#a78bfa'];
      el.style.background = colors[Math.floor(Math.random()*colors.length)];
      el.style.position = 'absolute';
      el.style.left = startX + 'px';
      el.style.top = startY + 'px';
      el.style.borderRadius = '2px';
      el.style.opacity = '0.95';
      el.style.pointerEvents = 'none'; // ensure confetti never blocks clicks
      el.style.transform = `translate3d(0,0,0) rotate(${Math.random()*360}deg)`;
      confettiLayer.appendChild(el);

      // animate physics-like
      const angle = Math.random()*Math.PI*2;
      const velocity = Math.random()*120 + 80;
      const vx = Math.cos(angle)*velocity;
      const vy = Math.sin(angle)*velocity * -1;
      const duration = 1200 + Math.random()*800;

      el.animate([
        { transform: `translate3d(0px,0px,0) rotate(${Math.random()*360}deg)`, opacity:1 },
        { transform: `translate3d(${vx}px, ${vy + 40}px,0) rotate(${Math.random()*720}deg)`, opacity:0.8 },
        { transform: `translate3d(${vx*1.6}px, ${vy + 220}px,0) rotate(${Math.random()*1080}deg)`, opacity:0 }
      ], { duration, easing: 'cubic-bezier(.12,.7,.3,1)' });

      // remove after duration
      setTimeout(() => {
        try { confettiLayer.removeChild(el); } catch(e){}
      }, duration + 80);
    }
  }

  // Full celebration (when all tasks done)
  let _celebrationTimeout = null;
  function triggerCelebration(){
    if (celebration.classList.contains('show')) return;

    // Make visible
    celebration.classList.add('show');

    // Ensure confetti layer and banner do not block clicks
    try { confettiLayer.style.pointerEvents = 'none'; } catch (e) {}
    try { celebration.style.pointerEvents = 'none'; } catch (e) {}

    // spawn more confetti (visual only)
    spawnConfettiBurst(celebration, 70);

    // Auto-hide sooner so UI becomes responsive quickly
    if (_celebrationTimeout) clearTimeout(_celebrationTimeout);
    _celebrationTimeout = setTimeout(() => {
      celebration.classList.remove('show');
      // safety: ensure pointer-events are restored to default (CSS handles but we clear inline)
      try { celebration.style.pointerEvents = ''; } catch(e){}
      try { confettiLayer.style.pointerEvents = ''; } catch(e){}
    }, 2200); // 2200ms = 2.2s
  }
  celebrationClose.addEventListener('click', () => {
    celebration.classList.remove('show');
    if (_celebrationTimeout) clearTimeout(_celebrationTimeout);
    try { celebration.style.pointerEvents = ''; } catch(e){}
    try { confettiLayer.style.pointerEvents = ''; } catch(e){}
  });

  // Clear completed
  clearCompletedBtn.addEventListener('click', () => {
    tasks = tasks.filter(t => !t.completed);
    save();
    render();
  });

  // Export / Import
  exportBtn.addEventListener('click', () => {
    const data = JSON.stringify(tasks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed)) throw new Error('Invalid file');
        // basic validation
        tasks = parsed.map(p => ({ id: p.id || uid(), text: p.text || '', completed: !!p.completed }));
        save();
        render();
      } catch (err) {
        alert('Failed to import tasks: invalid file.');
      }
    };
    reader.readAsText(file);
    importFile.value = '';
  });

  // Events
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    if (!value.trim()) return;
    const added = addTask(value);
    if (added){
      input.value = '';
      input.focus();
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') input.value = '';
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') form.dispatchEvent(new Event('submit', { cancelable: true }));
  });

  // Initialize
  function init(){
    load();
    render();
    // ensure confetti layer is positioned
    confettiLayer.style.position = 'absolute';
    confettiLayer.style.left = '0';
    confettiLayer.style.top = '0';
    confettiLayer.style.width = '100%';
    confettiLayer.style.height = '100%';
    confettiLayer.style.pointerEvents = 'none';
  }

  init();

  // expose for debugging
  window.TodoApp = {
    getTasks: () => JSON.parse(JSON.stringify(tasks)),
    clearAll: () => { tasks = []; save(); render(); }
  };
})();
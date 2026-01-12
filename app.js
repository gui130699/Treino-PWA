import { DB } from "./db.js";

// Inicializar Supabase
const SUPABASE_URL = "https://urnfqiwgtloldzaovive.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybmZxaXdndGxvbGR6YW92aXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY2MjY4MDAsImV4cCI6MjA1MjIwMjgwMH0.sb_publishable_C-JUI7jQWTd5ocVYfCCbcg_w73rcUKz";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

const KG_TO_LB = 2.20462;
const toLb = (kg) => +(kg * KG_TO_LB).toFixed(2);
const toKg = (lb) => +(lb / KG_TO_LB).toFixed(3);

let CURRENT = { email: null, role: null, unit: "kg" };
let ACTIVE_TEMPLATE_ID = null;
let SELECTED_EXERCISE = null;
let SELECTED_EXERCISES = [];
let IS_COMBO_MODE = false;

// Toast notification system
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------- PWA ----------
let deferredPrompt = null;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

// Capturar evento de instalação
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('beforeinstallprompt capturado');
  e.preventDefault();
  deferredPrompt = e;
  const btn = $("btnInstallApp");
  if (btn) btn.style.display = "inline-flex";
});

// Verificar se já está instalado
window.addEventListener('appinstalled', () => {
  const btn = $("btnInstallApp");
  if (btn) btn.style.display = "none";
  deferredPrompt = null;
  showToast('App instalado com sucesso! 🎉', 'success');
});

// Verificar se está em modo standalone
function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

async function installApp() {
  console.log('installApp chamado');
  
  // Verificar se já está instalado
  if (isAppInstalled()) {
    showToast('App já está instalado!', 'info');
    const btn = $("btnInstallApp");
    if (btn) btn.style.display = "none";
    return;
  }
  
  // Verificar se o prompt está disponível
  if (!deferredPrompt) {
    showToast('Instalação não disponível neste navegador', 'error');
    return;
  }
  
  try {
    // Mostrar o prompt
    await deferredPrompt.prompt();
    
    // Aguardar escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    console.log('Resultado da instalação:', outcome);
    
    if (outcome === 'accepted') {
      showToast('Instalação iniciada! 🎉', 'success');
    } else {
      showToast('Instalação cancelada', 'info');
    }
    
    // Limpar o prompt
    deferredPrompt = null;
    const btn = $("btnInstallApp");
    if (btn) btn.style.display = "none";
  } catch (err) {
    console.error('Erro ao instalar:', err);
    showToast('Erro ao instalar o app', 'error');
  }
}

function netUpdate() {
  const b = $("netBadge");
  const on = navigator.onLine;
  b.textContent = on ? "online" : "offline";
  b.classList.toggle("ok", on);
  b.classList.toggle("warn", !on);
}
window.addEventListener("online", netUpdate);
window.addEventListener("offline", netUpdate);

// ---------- DEMO AUTH ----------
async function demoLogin(email, password, rememberMe = true) {
  const existing = await DB.get("users", email);
  
  if (!existing) {
    return { error: "Usuário não encontrado. Clique em 'Criar Conta' primeiro." };
  }
  
  // Validar senha
  if (existing.password !== password) {
    return { error: "Senha incorreta" };
  }
  
  // Salvar sessão
  if (rememberMe) {
    await DB.put("runtime", { key: "current_user", value: { email, role: existing.role } });
    await DB.put("runtime", { key: "remember_me", value: true });
  } else {
    await DB.put("runtime", { key: "current_user", value: { email, role: existing.role } });
    await DB.put("runtime", { key: "remember_me", value: false });
  }
  
  return { email, role: existing.role };
}

async function demoRegister(userData) {
  const { email, password, name, age, weight, height, gender, role } = userData;
  
  if (password.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }
  
  // Criar usuário no Supabase Auth
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          age: parseInt(age) || null,
          weight: parseFloat(weight) || null,
          height: parseInt(height) || null,
          gender,
          role
        }
      }
    });
    
    if (authError) {
      console.error('Erro no Supabase Auth:', authError);
      if (authError.message.includes('already registered')) {
        return { error: "Este e-mail já está cadastrado. Use 'Entrar' para fazer login." };
      }
      return { error: authError.message || "Erro ao criar conta. Tente novamente." };
    }
    
    // Salvar dados do usuário na tabela users
    if (authData.user) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          name,
          age: parseInt(age) || null,
          weight: parseFloat(weight) || null,
          height: parseInt(height) || null,
          gender,
          role,
          created_at: nowIso()
        });
      
      if (insertError) {
        console.error('Erro ao salvar usuário na tabela:', insertError);
        showToast('Conta criada, mas alguns dados não foram salvos', 'warning');
      } else {
        console.log('✅ Usuário salvo no Supabase com sucesso!');
      }
    }
    
    // Salvar localmente também
    await DB.put("users", { 
      email, 
      password, 
      name,
      age: parseInt(age) || null,
      weight: parseFloat(weight) || null,
      height: parseInt(height) || null,
      gender,
      role, 
      created_at: nowIso() 
    });
    
    // Auto login após registro
    await DB.put("runtime", { key: "current_user", value: { email, role } });
    await DB.put("runtime", { key: "remember_me", value: true });
    
    showToast('✅ Conta criada com sucesso!', 'success');
    return { email, role };
    
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return { error: "Erro ao criar conta. Verifique sua conexão e tente novamente." };
  }
}

async function demoLogout() {
  const rememberMe = await DB.get("runtime", "remember_me");
  if (!rememberMe?.value) {
    await DB.put("runtime", { key: "current_user", value: null });
  }
}

async function getCurrentUser() {
  const r = await DB.get("runtime", "current_user");
  return r?.value || null;
}

// ---------- SETTINGS ----------
async function loadSettings() {
  const userKey = `settings:${CURRENT.email}`;
  const s = await DB.get("settings", userKey);
  if (!s) {
    CURRENT.unit = "kg";
    $("selUnit").value = "kg";
    return;
  }
  CURRENT.unit = s.unit || "kg";
  $("selUnit").value = CURRENT.unit;
}
async function saveSettings() {
  const userKey = `settings:${CURRENT.email}`;
  const unit = $("selUnit").value;
  await DB.put("settings", { userKey, unit, updated_at: nowIso() });
  CURRENT.unit = unit;
  showToast('Configurações salvas com sucesso!', 'success');
}

// ---------- SEED (some exercises to test quickly) ----------
async function ensureSeed() {
  const all = await DB.all("exercises");
  if (all.length) return;

  const seed = [
    // Peito
    { name:"Supino reto com barra", primary:"peito", secondary:["tríceps","ombro anterior"], equipment:"barra", type:"compound" },
    { name:"Supino inclinado com halteres", primary:"peito", secondary:["tríceps","ombro anterior"], equipment:"halter", type:"compound" },
    { name:"Crossover na polia", primary:"peito", secondary:[], equipment:"cabo", type:"isolation" },
    { name:"Supino declinado", primary:"peito", secondary:["tríceps"], equipment:"barra", type:"compound" },
    
    // Costas
    { name:"Puxada alta na polia", primary:"costas", secondary:["bíceps"], equipment:"cabo", type:"compound" },
    { name:"Remada curvada com barra", primary:"costas", secondary:["bíceps","trapézio"], equipment:"barra", type:"compound" },
    { name:"Remada baixa na polia", primary:"costas", secondary:["bíceps"], equipment:"cabo", type:"compound" },
    { name:"Pull over na polia", primary:"costas", secondary:["peito"], equipment:"cabo", type:"isolation" },
    { name:"Barra fixa", primary:"costas", secondary:["bíceps"], equipment:"peso corporal", type:"compound" },
    
    // Pernas
    { name:"Agachamento livre", primary:"pernas", secondary:["glúteos","core"], equipment:"barra", type:"compound" },
    { name:"Leg press 45°", primary:"pernas", secondary:["glúteos"], equipment:"máquina", type:"compound" },
    { name:"Cadeira extensora", primary:"quadríceps", secondary:[], equipment:"máquina", type:"isolation" },
    { name:"Cadeira flexora", primary:"posteriores", secondary:[], equipment:"máquina", type:"isolation" },
    { name:"Stiff", primary:"posteriores", secondary:["glúteos","lombar"], equipment:"barra", type:"compound" },
    { name:"Elevação pélvica", primary:"glúteos", secondary:["posteriores"], equipment:"barra", type:"compound" },
    
    // Ombros
    { name:"Desenvolvimento com barra", primary:"ombro", secondary:["tríceps"], equipment:"barra", type:"compound" },
    { name:"Elevação lateral com halteres", primary:"ombro lateral", secondary:[], equipment:"halter", type:"isolation" },
    { name:"Elevação frontal", primary:"ombro anterior", secondary:[], equipment:"halter", type:"isolation" },
    { name:"Remada alta", primary:"ombro", secondary:["trapézio"], equipment:"barra", type:"compound" },
    
    // Bíceps
    { name:"Rosca direta", primary:"bíceps", secondary:[], equipment:"barra", type:"isolation" },
    { name:"Rosca alternada com halteres", primary:"bíceps", secondary:[], equipment:"halter", type:"isolation" },
    { name:"Rosca martelo", primary:"bíceps", secondary:["antebraço"], equipment:"halter", type:"isolation" },
    { name:"Rosca scott", primary:"bíceps", secondary:[], equipment:"barra", type:"isolation" },
    
    // Tríceps
    { name:"Tríceps na polia", primary:"tríceps", secondary:[], equipment:"cabo", type:"isolation" },
    { name:"Tríceps testa", primary:"tríceps", secondary:[], equipment:"barra", type:"isolation" },
    { name:"Tríceps francês", primary:"tríceps", secondary:[], equipment:"halter", type:"isolation" },
    { name:"Mergulho em paralelas", primary:"tríceps", secondary:["peito"], equipment:"peso corporal", type:"compound" },
    
    // Core/Abdômen
    { name:"Abdominal supra", primary:"abdômen", secondary:[], equipment:"peso corporal", type:"isolation" },
    { name:"Prancha", primary:"core", secondary:[], equipment:"peso corporal", type:"isolation" },
    { name:"Abdominal infra", primary:"abdômen inferior", secondary:[], equipment:"peso corporal", type:"isolation" }
  ];

  for (const s of seed) {
    await DB.put("exercises", {
      id: uid(),
      name: s.name,
      primary_muscle: s.primary,
      secondary_muscles: s.secondary,
      equipment: s.equipment,
      type: s.type,
      instructions: "",
      notes: "",
      youtube_url: "",
      is_active: true,
      created_by: "seed",
      created_at: nowIso()
    });
  }
}

// ---------- UI STATE ----------
function setHeader() {
  if (!CURRENT.email) {
    $("headerSub").textContent = "Deslogado";
    $("btnLogout").style.display = "none";
  } else {
    $("headerSub").textContent = `${CURRENT.email} • ${CURRENT.role} • ${CURRENT.unit}`;
    $("btnLogout").style.display = "inline-block";
  }
}

function showApp(logged) {
  $("cardAuth").style.display = logged ? "none" : "block";
  $("cardSettings").style.display = logged ? "block" : "none";
  $("cardApp").style.display = logged ? "block" : "none";
}

function setTabs(active) {
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === active);
  });
  ["train","templates","catalog","requests","history","admin"].forEach(k => {
    const el = $(`tab-${k}`);
    if (el) el.style.display = (k === active) ? "block" : "none";
  });
}

// ---------- TEMPLATES ----------
async function listTemplates() {
  const all = await DB.byIndex("templates", "owner_id", CURRENT.email);
  all.sort((a,b) => (a.created_at < b.created_at ? 1 : -1));

  // fill select start
  const sel = $("selTemplateToStart");
  sel.innerHTML = "";
  sel.appendChild(new Option("— Selecione um treino —", ""));
  for (const t of all) sel.appendChild(new Option(`${t.name} (${t.day_label||"-"})`, t.id));

  // list
  const root = $("templateList");
  root.innerHTML = "";
  for (const t of all) {
    const wrap = document.createElement("div");
    wrap.className = "item";
    wrap.innerHTML = `
      <div style="flex:1">
        <strong>${escapeHtml(t.name)}</strong>
        <div class="meta">${escapeHtml(t.notes||"Sem descrição")}</div>
      </div>
      <button class="secondary small" data-act="days">📅 Dias</button>
      <button class="danger small" data-act="del">Deletar</button>
    `;
    wrap.querySelector('[data-act="del"]').onclick = async () => {
      await DB.del("templates", t.id);
      // delete days and items cascade
      const days = await DB.byIndex("template_days", "template_id", t.id);
      for (const day of days) {
        await DB.del("template_days", day.id);
        const items = await DB.byIndex("template_items", "template_day_id", day.id);
        for (const it of items) await DB.del("template_items", it.id);
      }
      await listTemplates();
      showToast('Treino deletado', 'success');
    };
    wrap.querySelector('[data-act="days"]').onclick = () => openTemplateDays(t.id);
    root.appendChild(wrap);
  }
}

async function createTemplate() {
  const name = $("tplName").value.trim();
  if (!name) {
    showToast('Informe o nome do treino', 'error');
    return;
  }
  
  const notes = $("tplNotes").value.trim();

  await DB.put("templates", {
    id: uid(),
    owner_id: CURRENT.email,
    name,
    notes,
    created_at: nowIso()
  });

  $("tplName").value = "";
  $("tplNotes").value = "";
  
  showToast('Treino criado! Agora adicione os dias da semana.', 'success');
  await listTemplates();
}

let CURRENT_TEMPLATE_ID = null;
let CURRENT_DAY_ID = null;

// ===== TEMPLATE DAYS =====
async function openTemplateDays(templateId) {
  const t = await DB.get("templates", templateId);
  if (!t) return;
  
  CURRENT_TEMPLATE_ID = templateId;
  $("templateDaysModalTitle").textContent = `Dias: ${t.name}`;
  $("dayWeekday").value = "";
  $("dayGroups").selectedIndex = -1;
  
  await loadTemplateDays();
  $("templateDaysModal").style.display = "block";
}

function closeTemplateDaysModal() {
  $("templateDaysModal").style.display = "none";
  CURRENT_TEMPLATE_ID = null;
}

async function addTemplateDay() {
  if (!CURRENT_TEMPLATE_ID) return;
  
  const weekday = $("dayWeekday").value;
  if (!weekday) {
    showToast("Selecione o dia da semana", "error");
    return;
  }
  
  // Pegar checkboxes marcados
  const groupsContainer = $("dayGroups");
  const checkboxes = groupsContainer.querySelectorAll('input[type="checkbox"]:checked');
  const groups = Array.from(checkboxes).map(cb => cb.value);
  
  if (!groups.length) {
    showToast("Selecione pelo menos um grupo muscular", "error");
    return;
  }
  
  await DB.put("template_days", {
    id: uid(),
    template_id: CURRENT_TEMPLATE_ID,
    weekday,
    muscle_groups: groups,
    order: Date.now(),
    created_at: nowIso()
  });
  
  $("dayWeekday").value = "";
  // Desmarcar todos os checkboxes
  checkboxes.forEach(cb => cb.checked = false);
  
  showToast(`Dia ${weekday} adicionado!`, "success");
  await loadTemplateDays();
}

async function loadTemplateDays() {
  if (!CURRENT_TEMPLATE_ID) return;
  
  const days = await DB.byIndex("template_days", "template_id", CURRENT_TEMPLATE_ID);
  days.sort((a,b) => (a.order||0) - (b.order||0));
  
  const list = $("templateDaysList");
  list.innerHTML = "";
  
  if (!days.length) {
    list.innerHTML = "<div class='muted'>Nenhum dia adicionado ainda</div>";
    return;
  }
  
  for (const day of days) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div style="flex:1">
        <strong>${escapeHtml(day.weekday)}</strong>
        <div class="meta">${escapeHtml(day.muscle_groups.join(", "))}</div>
      </div>
      <button class="primary small" data-act="items">Exercícios</button>
      <button class="danger small" data-act="del">Remover</button>
    `;
    
    div.querySelector('[data-act="del"]').onclick = async () => {
      await DB.del("template_days", day.id);
      const items = await DB.byIndex("template_items", "template_day_id", day.id);
      for (const it of items) await DB.del("template_items", it.id);
      showToast("Dia removido", "success");
      await loadTemplateDays();
    };
    
    div.querySelector('[data-act="items"]').onclick = () => openTemplateItems(day.id);
    
    list.appendChild(div);
  }
}

// ===== TEMPLATE ITEMS =====
async function openTemplateItems(dayId) {
  const day = await DB.get("template_days", dayId);
  if (!day) return;
  
  CURRENT_DAY_ID = dayId;
  ACTIVE_TEMPLATE_ID = day.template_id;
  SELECTED_EXERCISE = null;
  SELECTED_EXERCISES = [];
  IS_COMBO_MODE = false;
  
  $("templateModalTitle").textContent = `Exercícios: ${day.weekday} - ${day.muscle_groups.join(", ")}`;
  $("tmplExSearch").value = "";
  $("tmplTargetSets").value = "3";
  $("tmplTargetReps").value = "8-12";
  $("tmplCustomReps").value = "";
  $("tmplRestSec").value = "90";
  $("tmplComboType").value = "";
  $("btnAddTemplateItem").disabled = true;
  $("btnAddMultipleItems").style.display = "none";
  $("btnAddMultipleItems").disabled = true;
  
  await loadTemplateItems();
  searchExercisesForTemplate(); // Load all exercises on open
  $("templateModal").style.display = "block";
}

function closeTemplateModal() {
  $("templateModal").style.display = "none";
  ACTIVE_TEMPLATE_ID = null;
  CURRENT_DAY_ID = null;
}

function toggleComboMode() {
  const comboType = $("tmplComboType").value;
  IS_COMBO_MODE = comboType !== "" && comboType !== "none";
  
  if (IS_COMBO_MODE) {
    $("comboHint").style.display = "block";
    $("btnAddTemplateItem").style.display = "none";
    $("btnAddMultipleItems").style.display = "inline-block";
    $("btnAddMultipleItems").disabled = true;
    SELECTED_EXERCISES = [];
    SELECTED_EXERCISE = null;
  } else {
    $("comboHint").style.display = "none";
    $("btnAddTemplateItem").style.display = "inline-block";
    $("btnAddMultipleItems").style.display = "none";
    $("btnAddTemplateItem").disabled = true;
    SELECTED_EXERCISES = [];
    SELECTED_EXERCISE = null;
  }
  
  // Re-render current list with new selection mode
  searchExercisesForTemplate();
}

async function addMultipleItems() {
  if (!SELECTED_EXERCISES.length) {
    showToast("Selecione pelo menos um exercício", "error");
    return;
  }
  
  if (!CURRENT_DAY_ID) {
    showToast("Nenhum dia selecionado", "error");
    return;
  }
  
  const customReps = $("tmplCustomReps").value.trim();
  const comboType = $("tmplComboType").value;
  const comboGroup = Date.now(); // Same group for all
  
  try {
    // Get current max order for this day
    const items = await DB.byIndex("template_items", "template_day_id", CURRENT_DAY_ID);
    let maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order)) : 0;
    
    // Add all selected exercises with incrementing combo_order
    for (let i = 0; i < SELECTED_EXERCISES.length; i++) {
      const ex = SELECTED_EXERCISES[i];
      
      const targetSets = parseInt($("tmplTargetSets").value) || 3;
      const targetReps = $("tmplTargetReps").value.trim() || "8-12";
      const restSeconds = parseInt($("tmplRestSec").value) || 90;
      
      const newItem = {
        id: Date.now() + Math.random() + i, // Gera ID único
        template_id: ACTIVE_TEMPLATE_ID,
        template_day_id: CURRENT_DAY_ID,
        exercise_id: ex.id,
        order: ++maxOrder,
        target_sets: targetSets,
        target_reps: targetReps,
        custom_reps: customReps || null,
        rest_seconds: restSeconds,
        combo_type: comboType,
        combo_group: comboGroup,
        combo_order: i + 1
      };
      
      await DB.put("template_items", newItem);
    }
    
    showToast(`${SELECTED_EXERCISES.length} exercícios adicionados ao ${comboType}`, "success");
    
    // Reset state
    SELECTED_EXERCISES = [];
    $("tmplExSearch").value = "";
    $("tmplCustomReps").value = "";
    $("btnAddMultipleItems").disabled = true;
    
    await loadTemplateItems();
    searchExercisesForTemplate();
    
  } catch (err) {
    console.error("Erro ao adicionar exercícios:", err);
    showToast("Erro ao adicionar exercícios", "error");
  }
}

async function searchExercisesForTemplate() {
  const q = $("tmplExSearch").value.trim().toLowerCase();
  const all = await DB.all("exercises");
  const active = all.filter(e => e.is_active);
  const filtered = q.length >= 1 
    ? active.filter(e => e.name.toLowerCase().includes(q))
    : active;
  
  const sorted = filtered.sort((a,b) => a.name.localeCompare(b.name));
  renderExerciseList(sorted.slice(0, 50), q);
}

function renderExerciseList(exercises, query) {
  const results = $("tmplExResults");
  
  if (!exercises.length) {
    results.innerHTML = "<div class='muted' style='padding:10px'>Nenhum exercício encontrado</div>";
    if (!IS_COMBO_MODE) {
      SELECTED_EXERCISE = null;
      $("btnAddTemplateItem").disabled = true;
    }
    return;
  }
  
  results.innerHTML = "";
  
  for (const ex of exercises) {
    const div = document.createElement("div");
    div.className = "item";
    div.style.cursor = "pointer";
    div.style.padding = "10px";
    div.style.alignItems = "center";
    
    if (IS_COMBO_MODE) {
      // Modo combo: checkboxes
      const isSelected = SELECTED_EXERCISES.some(e => e.id === ex.id);
      div.innerHTML = `
        <input type="checkbox" ${isSelected ? 'checked' : ''} data-ex-id="${ex.id}" style="margin-right:10px">
        <div style="flex:1">
          <strong>${escapeHtml(ex.name)}</strong>
          <div class="meta">${escapeHtml(ex.primary_muscle)} • ${escapeHtml(ex.equipment)}</div>
        </div>
      `;
      
      const checkbox = div.querySelector('input[type="checkbox"]');
      checkbox.onclick = (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          if (!SELECTED_EXERCISES.some(e => e.id === ex.id)) {
            SELECTED_EXERCISES.push(ex);
          }
        } else {
          SELECTED_EXERCISES = SELECTED_EXERCISES.filter(e => e.id !== ex.id);
        }
        $("btnAddMultipleItems").disabled = SELECTED_EXERCISES.length === 0;
      };
      
      div.onclick = () => {
        checkbox.checked = !checkbox.checked;
        checkbox.onclick({ stopPropagation: () => {} });
      };
    } else {
      // Modo normal: seleção única
      div.innerHTML = `
        <div style="flex:1">
          <strong>${escapeHtml(ex.name)}</strong>
          <div class="meta">${escapeHtml(ex.primary_muscle)} • ${escapeHtml(ex.equipment)}</div>
        </div>
      `;
      
      div.onclick = () => {
        SELECTED_EXERCISE = ex;
        $("btnAddTemplateItem").disabled = false;
        // highlight
        results.querySelectorAll(".item").forEach(i => i.style.background = "");
        div.style.background = "#1e293b";
      };
    }
    
    results.appendChild(div);
  }
  
  if (IS_COMBO_MODE) {
    $("btnAddMultipleItems").disabled = SELECTED_EXERCISES.length === 0;
  }
}

async function addTemplateItem() {
  if (!SELECTED_EXERCISE || !CURRENT_DAY_ID) return;
  
  const customReps = $("tmplCustomReps").value.trim();
  const comboType = $("tmplComboType").value.trim();
  
  try {
    // Get current max order for this day
    const items = await DB.byIndex("template_items", "template_day_id", CURRENT_DAY_ID);
    let maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order)) : 0;
    
    // Parse target sets and reps
    const targetSets = parseInt($("tmplTargetSets").value) || 3;
    const targetReps = $("tmplTargetReps").value.trim() || "8-12";
    const restSeconds = parseInt($("tmplRestSec").value) || 90;
    
    const newItem = {
      id: Date.now() + Math.random(), // Gera ID único
      template_id: ACTIVE_TEMPLATE_ID,
      template_day_id: CURRENT_DAY_ID,
      exercise_id: SELECTED_EXERCISE.id,
      order: maxOrder + 1,
      target_sets: targetSets,
      target_reps: targetReps,
      custom_reps: customReps || null,
      rest_seconds: restSeconds,
      combo_type: comboType || null,
      combo_group: null,
      combo_order: null
    };
    
    await DB.put("template_items", newItem);
    showToast("Exercício adicionado ao treino!", "success");
    
    // Reset
    SELECTED_EXERCISE = null;
    $("tmplExSearch").value = "";
    $("tmplCustomReps").value = "";
    $("btnAddTemplateItem").disabled = true;
    
    await loadTemplateItems();
    searchExercisesForTemplate();
    
  } catch (err) {
    console.error("Erro ao adicionar exercício:", err);
    showToast("Erro ao adicionar exercício", "error");
  }
}

// ---------- EDIÇÃO DE EXERCÍCIOS ----------
let EDIT_GROUP = [];
let EDIT_SELECTED_EXERCISE = null;

async function editTemplateItem(group) {
  try {
    EDIT_GROUP = group;
    const firstItem = group[0];
    
    // Preencher os campos com os valores atuais
    $("editTargetSets").value = firstItem.target_sets || 3;
    $("editTargetReps").value = firstItem.target_reps || "8-12";
    $("editCustomReps").value = firstItem.custom_reps || "";
    $("editRestSec").value = firstItem.rest_seconds || 90;
    $("editComboType").value = firstItem.combo_type || "";
    
    // Mostrar exercícios atuais
    const exMap = new Map((await DB.all("exercises")).map(e => [e.id, e]));
    const exerciseNames = group.map(it => {
      const ex = exMap.get(it.exercise_id);
      return ex ? ex.name : "?";
    }).join(" • ");
    
    $("editModalTitle").textContent = `✏️ Editar: ${exerciseNames}`;
    $("editExercisesList").innerHTML = group.map(it => {
      const ex = exMap.get(it.exercise_id);
      return `<div>• ${escapeHtml(ex?.name || "?")}</div>`;
    }).join("");
    
    // Limpar busca de exercícios
    $("editExSearch").value = "";
    $("editExResults").innerHTML = "";
    $("btnAddExerciseToCombo").disabled = true;
    EDIT_SELECTED_EXERCISE = null;
    
    // Abrir modal
    $("editModal").style.display = "block";
    
  } catch (err) {
    console.error("Erro ao abrir edição:", err);
    showToast("Erro ao abrir edição", "error");
  }
}

function closeEditModal() {
  $("editModal").style.display = "none";
  EDIT_GROUP = [];
  EDIT_SELECTED_EXERCISE = null;
}

async function searchExercisesForEdit() {
  const query = $("editExSearch").value.trim().toLowerCase();
  const results = $("editExResults");
  
  if (!query) {
    results.innerHTML = "<div class='muted'>Digite para buscar exercícios...</div>";
    return;
  }
  
  const allExercises = await DB.all("exercises");
  const filtered = allExercises.filter(e => 
    e.is_active && 
    (e.name.toLowerCase().includes(query) || 
     e.primary_muscle.toLowerCase().includes(query))
  );
  
  if (!filtered.length) {
    results.innerHTML = "<div class='muted'>Nenhum exercício encontrado</div>";
    return;
  }
  
  results.innerHTML = "";
  for (const ex of filtered) {
    const div = document.createElement("div");
    div.className = "item";
    div.style.cursor = "pointer";
    div.innerHTML = `
      <div style="flex:1">
        <strong>${escapeHtml(ex.name)}</strong>
        <div class="meta">${escapeHtml(ex.primary_muscle)} • ${escapeHtml(ex.equipment)}</div>
      </div>
    `;
    
    div.onclick = () => {
      // Remover seleção anterior
      results.querySelectorAll(".item").forEach(i => i.style.background = "");
      div.style.background = "var(--primary)";
      div.style.color = "white";
      
      EDIT_SELECTED_EXERCISE = ex;
      $("btnAddExerciseToCombo").disabled = false;
    };
    
    results.appendChild(div);
  }
}

async function addExerciseToCombo() {
  if (!EDIT_SELECTED_EXERCISE || !EDIT_GROUP.length) return;
  
  try {
    const firstItem = EDIT_GROUP[0];
    
    // Verificar se já existe no grupo
    if (EDIT_GROUP.some(it => it.exercise_id === EDIT_SELECTED_EXERCISE.id)) {
      showToast("Este exercício já está no combo", "error");
      return;
    }
    
    // Buscar todos os itens do dia para pegar o máximo order
    const items = await DB.byIndex("template_items", "template_day_id", CURRENT_DAY_ID);
    let maxOrder = items.length > 0 ? Math.max(...items.map(i => i.order)) : 0;
    
    // Criar novo item com mesmo combo_group
    const newItem = {
      id: Date.now() + Math.random(),
      template_id: firstItem.template_id,
      template_day_id: firstItem.template_day_id,
      exercise_id: EDIT_SELECTED_EXERCISE.id,
      order: maxOrder + 1,
      target_sets: firstItem.target_sets,
      target_reps: firstItem.target_reps,
      custom_reps: firstItem.custom_reps,
      rest_seconds: firstItem.rest_seconds,
      combo_type: firstItem.combo_type || "superset",
      combo_group: firstItem.combo_group || Date.now(),
      combo_order: EDIT_GROUP.length + 1
    };
    
    await DB.put("template_items", newItem);
    
    // Atualizar combo_group e combo_type em todos os itens do grupo se não tinha
    if (!firstItem.combo_group) {
      for (const it of EDIT_GROUP) {
        it.combo_group = newItem.combo_group;
        it.combo_type = newItem.combo_type;
        await DB.put("template_items", it);
      }
    }
    
    showToast(`${EDIT_SELECTED_EXERCISE.name} adicionado ao combo!`, "success");
    
    // Recarregar o grupo atualizado
    const updatedItems = await DB.byIndex("template_items", "template_day_id", CURRENT_DAY_ID);
    const updatedGroup = updatedItems.filter(i => i.combo_group === (firstItem.combo_group || newItem.combo_group));
    updatedGroup.sort((a,b) => (a.combo_order||0) - (b.combo_order||0));
    
    await editTemplateItem(updatedGroup);
    
  } catch (err) {
    console.error("Erro ao adicionar ao combo:", err);
    showToast("Erro ao adicionar ao combo", "error");
  }
}

async function saveEditChanges() {
  if (!EDIT_GROUP.length) return;
  
  try {
    const targetSets = parseInt($("editTargetSets").value) || 3;
    const targetReps = $("editTargetReps").value.trim() || "8-12";
    const customReps = $("editCustomReps").value.trim() || null;
    const restSeconds = parseInt($("editRestSec").value) || 90;
    const comboType = $("editComboType").value.trim() || null;
    
    // Atualizar todos os itens do grupo
    for (const it of EDIT_GROUP) {
      it.target_sets = targetSets;
      it.target_reps = targetReps;
      it.custom_reps = customReps;
      it.rest_seconds = restSeconds;
      it.combo_type = comboType;
      
      await DB.put("template_items", it);
    }
    
    showToast("Alterações salvas!", "success");
    closeEditModal();
    await loadTemplateItems();
    
  } catch (err) {
    console.error("Erro ao salvar alterações:", err);
    showToast("Erro ao salvar alterações", "error");
  }
}

function openEditCustomRepsHelper() {
  openCustomRepsHelper("editCustomReps");
}

async function loadTemplateItems() {
  if (!CURRENT_DAY_ID) return;
  
  const items = await DB.byIndex("template_items", "template_day_id", CURRENT_DAY_ID);
  items.sort((a,b) => (a.order||0) - (b.order||0));
  
  const exMap = new Map((await DB.all("exercises")).map(e => [e.id, e]));
  const list = $("templateItemsList");
  list.innerHTML = "";
  
  if (!items.length) {
    list.innerHTML = "<div class='muted'>Nenhum exercício adicionado ainda</div>";
    return;
  }
  
  // Agrupar exercícios de combo
  const groups = [];
  const processed = new Set();
  
  for (const it of items) {
    if (processed.has(it.id)) continue;
    
    if (it.combo_group) {
      // Buscar todos os exercícios do mesmo combo_group
      const comboItems = items.filter(i => i.combo_group === it.combo_group);
      comboItems.sort((a,b) => (a.combo_order||0) - (b.combo_order||0));
      groups.push(comboItems);
      comboItems.forEach(i => processed.add(i.id));
    } else {
      groups.push([it]);
      processed.add(it.id);
    }
  }
  
  // Renderizar grupos
  for (const group of groups) {
    const isCombo = group.length > 1;
    const firstItem = group[0];
    
    // Montar nomes dos exercícios
    const exerciseNames = group.map(it => {
      const ex = exMap.get(it.exercise_id);
      return ex ? ex.name : "?";
    }).join(" + ");
    
    const repsDisplay = firstItem.custom_reps || firstItem.target_reps || "-";
    const comboInfo = firstItem.combo_type ? ` • ${firstItem.combo_type}` : "";
    
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div style="flex:1">
        <strong>${escapeHtml(exerciseNames)}</strong>
        <div class="meta">${firstItem.target_sets}x${repsDisplay} • ${firstItem.rest_seconds}s${comboInfo}</div>
      </div>
      <div class="row" style="gap:8px">
        <button class="secondary small" data-edit-group>✏️ Editar</button>
        <button class="danger small" data-del-group>🗑️ Remover</button>
      </div>
    `;
    
    div.querySelector(`[data-edit-group]`).onclick = async () => {
      await editTemplateItem(group);
    };
    
    div.querySelector(`[data-del-group]`).onclick = async () => {
      for (const it of group) {
        await DB.del("template_items", it.id);
      }
      showToast(isCombo ? "Combo removido" : "Exercício removido", "success");
      await loadTemplateItems();
    };
    
    list.appendChild(div);
  }
}

// ---------- CATALOG ----------
function escapeHtml(str) {
  return (str||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

async function renderCatalog(isAdminView=false) {
  const q = (isAdminView ? $("adminSearch").value : $("catalogSearch").value).trim().toLowerCase();
  const all = await DB.all("exercises");
  let list = all;

  if (!isAdminView) list = list.filter(e => e.is_active);

  if (q) list = list.filter(e => (e.name||"").toLowerCase().includes(q));

  list.sort((a,b)=> (a.name||"").localeCompare(b.name||""));

  const root = isAdminView ? $("adminExercises") : $("catalogList");
  root.innerHTML = "";

  for (const e of list) {
    const div = document.createElement("div");
    div.className = "item";
    const yt = e.youtube_url ? "vídeo ✅" : "vídeo —";
    div.innerHTML = `
      <div style="flex:1">
        <strong>${escapeHtml(e.name)}</strong>
        <div class="meta">${escapeHtml(e.primary_muscle)} • ${escapeHtml(e.equipment)} • ${escapeHtml(e.type)} • ${yt}</div>
        ${e.notes ? `<div class="meta">Obs: ${escapeHtml(e.notes)}</div>` : ""}
      </div>
      ${isAdminView ? `
        <div class="row">
          <button class="secondary small" data-act="toggle">${e.is_active ? "Inativar" : "Ativar"}</button>
          <button class="secondary small" data-act="edit">Editar</button>
          <button class="danger small" data-act="del">Excluir</button>
        </div>
      ` : ""}
    `;

    if (isAdminView) {
      div.querySelector('[data-act="toggle"]').onclick = async () => {
        e.is_active = !e.is_active;
        e.updated_at = nowIso();
        await DB.put("exercises", e);
        await renderCatalog(true);
        await renderCatalog(false);
      };
      div.querySelector('[data-act="del"]').onclick = async () => {
        if (!confirm("Excluir exercício?")) return;
        await DB.del("exercises", e.id);
        await renderCatalog(true);
        await renderCatalog(false);
      };
      div.querySelector('[data-act="edit"]').onclick = async () => {
        const n = prompt("Nome:", e.name); if (!n) return;
        e.name = n.trim();
        e.primary_muscle = (prompt("Músculo principal:", e.primary_muscle)||e.primary_muscle).trim();
        e.equipment = (prompt("Equipamento:", e.equipment)||e.equipment).trim();
        e.type = (prompt("Tipo:", e.type)||e.type).trim();
        e.youtube_url = (prompt("YouTube URL (1 link):", e.youtube_url||"")||"").trim();
        e.notes = (prompt("Observações:", e.notes||"")||"").trim();
        e.updated_at = nowIso();
        await DB.put("exercises", e);
        await renderCatalog(true);
        await renderCatalog(false);
      };
    }

    root.appendChild(div);
  }
}

// ---------- REQUESTS ----------
async function sendRequest() {
  const name = $("reqName").value.trim();
  const details = $("reqDetails").value.trim();
  if (!name) {
    showToast('Informe o nome do exercício', 'error');
    return;
  }

  await DB.put("exercise_requests", {
    id: uid(),
    requested_by: CURRENT.email,
    name,
    details,
    optional_youtube_url: "",
    status: "pending",
    admin_note: "",
    created_at: nowIso(),
    reviewed_at: null,
    reviewed_by: null
  });

  $("reqName").value = "";
  $("reqDetails").value = "";
  showToast('Solicitação enviada com sucesso!', 'success');
  await renderMyRequests();
  await renderPendingRequests();
}

async function renderMyRequests() {
  const all = await DB.byIndex("exercise_requests","requested_by",CURRENT.email);
  all.sort((a,b)=> (a.created_at < b.created_at ? 1 : -1));
  const root = $("myRequests");
  root.innerHTML = "";
  for (const r of all) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div style="flex:1">
        <strong>${escapeHtml(r.name)}</strong>
        <div class="meta">Status: ${r.status} • ${new Date(r.created_at).toLocaleString()}</div>
        ${r.details ? `<div class="meta">${escapeHtml(r.details)}</div>` : ""}
        ${r.admin_note ? `<div class="meta">Admin: ${escapeHtml(r.admin_note)}</div>` : ""}
      </div>
    `;
    root.appendChild(div);
  }
}

async function renderPendingRequests() {
  const all = await DB.byIndex("exercise_requests","status","pending");
  all.sort((a,b)=> (a.created_at < b.created_at ? 1 : -1));
  const root = $("pendingRequests");
  root.innerHTML = "";
  for (const r of all) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div style="flex:1">
        <strong>${escapeHtml(r.name)}</strong>
        <div class="meta">Solicitado por: ${escapeHtml(r.requested_by)} • ${new Date(r.created_at).toLocaleString()}</div>
        ${r.details ? `<div class="meta">${escapeHtml(r.details)}</div>` : ""}
      </div>
      <div class="row">
        <button class="good small" data-act="approve">Aprovar + Cadastrar</button>
        <button class="danger small" data-act="reject">Rejeitar</button>
      </div>
    `;
    div.querySelector('[data-act="approve"]').onclick = async () => approveRequest(r.id);
    div.querySelector('[data-act="reject"]').onclick = async () => rejectRequest(r.id);
    root.appendChild(div);
  }
}

async function approveRequest(reqId) {
  const r = await DB.get("exercise_requests", reqId);
  if (!r) return;

  const primary = prompt("Músculo principal:", "costas") || "costas";
  const equip = prompt("Equipamento:", "outro") || "outro";
  const type = prompt("Tipo (compound/isolation/other):", "other") || "other";
  const notes = prompt("Observações (opcional):", "") || "";

  await DB.put("exercises", {
    id: uid(),
    name: r.name.trim(),
    primary_muscle: primary.trim().toLowerCase(),
    secondary_muscles: [],
    equipment: equip.trim().toLowerCase(),
    type: type.trim().toLowerCase(),
    instructions: "",
    notes: notes.trim(),
    youtube_url: "",
    is_active: true,
    created_by: CURRENT.email,
    created_at: nowIso()
  });

  r.status = "approved";
  r.reviewed_at = nowIso();
  r.reviewed_by = CURRENT.email;
  r.admin_note = "Aprovado e cadastrado.";
  await DB.put("exercise_requests", r);

  await renderPendingRequests();
  await renderCatalog(true);
  await renderCatalog(false);
  await renderMyRequests();
}

async function rejectRequest(reqId) {
  const r = await DB.get("exercise_requests", reqId);
  if (!r) return;
  const note = prompt("Motivo (admin):", "Já existe / nome incorreto / etc.") || "";
  r.status = "rejected";
  r.reviewed_at = nowIso();
  r.reviewed_by = CURRENT.email;
  r.admin_note = note.trim();
  await DB.put("exercise_requests", r);
  await renderPendingRequests();
  await renderMyRequests();
}

// ---------- SESSIONS (offline + resume) ----------
async function getLiveSession() {
  const r = await DB.get("runtime", `live_session:${CURRENT.email}`);
  return r?.value || null;
}
async function setLiveSession(value) {
  await DB.put("runtime", { key: `live_session:${CURRENT.email}`, value });
}

async function startSession() {
  const templateId = $("selTemplateToStart").value;
  if (!templateId) {
    showToast('Selecione um treino', 'error');
    return;
  }
  const t = await DB.get("templates", templateId);
  if (!t) {
    showToast('Treino não encontrado', 'error');
    return;
  }

  const existing = await getLiveSession();
  if (existing?.status === "running") {
    showToast('Já existe uma sessão em andamento. Finalize ou retome.', 'error');
    return;
  }

  const session = {
    id: uid(),
    owner_id: CURRENT.email,
    template_id: templateId,
    status: "running",
    started_at: nowIso(),
    finished_at: null,
    notes: ""
  };

  await DB.put("sessions", session);
  await setLiveSession({ ...session });

  showToast('Treino iniciado! Boa sorte! 💪', 'success');
  // prebuild exercise list based on template items
  await renderTrainUI();
}

async function finishSession() {
  const live = await getLiveSession();
  if (!live) return;
  const session = await DB.get("sessions", live.id);
  if (!session) return;

  session.status = "finished";
  session.finished_at = nowIso();
  await DB.put("sessions", session);
  await setLiveSession(null);

  // stop rest
  await stopRest();

  showToast('Treino finalizado! Ótimo trabalho! 💪', 'success');
  await renderTrainUI();
  await renderHistory();
}

function msToClock(ms) {
  const total = Math.max(0, Math.floor(ms/1000));
  const m = String(Math.floor(total/60)).padStart(2,"0");
  const s = String(total%60).padStart(2,"0");
  return `${m}:${s}`;
}

let sessionTick = null;

async function renderTrainUI() {
  const live = await getLiveSession();

  // banner
  if (live?.status === "running") {
    $("cardSessionBanner").style.display = "block";
    const started = new Date(live.started_at).getTime();
    $("sessionBannerText").textContent =
      `Iniciado em ${new Date(live.started_at).toLocaleString()} • Duração atual: ${msToClock(Date.now()-started)}`;
  } else {
    $("cardSessionBanner").style.display = "none";
  }

  // area
  const liveArea = $("liveSessionArea");
  const noLive = $("noLiveSession");

  if (!live || live.status !== "running") {
    liveArea.style.display = "none";
    noLive.style.display = "block";
    if (sessionTick) { clearInterval(sessionTick); sessionTick=null; }
    return;
  }

  liveArea.style.display = "block";
  noLive.style.display = "none";

  const t = await DB.get("templates", live.template_id);
  $("liveSessionTitle").textContent = `Sessão: ${t?.name || "Treino"}`;

  // tick time
  const startedMs = new Date(live.started_at).getTime();
  const upd = () => $("liveSessionTime").textContent = `Tempo: ${msToClock(Date.now()-startedMs)}`;
  upd();
  if (sessionTick) clearInterval(sessionTick);
  sessionTick = setInterval(upd, 1000);

  // render exercises from template items
  const items = await DB.byIndex("template_items","template_id", live.template_id);
  items.sort((a,b)=> (a.order||0)-(b.order||0));
  const exMap = new Map((await DB.all("exercises")).map(e=>[e.id,e]));
  const setsAll = (await DB.byIndex("session_sets","session_id", live.id));

  const root = $("liveExercises");
  root.innerHTML = "";

  // Agrupar exercícios de combo
  const groups = [];
  const processed = new Set();
  
  for (const it of items) {
    if (processed.has(it.id)) continue;
    
    if (it.combo_group) {
      const comboItems = items.filter(i => i.combo_group === it.combo_group);
      comboItems.sort((a,b) => (a.combo_order||0) - (b.combo_order||0));
      groups.push(comboItems);
      comboItems.forEach(i => processed.add(i.id));
    } else {
      groups.push([it]);
      processed.add(it.id);
    }
  }

  // Renderizar grupos
  for (const group of groups) {
    const isCombo = group.length > 1;
    const firstItem = group[0];
    
    // Montar nomes dos exercícios
    const exerciseNames = group.map(it => {
      const ex = exMap.get(it.exercise_id);
      return ex ? ex.name : "?";
    }).join(" + ");
    
    // Para combos, mostrar informações do primeiro exercício como referência
    const ex = exMap.get(firstItem.exercise_id);
    if (!ex) continue;

    // Buscar sets de todos os exercícios do combo
    const allExIds = group.map(it => it.exercise_id);
    const sets = setsAll.filter(s => allExIds.includes(s.exercise_id)).sort((a,b)=>a.set_index-b.set_index);
    
    const lastLine = sets.length
      ? `Último set: ${formatWeightForUI(sets[sets.length-1].weight_kg)} x ${sets[sets.length-1].reps || "-"}`
      : "Sem sets ainda";

    const combo = firstItem.combo_type ? `${firstItem.combo_type}` : "";
    const target = `${firstItem.target_sets||"-"}x${firstItem.target_reps||"-"} • ${firstItem.rest_seconds||90}s`;

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div style="flex:1">
        <strong>${escapeHtml(exerciseNames)}</strong>
        <div class="meta">${escapeHtml(ex.primary_muscle)} • ${escapeHtml(ex.equipment)} ${combo ? " • " + combo : ""}</div>
        <div class="meta">Alvo: ${escapeHtml(target)}</div>
        <div class="meta">${escapeHtml(lastLine)}</div>

        <div class="divider"></div>

        ${group.map((it, idx) => {
          const itemEx = exMap.get(it.exercise_id);
          const itemSets = setsAll.filter(s => s.exercise_id === it.exercise_id).sort((a,b)=>a.set_index-b.set_index);
          
          return `
            <div style="margin-bottom: 12px; ${idx > 0 ? 'border-top: 1px solid var(--border); padding-top: 12px;' : ''}">
              ${isCombo ? `<div class="meta" style="margin-bottom: 4px;"><strong>${escapeHtml(itemEx?.name || "?")}</strong></div>` : ''}
              <div class="row" style="gap:8px">
                <input style="width:130px" data-w-${it.exercise_id} placeholder="Peso (${CURRENT.unit})">
                <input style="width:110px" data-r-${it.exercise_id} placeholder="Reps">
                <button class="small good" data-add-${it.exercise_id}>+ Set</button>
              </div>
              <div class="muted" style="margin-top:4px">${itemSets.map(s => `Set ${s.set_index}: ${formatWeightForUI(s.weight_kg)} x ${s.reps||"-"}`).join(" • ")}</div>
            </div>
          `;
        }).join('')}

        <div class="row" style="gap:8px; margin-top: 8px;">
          <button class="small secondary" data-rest>Descansar ${firstItem.rest_seconds||90}s</button>
        </div>
      </div>
    `;

    // Adicionar event listeners para cada exercício do grupo
    for (const it of group) {
      const itemEx = exMap.get(it.exercise_id);
      if (!itemEx) continue;
      
      const inpW = div.querySelector(`[data-w-${it.exercise_id}]`);
      const inpR = div.querySelector(`[data-r-${it.exercise_id}]`);
      const btnAdd = div.querySelector(`[data-add-${it.exercise_id}]`);

      if (!btnAdd) continue;

      btnAdd.onclick = async () => {
        const wTxt = (inpW.value||"").trim().replace(",",".");
        const rTxt = (inpR.value||"").trim();
        if (!wTxt) {
          showToast('Informe o peso', 'error');
          return;
        }
        const reps = rTxt ? parseInt(rTxt,10) : null;
        if (rTxt && isNaN(reps)) {
          showToast('Reps inválidas', 'error');
          return;
        }

        const weightUI = parseFloat(wTxt);
        if (isNaN(weightUI) || weightUI <= 0) {
          showToast('Peso inválido', 'error');
          return;
        }

        const weightKg = (CURRENT.unit === "kg") ? weightUI : toKg(weightUI);

        const itemSets = setsAll.filter(s => s.exercise_id === it.exercise_id).sort((a,b)=>a.set_index-b.set_index);
        const nextIndex = (itemSets.length ? Math.max(...itemSets.map(s=>s.set_index)) : 0) + 1;

        await DB.put("session_sets", {
          id: uid(),
          session_id: live.id,
          exercise_id: it.exercise_id,
          set_index: nextIndex,
          reps: reps,
          weight_kg: weightKg,
          rir: null,
          rpe: null,
          notes: "",
          created_at: nowIso()
        });

        inpW.value = "";
        inpR.value = "";

        showToast(`Set registrado para ${itemEx.name}`, 'success');
        await renderTrainUI();
      };
    }

    const btnRest = div.querySelector("[data-rest]");
    btnRest.onclick = async () => {
      const restSec = firstItem.rest_seconds || 90;
      await startRest(restSec);
      openRestModal();
    };

    root.appendChild(div);
  }
}

function formatWeightForUI(weightKg) {
  if (weightKg == null) return "-";
  if (CURRENT.unit === "kg") return `${(+weightKg).toFixed(2)} kg`;
  return `${toLb(+weightKg).toFixed(2)} lb`;
}

// ---------- REST TIMER (timestamp-based) ----------
async function getRestState() {
  const r = await DB.get("runtime", `rest:${CURRENT.email}`);
  return r?.value || null;
}
async function setRestState(value) {
  await DB.put("runtime", { key: `rest:${CURRENT.email}`, value });
}

let restTick = null;

async function startRest(seconds) {
  await setRestState({ started_at: Date.now(), duration_sec: seconds });
}

async function stopRest() {
  await setRestState(null);
  if (restTick) { clearInterval(restTick); restTick = null; }
  $("restClock").textContent = "00:00";
}

function openRestModal() {
  $("restModal").style.display = "block";
  updateRestUI();
  if (restTick) clearInterval(restTick);
  restTick = setInterval(updateRestUI, 250);
}
function closeRestModal() {
  $("restModal").style.display = "none";
  if (restTick) { clearInterval(restTick); restTick = null; }
}

async function updateRestUI() {
  const st = await getRestState();
  if (!st) {
    $("restClock").textContent = "00:00";
    $("restInfo").textContent = "Sem descanso em andamento.";
    return;
  }
  const elapsed = (Date.now() - st.started_at) / 1000;
  const left = Math.max(0, Math.ceil(st.duration_sec - elapsed));
  $("restClock").textContent = msToClock(left*1000);
  $("restInfo").textContent = left > 0
    ? `Restando ${left}s`
    : `Descanso finalizado (há ${Math.floor(elapsed - st.duration_sec)}s)`;
}

// ---------- HISTORY ----------
async function renderHistory() {
  const sessions = await DB.byIndex("sessions","owner_id",CURRENT.email);
  const fin = sessions.filter(s=>s.status==="finished").sort((a,b)=>(a.finished_at < b.finished_at ? 1 : -1));
  const root = $("historyList");
  root.innerHTML = "";
  const templates = new Map((await DB.byIndex("templates","owner_id",CURRENT.email)).map(t=>[t.id,t]));

  for (const s of fin) {
    const t = templates.get(s.template_id);
    const started = new Date(s.started_at).getTime();
    const ended = new Date(s.finished_at).getTime();
    const dur = msToClock(ended-started);

    const sets = await DB.byIndex("session_sets","session_id",s.id);
    const volKg = sets.reduce((acc,x)=> acc + ((+x.weight_kg||0) * (+x.reps||0)), 0);

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div style="flex:1">
        <strong>${escapeHtml(t?.name || "Treino")}</strong>
        <div class="meta">Finalizado: ${new Date(s.finished_at).toLocaleString()} • Duração: ${dur}</div>
        <div class="meta">Sets: ${sets.length} • Volume (kg*reps): ${volKg.toFixed(0)}</div>
      </div>
      <div class="row">
        <button class="secondary small" data-act="details">Detalhes</button>
        <button class="danger small" data-act="del">Excluir</button>
      </div>
    `;
    div.querySelector('[data-act="del"]').onclick = async ()=>{
      if (!confirm("Excluir sessão e sets?")) return;
      await DB.del("sessions", s.id);
      for (const set of sets) await DB.del("session_sets", set.id);
      await renderHistory();
    };
    div.querySelector('[data-act="details"]').onclick = ()=>{
      const byEx = new Map();
      for (const set of sets) {
        const arr = byEx.get(set.exercise_id) || [];
        arr.push(set);
        byEx.set(set.exercise_id, arr);
      }
      const msg = `📊 Detalhes do Treino\n\nExercícios: ${byEx.size}\nSets totais: ${sets.length}\nVolume (kg×reps): ${volKg.toFixed(0)}\n\n💡 Gráficos de progresso virão na próxima versão!`;
      alert(msg);
    };
    root.appendChild(div);
  }

  if (!fin.length) {
    root.innerHTML = `<div class="muted">Sem sessões finalizadas ainda.</div>`;
  }
}

// ---------- ADMIN: create exercise ----------
async function createExerciseAdmin() {
  const name = $("exName").value.trim();
  const primary = $("exPrimary").value.trim();
  if (!name || !primary) {
    showToast('Informe nome e músculo principal', 'error');
    return;
  }

  const sec = $("exSecondary").value.split(",").map(s=>s.trim()).filter(Boolean);
  const equip = $("exEquip").value.trim() || "other";
  const type = $("exType").value.trim() || "other";
  const instr = $("exInstr").value.trim();
  const notes = $("exNotes").value.trim();
  const yt = $("exYoutube").value.trim();

  await DB.put("exercises", {
    id: uid(),
    name,
    primary_muscle: primary.toLowerCase(),
    secondary_muscles: sec.map(x=>x.toLowerCase()),
    equipment: equip.toLowerCase(),
    type: type.toLowerCase(),
    instructions: instr,
    notes,
    youtube_url: yt,
    is_active: true,
    created_by: CURRENT.email,
    created_at: nowIso()
  });

  $("exName").value = "";
  $("exPrimary").value = "";
  $("exSecondary").value = "";
  $("exEquip").value = "";
  $("exType").value = "";
  $("exInstr").value = "";
  $("exNotes").value = "";
  $("exYoutube").value = "";

  showToast('Exercício cadastrado com sucesso!', 'success');
  await renderCatalog(true);
  await renderCatalog(false);
}

// ---------- TAB wiring ----------
function wireTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = async () => {
      const tab = btn.dataset.tab;
      setTabs(tab);
      if (tab === "templates") await listTemplates();
      if (tab === "catalog") await renderCatalog(false);
      if (tab === "requests") await renderMyRequests();
      if (tab === "history") await renderHistory();
      if (tab === "admin") {
        await renderPendingRequests();
        await renderCatalog(true);
      }
    };
  });
}

// ---------- ASSISTENTE DE SÉRIES PERSONALIZADAS ----------
let customRepsBlocks = [];
let customRepsTargetField = null; // Para saber qual campo preencher

function openCustomRepsHelper(targetFieldId = "tmplCustomReps") {
  customRepsTargetField = targetFieldId;
  // Inicializar com um bloco padrão
  customRepsBlocks = [{ sets: 3, reps: 12 }];
  renderCustomRepsBlocks();
  $("customRepsModal").style.display = "block";
}

function closeCustomRepsHelper() {
  $("customRepsModal").style.display = "none";
}

function addRepsBlock() {
  customRepsBlocks.push({ sets: 1, reps: 10 });
  renderCustomRepsBlocks();
}

function removeRepsBlock(index) {
  customRepsBlocks.splice(index, 1);
  if (customRepsBlocks.length === 0) {
    customRepsBlocks.push({ sets: 3, reps: 12 });
  }
  renderCustomRepsBlocks();
}

function updateRepsBlock(index, field, value) {
  customRepsBlocks[index][field] = parseInt(value) || 1;
  renderCustomRepsBlocks();
}

function renderCustomRepsBlocks() {
  const container = $("customRepsBlocks");
  container.innerHTML = "";
  
  customRepsBlocks.forEach((block, index) => {
    const div = document.createElement("div");
    div.className = "row";
    div.style.gap = "8px";
    div.style.marginBottom = "12px";
    div.innerHTML = `
      <input type="number" min="1" max="20" value="${block.sets}" 
             data-block-sets="${index}" placeholder="Séries" 
             style="width:80px;text-align:center">
      <span style="line-height:40px">×</span>
      <input type="number" min="1" max="100" value="${block.reps}" 
             data-block-reps="${index}" placeholder="Reps" 
             style="width:80px;text-align:center">
      <span style="line-height:40px">reps</span>
      ${customRepsBlocks.length > 1 ? `<button class="danger small" data-remove="${index}">✕</button>` : ''}
    `;
    
    const setsInput = div.querySelector(`[data-block-sets="${index}"]`);
    const repsInput = div.querySelector(`[data-block-reps="${index}"]`);
    
    setsInput.oninput = (e) => updateRepsBlock(index, 'sets', e.target.value);
    repsInput.oninput = (e) => updateRepsBlock(index, 'reps', e.target.value);
    
    const removeBtn = div.querySelector(`[data-remove="${index}"]`);
    if (removeBtn) {
      removeBtn.onclick = () => removeRepsBlock(index);
    }
    
    container.appendChild(div);
  });
  
  updateCustomRepsPreview();
}

function updateCustomRepsPreview() {
  const preview = customRepsBlocks
    .map(block => `${block.sets}x${block.reps}`)
    .join(" + ");
  
  $("customRepsPreview").textContent = preview;
}

function applyCustomReps() {
  // Converter blocos em lista de reps individuais
  const reps = [];
  customRepsBlocks.forEach(block => {
    for (let i = 0; i < block.sets; i++) {
      reps.push(block.reps);
    }
  });
  
  // Aplicar no campo correto (modal de adição ou edição)
  $(customRepsTargetField || "tmplCustomReps").value = reps.join(", ");
  closeCustomRepsHelper();
  showToast('Séries personalizadas aplicadas!', 'success');
}

// ---------- INIT ----------
async function init() {
  netUpdate();
  await ensureSeed();

  // events
  $("btnLogin").onclick = async () => {
    const email = $("inpEmail").value.trim().toLowerCase();
    const password = $("inpPass").value.trim();
    const rememberMe = $("chkRememberMe").checked;
    
    if (!email) {
      $("authMsg").textContent = "Informe um e-mail.";
      $("authMsg").style.color = "var(--bad)";
      return;
    }
    
    if (!password) {
      $("authMsg").textContent = "Informe uma senha.";
      $("authMsg").style.color = "var(--bad)";
      return;
    }
    
    const result = await demoLogin(email, password, rememberMe);
    
    if (result.error) {
      $("authMsg").textContent = result.error;
      $("authMsg").style.color = "var(--bad)";
      return;
    }
    
    $("authMsg").textContent = "";
    await bootstrap(result.email, result.role);
  };
  
  $("btnRegister").onclick = () => {
    try {
      $("registerModal").style.display = "block";
      // Limpar campos
      $("regName").value = "";
      $("regEmail").value = "";
      $("regPassword").value = "";
      $("regAge").value = "";
      $("regWeight").value = "";
      $("regHeight").value = "";
      $("regGender").value = "";
      $("regRole").value = "student";
      $("registerMsg").textContent = "";
    } catch (err) {
      console.error("Erro ao abrir modal de registro:", err);
    }
  };
  
  $("btnCloseRegisterModal").onclick = () => {
    $("registerModal").style.display = "none";
  };
  
  $("btnConfirmRegister").onclick = async () => {
    const name = $("regName").value.trim();
    const email = $("regEmail").value.trim().toLowerCase();
    const password = $("regPassword").value.trim();
    const age = $("regAge").value.trim();
    const weight = $("regWeight").value.trim();
    const height = $("regHeight").value.trim();
    const gender = $("regGender").value;
    const role = $("regRole").value;
    
    if (!name) {
      $("registerMsg").textContent = "Informe seu nome completo.";
      $("registerMsg").style.color = "var(--bad)";
      return;
    }
    
    if (!email) {
      $("registerMsg").textContent = "Informe um e-mail.";
      $("registerMsg").style.color = "var(--bad)";
      return;
    }
    
    if (!password) {
      $("registerMsg").textContent = "Informe uma senha.";
      $("registerMsg").style.color = "var(--bad)";
      return;
    }
    
    if (!age || !weight || !height || !gender) {
      $("registerMsg").textContent = "Preencha todos os campos.";
      $("registerMsg").style.color = "var(--bad)";
      return;
    }
    
    const result = await demoRegister({ email, password, name, age, weight, height, gender, role });
    
    if (result.error) {
      $("registerMsg").textContent = result.error;
      $("registerMsg").style.color = "var(--bad)";
      return;
    }
    
    $("registerModal").style.display = "none";
    showToast('Conta criada com sucesso!', 'success');
    await bootstrap(result.email, result.role);
  };

  $("btnInstallApp").onclick = installApp;

  $("btnLogout").onclick = async () => {
    await demoLogout();
    CURRENT = { email:null, role:null, unit:"kg" };
    setHeader(); showApp(false);
  };

  $("btnSaveSettings").onclick = async () => {
    await saveSettings();
    setHeader();
    await renderTrainUI();
  };

  $("btnCreateTemplate").onclick = createTemplate;

  // template days modal
  $("btnCloseTemplateDaysModal").onclick = closeTemplateDaysModal;
  $("btnAddTemplateDay").onclick = addTemplateDay;

  // template items modal
  $("btnCloseTemplateModal").onclick = closeTemplateModal;
  $("tmplExSearch").oninput = searchExercisesForTemplate;
  $("btnAddTemplateItem").onclick = addTemplateItem;
  $("btnAddMultipleItems").onclick = addMultipleItems;
  $("tmplComboType").onchange = toggleComboMode;

  // custom reps helper
  $("btnCustomRepsHelper").onclick = () => openCustomRepsHelper("tmplCustomReps");
  $("btnCloseCustomReps").onclick = closeCustomRepsHelper;
  $("btnCancelCustomReps").onclick = closeCustomRepsHelper;
  $("btnAddRepsBlock").onclick = addRepsBlock;
  $("btnApplyCustomReps").onclick = applyCustomReps;

  // edit modal
  $("btnCloseEditModal").onclick = closeEditModal;
  $("btnCancelEdit").onclick = closeEditModal;
  $("btnSaveEdit").onclick = saveEditChanges;
  $("editExSearch").oninput = searchExercisesForEdit;
  $("btnAddExerciseToCombo").onclick = addExerciseToCombo;
  $("btnEditCustomRepsHelper").onclick = openEditCustomRepsHelper;

  $("catalogSearch").oninput = () => renderCatalog(false);
  $("adminSearch").oninput = () => renderCatalog(true);

  $("btnSendRequest").onclick = sendRequest;

  $("btnCreateExercise").onclick = createExerciseAdmin;

  $("btnStartSession").onclick = startSession;
  $("btnFinishSession").onclick = finishSession;
  $("btnFinishSessionQuick").onclick = finishSession;
  $("btnResumeSession").onclick = async () => { setTabs("train"); await renderTrainUI(); };

  // rest modal
  $("btnOpenRest").onclick = () => openRestModal();
  $("btnCloseRest").onclick = () => closeRestModal();
  $("btnStartRest").onclick = async () => {
    const s = parseInt($("selRestSeconds").value,10);
    await startRest(s);
    openRestModal();
  };
  $("btnStopRest").onclick = stopRest;

  wireTabs();

  // auto login if user exists
  const u = await getCurrentUser();
  if (u?.email) await bootstrap(u.email, u.role);
  else { setHeader(); showApp(false); }

  // close modals if click outside
  $("restModal").addEventListener("click",(e)=>{
    if (e.target === $("restModal")) closeRestModal();
  });
  $("templateModal").addEventListener("click",(e)=>{
    if (e.target === $("templateModal")) closeTemplateModal();
  });
  $("templateDaysModal").addEventListener("click",(e)=>{
    if (e.target === $("templateDaysModal")) closeTemplateDaysModal();
  });
  $("registerModal").addEventListener("click",(e)=>{
    if (e.target === $("registerModal")) $("registerModal").style.display = "none";
  });
}

async function bootstrap(email, role) {
  CURRENT.email = email;
  CURRENT.role = role;

  await loadSettings();
  setHeader();
  showApp(true);

  // admin tab
  const isAdmin = role === "admin";
  $("tabAdmin").style.display = isAdmin ? "inline-block" : "none";

  // default tab
  setTabs("train");

  // set default rest in modal select
  $("selRestSeconds").value = "90";

  await listTemplates();
  await renderCatalog(false);
  await renderMyRequests();
  await renderPendingRequests();
  await renderHistory();
  await renderTrainUI();
}

init().catch(console.error);

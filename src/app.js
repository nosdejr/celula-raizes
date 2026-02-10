alert("JS carregou");
// Célula Raízes - SPA estática com Supabase
// ---------------------------------------------------------------------------
// IMPORTANTE:
// - Defina as variáveis de ambiente do Supabase via injeção segura no build
//   ou use um arquivo separado não commitado com as chaves e importe aqui.
// - Nunca exponha senha de admin. Use apenas email+senha via Supabase Auth.
// ---------------------------------------------------------------------------

// TODO: substitua por valores INJETADOS em tempo de build/deploy
const SUPABASE_URL = window.SUPABASE_URL || "https://sxvdzghltsmsvjjorvoc.supabase.co";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4dmR6Z2hsdHNtc3Zqam9ydm9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2Njg0NzIsImV4cCI6MjA4NjI0NDQ3Mn0.josowwt8D1cYhnotJz93vggUuQPv3iNIMBcSpUdrdMM";

// Inicializa cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDayMonth(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function setLoading(button, isLoading, textWhenIdle) {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = "Salvando...";
    button.disabled = true;
  } else {
    button.textContent = textWhenIdle || button.dataset.originalText || "Salvar";
    button.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Navegação básica entre seções públicas
// ---------------------------------------------------------------------------

const sections = document.querySelectorAll(".section");
const navLinks = document.querySelectorAll(".nav-link");
const homeNavCards = document.querySelectorAll(".home-nav-card");
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

menuToggle?.addEventListener("click", () => {
  mainNav.classList.toggle("open");
});

navLinks.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.section;
    if (!target) return;

    navLinks.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    sections.forEach((sec) => {
      sec.classList.toggle("active", sec.id === `section-${target}`);
    });

    mainNav.classList.remove("open");
  });
});

// cards da home usam a mesma navegação das abas principais
homeNavCards.forEach((card) => {
  card.addEventListener("click", () => {
    const target = card.dataset.section;
    if (!target) return;
    const button = document.querySelector(`.nav-link[data-section=\"${target}\"]`);
    if (button) button.click();
  });
});

// ---------------------------------------------------------------------------
// Autenticação Admin (Supabase Auth)
// ---------------------------------------------------------------------------

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const adminLogin = document.getElementById("adminLogin");
const adminDashboard = document.getElementById("adminDashboard");
const adminUserEmail = document.getElementById("adminUserEmail");
const logoutBtn = document.getElementById("logoutBtn");

async function handleLogin(event) {
  event.preventDefault();
  loginError.textContent = "";

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    loginError.textContent = "Informe e-mail e senha.";
    return;
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error(error);
      loginError.textContent =
        error.message === "Invalid login credentials"
          ? "Credenciais inválidas. Verifique e-mail e senha."
          : "Erro ao entrar. Tente novamente.";
      return;
    }

    if (data.session) {
      applySessionUI(data.session);
    }
  } catch (err) {
    console.error(err);
    loginError.textContent = "Erro inesperado ao autenticar.";
  }
}

function applySessionUI(session) {
  if (session?.user) {
    adminLogin.classList.add("hidden");
    adminDashboard.classList.remove("hidden");
    adminUserEmail.textContent = session.user.email;
    // Carrega dados iniciais do admin
    loadAdminData();
  } else {
    adminLogin.classList.remove("hidden");
    adminDashboard.classList.add("hidden");
    adminUserEmail.textContent = "";
  }
}

async function checkInitialSession() {
  const { data, error } = await supabase.auth.getSession();
  if (!error && data.session) {
    applySessionUI(data.session);
  } else {
    applySessionUI(null);
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  applySessionUI(session);
});

loginForm?.addEventListener("submit", handleLogin);

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  applySessionUI(null);
});

// ---------------------------------------------------------------------------
// ADMIN: Tabs
// ---------------------------------------------------------------------------

const adminTabLinks = document.querySelectorAll(".admin-tab-link");
const adminTabs = document.querySelectorAll(".admin-tab");

adminTabLinks.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.adminTab;
    if (!tab) return;

    adminTabLinks.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    adminTabs.forEach((t) => {
      t.classList.toggle("active", t.id === `admin-tab-${tab}` || (tab === "content" && t.id === "admin-tab-content"));
    });
  });
});

// ---------------------------------------------------------------------------
// PUBLIC: Carregamento de dados
// ---------------------------------------------------------------------------

const birthdayBanner = document.getElementById("birthdayBanner");
const birthdayBannerList = document.getElementById("birthdayBannerList");
const birthdayList = document.getElementById("birthdayList");
const agendaList = document.getElementById("agendaList");
const scheduleList = document.getElementById("scheduleList");
const photoGrid = document.getElementById("photoGrid");

async function loadBirthdays() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const nextMonth = ((currentMonth % 12) || 12);
  const months = [currentMonth, nextMonth];

  const { data, error } = await supabase
    .from("membros")
    .select("id, nome, data_nascimento, aniversario_ajustado")
    .not("data_nascimento", "is", null);

  if (error) {
    console.error("Erro ao buscar aniversários", error);
    return;
  }

  const allBirthdays = (data || []).map((m) => {
    const baseDate = m.aniversario_ajustado || m.data_nascimento;
    const d = new Date(baseDate);
    const month = d.getMonth() + 1;
    return { ...m, month, dateObj: d };
  });

  const filtered = allBirthdays.filter((m) => months.includes(m.month));
  filtered.sort((a, b) => a.dateObj.getDate() - b.dateObj.getDate());

  // Banner do mês atual
  const currentMonthBirthdays = filtered.filter((m) => m.month === currentMonth);
  if (currentMonthBirthdays.length > 0) {
    birthdayBannerList.innerHTML = "";
    currentMonthBirthdays.forEach((m) => {
      const li = document.createElement("li");
      li.textContent = `${m.nome} — ${formatDayMonth(m.dateObj.toISOString())}`;
      birthdayBannerList.appendChild(li);
    });
    birthdayBanner.classList.remove("hidden");
  } else {
    birthdayBanner.classList.add("hidden");
  }

  // Lista pública
  birthdayList.innerHTML = "";
  filtered.forEach((m) => {
    const li = document.createElement("li");
    li.className = "card";
    li.innerHTML = `
      <div>
        <strong>${m.nome}</strong>
        <div class="card-meta">Aniversário: ${formatDayMonth(m.dateObj.toISOString())}</div>
      </div>
    `;
    birthdayList.appendChild(li);
  });
}

async function loadAgenda() {
  const { data, error } = await supabase
    .from("agenda")
    .select("*")
    .gte("data", todayISO())
    .order("data", { ascending: true });

  if (error) {
    console.error("Erro ao buscar agenda", error);
    return;
  }

  agendaList.innerHTML = "";
  (data || []).forEach((item) => {
    const li = document.createElement("li");
    li.className = "card";
    li.innerHTML = `
      <div>
        <strong>${formatDate(item.data)}</strong>
        <div class="card-meta">${item.descricao || ""}</div>
      </div>
    `;
    agendaList.appendChild(li);
  });
}

async function loadSchedules() {
  const { data, error } = await supabase
    .from("escalas")
    .select(
      `
      id, data,
      quebra_gelo:membros!quebra_gelo_id ( id, nome ),
      louvor:membros!louvor_id ( id, nome ),
      lanche:membros!lanche_id ( id, nome ),
      midia:membros!midia_id ( id, nome )
    `
    )
    .gte("data", todayISO())
    .order("data", { ascending: true });

  if (error) {
    console.error("Erro ao buscar escalas", error);
    return;
  }

  scheduleList.innerHTML = "";
  (data || []).forEach((s) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <h4>${formatDate(s.data)}</h4>
      <div class="card-meta">
        <div>Quebra-gelo: <strong>${s.quebra_gelo?.nome || "-"}</strong></div>
        <div>Louvor: <strong>${s.louvor?.nome || "-"}</strong></div>
        <div>Lanche: <strong>${s.lanche?.nome || "-"}</strong></div>
        <div>Mídia: <strong>${s.midia?.nome || "-"}</strong></div>
      </div>
    `;
    scheduleList.appendChild(div);
  });
}

async function loadPhotos() {
  const { data, error } = await supabase
    .from("fotos")
    .select("*")
    .order("upload_date", { ascending: false });

  if (error) {
    console.error("Erro ao buscar fotos", error);
    return;
  }

  photoGrid.innerHTML = "";
  (data || []).forEach((f) => {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = f.url;
    img.alt = "Foto da Célula Raízes";
    photoGrid.appendChild(img);
  });
}

async function loadPublicData() {
  await Promise.all([loadBirthdays(), loadAgenda(), loadSchedules(), loadPhotos()]);
}

// ---------------------------------------------------------------------------
// ADMIN: Conteúdo público (agenda, escalas, fotos)
// ---------------------------------------------------------------------------

const agendaForm = document.getElementById("agendaForm");
const agendaDate = document.getElementById("agendaDate");
const agendaDescription = document.getElementById("agendaDescription");
const adminAgendaList = document.getElementById("adminAgendaList");

agendaDate.value = todayISO();

agendaForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!agendaDate.value || !agendaDescription.value.trim()) return;

  const btn = agendaForm.querySelector("button[type='submit']");
  setLoading(btn, true, "Adicionar");
  const { error } = await supabase.from("agenda").insert({
    data: agendaDate.value,
    descricao: agendaDescription.value.trim(),
  });
  setLoading(btn, false, "Adicionar");

  if (error) {
    alert("Erro ao salvar agenda.");
    console.error(error);
    return;
  }

  agendaDescription.value = "";
  await Promise.all([loadAgenda(), loadAdminAgenda()]);
});

async function loadAdminAgenda() {
  const { data, error } = await supabase
    .from("agenda")
    .select("*")
    .order("data", { ascending: true });

  if (error) {
    console.error("Erro ao buscar agenda admin", error);
    return;
  }

  adminAgendaList.innerHTML = "";
  (data || []).forEach((item) => {
    const li = document.createElement("li");
    li.className = "card";
    li.innerHTML = `
      <div>
        <strong>${formatDate(item.data)}</strong>
        <div class="card-meta">${item.descricao || ""}</div>
      </div>
      <div class="card-actions">
        <button class="btn-secondary btn-sm" data-edit-agenda="${item.id}">Editar</button>
        <button class="btn-danger btn-sm" data-delete-agenda="${item.id}">Excluir</button>
      </div>
    `;
    adminAgendaList.appendChild(li);
  });
}

adminAgendaList?.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const editId = target.dataset.editAgenda;
  const deleteId = target.dataset.deleteAgenda;

  if (editId) {
    const { data, error } = await supabase
      .from("agenda")
      .select("*")
      .eq("id", editId)
      .single();
    if (error || !data) return;
    agendaDate.value = data.data.slice(0, 10);
    agendaDescription.value = data.descricao || "";
    // deletar e re-salvar serve como "update" simples
    await supabase.from("agenda").delete().eq("id", editId);
    await loadAdminAgenda();
  }

  if (deleteId) {
    if (!confirm("Deseja realmente excluir este evento?")) return;
    const { error } = await supabase.from("agenda").delete().eq("id", deleteId);
    if (error) {
      alert("Erro ao excluir.");
      console.error(error);
      return;
    }
    await Promise.all([loadAgenda(), loadAdminAgenda()]);
  }
});

// Escalas -------------------------------------------------------------------

const scheduleForm = document.getElementById("scheduleForm");
const scheduleDate = document.getElementById("scheduleDate");
const scheduleIcebreaker = document.getElementById("scheduleIcebreaker");
const scheduleWorship = document.getElementById("scheduleWorship");
const scheduleSnack = document.getElementById("scheduleSnack");
const scheduleMedia = document.getElementById("scheduleMedia");
const adminScheduleList = document.getElementById("adminScheduleList");

scheduleDate.value = todayISO();

async function loadMemberOptionsForSchedule() {
  const { data, error } = await supabase
    .from("membros")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar membros para escala", error);
    return;
  }

  [scheduleIcebreaker, scheduleWorship, scheduleSnack, scheduleMedia].forEach((sel) => {
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione...</option>';
    (data || []).forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.nome;
      sel.appendChild(opt);
    });
  });
}

scheduleForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!scheduleDate.value) return;

  const payload = {
    data: scheduleDate.value,
    quebra_gelo_id: scheduleIcebreaker.value || null,
    louvor_id: scheduleWorship.value || null,
    lanche_id: scheduleSnack.value || null,
    midia_id: scheduleMedia.value || null,
  };

  const btn = scheduleForm.querySelector("button[type='submit']");
  setLoading(btn, true, "Salvar Escala");
  const { error } = await supabase.from("escalas").insert(payload);
  setLoading(btn, false, "Salvar Escala");

  if (error) {
    alert("Erro ao salvar escala.");
    console.error(error);
    return;
  }

  scheduleIcebreaker.value = "";
  scheduleWorship.value = "";
  scheduleSnack.value = "";
  scheduleMedia.value = "";
  await Promise.all([loadSchedules(), loadAdminSchedules()]);
});

async function loadAdminSchedules() {
  const { data, error } = await supabase
    .from("escalas")
    .select("id, data")
    .order("data", { ascending: true });

  if (error) {
    console.error("Erro ao buscar escalas admin", error);
    return;
  }

  adminScheduleList.innerHTML = "";
  (data || []).forEach((s) => {
    const li = document.createElement("li");
    li.className = "card";
    li.innerHTML = `
      <div>
        <strong>${formatDate(s.data)}</strong>
      </div>
      <div class="card-actions">
        <button class="btn-danger btn-sm" data-delete-schedule="${s.id}">Excluir</button>
      </div>
    `;
    adminScheduleList.appendChild(li);
  });
}

adminScheduleList?.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const id = target.dataset.deleteSchedule;
  if (!id) return;
  if (!confirm("Excluir esta escala?")) return;
  const { error } = await supabase.from("escalas").delete().eq("id", id);
  if (error) {
    alert("Erro ao excluir escala.");
    console.error(error);
    return;
  }
  await Promise.all([loadSchedules(), loadAdminSchedules()]);
});

// Fotos ---------------------------------------------------------------------

const photoUploadForm = document.getElementById("photoUploadForm");
const photoFile = document.getElementById("photoFile");
const photoUploadError = document.getElementById("photoUploadError");
const photoPreview = document.getElementById("photoPreview");

photoUploadForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  photoUploadError.textContent = "";
  const file = photoFile.files?.[0];
  if (!file) {
    photoUploadError.textContent = "Selecione uma imagem.";
    return;
  }

  const btn = photoUploadForm.querySelector("button[type='submit']");
  setLoading(btn, true, "Enviar Foto");

  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${fileExt}`;
    const filePath = `celula-raizes/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("fotos")
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      console.error(uploadError);
      photoUploadError.textContent = "Erro ao enviar imagem.";
      setLoading(btn, false, "Enviar Foto");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("fotos").getPublicUrl(filePath);

    const { error: insertError } = await supabase.from("fotos").insert({
      url: publicUrl,
      upload_date: new Date().toISOString(),
    });
    if (insertError) {
      console.error(insertError);
      photoUploadError.textContent = "Erro ao registrar foto.";
      setLoading(btn, false, "Enviar Foto");
      return;
    }

    // preview
    const img = document.createElement("img");
    img.src = publicUrl;
    img.alt = "Foto enviada";
    img.loading = "lazy";
    photoPreview.prepend(img);
    photoFile.value = "";
    await loadPhotos();
  } catch (err) {
    console.error(err);
    photoUploadError.textContent = "Erro inesperado ao enviar foto.";
  } finally {
    setLoading(btn, false, "Enviar Foto");
  }
});

// ---------------------------------------------------------------------------
// ADMIN: Membros
// ---------------------------------------------------------------------------

const memberForm = document.getElementById("memberForm");
const memberId = document.getElementById("memberId");
const memberName = document.getElementById("memberName");
const memberType = document.getElementById("memberType");
const memberBirthDate = document.getElementById("memberBirthDate");
const memberBirthdayOverride = document.getElementById("memberBirthdayOverride");
const memberBaptism = document.getElementById("memberBaptism");
const memberEncounter = document.getElementById("memberEncounter");
const memberFormError = document.getElementById("memberFormError");
const memberTableBody = document.querySelector("#memberTable tbody");

function getSelectedCourses() {
  const checkboxes = memberForm.querySelectorAll('fieldset.courses input[type="checkbox"]');
  const values = [];
  checkboxes.forEach((cb) => {
    if (cb.checked) values.push(cb.value);
  });
  return values;
}

function setSelectedCourses(courses) {
  const checkboxes = memberForm.querySelectorAll('fieldset.courses input[type="checkbox"]');
  checkboxes.forEach((cb) => {
    cb.checked = Array.isArray(courses) && courses.includes(cb.value);
  });
}

memberForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  memberFormError.textContent = "";

  if (!memberName.value.trim() || !memberBirthDate.value) {
    memberFormError.textContent = "Nome e data de nascimento são obrigatórios.";
    return;
  }

  const payload = {
    nome: memberName.value.trim(),
    tipo: memberType.value,
    data_nascimento: memberBirthDate.value,
    aniversario_ajustado: memberBirthdayOverride.value || null,
    batismo: memberBaptism.value,
    encontro_com_deus: memberEncounter.value === "true",
    cursos: getSelectedCourses(),
  };

  const btn = memberForm.querySelector("button[type='submit']");
  setLoading(btn, true, "Salvar Membro");

  try {
    if (memberId.value) {
      const { error } = await supabase.from("membros").update(payload).eq("id", memberId.value);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("membros").insert(payload);
      if (error) throw error;
    }

    memberForm.reset();
    memberId.value = "";
    await Promise.all([loadMembers(), loadBirthdays(), loadMemberOptionsForSchedule(), loadAttendanceMembers()]);
  } catch (err) {
    console.error(err);
    memberFormError.textContent = "Erro ao salvar membro.";
  } finally {
    setLoading(btn, false, "Salvar Membro");
  }
});

async function loadMembers() {
  const { data, error } = await supabase
    .from("membros")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar membros", error);
    return;
  }

  memberTableBody.innerHTML = "";
  (data || []).forEach((m) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.nome}</td>
      <td>${m.tipo}</td>
      <td>${formatDate(m.data_nascimento)}</td>
      <td>${m.batismo}</td>
      <td>${m.encontro_com_deus ? "Sim" : "Não"}</td>
      <td>${Array.isArray(m.cursos) ? m.cursos.join(", ") : ""}</td>
      <td>
        <button class="btn-secondary btn-sm" data-edit-member="${m.id}">Editar</button>
        <button class="btn-danger btn-sm" data-delete-member="${m.id}">Excluir</button>
      </td>
    `;
    memberTableBody.appendChild(tr);
  });
}

memberTableBody?.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const editId = target.dataset.editMember;
  const deleteId = target.dataset.deleteMember;

  if (editId) {
    const { data, error } = await supabase
      .from("membros")
      .select("*")
      .eq("id", editId)
      .single();
    if (error || !data) return;

    memberId.value = data.id;
    memberName.value = data.nome;
    memberType.value = data.tipo;
    memberBirthDate.value = data.data_nascimento?.slice(0, 10) || "";
    memberBirthdayOverride.value = data.aniversario_ajustado?.slice(0, 10) || "";
    memberBaptism.value = data.batismo;
    memberEncounter.value = data.encontro_com_deus ? "true" : "false";
    setSelectedCourses(data.cursos || []);
    window.scrollTo({ top: memberForm.offsetTop - 80, behavior: "smooth" });
  }

  if (deleteId) {
    if (!confirm("Excluir este membro?")) return;
    const { error } = await supabase.from("membros").delete().eq("id", deleteId);
    if (error) {
      alert("Erro ao excluir membro.");
      console.error(error);
      return;
    }
    await Promise.all([loadMembers(), loadMemberOptionsForSchedule(), loadAttendanceMembers(), loadBirthdays()]);
  }
});

// ---------------------------------------------------------------------------
// ADMIN: Presenças
// ---------------------------------------------------------------------------

const attendanceForm = document.getElementById("attendanceForm");
const attendanceDate = document.getElementById("attendanceDate");
const attendanceMembers = document.getElementById("attendanceMembers");
const attendanceVisitors = document.getElementById("attendanceVisitors");
const attendanceError = document.getElementById("attendanceError");

attendanceDate.value = todayISO();

async function loadAttendanceMembers() {
  const { data, error } = await supabase
    .from("membros")
    .select("id, nome")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar membros para presença", error);
    return;
  }

  attendanceMembers.innerHTML = "";
  (data || []).forEach((m) => {
    const row = document.createElement("div");
    row.className = "attendance-item";
    row.innerHTML = `
      <span>${m.nome}</span>
      <label style="flex-direction:row;align-items:center;gap:.25rem;font-size:.8rem;">
        <input type="checkbox" data-attendance-member="${m.id}" /> Presente
      </label>
    `;
    attendanceMembers.appendChild(row);
  });
}

attendanceForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  attendanceError.textContent = "";

  if (!attendanceDate.value) {
    attendanceError.textContent = "Informe a data da célula.";
    return;
  }

  const presentCheckboxes = attendanceMembers.querySelectorAll("input[data-attendance-member]");
  const rows = [];
  presentCheckboxes.forEach((cb) => {
    const memberId = cb.dataset.attendanceMember;
    const present = cb.checked;
    rows.push({
      meeting_date: attendanceDate.value,
      member_id: memberId,
      present,
      type: "membro",
    });
  });

  const visitorsText = attendanceVisitors.value.trim();
  if (visitorsText) {
    visitorsText.split("\n").forEach((name) => {
      const trimmed = name.trim();
      if (trimmed) {
        rows.push({
          meeting_date: attendanceDate.value,
          member_id: null,
          present: true,
          type: "visitante",
          nome_visitante: trimmed,
        });
      }
    });
  }

  if (rows.length === 0) {
    attendanceError.textContent = "Marque pelo menos um presente ou visitante.";
    return;
  }

  const btn = attendanceForm.querySelector("button[type='submit']");
  setLoading(btn, true, "Salvar Presenças");

  try {
    // simples: remove registros anteriores da mesma data e insere novamente
    await supabase.from("presencas").delete().eq("meeting_date", attendanceDate.value);
    const { error } = await supabase.from("presencas").insert(rows);
    if (error) throw error;

    attendanceVisitors.value = "";
    presentCheckboxes.forEach((cb) => (cb.checked = false));
    await loadReports();
  } catch (err) {
    console.error(err);
    attendanceError.textContent = "Erro ao salvar presenças.";
  } finally {
    setLoading(btn, false, "Salvar Presenças");
  }
});

// ---------------------------------------------------------------------------
// ADMIN: Relatórios (Chart.js)
// ---------------------------------------------------------------------------

const reportFilterForm = document.getElementById("reportFilterForm");
const reportStart = document.getElementById("reportStart");
const reportEnd = document.getElementById("reportEnd");
const overallAttendanceAvg = document.getElementById("overallAttendanceAvg");

let attendanceByMeetingChart;
let attendanceByMemberChart;

reportFilterForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  await loadReports();
});

async function loadReports() {
  let query = supabase
    .from("presencas")
    .select("meeting_date, member_id, present, type, membros ( id, nome )");

  if (reportStart.value) {
    query = query.gte("meeting_date", reportStart.value);
  }
  if (reportEnd.value) {
    query = query.lte("meeting_date", reportEnd.value);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Erro ao carregar relatórios", error);
    return;
  }

  const rows = data || [];

  // presença por encontro
  const byMeeting = {};
  rows.forEach((r) => {
    const key = r.meeting_date;
    if (!byMeeting[key]) byMeeting[key] = { presentes: 0, total: 0 };
    if (r.type === "visitante") return; // opcional: ignorar visitantes na média
    byMeeting[key].total += 1;
    if (r.present) byMeeting[key].presentes += 1;
  });

  const meetingLabels = Object.keys(byMeeting).sort();
  const meetingPercent = meetingLabels.map((d) => {
    const { presentes, total } = byMeeting[d];
    return total ? Math.round((presentes / total) * 100) : 0;
  });

  const ctxMeeting = document.getElementById("attendanceByMeetingChart").getContext("2d");
  if (attendanceByMeetingChart) attendanceByMeetingChart.destroy();
  attendanceByMeetingChart = new Chart(ctxMeeting, {
    type: "bar",
    data: {
      labels: meetingLabels.map((d) => formatDate(d)),
      datasets: [
        {
          label: "% presença",
          data: meetingPercent,
          backgroundColor: "rgba(37, 99, 235, 0.7)",
          borderRadius: 6,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (v) => `${v}%` },
        },
      },
    },
  });

  // média geral
  const allPercent = meetingPercent.filter((v) => !Number.isNaN(v));
  const avg =
    allPercent.length > 0
      ? (allPercent.reduce((sum, v) => sum + v, 0) / allPercent.length).toFixed(1)
      : "0";
  overallAttendanceAvg.textContent = `${avg}% de presença média`;

  // presença por membro
  const byMember = {};
  rows.forEach((r) => {
    if (r.type === "visitante" || !r.member_id) return;
    const name = r.membros?.nome || r.member_id;
    if (!byMember[name]) byMember[name] = { presentes: 0, total: 0 };
    byMember[name].total += 1;
    if (r.present) byMember[name].presentes += 1;
  });

  const memberLabels = Object.keys(byMember);
  const memberPercent = memberLabels.map((n) => {
    const { presentes, total } = byMember[n];
    return total ? Math.round((presentes / total) * 100) : 0;
  });

  const ctxMember = document.getElementById("attendanceByMemberChart").getContext("2d");
  if (attendanceByMemberChart) attendanceByMemberChart.destroy();
  attendanceByMemberChart = new Chart(ctxMember, {
    type: "bar",
    data: {
      labels: memberLabels,
      datasets: [
        {
          label: "% presença",
          data: memberPercent,
          backgroundColor: "rgba(14, 165, 233, 0.8)",
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: "y",
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: { callback: (v) => `${v}%` },
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Carregamento inicial
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
  // segurança básica: não carregamos dados admin até validar sessão
  await checkInitialSession();
  await loadPublicData();
});

async function loadAdminData() {
  await Promise.all([
    loadAdminAgenda(),
    loadMemberOptionsForSchedule(),
    loadAdminSchedules(),
    loadMembers(),
    loadAttendanceMembers(),
    loadReports(),
  ]);
}



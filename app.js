(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const ROOT = $('#appRoot');
  const LS_KEY = 'ruang_tka_attempts_v1';
  const DEMO_USER = 'guru';
  const DEMO_PASS = 'GuruTKA61!';
  const COMPETENCIES = [
    {id:'kosakata',label:'Kosakata umum dan khusus',short:'Kosakata'},
    {id:'objek',label:'Identifikasi objek dalam teks',short:'Objek'},
    {id:'bagan',label:'Ikhtisar dan bagan',short:'Ikhtisar/bagan'},
    {id:'tersurat',label:'Informasi tersurat',short:'Informasi tersurat'}
  ];
  let client = null;
  let cloudMode = false;
  let teacherSession = false;
  let authUser = null;
  let currentQuiz = null;
  let timerHandle = null;
  let teacherRows = [];
  let authView = 'login';
  let toastHandle = null;

  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
  const fmtDate = v => { try{return new Date(v).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});}catch{return '-';} };
  const fmtDuration = s => {s=Math.max(0,Number(s)||0);const m=Math.floor(s/60),r=s%60;return `${m} m ${String(r).padStart(2,'0')} d`;};
  const localRows = () => {try{return JSON.parse(localStorage.getItem(LS_KEY)||'[]');}catch{return [];}};
  const saveLocalRows = rows => localStorage.setItem(LS_KEY,JSON.stringify(rows));
  const notify = msg => {const t=$('#toast'); if(!t)return; t.textContent=msg;t.classList.add('show');clearTimeout(toastHandle);toastHandle=setTimeout(()=>t.classList.remove('show'),3200);};
  const compLabel = id => (COMPETENCIES.find(c=>c.id===id)||{label:id}).label;
  const typeLabel = type => type==='mcq'?'Pilihan ganda':type==='mcma'?'MCMA · lebih dari satu':'Kategori';
  const setModePill = () => {const p=$('#modePill');if(!p)return;p.textContent=cloudMode?'Sinkron daring':'Mode lokal';p.classList.toggle('cloud',cloudMode);};

  function initBackend(){
    const cfg=window.APP_CONFIG||{};
    const valid=cfg.supabaseUrl && cfg.supabaseAnonKey && /^https:\/\//.test(cfg.supabaseUrl) && cfg.supabaseAnonKey.length>20;
    if(valid && window.supabase && window.supabase.createClient){
      try{client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);cloudMode=true;client.auth.getSession().then(({data})=>{authUser=data?.session?.user||null;});}
      catch(e){console.warn('Supabase belum dapat diinisialisasi',e);client=null;cloudMode=false;}
    }
    setModePill();
  }

  function renderHome(){
    stopTimer();currentQuiz=null;teacherSession=false;
    ROOT.innerHTML=`
      <section class="hero">
        <div>
          <div class="eyebrow">Ruang latihan mandiri · TKA SD/MI</div>
          <h1>Pahami teksnya.<br>Temukan buktinya. Bangun alasanmu.</h1>
          <p>Latihan interaktif Bahasa Indonesia Kelas VI untuk kompetensi Pemahaman Tekstual. Setiap sesi berisi 30 soal acak dari 60 bank soal, lengkap dengan umpan balik dan pembahasan.</p>
          <div class="hero-actions"><button class="btn btn-primary" id="heroStudent">Mulai latihan murid <span aria-hidden="true">→</span></button><button class="btn btn-outline" id="heroTeacher">Masuk ruang guru</button></div>
        </div>
        <div class="hero-visual"><div class="hero-orbit"><div class="hero-book"><b>30</b><span>SOAL ACAK</span><small>60 BANK SOAL<br>4 SUBKOMPETENSI</small></div></div></div>
      </section>
      <div class="section-heading"><div><h2>Empat kemampuan yang dilatih</h2><p>Setiap sesi mengambil soal dari seluruh subkompetensi.</p></div><span class="tiny">Kelas VI · Pemahaman Tekstual</span></div>
      <section class="skill-list">
        ${COMPETENCIES.map((c,i)=>`<div class="skill-item"><span>SUBKOMPETENSI 0${i+1}</span><strong>${esc(c.label)}</strong></div>`).join('')}
      </section>
      <div class="section-heading"><div><h2>Belajar dengan proses berpikir</h2><p>Bukan hanya mengejar skor, tetapi memahami alasan di balik jawaban.</p></div></div>
      <section class="card-grid">
        <article class="info-card"><div class="card-icon">🎲</div><h3>30 soal dipilih secara acak</h3><p>Bank berisi 60 butir orisinal. Komposisi kompetensi dan tiga bentuk soal dibuat seimbang agar latihan dapat diulang.</p></article>
        <article class="info-card"><div class="card-icon">🔎</div><h3>Latihan mencari bukti</h3><p>Murid dapat mencatat petunjuk dari teks yang mendukung jawaban. Setelah sesi selesai, alasan dan pembahasan dapat ditinjau kembali.</p></article>
        <article class="info-card"><div class="card-icon">📈</div><h3>Pantau perkembangan</h3><p>Guru dapat melihat riwayat pengerjaan, nilai, capaian per subkompetensi, serta mengunduh data hasil belajar.</p></article>
      </section>
      <div class="section-heading"><div><h2>Pilih ruang belajar</h2><p>Murid berlatih, guru memantau dan memberikan tindak lanjut.</p></div></div>
      <section class="mode-cards">
        <button class="mode-card" id="studentCard"><div><h3>🎒 Ruang Murid</h3><p>Mulai sesi 30 soal, tandai soal, tulis bukti teks, lalu lihat pembahasan.</p></div><span class="arrow">›</span></button>
        <button class="mode-card" id="teacherCard"><div><h3>🧑‍🏫 Ruang Guru</h3><p>Lihat progres kelas, analisis subkompetensi, detail jawaban, dan unduh hasil.</p></div><span class="arrow">›</span></button>
      </section>
      ${!cloudMode?`<div class="hint-box"><strong>Mode saat ini: lokal.</strong> Aplikasi dapat dicoba langsung pada perangkat ini. Agar hasil dari perangkat murid yang berbeda masuk ke dasbor guru, hubungkan aplikasi ke Supabase menggunakan petunjuk di README dan file SQL yang disertakan.</div>`:`<div class="hint-box"><strong>Sinkronisasi daring aktif.</strong> Hasil murid dapat dikirim dengan kode kelas/guru dan dibaca oleh akun guru yang membuat kode tersebut.</div>`}`;
    $('#heroStudent').onclick=renderStudentForm;$('#studentCard').onclick=renderStudentForm;$('#heroTeacher').onclick=renderTeacherLogin;$('#teacherCard').onclick=renderTeacherLogin;
  }

  function renderStudentForm(){
    stopTimer();
    ROOT.innerHTML=`<div class="auth-wrap"><section class="auth-card">
      <div class="eyebrow" style="color:#0b8490">Ruang Murid</div><h1>Siap untuk berlatih?</h1><p>Isi identitas sederhana agar guru dapat mengenali hasil latihanmu. Tidak perlu memasukkan alamat email atau tanggal lahir.</p>
      <form id="studentForm">
        <div class="field"><label for="studentName">Nama murid</label><input id="studentName" maxlength="80" required placeholder="Contoh: Nabila Putri" autocomplete="name"></div>
        <div class="field"><label for="studentClass">Kelas</label><input id="studentClass" maxlength="30" required placeholder="Contoh: VI A" value="VI A"></div>
        ${cloudMode?`<div class="field"><label for="teacherCode">Kode guru/kelas</label><input id="teacherCode" maxlength="30" required placeholder="Masukkan kode dari guru"><small>Minta kode ini kepada guru sebelum mulai.</small></div>`:''}
        <div class="hint-box"><strong>Rencana sesi:</strong> 30 soal acak · 4 subkompetensi · pilihan ganda, MCMA, dan kategori. Waktu saran 45 menit. Kamu boleh menandai soal untuk diperiksa kembali.</div>
        <div class="form-footer"><button type="button" class="link-btn" id="backHome">← Kembali</button><button class="btn btn-primary" type="submit">Mulai 30 soal →</button></div>
      </form>
    </section></div>`;
    $('#backHome').onclick=renderHome;
    $('#studentForm').onsubmit=e=>{e.preventDefault();const name=$('#studentName').value.trim(),cls=$('#studentClass').value.trim(),code=cloudMode?$('#teacherCode').value.trim():'';if(!name||!cls){notify('Lengkapi nama dan kelas terlebih dahulu.');return;}if(cloudMode&&!code){notify('Masukkan kode guru/kelas.');return;}startQuiz({name,cls,teacherCode:code});};
  }

  function renderTeacherLogin(){
    stopTimer();authView='login';
    if(cloudMode && authUser){loadTeacherDashboard();return;}
    const cloudText=cloudMode?'Masuk dengan email dan kata sandi akun guru Supabase.':'Mode lokal: gunakan akun demo yang tersedia di bawah.';
    ROOT.innerHTML=`<div class="auth-wrap"><section class="auth-card">
      <div class="eyebrow" style="color:#0b8490">Ruang Guru</div><h1 id="authTitle">Masuk ke dasbor guru</h1><p id="authDesc">${cloudText}</p>
      <form id="teacherAuthForm">
        ${cloudMode?`<div class="field"><label for="teacherEmail">Email guru</label><input id="teacherEmail" type="email" required placeholder="nama@email.com" autocomplete="username"></div>`:`<div class="field"><label for="teacherUsername">Nama pengguna</label><input id="teacherUsername" required value="guru" autocomplete="username"></div>`}
        <div class="field"><label for="teacherPassword">Kata sandi</label><input id="teacherPassword" type="password" required placeholder="Masukkan kata sandi" autocomplete="current-password"></div>
        <div id="signupNameField" class="field hidden"><label for="teacherName">Nama guru (opsional)</label><input id="teacherName" maxlength="80" placeholder="Nama guru"></div>
        <button class="btn btn-primary" type="submit" id="authSubmit" style="width:100%">Masuk</button>
      </form>
      ${cloudMode?`<div class="form-footer"><button class="link-btn" id="toggleAuth">Belum punya akun? Daftar guru</button><button class="link-btn" id="backHome">← Beranda</button></div><div class="hint-box">Pendaftaran akun guru menggunakan autentikasi Supabase. Akun yang mendaftar dapat membuat kode kelas sendiri.</div>`:`<div class="demo-note"><strong>Akun demo lokal</strong><br>Pengguna: <b>guru</b><br>Kata sandi: <b>GuruTKA61!</b><br>Akun ini hanya untuk uji coba lokal pada perangkat ini. Ganti ke autentikasi daring sebelum digunakan lintas perangkat.</div><div class="form-footer"><span></span><button class="link-btn" id="backHome">← Beranda</button></div>`}
    </section></div>`;
    $('#backHome').onclick=renderHome;
    if(cloudMode){
      $('#toggleAuth').onclick=()=>{authView=authView==='login'?'signup':'login';$('#authTitle').textContent=authView==='login'?'Masuk ke dasbor guru':'Daftar akun guru';$('#authDesc').textContent=authView==='login'?'Masuk menggunakan akun guru.':'Buat akun guru menggunakan email yang aktif.';$('#authSubmit').textContent=authView==='login'?'Masuk':'Buat akun';$('#signupNameField').classList.toggle('hidden',authView!=='signup');$('#toggleAuth').textContent=authView==='login'?'Belum punya akun? Daftar guru':'Sudah punya akun? Masuk';};
    }
    $('#teacherAuthForm').onsubmit=async e=>{
      e.preventDefault();const pass=$('#teacherPassword').value;
      if(!cloudMode){if($('#teacherUsername').value.trim()===DEMO_USER&&pass===DEMO_PASS){teacherSession=true;loadTeacherDashboard();}else notify('Nama pengguna atau kata sandi demo tidak tepat.');return;}
      const email=$('#teacherEmail').value.trim();const button=$('#authSubmit');button.disabled=true;button.textContent='Memproses…';
      try{
        if(authView==='signup'){
          const {data,error}=await client.auth.signUp({email,password:pass,options:{data:{display_name:$('#teacherName')?.value.trim()||''}}});if(error)throw error;
          if(data.session){authUser=data.user;notify('Akun guru berhasil dibuat.');loadTeacherDashboard();}else{notify('Pendaftaran berhasil. Periksa email untuk konfirmasi, lalu masuk.');authView='login';renderTeacherLogin();}
        }else{
          const {data,error}=await client.auth.signInWithPassword({email,password:pass});if(error)throw error;authUser=data.user;loadTeacherDashboard();
        }
      }catch(err){notify(err.message||'Autentikasi gagal. Periksa koneksi dan akun.');}
      finally{button.disabled=false;button.textContent=authView==='signup'?'Buat akun':'Masuk';}
    };
  }

  function createSessionQuestions(){
    const byComp={};COMPETENCIES.forEach(c=>byComp[c.id]=shuffle((window.QUESTION_BANK||[]).filter(q=>q.competency===c.id)));
    const eight=shuffle(COMPETENCIES.map(c=>c.id)).slice(0,2);let selected=[];
    COMPETENCIES.forEach(c=>selected.push(...byComp[c.id].slice(0,eight.includes(c.id)?8:7)));
    selected=shuffle(selected);
    const optionOrders={};selected.forEach(q=>{if(q.options)optionOrders[q.id]=shuffle(q.options.map(o=>o.id));});
    return {questions:selected,optionOrders};
  }
  function startQuiz(profile){
    const set=createSessionQuestions();
    currentQuiz={...profile,...set,index:0,answers:{},startedAt:Date.now(),remaining:45*60,reflection:{strategy:'',challenge:''}};
    currentQuiz.questions.forEach(q=>currentQuiz.answers[q.id]={value:q.type==='category'?q.statements.map(()=>null):[],evidence:'',flagged:false});
    renderQuiz();startTimer();
  }
  function stopTimer(){if(timerHandle){clearInterval(timerHandle);timerHandle=null;}}
  function startTimer(){stopTimer();timerHandle=setInterval(()=>{if(!currentQuiz)return;currentQuiz.remaining--;const timer=$('#timer');if(timer){timer.textContent=fmtDuration(currentQuiz.remaining);timer.classList.toggle('warning',currentQuiz.remaining<=300);}if(currentQuiz.remaining<=0){stopTimer();notify('Waktu latihan selesai. Jawaban akan dikirim.');submitQuiz(true);}},1000);}
  function questionAnswered(q){const v=currentQuiz.answers[q.id].value;if(q.type==='category')return Array.isArray(v)&&v.length===q.statements.length&&v.every(x=>x!==null);return Array.isArray(v)&&v.length>0;}
  function currentAnswer(q){return currentQuiz.answers[q.id];}
  function renderQuiz(){
    const q=currentQuiz.questions[currentQuiz.index];const ans=currentAnswer(q);const done=currentQuiz.questions.filter(questionAnswered).length;const flagged=currentQuiz.questions.filter(x=>currentQuiz.answers[x.id].flagged).length;
    const pct=Math.round(done/currentQuiz.questions.length*100);const typeClass=q.type;
    const help=q.type==='mcq'?'Pilih satu jawaban yang paling tepat.':q.type==='mcma'?'Pilih semua jawaban yang benar. Jawaban benar dapat lebih dari satu.':'Berikan satu respons untuk setiap pernyataan.';
    let answerHtml='';
    if(q.type==='mcq'||q.type==='mcma'){
      const order=currentQuiz.optionOrders[q.id]||q.options.map(o=>o.id);
      answerHtml=`<div class="type-help">${esc(help)}</div><div class="answer-list">${order.map((id,i)=>{const opt=q.options.find(o=>o.id===id);const selected=ans.value.includes(id);return `<button class="answer-option ${selected?'selected':''}" data-opt="${id}" type="button"><span class="option-key">${q.type==='mcma'?(selected?'✓':'□'):String.fromCharCode(65+i)}</span><span class="option-text">${esc(opt.text)}</span></button>`;}).join('')}</div>`;
    }else{
      answerHtml=`<div class="type-help">${esc(help)}</div><table class="category-table"><thead><tr><th>Pernyataan</th><th>Respons</th></tr></thead><tbody>${q.statements.map((st,i)=>`<tr><td>${esc(st.text)}</td><td><div class="category-choice">${q.categoryOptions.map(choice=>`<button class="choice-chip ${ans.value[i]===choice?'active':''}" type="button" data-row="${i}" data-choice="${esc(choice)}">${esc(choice)}</button>`).join('')}</div></td></tr>`).join('')}</tbody></table>`;
    }
    ROOT.innerHTML=`
      <div class="quiz-top"><div class="quiz-title"><h1>Latihan Pemahaman Tekstual</h1><p>${esc(currentQuiz.name)} · ${esc(currentQuiz.cls)} · Sesi 30 soal acak</p></div><div class="timer" id="timer">${fmtDuration(currentQuiz.remaining)}</div></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="quiz-layout"><section class="question-card">
        <div class="q-meta"><span class="tag">${esc(compLabel(q.competency))}</span><span class="tag ${typeClass}">${esc(typeLabel(q.type))}</span><span class="q-number">Soal ${currentQuiz.index+1} dari 30</span></div>
        <div class="stimulus">${esc(q.stimulus)}</div><h2 class="question-text">${esc(q.question)}</h2>
        ${answerHtml}
        <div class="thinking-box"><label for="evidenceInput">🔎 Bukti dari teks yang mendukung jawabanmu</label><textarea id="evidenceInput" maxlength="300" placeholder="Tuliskan kata, kalimat, atau petunjuk yang kamu gunakan (opsional)…">${esc(ans.evidence||'')}</textarea><small>Latihan ini membantumu menjawab berdasarkan bukti, bukan sekadar menebak.</small></div>
        <div class="question-actions"><button class="btn btn-secondary btn-small" id="flagBtn">${ans.flagged?'★ Ditandai':'☆ Tandai untuk ditinjau'}</button><div class="action-right"><button class="btn btn-secondary" id="prevBtn" ${currentQuiz.index===0?'disabled':''}>← Sebelumnya</button><button class="btn btn-primary" id="nextBtn">${currentQuiz.index===29?'Periksa jawaban':'Berikutnya →'}</button></div></div>
      </section>
      <aside class="quiz-side"><h3>Navigasi soal</h3><p>${done} terjawab · ${flagged} ditandai · ${30-done} belum terjawab</p><div class="number-grid">${currentQuiz.questions.map((item,i)=>{const a=currentQuiz.answers[item.id];return `<button type="button" class="number-btn ${i===currentQuiz.index?'current':''} ${questionAnswered(item)?'answered':''} ${a.flagged?'flagged':''}" data-jump="${i}" aria-label="Soal ${i+1}">${i+1}</button>`;}).join('')}</div><div class="legend"><span>Terjawab</span><span>Aktif</span><span>Ditandai</span></div><div class="divider"></div><button class="btn btn-primary side-submit" id="finishBtn">Selesai & periksa hasil</button><p class="tiny" style="margin-top:9px">Jawaban dapat diubah sebelum hasil dikirim.</p></aside></div>`;
    $('#evidenceInput').addEventListener('input',e=>{ans.evidence=e.target.value;});
    ROOT.querySelectorAll('[data-opt]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.opt;if(q.type==='mcq')ans.value=[id];else ans.value=ans.value.includes(id)?ans.value.filter(x=>x!==id):[...ans.value,id];renderQuiz();});
    ROOT.querySelectorAll('[data-row]').forEach(btn=>btn.onclick=()=>{const row=Number(btn.dataset.row);ans.value[row]=btn.dataset.choice;renderQuiz();});
    $('#flagBtn').onclick=()=>{ans.flagged=!ans.flagged;renderQuiz();};
    $('#prevBtn').onclick=()=>{if(currentQuiz.index>0){currentQuiz.index--;renderQuiz();}};
    $('#nextBtn').onclick=()=>{if(currentQuiz.index<29){currentQuiz.index++;renderQuiz();}else renderReflection();};
    ROOT.querySelectorAll('[data-jump]').forEach(btn=>btn.onclick=()=>{currentQuiz.index=Number(btn.dataset.jump);renderQuiz();});
    $('#finishBtn').onclick=renderReflection;
  }

  function countCorrect(){return currentQuiz.questions.filter(q=>isCorrect(q,currentQuiz.answers[q.id].value)).length;}
  function isCorrect(q,value){
    if(q.type==='category')return Array.isArray(value)&&value.length===q.answer.length&&value.every((v,i)=>v===q.answer[i]);
    const a=[...(value||[])].sort(),b=[...q.answer].sort();return a.length===b.length&&a.every((v,i)=>v===b[i]);
  }
  function renderReflection(){
    stopTimer();const done=currentQuiz.questions.filter(questionAnswered).length,correct=countCorrect();
    ROOT.innerHTML=`<div class="quiz-top"><div class="quiz-title"><h1>Sebelum mengirim hasil…</h1><p>Periksa kembali latihanmu dan lakukan refleksi singkat.</p></div><span class="tag">Tahap akhir</span></div>
      <div class="result-grid"><section class="panel"><h3>Ringkasan pengerjaan</h3><div class="modal-kpis"><div class="modal-kpi"><span>Soal terjawab</span><strong>${done}/30</strong></div><div class="modal-kpi"><span>Benar sementara</span><strong>${correct}</strong></div><div class="modal-kpi"><span>Ditandai</span><strong>${currentQuiz.questions.filter(q=>currentQuiz.answers[q.id].flagged).length}</strong></div></div><p class="tiny">Jawaban yang belum diisi akan dinilai salah. Setelah dikirim, jawaban tidak dapat diubah.</p><button class="btn btn-secondary" id="backQuiz">← Kembali periksa soal</button></section>
      <section class="panel"><h3>Refleksi cara berpikirmu</h3><div class="field"><label for="reflectionStrategy">Strategi apa yang paling membantumu? (pilih satu)</label><select id="reflectionStrategy"><option value="">Pilih strategi…</option><option>Mencari kata kunci dalam pertanyaan</option><option>Menemukan bukti langsung dalam teks</option><option>Menghubungkan beberapa petunjuk</option><option>Membandingkan setiap pilihan jawaban</option><option>Menyusun urutan informasi</option></select></div><div class="field"><label for="reflectionChallenge">Bagian apa yang paling menantang? (opsional)</label><textarea id="reflectionChallenge" rows="3" maxlength="400" placeholder="Contoh: Saya masih bingung membedakan istilah umum dan istilah khusus."></textarea></div><div class="hint-box">Refleksi membantu guru mengetahui strategi yang sudah kamu gunakan dan materi yang masih perlu dilatih.</div><button class="btn btn-primary" id="submitFinal" style="width:100%">Kirim jawaban & lihat hasil →</button></section></div>`;
    $('#backQuiz').onclick=()=>{currentQuiz.index=Math.max(0,currentQuiz.index);renderQuiz();startTimer();};
    $('#reflectionStrategy').value=currentQuiz.reflection.strategy||'';$('#reflectionChallenge').value=currentQuiz.reflection.challenge||'';
    $('#submitFinal').onclick=()=>{currentQuiz.reflection.strategy=$('#reflectionStrategy').value;currentQuiz.reflection.challenge=$('#reflectionChallenge').value.trim();submitQuiz(false);};
  }

  function answerText(q,value){
    if(q.type==='category')return q.statements.map((st,i)=>`${st.text} — ${value?.[i]||'Belum dijawab'}`).join('\n');
    return (value||[]).map(id=>{const o=q.options.find(x=>x.id===id);return o?o.text:id;}).join('; ')||'Belum dijawab';
  }
  function makeAttempt(){
    const correct=countCorrect(),total=currentQuiz.questions.length,score=Math.round(correct/total*100),duration=Math.max(0,Math.round((Date.now()-currentQuiz.startedAt)/1000));
    const per={};COMPETENCIES.forEach(c=>{const qs=currentQuiz.questions.filter(q=>q.competency===c.id);const n=qs.filter(q=>isCorrect(q,currentQuiz.answers[q.id].value)).length;per[c.id]={correct:n,total:qs.length,score:qs.length?Math.round(n/qs.length*100):0};});
    const review=currentQuiz.questions.map((q,i)=>{const a=currentQuiz.answers[q.id],right=isCorrect(q,a.value);return {number:i+1,id:q.id,competency:q.competency,competencyLabel:compLabel(q.competency),type:q.type,question:q.question,stimulus:q.stimulus,selected:answerText(q,a.value),correct:answerText(q,q.answer),isCorrect:right,evidence:a.evidence||'',explanation:q.explanation,clue:q.clue,flagged:a.flagged};});
    return {student_name:currentQuiz.name,class_name:currentQuiz.cls,score,correct_count:correct,total,duration_seconds:duration,detail:{competency_summary:per,review,reflection:currentQuiz.reflection,bank_size:window.QUESTION_BANK.length},created_at:new Date().toISOString()};
  }
  async function submitQuiz(auto){
    if(!currentQuiz)return;stopTimer();const attempt=makeAttempt();
    const finishBtn=$('#submitFinal');if(finishBtn){finishBtn.disabled=true;finishBtn.textContent='Menyimpan hasil…';}
    if(cloudMode){
      try{
        const {error}=await client.rpc('submit_tka_attempt',{
          p_teacher_code:currentQuiz.teacherCode,p_student_name:attempt.student_name,p_class_name:attempt.class_name,p_score:attempt.score,p_correct_count:attempt.correct_count,p_total:attempt.total,p_duration_seconds:attempt.duration_seconds,p_detail:attempt.detail
        });
        if(error)throw error;
        attempt.synced=true;
      }catch(err){
        attempt.synced=false;const rows=localRows();rows.push(attempt);saveLocalRows(rows);
        renderResult(attempt,`Hasil tersimpan hanya di perangkat ini karena pengiriman daring gagal: ${err.message||'periksa kode guru dan koneksi.'}`);return;
      }
    }else{
      const rows=localRows();rows.push(attempt);saveLocalRows(rows);attempt.synced=false;
    }
    renderResult(attempt,auto?'Waktu latihan berakhir. Jawaban yang sudah terisi telah diperiksa.':null);
  }

  function renderResult(attempt,warning=null){
    currentQuiz=null;stopTimer();const per=attempt.detail.competency_summary;const pct=attempt.score;
    ROOT.innerHTML=`
      <section class="result-hero"><div><div class="eyebrow">Hasil latihan selesai</div><h1>Latihanmu sudah diperiksa.</h1><p>${esc(attempt.student_name)} · ${esc(attempt.class_name)} · ${fmtDate(attempt.created_at)}</p><p style="margin-top:9px">${pct>=80?'Bagus! Pertahankan kebiasaan mencari bukti dari teks.':pct>=60?'Terus berlatih. Periksa kembali pembahasan yang masih keliru.':'Jangan menyerah. Pelajari petunjuk dan pembahasan, lalu coba sesi baru.'}</p></div><div class="score-ring">${pct}</div></section>
      ${warning?`<div class="demo-note" style="margin-top:12px">${esc(warning)}</div>`:''}
      <section class="result-stats"><div class="stat-card"><span>Jawaban benar</span><strong>${attempt.correct_count}/${attempt.total}</strong></div><div class="stat-card"><span>Waktu pengerjaan</span><strong>${fmtDuration(attempt.duration_seconds)}</strong></div><div class="stat-card"><span>Bank soal</span><strong>60</strong></div></section>
      <section class="result-grid"><div class="panel"><h3>Analisis per subkompetensi</h3>${COMPETENCIES.map(c=>{const s=per[c.id];return `<div class="skill-result"><div class="skill-result-head"><span>${esc(c.label)}</span><span>${s.correct}/${s.total} · ${s.score}%</span></div><div class="mini-track"><div class="mini-fill" style="width:${s.score}%"></div></div></div>`;}).join('')}</div><div class="panel"><h3>Langkah belajar berikutnya</h3><p style="font-size:12px;color:#526b76">${pct>=80?'Kamu sudah mencapai target latihan. Cobalah sesi berikutnya agar terbiasa dengan bacaan dan bentuk soal yang berbeda.':'Ulangi materi pada subkompetensi dengan persentase terendah. Saat mencoba lagi, cari kalimat bukti sebelum memilih jawaban.'}</p><div class="hint-box"><strong>Refleksi strategi:</strong><br>${esc(attempt.detail.reflection?.strategy||'Belum diisi')}<br><br><strong>Bagian menantang:</strong><br>${esc(attempt.detail.reflection?.challenge||'Belum diisi')}</div></div></section>
      <div class="section-heading"><div><h2>Pembahasan jawaban</h2><p>Baca alasan setiap jawaban. Bandingkan pilihanmu dengan bukti dan petunjuk dalam teks.</p></div><span class="tiny">${attempt.detail.review.filter(x=>x.isCorrect).length} benar · ${attempt.detail.review.filter(x=>!x.isCorrect).length} perlu dipelajari</span></div>
      <section class="review-list">${attempt.detail.review.map(r=>`<article class="review-item ${r.isCorrect?'correct':'wrong'}"><h4>${r.number}. ${esc(r.competencyLabel)} <span class="tag ${r.isCorrect?'':'category'}">${r.isCorrect?'Benar':'Perlu ditinjau'}</span></h4><p><b>Pertanyaan:</b> ${esc(r.question)}</p><p><b>Jawabanmu:</b> ${esc(r.selected)}</p>${!r.isCorrect?`<p><b>Jawaban tepat:</b> ${esc(r.correct)}</p>`:''}<div class="explain"><b>Petunjuk:</b> ${esc(r.clue)}<br><b>Pembahasan:</b> ${esc(r.explanation)}</div>${r.evidence?`<p><b>Bukti yang kamu tulis:</b> ${esc(r.evidence)}</p>`:''}</article>`).join('')}</section>
      <div class="result-actions"><button class="btn btn-primary" id="retryBtn">Coba 30 soal acak lagi ↻</button><button class="btn btn-secondary" id="homeResult">Kembali ke beranda</button></div>`;
    $('#retryBtn').onclick=renderStudentForm;$('#homeResult').onclick=renderHome;
  }

  async function fetchAttempts(){
    if(!cloudMode)return localRows().map(r=>({...r,created_at:r.created_at||new Date().toISOString()})).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const {data,error}=await client.from('tka_attempts').select('id,student_name,class_name,score,correct_count,total,duration_seconds,detail,created_at').order('created_at',{ascending:false}).limit(1000);
    if(error)throw error;return data||[];
  }
  async function loadTeacherDashboard(){
    ROOT.innerHTML=`<section class="loading-card"><div class="spinner"></div><p>Memuat data hasil belajar…</p></section>`;
    if(cloudMode&&!authUser){const {data}=await client.auth.getSession();authUser=data?.session?.user||null;if(!authUser){renderTeacherLogin();return;}}
    try{teacherRows=await fetchAttempts();renderDashboard();}catch(err){ROOT.innerHTML=`<div class="panel"><h2>Dasbor belum dapat dimuat</h2><p class="muted">${esc(err.message||'Periksa konfigurasi Supabase dan kebijakan akses.')}</p><button class="btn btn-secondary" id="backHome">Beranda</button></div>`;$('#backHome').onclick=renderHome;}
  }
  function aggregateStudents(rows){
    const groups={};rows.forEach(r=>{const key=`${r.student_name}||${r.class_name}`;(groups[key]??=[]).push(r);});
    return Object.values(groups).map(items=>{items.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));const avg=Math.round(items.reduce((s,r)=>s+Number(r.score||0),0)/items.length);return {name:items[0].student_name,cls:items[0].class_name,count:items.length,average:avg,best:Math.max(...items.map(r=>Number(r.score||0))),latest:Number(items[0].score||0),last:items[0].created_at,items};}).sort((a,b)=>b.last.localeCompare(a.last));
  }
  function renderDashboard(){
    const rows=teacherRows;const students=aggregateStudents(rows);const avg=rows.length?Math.round(rows.reduce((s,r)=>s+Number(r.score||0),0)/rows.length):0;const passed=rows.filter(r=>Number(r.score)>=80).length;const classes=[...new Set(rows.map(r=>r.class_name))].sort();
    ROOT.innerHTML=`<div class="dashboard-head"><div><div class="eyebrow" style="color:#0b8791">Ruang Guru</div><h1>Dasbor perkembangan murid</h1><p>Pantau hasil latihan Pemahaman Tekstual dari setiap sesi.</p></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn btn-secondary btn-small" id="refreshDash">↻ Perbarui</button><button class="btn btn-secondary btn-small" id="exportCsv">Unduh CSV</button><button class="btn btn-secondary btn-small" id="exportJson">Unduh JSON</button><button class="btn btn-primary btn-small" id="printDash">Cetak / PDF</button><button class="btn btn-danger btn-small" id="logoutTeacher">Keluar</button></div></div>
      ${!cloudMode?`<div class="demo-note"><b>Mode lokal / demo.</b> Data hanya tersimpan di browser dan perangkat ini. Hasil murid dari HP atau laptop lain tidak akan muncul di dasbor ini sampai sinkronisasi daring Supabase diaktifkan. Akun demo: guru / GuruTKA61!.</div>`:`<div class="teacher-code-box"><h4>Kode guru/kelas untuk murid</h4><p>Bagikan kode ini kepada murid. Hasil yang dikirim dengan kode tersebut akan masuk ke akun guru ini.</p><div class="code-row"><input id="newTeacherCode" maxlength="20" placeholder="Buat kode, min. 6 karakter"><button class="btn btn-primary btn-small" id="createCodeBtn">Buat kode</button></div><div id="codeFeedback" class="tiny" style="margin-top:7px">Gunakan huruf dan angka. Jangan bagikan kode kepada orang di luar kelas.</div></div>`}
      <section class="dash-stats"><div class="dash-stat"><span>Total pengerjaan</span><strong>${rows.length}</strong><small>Seluruh sesi yang terkirim/tersimpan</small></div><div class="dash-stat"><span>Murid tercatat</span><strong>${students.length}</strong><small>Berdasarkan nama dan kelas</small></div><div class="dash-stat"><span>Rata-rata nilai</span><strong>${avg}</strong><small>Dari seluruh sesi</small></div><div class="dash-stat"><span>Mencapai nilai ≥ 80</span><strong>${passed}</strong><small>${rows.length?Math.round(passed/rows.length*100):0}% dari pengerjaan</small></div></section>
      <div class="filter-row"><input id="searchStudent" placeholder="Cari nama murid…"><select id="filterClass"><option value="">Semua kelas</option>${classes.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="dash-layout"><section class="panel"><h3>Progres per murid <span class="tiny">· klik detail untuk riwayat</span></h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Nama / kelas</th><th>Sesi</th><th>Rata-rata</th><th>Terakhir</th><th></th></tr></thead><tbody id="studentProgressBody">${renderStudentRows(students)}</tbody></table></div></section>
      <section class="panel"><h3>Hasil pengerjaan terbaru</h3><div class="table-wrap"><table class="data-table" style="min-width:390px"><thead><tr><th>Murid</th><th>Nilai</th><th>Waktu</th></tr></thead><tbody>${rows.slice(0,9).map(r=>`<tr><td><b>${esc(r.student_name)}</b><br><span class="tiny">${esc(r.class_name)}</span></td><td><span class="score-pill ${Number(r.score)<60?'low':''}">${Number(r.score)}%</span></td><td>${esc(fmtDate(r.created_at))}</td></tr>`).join('')||`<tr><td colspan="3"><div class="empty-state"><b>Belum ada hasil</b>Hasil murid akan tampil setelah sesi dikirim.</div></td></tr>`}</tbody></table></div></section></div>
      <div class="section-heading"><div><h2>Catatan penggunaan</h2><p>Nilai sesi dan capaian subkompetensi dapat digunakan untuk menentukan tindak lanjut belajar.</p></div></div>
      <section class="card-grid"><article class="info-card"><div class="card-icon">🧭</div><h3>Perhatikan capaian terendah</h3><p>Buka detail murid untuk melihat kemampuan yang paling perlu diperkuat berdasarkan empat subkompetensi.</p></article><article class="info-card"><div class="card-icon">🗂️</div><h3>Unduh data</h3><p>CSV dapat dibuka di Excel atau Google Sheets. JSON memuat detail jawaban, bukti teks, refleksi, dan pembahasan.</p></article><article class="info-card"><div class="card-icon">🔁</div><h3>Bandingkan sesi</h3><p>Murid dapat mengulang dengan 30 soal berbeda. Gunakan riwayat untuk memantau perkembangan, bukan hanya satu nilai.</p></article></section>`;
    $('#refreshDash').onclick=loadTeacherDashboard;$('#exportCsv').onclick=()=>exportCSV(teacherRows);$('#exportJson').onclick=()=>downloadFile('hasil-tka-pemahaman-tekstual.json',JSON.stringify(teacherRows,null,2),'application/json');$('#printDash').onclick=()=>window.print();
    $('#logoutTeacher').onclick=async()=>{if(cloudMode){await client.auth.signOut();authUser=null;}teacherSession=false;renderHome();};
    if(cloudMode){$('#createCodeBtn').onclick=createTeacherCode;}
    const applyFilter=()=>{const q=$('#searchStudent').value.toLowerCase(),cls=$('#filterClass').value;const filtered=students.filter(s=>(!cls||s.cls===cls)&&(`${s.name} ${s.cls}`).toLowerCase().includes(q));$('#studentProgressBody').innerHTML=renderStudentRows(filtered);bindStudentDetails(filtered);};
    $('#searchStudent').addEventListener('input',applyFilter);$('#filterClass').addEventListener('change',applyFilter);bindStudentDetails(students);
  }
  function renderStudentRows(students){return students.map((s,i)=>`<tr><td><b>${esc(s.name)}</b><br><span class="tiny">${esc(s.cls)}</span></td><td>${s.count}</td><td><b>${s.average}%</b><div class="progress-bar-small"><i style="width:${s.average}%"></i></div></td><td>${esc(fmtDate(s.last))}</td><td><button class="btn btn-secondary btn-small" data-student-detail="${i}">Detail</button></td></tr>`).join('')||`<tr><td colspan="5"><div class="empty-state"><b>Belum ada murid</b>Belum ada hasil sesuai pencarian.</div></td></tr>`;}
  function bindStudentDetails(students){ROOT.querySelectorAll('[data-student-detail]').forEach(btn=>btn.onclick=()=>showStudentDetail(students[Number(btn.dataset.studentDetail)]));}
  function showStudentDetail(s){
    const reviews=s.items.map(r=>`<tr><td>${esc(fmtDate(r.created_at))}</td><td><span class="score-pill ${Number(r.score)<60?'low':''}">${Number(r.score)}%</span></td><td>${r.correct_count}/${r.total}</td><td>${fmtDuration(r.duration_seconds)}</td><td><button class="btn btn-secondary btn-small" data-attempt-detail="${esc(r.id||r.created_at)}">Lihat</button></td></tr>`).join('');
    const id='studentModal';document.getElementById(id)?.remove();const modal=document.createElement('div');modal.className='detail-modal';modal.id=id;
    modal.innerHTML=`<section class="modal-card"><div class="modal-head"><div><div class="eyebrow" style="color:#0b8490">Riwayat murid</div><h2>${esc(s.name)} · ${esc(s.cls)}</h2></div><button class="close-btn" id="closeStudentModal">Tutup ✕</button></div><div class="modal-kpis"><div class="modal-kpi"><span>Jumlah sesi</span><strong>${s.count}</strong></div><div class="modal-kpi"><span>Rata-rata</span><strong>${s.average}%</strong></div><div class="modal-kpi"><span>Nilai terbaik</span><strong>${s.best}%</strong></div></div><h3>Riwayat hasil</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Tanggal</th><th>Nilai</th><th>Benar</th><th>Durasi</th><th>Detail</th></tr></thead><tbody>${reviews}</tbody></table></div><div id="attemptDetailArea"></div></section>`;
    document.body.appendChild(modal);$('#closeStudentModal',modal).onclick=()=>modal.remove();modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
    modal.querySelectorAll('[data-attempt-detail]').forEach(btn=>btn.onclick=()=>{const attempt=s.items.find(r=>String(r.id||r.created_at)===btn.dataset.attemptDetail);renderAttemptDetail(attempt,$('#attemptDetailArea',modal));});
  }
  function renderAttemptDetail(attempt,container){
    const d=attempt.detail||{};const stats=d.competency_summary||{};container.innerHTML=`<div class="divider"></div><h3>Analisis sesi · ${esc(fmtDate(attempt.created_at))}</h3><div class="modal-kpis"><div class="modal-kpi"><span>Nilai</span><strong>${attempt.score}%</strong></div><div class="modal-kpi"><span>Jawaban benar</span><strong>${attempt.correct_count}/${attempt.total}</strong></div><div class="modal-kpi"><span>Durasi</span><strong style="font-size:14px">${fmtDuration(attempt.duration_seconds)}</strong></div></div><h4 class="tiny">CAPAIAN PER SUBKOMPETENSI</h4>${COMPETENCIES.map(c=>{const s=stats[c.id]||{score:0,correct:0,total:0};return `<div class="skill-result"><div class="skill-result-head"><span>${esc(c.label)}</span><span>${s.correct}/${s.total} · ${s.score}%</span></div><div class="mini-track"><div class="mini-fill" style="width:${s.score}%"></div></div></div>`;}).join('')}<h4 class="tiny" style="margin-top:18px">JAWABAN DAN BUKTI BERPIKIR</h4><div class="review-list">${(d.review||[]).map(r=>`<article class="review-item ${r.isCorrect?'correct':'wrong'}"><h4>Soal ${r.number} · ${esc(r.competencyLabel)} <span class="tag">${r.isCorrect?'Benar':'Perlu ditinjau'}</span></h4><p>${esc(r.question)}</p><p><b>Jawaban murid:</b> ${esc(r.selected)}</p>${!r.isCorrect?`<p><b>Jawaban tepat:</b> ${esc(r.correct)}</p>`:''}<p><b>Bukti yang ditulis:</b> ${esc(r.evidence||'Tidak diisi')}</p><div class="explain"><b>Pembahasan:</b> ${esc(r.explanation)}</div></article>`).join('')}</div><div class="hint-box"><b>Refleksi murid:</b><br>Strategi: ${esc(d.reflection?.strategy||'Tidak diisi')}<br>Kesulitan: ${esc(d.reflection?.challenge||'Tidak diisi')}</div><button class="btn btn-secondary btn-small" id="downloadOneAttempt">Unduh detail sesi (JSON)</button>`;
    $('#downloadOneAttempt',container).onclick=()=>downloadFile(`detail-${safeFile(attempt.student_name)}-${Date.now()}.json`,JSON.stringify(attempt,null,2),'application/json');
  }
  async function createTeacherCode(){
    const input=$('#newTeacherCode'),code=input.value.trim().toUpperCase();if(!/^[A-Z0-9-]{6,20}$/.test(code)){notify('Kode harus 6–20 karakter, berisi huruf, angka, atau tanda hubung.');return;}
    const btn=$('#createCodeBtn');btn.disabled=true;btn.textContent='Menyimpan…';
    try{const {data,error}=await client.rpc('create_tka_teacher_code',{p_code:code});if(error)throw error;$('#codeFeedback').innerHTML=`<b style="color:#087b55">Kode berhasil dibuat: ${esc(code)}</b><br>Bagikan kode ini kepada murid. Simpan dengan baik; kode lengkap tidak ditampilkan lagi setelah bagian ini ditutup.`;input.value='';notify('Kode guru berhasil dibuat.');}
    catch(err){notify(err.message||'Kode gagal dibuat. Jalankan SQL penyiapan Supabase terlebih dahulu.');}
    finally{btn.disabled=false;btn.textContent='Buat kode';}
  }
  function safeFile(v){return String(v||'hasil').toLowerCase().replace(/[^a-z0-9-_]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'hasil';}
  function downloadFile(name,content,mime){const blob=new Blob([content],{type:mime+';charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
  function exportCSV(rows){
    const header=['Nama Murid','Kelas','Nilai','Jawaban Benar','Jumlah Soal','Durasi (detik)','Tanggal','Kosakata (%)','Objek (%)','Ikhtisar/Bagan (%)','Informasi Tersurat (%)','Strategi Refleksi','Kesulitan'];
    const quote=v=>{let x=String(v??'').replace(/\r?\n/g,' ');if(/^[=+\-@\t\r]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';};
    const body=rows.map(r=>{const s=r.detail?.competency_summary||{};return [r.student_name,r.class_name,r.score,r.correct_count,r.total,r.duration_seconds,fmtDate(r.created_at),s.kosakata?.score??'',s.objek?.score??'',s.bagan?.score??'',s.tersurat?.score??'',r.detail?.reflection?.strategy||'',r.detail?.reflection?.challenge||''].map(quote).join(',');});
    downloadFile('hasil-tka-pemahaman-tekstual.csv',[header.map(quote).join(','),...body].join('\r\n'),'text/csv');
  }

  $('#homeBtn').addEventListener('click',()=>{if(currentQuiz&&!confirm('Keluar dari latihan? Jawaban yang belum dikirim dapat hilang.'))return;renderHome();});
  initBackend();renderHome();
})();

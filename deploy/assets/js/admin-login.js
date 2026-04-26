// Extracted from admin-login.html on 2026-04-26.
const { SUPABASE_URL, SUPABASE_KEY } = window.BALENT_CONFIG;
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, storageKey: 'balent_admin_session' }
});

// If already logged in, redirect to dashboard
sbClient.auth.getSession().then(({data:{session}}) => {
  if (session) window.location.href = 'dashboard.html';
});

async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const zapamti = document.getElementById('zapamtiMe').checked;
  const btn = document.getElementById('btnLogin');
  const err = document.getElementById('errorMsg');

  if (!email || !password) {
    err.textContent = 'Unesite email i lozinku.';
    err.classList.add('show');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Prijava...';
  err.classList.remove('show');

  const { error } = await sbClient.auth.signInWithPassword({ email, password });

  if (error) {
    err.textContent = 'Pogrešan email ili lozinka.';
    err.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Prijavi se';
  } else {
    // If not remember me, clear on tab close
    if (!zapamti) sessionStorage.setItem('balent_no_persist', '1');
    else sessionStorage.removeItem('balent_no_persist');
    window.location.href = 'dashboard.html';
  }
}

// Enter key
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});

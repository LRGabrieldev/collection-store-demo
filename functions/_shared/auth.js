/**
 * Autenticação segura na borda da Cloudflare Pages com tela de login HTML
 * e sessão assinada por HMAC-SHA256 em cookie HttpOnly.
 *
 * Sem sessão válida, nenhum arquivo do painel (/painel/*) é entregue ao navegador.
 */

const SESSION_COOKIE_NAME = 'collection_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function timingSafeEqual(a, b) {
  const encoder = new TextEncoder();
  const bytesA = encoder.encode(String(a));
  const bytesB = encoder.encode(String(b));
  const maxLen = Math.max(bytesA.length, bytesB.length, 1);

  let diff = bytesA.length ^ bytesB.length;
  for (let i = 0; i < maxLen; i += 1) {
    const byteA = i < bytesA.length ? bytesA[i] : 0;
    const byteB = i < bytesB.length ? bytesB[i] : 0;
    diff |= byteA ^ byteB;
  }
  return diff === 0;
}

export function getConfiguredAccounts(env) {
  const accounts = [];
  const u1 = env && env.ADMIN_USER ? String(env.ADMIN_USER).trim() : '';
  const p1 = env && env.ADMIN_PASS ? String(env.ADMIN_PASS) : '';
  if (u1 && p1) {
    accounts.push({ user: u1, pass: p1 });
  }

  const u2 = env && env.ADMIN_USER_2 ? String(env.ADMIN_USER_2).trim() : '';
  const p2 = env && env.ADMIN_PASS_2 ? String(env.ADMIN_PASS_2) : '';
  if (u2 && p2) {
    accounts.push({ user: u2, pass: p2 });
  }

  return accounts;
}

function getSigningMaterial(env) {
  const accounts = getConfiguredAccounts(env);
  if (accounts.length === 0) return '';
  const explicit = env && env.SESSION_SECRET ? String(env.SESSION_SECRET) : '';
  if (explicit) return explicit;
  return `${accounts.map((a) => `${a.user}:${a.pass}`).join('|')}|collection-edge-session-key`;
}

async function importHmacKey(secret, usage) {
  const keyBytes = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseCookies(cookieHeader) {
  const map = new Map();
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) map.set(key, val);
  }
  return map;
}

export async function createSessionToken(username, env) {
  const secret = getSigningMaterial(env);
  if (!secret) throw new Error('Credenciais administrativas não configuradas.');

  const payloadObj = {
    sub: String(username),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const key = await importHmacKey(secret, 'sign');
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sigBuf));
  return `${payloadB64}.${sigB64}`;
}

export async function verifySessionCookie(request, env) {
  const secret = getSigningMaterial(env);
  if (!secret) return null;

  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies.get(SESSION_COOKIE_NAME);
  if (!token || !token.includes('.')) return null;

  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await importHmacKey(secret, 'verify');
    const sigBytes = fromBase64Url(sigB64);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(fromBase64Url(payloadB64));
    const payload = JSON.parse(payloadJson);
    if (!payload || !payload.sub || !payload.exp) return null;
    if (Math.floor(Date.now() / 1000) > Number(payload.exp)) return null;

    return payload;
  } catch {
    return null;
  }
}

export function verifyCredentials(username, password, env) {
  const accounts = getConfiguredAccounts(env);
  if (accounts.length === 0) return false;

  const inputUser = String(username || '').trim();
  const inputPass = String(password || '');

  let matched = false;
  for (const account of accounts) {
    const uOk = timingSafeEqual(inputUser, account.user);
    const pOk = timingSafeEqual(inputPass, account.pass);
    if (uOk && pOk) {
      matched = true;
    }
  }
  return matched;
}

export function buildSessionCookieHeader(token, requestUrl) {
  const isHttps = String(requestUrl).startsWith('https://');
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (isHttps) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookieHeader(requestUrl) {
  const isHttps = String(requestUrl).startsWith('https://');
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (isHttps) parts.push('Secure');
  return parts.join('; ');
}

export function renderLoginPage({ errorMessage = '', env = {}, status = 200 } = {}) {
  const hasAdminVars = getConfiguredAccounts(env).length > 0;

  const diagnosticBanner = !hasAdminVars
    ? `<div class="alert alert-warn">
         <strong>Painel temporariamente indisponível:</strong>
         verifique as credenciais de acesso configuradas no servidor.
       </div>`
    : '';

  const errorBanner = errorMessage
    ? `<div class="alert alert-error">${escapeHtml(errorMessage)}</div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Acesso Restrito — Collection Store</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100svh;
      display: grid;
      place-items: center;
      padding: 1.5rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: radial-gradient(circle at top right, rgba(197, 155, 95, 0.16), transparent 45%), #15110f;
      color: #f7f1e8;
    }
    .login-card {
      width: min(100%, 410px);
      background: #211b18;
      border: 1px solid rgba(226, 196, 147, 0.28);
      border-radius: 22px;
      padding: 2rem;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    }
    .kicker {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #e2c493;
      margin-bottom: 0.5rem;
    }
    h1 {
      font-family: Georgia, serif;
      font-size: 1.9rem;
      font-weight: 600;
      margin: 0 0 0.45rem;
    }
    p.sub {
      margin: 0 0 1.4rem;
      font-size: 0.86rem;
      color: rgba(247, 241, 232, 0.72);
      line-height: 1.5;
    }
    .alert {
      border-radius: 12px;
      padding: 0.8rem 0.95rem;
      font-size: 0.82rem;
      line-height: 1.45;
      margin-bottom: 1rem;
    }
    .alert-error {
      background: rgba(140, 52, 67, 0.28);
      border: 1px solid rgba(229, 128, 144, 0.45);
      color: #ffd9df;
    }
    .alert-warn {
      background: rgba(197, 155, 95, 0.16);
      border: 1px solid rgba(226, 196, 147, 0.42);
      color: #f6dfba;
    }
    label {
      display: block;
      font-size: 0.78rem;
      font-weight: 700;
      color: #e2c493;
      margin-bottom: 0.35rem;
    }
    input {
      width: 100%;
      padding: 0.78rem 0.95rem;
      border-radius: 12px;
      border: 1px solid rgba(247, 241, 232, 0.18);
      background: #15110f;
      color: #f7f1e8;
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }
    input:focus {
      outline: none;
      border-color: #c59b5f;
    }
    button {
      width: 100%;
      padding: 0.9rem 1.2rem;
      border-radius: 999px;
      border: none;
      background: linear-gradient(135deg, #e2c493, #c59b5f);
      color: #15110f;
      font-size: 0.94rem;
      font-weight: 700;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .back-link {
      display: block;
      text-align: center;
      margin-top: 1.15rem;
      font-size: 0.8rem;
      color: rgba(247, 241, 232, 0.65);
      text-decoration: none;
    }
    .back-link:hover { color: #e2c493; }
  </style>
</head>
<body>
  <main class="login-card">
    <span class="kicker">Collection Store</span>
    <h1>Painel Administrativo</h1>
    <p class="sub">Área restrita para gestão de produtos e fotos da loja. Entre com suas credenciais de administrador.</p>
    ${diagnosticBanner}
    ${errorBanner}
    <form method="POST" action="">
      <label for="username">Usuário</label>
      <input type="text" id="username" name="username" autocomplete="username" required ${hasAdminVars ? '' : 'disabled'} />

      <label for="password">Senha</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required ${hasAdminVars ? '' : 'disabled'} />

      <button type="submit" ${hasAdminVars ? '' : 'disabled'}>Entrar no Painel</button>
    </form>
    <a href="/" class="back-link">&larr; Voltar para a vitrine da loja</a>
  </main>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}

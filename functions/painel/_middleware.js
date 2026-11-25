import {
  buildClearCookieHeader,
  buildSessionCookieHeader,
  createSessionToken,
  getConfiguredAccounts,
  renderLoginPage,
  verifyCredentials,
  verifySessionCookie
} from '../_shared/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Logout explícito
  if (url.searchParams.get('logout') === '1') {
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/painel/',
        'Set-Cookie': buildClearCookieHeader(request.url),
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow'
      }
    });
  }

  // Tentativa de login via formulário da tela de login
  if (request.method === 'POST' && (url.pathname === '/painel' || url.pathname === '/painel/')) {
    if (getConfiguredAccounts(env).length === 0) {
      return renderLoginPage({ env, status: 403 });
    }

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return renderLoginPage({
        errorMessage: 'Não foi possível ler os dados enviados.',
        env,
        status: 400
      });
    }

    const username = formData.get('username');
    const password = formData.get('password');

    if (!verifyCredentials(username, password, env)) {
      return renderLoginPage({
        errorMessage: 'Usuário ou senha incorretos.',
        env,
        status: 401
      });
    }

    const token = await createSessionToken(String(username).trim(), env);
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/painel/',
        'Set-Cookie': buildSessionCookieHeader(token, request.url),
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow'
      }
    });
  }

  // Verifica se o visitante possui cookie de sessão assinado válido
  const session = await verifySessionCookie(request, env);
  if (!session) {
    const isHtmlEntry = url.pathname === '/painel'
      || url.pathname === '/painel/'
      || url.pathname === '/painel/index.html';

    if (isHtmlEntry) {
      return renderLoginPage({
        env,
        status: getConfiguredAccounts(env).length === 0 ? 403 : 200
      });
    }

    // Bloqueia admin.js, admin.css e qualquer outro recurso sem sessão
    return new Response('Autenticação necessária.', {
      status: 401,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow'
      }
    });
  }

  // Autenticado: entrega os arquivos reais do painel admin
  const response = await context.next();
  const secured = new Response(response.body, response);
  secured.headers.set('X-Robots-Tag', 'noindex, nofollow');
  secured.headers.set('Cache-Control', 'private, no-store');
  return secured;
}

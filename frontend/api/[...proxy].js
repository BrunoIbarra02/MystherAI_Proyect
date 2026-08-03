const BACKEND = 'http://mysther-ai-alb-1734290767.eu-central-1.elb.amazonaws.com';

module.exports = async function handler(req, res) {
  // req.url inside a catch-all function is the matched segment(s) only.
  // req.query.proxy is an array like ['auth','login'] for /api/auth/login/
  const segments = req.query.proxy || [];
  const pathParts = Array.isArray(segments) ? segments : [segments];
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const backendUrl = `${BACKEND}/api/${pathParts.join('/')}/${qs}`;

  const forwardHeaders = {};
  if (req.headers['content-type'])  forwardHeaders['content-type']  = req.headers['content-type'];
  if (req.headers['cookie'])        forwardHeaders['cookie']         = req.headers['cookie'];
  if (req.headers['x-csrftoken'])   forwardHeaders['x-csrftoken']   = req.headers['x-csrftoken'];
  // Django compara Origin/Referer contra CSRF_TRUSTED_ORIGINS en peticiones HTTPS.
  // Sin reenviarlos, todo POST/PUT/DELETE se rechazaba con 403.
  if (req.headers['origin'])        forwardHeaders['origin']        = req.headers['origin'];
  if (req.headers['referer'])       forwardHeaders['referer']       = req.headers['referer'];

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody && req.body ? JSON.stringify(req.body) : undefined;

  let upstream;
  try {
    upstream = await fetch(backendUrl, { method: req.method, headers: forwardHeaders, body });
  } catch (err) {
    res.status(502).json({ error: 'Backend unreachable', detail: err.message });
    return;
  }

  // Django envía DOS cookies en el login (sessionid y csrftoken). Con .get() vienen
  // concatenadas por comas, y como el atributo Expires también lleva comas el
  // navegador parseaba basura y se perdía la sesión: parecía "contraseña incorrecta".
  const cookies = typeof upstream.headers.getSetCookie === 'function'
    ? upstream.headers.getSetCookie()
    : (upstream.headers.raw?.()['set-cookie'] || []);
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');

  const text = await upstream.text();
  res.status(upstream.status).send(text);
};

module.exports.config = { api: { bodyParser: true } };

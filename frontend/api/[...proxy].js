const BACKEND = 'http://mysther-ai-alb-1734290767.eu-central-1.elb.amazonaws.com';

export default async function handler(req, res) {
  const backendUrl = `${BACKEND}${req.url}`;

  const forwardHeaders = {};
  if (req.headers['content-type'])  forwardHeaders['content-type']  = req.headers['content-type'];
  if (req.headers['cookie'])        forwardHeaders['cookie']         = req.headers['cookie'];
  if (req.headers['x-csrftoken'])   forwardHeaders['x-csrftoken']   = req.headers['x-csrftoken'];

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody && req.body ? JSON.stringify(req.body) : undefined;

  const upstream = await fetch(backendUrl, {
    method: req.method,
    headers: forwardHeaders,
    body,
  });

  const setCookie = upstream.headers.get('set-cookie');
  if (setCookie) res.setHeader('Set-Cookie', setCookie);

  const contentType = upstream.headers.get('content-type') || 'application/json';
  res.setHeader('Content-Type', contentType);

  const text = await upstream.text();
  res.status(upstream.status).send(text);
}

export const config = {
  api: { bodyParser: true },
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'That request is too large.' });
    return;
  }
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  const message = status >= 500 ? 'Something went wrong on the server.' : err.message;
  res.status(status).json({ error: message });
}

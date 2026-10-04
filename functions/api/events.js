import { ingest } from '../../worker/index.js';

export function onRequest({ request, env }) {
  return ingest(request, env);
}

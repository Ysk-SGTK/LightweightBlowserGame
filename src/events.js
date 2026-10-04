// Extension point: subscribe here for analytics or reward collection.
// Local app events only; anonymous network logging is isolated in analytics.js.
export function emit(type, payload = {}) {
  document.dispatchEvent(new CustomEvent('treasure:event', {
    detail: { version: 1, type, at: new Date().toISOString(), ...payload }
  }));
}

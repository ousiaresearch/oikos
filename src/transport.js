// Transport Seam for Oikos: Local-First Today, Invite-Only / Shared Town Ready for v2.
// Mirrors the SSE (/v1/stream) + HTTP act (/v1/agents/:id/act) contract used in server/.

export function createLocalTransport() {
  return {
    mode: 'local',
    connect() {
      return () => {};
    },
    async publishCitizen(citizen) {
      return { ok: true, id: citizen.id };
    },
    async dispatchAction(entityId, action) {
      return { ok: true, entityId, action };
    }
  };
}

export function createRemoteTownTransport({ baseUrl, token = null } = {}) {
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('Remote town transport requires a baseUrl');
  }
  const normalizedUrl = baseUrl.replace(/\/+$/, '');

  return {
    mode: 'remote_town',
    baseUrl: normalizedUrl,
    connect(onSnapshot) {
      if (typeof EventSource === 'undefined') return () => {};
      const es = new EventSource(`${normalizedUrl}/v1/stream`);
      const onSnap = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          onSnapshot?.(payload);
        } catch {}
      };
      es.addEventListener('snapshot', onSnap);
      es.onmessage = onSnap;
      return () => {
        es.removeEventListener('snapshot', onSnap);
        es.close();
      };
    },
    async publishCitizen(citizen) {
      if (typeof fetch !== 'function') return { ok: false, reason: 'fetch_unavailable' };
      const resp = await fetch(`${normalizedUrl}/v1/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          id: citizen.id,
          name: citizen.name,
          role: citizen.persona,
          x: Math.round(citizen.x),
          y: Math.round(citizen.y),
          appearance: citizen.appearance
        })
      });
      return resp.json();
    },
    async dispatchAction(entityId, action) {
      if (typeof fetch !== 'function') return { ok: false, reason: 'fetch_unavailable' };
      const resp = await fetch(`${normalizedUrl}/v1/agents/${encodeURIComponent(entityId)}/act`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(action)
      });
      return resp.json();
    }
  };
}

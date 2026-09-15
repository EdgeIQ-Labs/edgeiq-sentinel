const BASE = '/api';

async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  getProjects: () => fetchJSON('/projects'),
  createProject: (data: { name: string; url: string }) =>
    fetchJSON('/projects', { method: 'POST', body: JSON.stringify(data) }),
  getRuns: (projectId: string) => fetchJSON(`/projects/${projectId}/runs`),
  triggerRun: (projectId: string, llmModel?: string) =>
    fetchJSON('/runs', { method: 'POST', body: JSON.stringify({ projectId, llmModel }) }),
  getRun: (runId: string) => fetchJSON(`/runs/${runId}`),
  getFindings: (runId: string) => fetchJSON(`/runs/${runId}/findings`),
};

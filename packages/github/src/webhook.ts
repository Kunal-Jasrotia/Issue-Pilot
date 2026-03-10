import crypto from 'node:crypto';

export interface WebhookPayload {
  action: string;
  issue?: {
    number: number;
    title: string;
    body: string | null;
    labels: Array<{ name: string }>;
    state: string;
    html_url: string;
    user: { login: string };
  };
  comment?: {
    id: number;
    body: string;
    user: { login: string };
    html_url: string;
  };
  repository: {
    full_name: string;
    owner: { login: string };
    name: string;
    clone_url: string;
    default_branch: string;
  };
  sender: { login: string };
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf-8');
  const digest = `sha256=${hmac.digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function shouldTriggerAgent(payload: WebhookPayload): boolean {
  const { action, issue, comment } = payload;

  // Trigger on label "ai-agent" being added to an issue
  if (action === 'labeled' && issue) {
    const hasAiLabel = issue.labels.some((l) => l.name === 'ai-agent');
    return hasAiLabel && issue.state === 'open';
  }

  // Trigger on comment "/ai solve"
  if ((action === 'created' || action === 'edited') && comment && issue) {
    const body = comment.body.trim().toLowerCase();
    return body === '/ai solve' || body.startsWith('/ai solve ');
  }

  return false;
}

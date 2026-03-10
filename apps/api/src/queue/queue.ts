import { Queue } from 'bullmq';
import { getBullConnection } from './redis.js';
import type { AgentJobData } from './worker.js';

let agentQueue: Queue<AgentJobData> | null = null;

export function getAgentQueue(): Queue<AgentJobData> {
  if (!agentQueue) {
    agentQueue = new Queue<AgentJobData>('agent-jobs', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      connection: getBullConnection(),
      defaultJobOptions: {
        attempts: 1, // Don't auto-retry agent jobs
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return agentQueue;
}

export async function enqueueAgentJob(data: AgentJobData): Promise<string> {
  const queue = getAgentQueue();
  const job = await queue.add(`agent-${data.issueNumber}`, data, {
    jobId: data.jobId,
  });
  return job.id ?? data.jobId;
}

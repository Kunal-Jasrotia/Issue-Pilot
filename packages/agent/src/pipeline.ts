/**
 * IssuePilot Agent Pipeline
 *
 * Pipeline: Planner → Coder → TestRunner → Reviewer → FixAgent (loop) → Commit → Create PR
 */
import { gitAdd, gitCommit, gitPush, createBranch } from '@issuepilot/tools';
import { GitHubClient, withAuthenticatedRemote } from '@issuepilot/github';
import { runTests } from '@issuepilot/sandbox';
import { runPlannerAgent } from './agents/planner.js';
import { runCoderAgent } from './agents/coder.js';
import { runReviewerAgent } from './agents/reviewer.js';
import { runFixAgent } from './agents/fix-agent.js';
import type { AgentConfig, AgentResult, AgentStep } from './types.js';

const MAX_FIX_ITERATIONS = 3;

function emit(config: AgentConfig, type: import('./types.js').AgentEventType, message: string, data?: unknown) {
  void config.onProgress?.({ type, message, data, timestamp: new Date() });
}

function makeStep(name: string, success: boolean, output: string, startTime: number): AgentStep {
  return { name, success, output, duration: Date.now() - startTime };
}

export async function runAgentPipeline(config: AgentConfig): Promise<AgentResult> {
  const { provider, repoPath, repository, issue, githubToken } = config;
  const steps: AgentStep[] = [];
  let branchName = `ai/issue-${issue.number}-${slugify(issue.title)}`;

  emit(config, 'started', `Starting agent pipeline for issue #${issue.number}: ${issue.title}`);

  // ── Step 1: Create branch ─────────────────────────────────────────────────
  let t = Date.now();
  try {
    let branchResult = await createBranch({ branchName }, { repoPath });
    if (!branchResult.success) {
      // Fallback attempt so the pipeline doesn't fail
      branchName = `${branchName}-${Date.now()}`;
      branchResult = await createBranch({ branchName }, { repoPath });
      if (!branchResult.success) throw new Error(branchResult.error);
    }
    steps.push(makeStep('Create Branch', true, `Branch created: ${branchName}`, t));
  } catch (err) {
    const msg = String(err);
    steps.push(makeStep('Create Branch', false, msg, t));
    return { success: false, error: msg, steps, branchName };
  }

  // ── Step 2: Plan ──────────────────────────────────────────────────────────
  t = Date.now();
  emit(config, 'planning', 'Analyzing issue and repository to create implementation plan...');
  let plan;
  try {
    plan = await runPlannerAgent(provider, issue, repository, repoPath);
    steps.push(makeStep('Planning', true, `Plan: ${plan.summary} (${plan.steps.length} steps)`, t));
    emit(config, 'planning', `Plan ready: ${plan.summary}`, plan);
  } catch (err) {
    const msg = String(err);
    steps.push(makeStep('Planning', false, msg, t));
    return { success: false, error: `Planning failed: ${msg}`, steps, branchName };
  }

  // ── Step 3: Code ──────────────────────────────────────────────────────────
  t = Date.now();
  emit(config, 'coding', 'Implementing changes...');
  try {
    const codingResult = await runCoderAgent(provider, issue, plan, repoPath, (msg) => {
      emit(config, 'log', msg);
    });
    steps.push(makeStep('Coding', true, codingResult.slice(0, 500), t));
    emit(config, 'coding', 'Code implementation complete');
  } catch (err) {
    const msg = String(err);
    steps.push(makeStep('Coding', false, msg, t));
    return { success: false, error: `Coding failed: ${msg}`, steps, branchName };
  }

  // ── Steps 4–6: Test → Review → Fix loop ──────────────────────────────────
  let testOutput = '';
  let approved = false;

  for (let iteration = 0; iteration < MAX_FIX_ITERATIONS; iteration++) {
    // Test
    t = Date.now();
    emit(config, 'testing', `Running tests (attempt ${iteration + 1}/${MAX_FIX_ITERATIONS})...`);
    try {
      const testResult = await runTests({ repoPath, timeout: 5 * 60 * 1000 });
      testOutput = testResult.output;
      steps.push(makeStep('Testing', testResult.passed, testResult.output.slice(0, 1000), t));
      emit(config, 'testing', testResult.passed ? 'Tests passed!' : 'Tests failed', testResult);
    } catch (err) {
      testOutput = String(err);
      steps.push(makeStep('Testing', false, testOutput, t));
      emit(config, 'testing', `Test runner error: ${testOutput}`);
    }

    // Review
    t = Date.now();
    emit(config, 'reviewing', 'Reviewing changes...');
    let reviewResult;
    try {
      reviewResult = await runReviewerAgent(provider, issue, plan, repoPath, testOutput);
      steps.push(makeStep('Review', reviewResult.approved, reviewResult.summary, t));
      emit(config, 'reviewing', reviewResult.summary, reviewResult);
    } catch (err) {
      const msg = String(err);
      steps.push(makeStep('Review', false, msg, t));
      reviewResult = { approved: false, issues: [], summary: msg };
    }

    if (reviewResult.approved) {
      approved = true;
      break;
    }

    // Fix (if not last iteration)
    if (iteration < MAX_FIX_ITERATIONS - 1) {
      t = Date.now();
      emit(config, 'fixing', `Fixing issues (iteration ${iteration + 1})...`);
      try {
        const fixResult = await runFixAgent(
          provider,
          repoPath,
          testOutput,
          reviewResult.issues,
          (msg) => emit(config, 'log', msg)
        );
        steps.push(makeStep('Fix', true, fixResult.slice(0, 500), t));
      } catch (err) {
        steps.push(makeStep('Fix', false, String(err), t));
      }
    }
  }

  // ── Step 7: Commit ────────────────────────────────────────────────────────
  t = Date.now();
  emit(config, 'committing', 'Staging and committing changes...');
  try {
    const ctx = { repoPath };
    await gitAdd({}, ctx);
    const commitMsg = `fix(#${issue.number}): ${issue.title}\n\nAutomated fix by IssuePilot AI agent\n\nResolves #${issue.number}`;
    const commitResult = await gitCommit({ message: commitMsg }, ctx);
    if (!commitResult.success) throw new Error(commitResult.error);
    steps.push(makeStep('Commit', true, `Committed: ${commitResult.data ?? ''}`, t));
  } catch (err) {
    const msg = String(err);
    steps.push(makeStep('Commit', false, msg, t));
    return { success: false, error: `Commit failed: ${msg}`, steps, branchName };
  }

  // ── Step 8: Push ──────────────────────────────────────────────────────────
  t = Date.now();
  emit(config, 'committing', 'Pushing branch to GitHub...');
  try {
    await withAuthenticatedRemote(repoPath, githubToken, repository.cloneUrl, async () => {
      const pushResult = await gitPush({ branch: branchName, force: false }, { repoPath });
      if (!pushResult.success) throw new Error(pushResult.error);
    });
    steps.push(makeStep('Push', true, `Pushed branch: ${branchName}`, t));
  } catch (err) {
    const msg = String(err);
    steps.push(makeStep('Push', false, msg, t));
    return { success: false, error: `Push failed: ${msg}`, steps, branchName };
  }

  // ── Step 9: Create PR ─────────────────────────────────────────────────────
  t = Date.now();
  emit(config, 'creating_pr', 'Creating pull request...');
  try {
    const gh = new GitHubClient(githubToken);
    const prBody = buildPRBody(issue, plan, steps, approved);
    const pr = await gh.createPullRequest({
      owner: repository.owner,
      repo: repository.name,
      title: `AI Fix: ${issue.title}`,
      body: prBody,
      head: branchName,
      base: repository.defaultBranch,
      draft: !approved, // Draft if not fully approved
    });
    steps.push(makeStep('Create PR', true, pr.htmlUrl, t));
    emit(config, 'completed', `Pull request created: ${pr.htmlUrl}`, pr);

    return { success: true, pullRequest: pr, branchName, steps };
  } catch (err) {
    const msg = String(err);
    steps.push(makeStep('Create PR', false, msg, t));
    return { success: false, error: `PR creation failed: ${msg}`, steps, branchName };
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function buildPRBody(
  issue: { number: number; title: string; htmlUrl: string },
  plan: { summary: string; steps: Array<{ description: string }> },
  steps: AgentStep[],
  approved: boolean
): string {
  const stepsTable = steps
    .map((s) => `| ${s.name} | ${s.success ? '✅' : '❌'} | ${s.duration}ms |`)
    .join('\n');

  return `## 🤖 AI Fix for #${issue.number}

**Issue:** [${issue.title}](${issue.htmlUrl})

### Plan
${plan.summary}

**Steps taken:**
${plan.steps.map((s, i) => `${i + 1}. ${s.description}`).join('\n')}

### Agent Pipeline Results

| Step | Status | Duration |
|------|--------|----------|
${stepsTable}

${approved ? '✅ **All checks passed — ready for review**' : '⚠️ **Draft PR — some checks did not pass, human review required**'}

---
*Generated by [IssuePilot](https://github.com/issuepilot/issuepilot)*

Closes #${issue.number}`;
}

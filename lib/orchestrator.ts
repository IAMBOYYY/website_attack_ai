'use client';

import { callModel } from './llm';
import { DIRECTOR_TOOL, TOOL_DEFS, executeTool } from './tools';
import type {
  AgentConfig, AgentRuntime, BBEvent, ChatMessage,
  ProviderKey, RunConfig, Target, ToolCall,
} from './types';

const uid = () => Math.random().toString(36).slice(2, 11);

export interface SwarmOpts {
  mission: string;
  targets: Target[];
  agents: AgentConfig[];
  keys: Record<string, ProviderKey>;
  config: RunConfig;
}

export interface SwarmCallbacks {
  onEvent: (e: BBEvent) => void;
  onRuntime: (r: Record<string, AgentRuntime>) => void;
  onDone: (reason: string) => void;
  shouldStop: () => boolean;
}

function keyFor(providerId: string, keys: Record<string, ProviderKey>) {
  return keys[providerId] ?? null;
}

function systemPromptAgent(agent: AgentConfig, mission: string, plan: string, targets: Target[], round: number) {
  return `You are ${agent.name}, an autonomous agent in a multi-agent swarm. Role: ${agent.role.toUpperCase()}.

MISSION:
${mission}

${targets.length ? `TARGETS:\n${targets.map((t) => `- ${t.url}${t.note ? ` (${t.note})` : ''}`).join('\n')}\n` : ''}
DIRECTOR PLAN:
${plan || '(none yet — act on the mission directly)'}

CURRENT ROUND: ${round}

OPERATING RULES:
- You have tools. Use them. Do not describe what you would do — do it, then report what the tool returned.
- Every claim must trace to a tool result. Never fabricate output.
- Workspace files are shared with other agents. Read what they wrote before duplicating work.
- Be economical: one decisive tool call beats five exploratory ones.
- When your contribution for this round is complete, call \`report\` with a concrete summary.
- If you are blocked, call \`report\` with status "blocked" and say exactly what is missing.`;
}

function systemPromptDirector(mission: string, plan: string, targets: Target[]) {
  return `You are the DIRECTOR of an autonomous multi-agent swarm. You do not execute; you plan, judge, and decide when the mission is complete.

MISSION:
${mission}

${targets.length ? `TARGETS:\n${targets.map((t) => `- ${t.url}`).join('\n')}\n` : ''}
CURRENT PLAN:
${plan || '(not yet formed)'}

You will receive the blackboard: everything every agent has said and done this run. Judge honestly:
- Is the mission actually complete, with concrete evidence on the blackboard?
- If not, what is the single highest-value next instruction?

If complete, call \`finish\` with the full deliverable — the actual answer, artifact, or report, not a description of it.
If not complete, respond with plain text: a tight directive for the next round. No preamble. No "let's". Just the instruction.`;
}

function summarize(events: BBEvent[], maxChars = 24000): string {
  if (!events.length) return '(empty)';
  const tail = events.slice(-160);
  const lines: string[] = [];
  let used = 0;
  for (let i = tail.length - 1; i >= 0; i--) {
    const e = tail[i];
    const head = `[r${e.round} ${e.agentName}${e.tool ? ` · ${e.tool}` : ''}]`;
    const body = e.content.length > 1600 ? e.content.slice(0, 1600) + '…' : e.content;
    const chunk = `${head}\n${body}`;
    if (used + chunk.length > maxChars) { lines.unshift('…(earlier events elided)'); break; }
    lines.unshift(chunk);
    used += chunk.length;
  }
  return lines.join('\n\n');
}

export async function runSwarm(opts: SwarmOpts, cb: SwarmCallbacks) {
  const { mission, targets, keys, config } = opts;
  const agents = opts.agents.filter((a) => a.enabled);
  const director = agents.find((a) => a.isDirector) ?? agents[0];
  const workers = agents.filter((a) => a.id !== director?.id);

  if (!director) { cb.onDone('no director agent configured'); return; }
  if (!mission.trim()) { cb.onDone('empty mission'); return; }

  const runtime: Record<string, AgentRuntime> = {};
  for (const a of agents) {
    runtime[a.id] = { id: a.id, status: 'idle', lastAction: '', tokensIn: 0, tokensOut: 0, calls: 0, errors: 0 };
  }
  const pushRuntime = () => cb.onRuntime({ ...runtime });

  const blackboard: BBEvent[] = [];
  let round = 0;
  let totalToolCalls = 0;
  let stopReason = 'completed';
  let finalSummary = '';
  let plan = '';

  const emit = (e: Omit<BBEvent, 'id' | 'ts'>) => {
    const full: BBEvent = { ...e, id: uid(), ts: Date.now() };
    blackboard.push(full);
    cb.onEvent(full);
  };

  const dc = keyFor(director.providerId, keys);
  if (!dc || (!dc.apiKey && dc.providerId !== 'ollama' && dc.providerId !== 'lmstudio')) {
    cb.onDone(`no API key for director (${director.providerId})`);
    return;
  }

  /* ---------- PLAN ---------- */
  emit({ round: 0, agentId: director.id, agentName: director.name, providerId: director.providerId, model: director.model, kind: 'system', content: 'Director is planning.' });
  runtime[director.id].status = 'thinking'; pushRuntime();

  try {
    const planRes = await callModel({
      providerId: director.providerId, apiKey: dc.apiKey, baseUrl: dc.baseUrl,
      model: director.model, useProxy: dc.useProxy,
      messages: [
        { role: 'system', content: 'You are a mission planner for an autonomous multi-agent swarm. Output a numbered plan of 3–7 concrete steps. Each step names which role executes it (scout / builder / critic / executor). No preamble. No closing.' },
        { role: 'user', content: `MISSION: ${mission}\n\nTARGETS:\n${targets.map((t) => t.url).join('\n') || '(none)'}\n\nAVAILABLE ROLES: scout, builder, critic, executor` },
      ],
      temperature: 0.4, maxTokens: 1200,
    });
    plan = planRes.content.trim() || '(no plan produced)';
    emit({ round: 0, agentId: director.id, agentName: director.name, providerId: director.providerId, model: director.model, kind: 'plan', content: plan });
  } catch (e) {
    plan = '(planning failed — agents will work from the mission directly)';
    emit({ round: 0, agentId: director.id, agentName: director.name, providerId: director.providerId, model: director.model, kind: 'error', content: `planning error: ${(e as Error).message}` });
  }
  runtime[director.id].status = 'idle'; pushRuntime();

  /* ---------- ROUNDS ---------- */
  while (round < config.maxRounds) {
    if (cb.shouldStop()) { stopReason = 'stopped by operator'; break; }
    round++;

    emit({ round, agentId: 'system', agentName: 'SWARM', providerId: '', model: '', kind: 'system', content: `── round ${round} / ${config.maxRounds} ──` });

    for (const agent of workers) {
      if (cb.shouldStop()) { stopReason = 'stopped by operator'; break; }
      if (totalToolCalls >= config.maxToolCalls) { stopReason = 'tool-call budget exhausted'; break; }
      const k = keyFor(agent.providerId, keys);
      if (!k || (!k.apiKey && agent.providerId !== 'ollama' && agent.providerId !== 'lmstudio')) {
        runtime[agent.id].status = 'offline';
        runtime[agent.id].lastAction = 'no api key';
        pushRuntime();
        continue;
      }

      runtime[agent.id].status = 'thinking';
      runtime[agent.id].lastAction = 'thinking…';
      pushRuntime();

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPromptAgent(agent, mission, plan, targets, round) },
        { role: 'user', content: `BLACKBOARD SO FAR:\n\n${summarize(blackboard)}\n\nWhat is your move this round? Use a tool or call report.` },
      ];

      let turnToolCalls = 0;
      let guard = 0;

      while (guard++ < config.maxToolCallsPerTurn + 2) {
        if (cb.shouldStop()) break;

        let res;
        try {
          res = await callModel({
            providerId: agent.providerId, apiKey: k.apiKey, baseUrl: k.baseUrl,
            model: agent.model, useProxy: k.useProxy,
            messages, tools: TOOL_DEFS,
            temperature: agent.temperature, maxTokens: 4096,
          });
          runtime[agent.id].calls++;
          runtime[agent.id].tokensIn += res.usage?.input ?? 0;
          runtime[agent.id].tokensOut += res.usage?.output ?? 0;
          runtime[agent.id].errors = 0;
          pushRuntime();
        } catch (e) {
          runtime[agent.id].errors++;
          runtime[agent.id].status = 'error';
          runtime[agent.id].lastAction = (e as Error).message.slice(0, 80);
          pushRuntime();
          emit({ round, agentId: agent.id, agentName: agent.name, providerId: agent.providerId, model: agent.model, kind: 'error', content: (e as Error).message });
          break;
        }

        const asst: ChatMessage = {
          role: 'assistant',
          content: res.content || null,
          tool_calls: res.tool_calls.length ? res.tool_calls : undefined,
        };
        messages.push(asst);

        if (res.content?.trim()) {
          emit({ round, agentId: agent.id, agentName: agent.name, providerId: agent.providerId, model: agent.model, kind: 'text', content: res.content.trim() });
        }

        if (!res.tool_calls.length) {
          emit({ round, agentId: agent.id, agentName: agent.name, providerId: agent.providerId, model: agent.model, kind: 'report', content: res.content?.trim() || '(no output)' });
          break;
        }

        let calledReport = false;

        for (const tc of res.tool_calls) {
          if (totalToolCalls >= config.maxToolCalls) break;
          let args: Record<string, any> = {};
          try { args = JSON.parse(tc.function.arguments || '{}'); } catch { args = { _raw: tc.function.arguments }; }

          if (tc.function.name === 'report') {
            calledReport = true;
            emit({
              round, agentId: agent.id, agentName: agent.name, providerId: agent.providerId, model: agent.model,
              kind: 'report',
              content: String(args.summary ?? '(no summary)'),
              meta: { status: args.status, artifacts: args.artifacts },
            });
            messages.push({ role: 'tool', tool_call_id: tc.id, content: 'ACK' });
            continue;
          }

          runtime[agent.id].status = 'tool';
          runtime[agent.id].lastAction = tc.function.name;
          pushRuntime();

          emit({
            round, agentId: agent.id, agentName: agent.name, providerId: agent.providerId, model: agent.model,
            kind: 'tool', tool: tc.function.name, content: JSON.stringify(args, null, 2).slice(0, 2000),
          });

          const result = await executeTool(tc.function.name, args, { config });
          totalToolCalls++;
          turnToolCalls++;

          emit({
            round, agentId: agent.id, agentName: agent.name, providerId: agent.providerId, model: agent.model,
            kind: 'tool_result', tool: tc.function.name, content: result,
          });

          messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }

        if (calledReport) break;
        if (turnToolCalls >= config.maxToolCallsPerTurn) {
          messages.push({ role: 'user', content: 'Tool budget for this turn is exhausted. Call report now with what you have.' });
        }
      }

      runtime[agent.id].status = 'done';
      runtime[agent.id].lastAction = 'turn complete';
      pushRuntime();
    }

    if (cb.shouldStop()) { stopReason = 'stopped by operator'; break; }
    if (totalToolCalls >= config.maxToolCalls) { stopReason = 'tool-call budget exhausted'; break; }

    /* ---------- VERDICT ---------- */
    if (!config.goalCheckEveryRound && round < config.maxRounds) continue;

    runtime[director.id].status = 'thinking';
    runtime[director.id].lastAction = 'evaluating';
    pushRuntime();

    emit({ round, agentId: director.id, agentName: director.name, providerId: director.providerId, model: director.model, kind: 'system', content: 'Director is evaluating the blackboard.' });

    try {
      const verdict = await callModel({
        providerId: director.providerId, apiKey: dc.apiKey, baseUrl: dc.baseUrl,
        model: director.model, useProxy: dc.useProxy,
        messages: [
          { role: 'system', content: systemPromptDirector(mission, plan, targets) },
          { role: 'user', content: `BLACKBOARD:\n\n${summarize(blackboard)}\n\nIs the mission complete? If yes, call finish with the full deliverable. If no, reply with the next round's directive as plain text.` },
        ],
        tools: [DIRECTOR_TOOL],
        temperature: 0.3, maxTokens: 3000,
      });

      runtime[director.id].calls++;
      runtime[director.id].tokensIn += verdict.usage?.input ?? 0;
      runtime[director.id].tokensOut += verdict.usage?.output ?? 0;

      const finishCall = verdict.tool_calls.find((c: ToolCall) => c.function.name === 'finish');
      if (finishCall) {
        let a: any = {};
        try { a = JSON.parse(finishCall.function.arguments || '{}'); } catch {}
        finalSummary = String(a.summary ?? verdict.content ?? '(no summary)');
        emit({ round, agentId: director.id, agentName: director.name, providerId: director.providerId, model: director.model, kind: 'verdict', content: 'MISSION COMPLETE' });
        stopReason = 'mission complete';
        runtime[director.id].status = 'done'; pushRuntime();
        break;
      }

      const directive = verdict.content.trim();
      if (directive) {
        plan = `${plan}\n\n[round ${round} directive]\n${directive}`;
        emit({ round, agentId: director.id, agentName: director.name, providerId: director.providerId, model: director.model, kind: 'verdict', content: `CONTINUE\n\n${directive}` });
      }
    } catch (e) {
      emit({ round, agentId: director.id, agentName: director.name, providerId: director.providerId, model: director.model, kind: 'error', content: `verdict error: ${(e as Error).message}` });
    }

    runtime[director.id].status = 'idle'; pushRuntime();
  }

  if (round >= config.maxRounds && stopReason === 'completed') stopReason = 'round budget exhausted';

  emit({
    round, agentId: 'system', agentName: 'SWARM', providerId: '', model: '',
    kind: 'final',
    content: finalSummary || `Run ended: ${stopReason}. ${blackboard.length} events, ${totalToolCalls} tool calls.`,
    meta: { stopReason, rounds: round, toolCalls: totalToolCalls },
  });

  cb.onDone(stopReason);
}

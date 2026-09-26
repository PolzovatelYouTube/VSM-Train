/**
 * Authoritative replay of a completed ride.
 *
 * The browser supplies only ordered choices. This module feeds them back into
 * the same pure engine used by the UI and returns the server-calculated state.
 * Thus scores, meters, competencies and the audit log never come from the
 * client request.
 */
import type { ReplayAction } from "./schema";
import type { ScenarioData } from "./scenario";
import { chooseOption, computeResult, createSim, tick, triggerEvent, visibleOptions, concurrentGameplay, selectIncident, leaveIncident, continueInformation, effectiveNodeKind, type SimResult, type SimState } from "./engine";

const STEP_SEC = 0.05;
const EPSILON_SEC = 0.0001;

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayError";
  }
}

export interface ReplayResult {
  state: SimState;
  result: SimResult;
}

function advanceTo(state: SimState, targetSec: number, data: ScenarioData, pauseWhileDialogue: boolean) {
  while (!state.finished && state.t + EPSILON_SEC < targetSec) {
    // In training a dialogue intentionally freezes simulation time. A later
    // action cannot be valid until that dialogue has been answered.
    if (pauseWhileDialogue && state.active && !concurrentGameplay(data))
      throw new ReplayError(`Диалог ${state.active.nodeId} не был завершён до следующего действия.`);
    tick(state, Math.min(STEP_SEC, targetSec - state.t), data, { pauseWhileDialogue });
  }
}

/** Reproduce an attempt from ordered user choices and calculate its result. */
export function replayAttempt(data: ScenarioData, mode: "training" | "check", actions: ReplayAction[]): ReplayResult {
  const state = createSim(data);
  const pauseWhileDialogue = mode === "training";
  let previousMs = 0;
  const maxMs = Math.ceil(data.durationSec * 1000);

  for (const action of actions) {
    if (action.timestampMs < previousMs)
      throw new ReplayError("Действия должны быть отсортированы по времени.");
    if (action.timestampMs > maxMs)
      throw new ReplayError("Время действия выходит за пределы длительности сценария.");

    if (action.timestampMs / 1000 + 0.001 < state.t)
      throw new ReplayError("Действие началось раньше завершения предыдущего действия.");
    advanceTo(state, action.timestampMs / 1000, data, pauseWhileDialogue);
    if (state.finished) throw new ReplayError("Действие после завершения рейса.");
    if (action.type === "select") {
      if (!selectIncident(state, data, action.eventId)) throw new ReplayError(`Ситуация ${action.eventId} недоступна.`);
      previousMs = action.timestampMs;
      continue;
    }
    if (action.type === "leave") {
      if (!state.active || !concurrentGameplay(data)) throw new ReplayError("Нет ситуации, которую можно оставить ждать.");
      leaveIncident(state);
      previousMs = action.timestampMs;
      continue;
    }
    if (action.type === "trigger") {
      const event = data.events.find((item) => item.id === action.eventId);
      if (!event || event.trigger.type !== "manual")
        throw new ReplayError(`Событие ${action.eventId} нельзя запустить вручную.`);
      if (state.fired.includes(event.id)) throw new ReplayError(`Событие ${action.eventId} уже было запущено.`);
      triggerEvent(state, data, event.id);
      previousMs = action.timestampMs;
      continue;
    }

    // Совместимость со старыми журналами: только одна ситуация допускает неявный фокус.
    if (!state.active && concurrentGameplay(data) && action.type === "choice" && !action.eventId) {
      const waiting = Object.values(state.incidents).filter((i) => i.status === "waiting");
      if (waiting.length === 1) selectIncident(state, data, waiting[0].eventId);
    }
    if (action.type === "continue") {
      if (state.active?.eventId !== action.eventId || state.active.nodeId !== action.nodeId || !continueInformation(state, data))
        throw new ReplayError("Продолжение недоступно вне информационного узла.");
      previousMs = action.timestampMs;
      continue;
    }

    if (!state.active)
      throw new ReplayError(`Нет активного диалога для выбора ${action.choiceId}.`);
    if (state.active.nodeId !== action.nodeId)
      throw new ReplayError(`Ожидался узел ${state.active.nodeId}, получен ${action.nodeId}.`);
    if (action.eventId && state.active.eventId !== action.eventId)
      throw new ReplayError("Ответ относится к другой ситуации.");

    const event = data.events.find((item) => item.id === state.active!.eventId);
    const node = event?.nodes.find((item) => item.id === state.active!.nodeId);
    const option = node && visibleOptions(node, state).find((item) => item.id === action.choiceId);
    if (!option || !node || effectiveNodeKind(node, state) !== "decision")
      throw new ReplayError(`Вариант ${action.choiceId} недоступен в узле ${action.nodeId}.`);

    // Reaction time is derived from virtual replay time. It is also bounded by
    // the engine's timeout processing during advanceTo() in check mode.
    state.active.wallOpenedAt = Date.now() - Math.max(0, action.timestampMs - state.active.openedAt * 1000);
    chooseOption(state, data, option);
    previousMs = action.timestampMs;
  }

  advanceTo(state, data.durationSec, data, pauseWhileDialogue);
  if (!state.finished) {
    if (state.active) throw new ReplayError(`Сценарий завершён с неразрешённым диалогом ${state.active.nodeId}.`);
    // A completed timeline needs one final engine tick to set finished=true.
    tick(state, EPSILON_SEC, data, { pauseWhileDialogue });
  }
  if (!state.finished) throw new ReplayError("Сценарий не завершился после воспроизведения действий.");

  return { state, result: computeResult(state, data) };
}

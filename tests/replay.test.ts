import { describe, expect, it } from "vitest";
import { ReplayError, replayAttempt } from "../shared/replay";
import { standardDemo } from "./helpers";

function replayScenario() {
  const data = standardDemo();
  data.durationSec = 1;
  data.actors = [];
  data.events = [
    {
      id: "event",
      title: "Проверка replay",
      category: "technical",
      actorId: null,
      trigger: { type: "time", atSec: 0 },
      startNode: "node",
      nodes: [
        {
          id: "node",
          kind: "decision",
          speaker: "Система",
          text: "Выберите действие",
          options: [
            { id: "safe", text: "Устранить неисправность сразу", next: null, effects: { loyalty: 2, safety: 7 }, correct: true },
            { id: "delegate", text: "Передать ремонт коллеге и продолжить обход", next: null, effects: { loyalty: 0, safety: 3 }, correct: true },
          ],
        },
      ],
    },
  ];
  return data;
}

describe("authoritative attempt replay", () => {
  it("calculates result from choices, not client-supplied meters", () => {
    const data = replayScenario();
    const replay = replayAttempt(data, "check", [{ type: "choice", nodeId: "node", choiceId: "safe", timestampMs: 50 }]);

    expect(replay.state.log).toHaveLength(1);
    expect(replay.state.log[0]).toMatchObject({ nodeId: "node", optionId: "safe", correct: true });
    expect(replay.result.safety).toBe(data.initial.safety + 7);
    expect(replay.state.finished).toBe(true);
  });

  it("rejects a choice that is not available in the active node", () => {
    expect(() => replayAttempt(replayScenario(), "check", [{ type: "choice", nodeId: "node", choiceId: "forged", timestampMs: 50 }])).toThrow(ReplayError);
  });

  it("replays a manual sandbox trigger before its choice", () => {
    const data = replayScenario();
    data.events[0].trigger = { type: "manual" };
    const replay = replayAttempt(data, "training", [
      { type: "trigger", eventId: "event", timestampMs: 50 },
      { type: "choice", nodeId: "node", choiceId: "safe", timestampMs: 100 },
    ]);

    expect(replay.state.log[0]).toMatchObject({ eventId: "event", optionId: "safe" });
  });

  it("records server-side timeout when no choice arrives", () => {
    const data = replayScenario();
    data.events[0].nodes[0].timerSec = 0.1;
    const replay = replayAttempt(data, "check", []);

    expect(replay.state.log).toHaveLength(1);
    expect(replay.state.log[0].optionId).toBeNull();
  });
});

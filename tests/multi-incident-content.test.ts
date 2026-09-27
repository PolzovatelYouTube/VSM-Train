import { describe, expect, it } from "vitest";
import { findNode } from "../shared/engine";
import { scenarioDataSchema } from "../shared/scenario";
import { multiIncidentScenario } from "../shared/scenarios/multi-incident";

describe("содержание сценария одновременных инцидентов", () => {
  it("даёт время на чтение и корректно классифицирует угрозу безопасности", () => {
    const data = multiIncidentScenario();

    expect(data.durationSec).toBe(100);
    expect(data.events.find((event) => event.id === "unattended")?.category).toBe("security");
    expect(scenarioDataSchema.safeParse(data).success).toBe(true);
  });

  it("не отправляет проводника за рацией и сохраняет наблюдение за пассажиром", () => {
    const data = multiIncidentScenario();
    const option = findNode(data, "breathing", "breathing-start")?.options.find(
      (item) => item.id === "medical-radio",
    );

    expect(option?.text).toContain("по рации на поясе");
    expect(option?.text).toContain("одновременно подходя к пассажиру");
    expect(option?.feedback).toContain("без ухода от пассажира");
  });
});

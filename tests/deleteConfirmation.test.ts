import { describe, expect, it } from "vitest";
import { deleteScenarioMessage } from "../client/src/lib/deleteConfirmation";

describe("deleteScenarioMessage", () => {
  it("показывает название сценария и предупреждает о необратимости", () => {
    expect(deleteScenarioMessage({ id: 28, name: "Ситуации на борту" })).toBe(
      "Удалить сценарий «Ситуации на борту»?\n\nЭто действие нельзя отменить.",
    );
  });
});

export interface ScenarioDeleteTarget {
  id: number;
  name: string;
}

export function deleteScenarioMessage(scenario: ScenarioDeleteTarget): string {
  return `Удалить сценарий «${scenario.name}»?\n\nЭто действие нельзя отменить.`;
}

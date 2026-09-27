import { describe, expect, it } from "vitest";
import { computeResult, createSim, evalCondition, findNode, openNode, chooseOption, visibleOptions, resolveOutcome } from "../shared/engine";
import { scenarioDataSchema } from "../shared/scenario";
import { accessibilityScenario } from "../shared/scenarios/accessibility";
import { boardingUnderPressureScenario } from "../shared/scenarios/boarding-under-pressure";
import { serviceByClassEquipmentScenario } from "../shared/scenarios/service-by-class-equipment";
import { accessibilityCommunicationScenario } from "../shared/scenarios/accessibility-communication";
import { onboardScenario } from "../shared/scenarios/onboard";

function pick(data: { events: ReturnType<typeof accessibilityScenario>["events"] }, state: ReturnType<typeof createSim>, id: string) {
  const node = findNode(data, state.active!.eventId, state.active!.nodeId)!;
  const option = visibleOptions(node, state).find((item) => item.id === id);
  expect(option, id).toBeDefined();
  chooseOption(state, data, option!);
}

describe("потребности доступности и ресурсы состава", () => {
  it("старые сценарии остаются валидными без новых полей", () => {
    const data = accessibilityScenario();
    expect(scenarioDataSchema.safeParse(data).success).toBe(true);
    expect(data.actors.find((actor) => actor.id === "a_wheelchair")?.accessibilityNeeds).toEqual(["wheelchair", "mobility"]);
    expect(data.actors.find((actor) => actor.id === "a_guide_dog_owner")?.accessibilityNeeds).toEqual(["vision"]);
  });

  it("письменный канал для нарушения слуха доступен только после уточнения и при оснащении", () => {
    const data = accessibilityScenario();
    const state = createSim(data);
    openNode(state, data, "ev_hearing", "h1");
    const h2 = findNode(data, "ev_hearing", "h2")!;
    expect(visibleOptions(h2, state).some((item) => item.id === "h2a")).toBe(false);
    pick(data, state, "h1a");
    expect(visibleOptions(h2, state).some((item) => item.id === "h2a")).toBe(true);
    state.resources.capabilities[data.train.cars[1].id].writtenCommunication = false;
    expect(visibleOptions(h2, state).some((item) => item.id === "h2a")).toBe(false);
  });

  it("устная ориентация для нарушения зрения не подменяется письменным каналом", () => {
    const data = accessibilityScenario();
    const state = createSim(data);
    openNode(state, data, "ev_vision", "v1");
    pick(data, state, "v1a");
    expect(visibleOptions(findNode(data, "ev_vision", "v2")!, state).map((item) => item.id)).toContain("v2a");
    state.resources.serviceEntitlements.verbalOrientation = false;
    expect(visibleOptions(findNode(data, "ev_vision", "v2")!, state).map((item) => item.id)).not.toContain("v2a");
  });

  it("ресурсные условия читают вместимость, тип вагона и оснащение без ложного entitlement", () => {
    const data = serviceByClassEquipmentScenario();
    const state = createSim(data);
    const [business] = data.train.cars;
    expect(evalCondition({ resource: { type: "availableSeats", carId: business.id, range: { gte: 1 } } }, state)).toBe(true);
    expect(evalCondition({ resource: { type: "carType", carId: business.id, eq: "business" } }, state)).toBe(true);
    expect(evalCondition({ resource: { type: "capability", carId: business.id, capability: "quietArea" } }, state)).toBe(false);
    expect(evalCondition({ resource: { type: "serviceEntitlement", entitlement: "quietArea" } }, state)).toBe(false);
  });

  it("свободное место Business недоступно другим веткам после резервирования", () => {
    const data = serviceByClassEquipmentScenario();
    const state = createSim(data);
    const quietFollowup = findNode(data, "quiet_followup", "quiet_followup_start")!;
    expect(visibleOptions(quietFollowup, state).some((item) => item.id === "quiet_use_business")).toBe(true);
    state.flags["service.business_seat_reserved"] = true;
    expect(visibleOptions(quietFollowup, state).some((item) => item.id === "quiet_use_business")).toBe(false);
  });

  it("оформленное повышение класса занимает единственное место Business", () => {
    const data = serviceByClassEquipmentScenario();
    const state = createSim(data);
    openNode(state, data, "upgrade_request", "upgrade_start");
    pick(data, state, "upgrade_check");
    pick(data, state, "upgrade_available");

    expect(state.flags["service.upgrade_np_called"]).toBe(true);
    expect(state.flags["service.business_seat_reserved"]).toBe(true);
    const quietFollowup = findNode(data, "quiet_followup", "quiet_followup_start")!;
    expect(visibleOptions(quietFollowup, state).some((item) => item.id === "quiet_use_business")).toBe(false);
  });

  it("звонок направляется в сервисный тамбур, а не в Business", () => {
    const data = serviceByClassEquipmentScenario();
    const state = createSim(data);
    openNode(state, data, "quiet_request", "quiet_start");
    pick(data, state, "quiet_clarify");

    const context = findNode(data, "quiet_request", "quiet_context")!;
    expect(context.options.find((item) => item.id === "quiet_corridor")?.correct).toBe(true);
    const businessOption = findNode(data, "quiet_followup", "quiet_followup_start")!.options.find((item) => item.id === "quiet_use_business")!;
    expect(businessOption.correct).not.toBe(true);
  });

  it("неподтверждённый срок ремонта снижает компетенции в итоговом разборе", () => {
    const data = serviceByClassEquipmentScenario();
    const state = createSim(data);
    openNode(state, data, "business_equipment_failure", "equipment_start");
    pick(data, state, "equipment_promise_repair");

    const result = computeResult(state, data);
    expect(result.competencies.safety).toBe(0);
    expect(result.competencies.protocol).toBe(0);
  });

  it("посадка предлагает резервное место только после проверки документов, обращения к ЛНП и при доступном ресурсе", () => {
    const data = boardingUnderPressureScenario();
    const state = createSim(data);
    openNode(state, data, "boarding_conflict", "seat_start");
    pick(data, state, "seat_check");
    const checked = findNode(data, "boarding_conflict", "seat_checked")!;
    expect(visibleOptions(checked, state).some((item) => item.id === "seat_spare")).toBe(false);
    pick(data, state, "seat_wait_np");
    const npGuidance = findNode(data, "boarding_conflict", "seat_np_guidance")!;
    expect(visibleOptions(npGuidance, state).some((item) => item.id === "seat_spare")).toBe(true);
    state.resources.availableSeats[data.train.cars[0].id] = 0;
    expect(visibleOptions(npGuidance, state).some((item) => item.id === "seat_spare")).toBe(false);
  });

  it("принятие фотографии документа создаёт критичный риск и эскалируется к ЛНП", () => {
    const data = boardingUnderPressureScenario();
    const state = createSim(data);
    openNode(state, data, "boarding_identity", "identity_start");
    const photo = findNode(data, "boarding_identity", "identity_start")!.options.find((item) => item.id === "identity_photo")!;

    expect(resolveOutcome(photo, state).effects.safety).toBe(-15);
    pick(data, state, "identity_photo");
    expect(state.flags["boarding.identity_photo_accepted"]).toBe(true);
    expect(state.flags["boarding.np_called"]).toBe(true);
  });

  it("посадка разворачивает несколько обращений и отложенное последствие", () => {
    const data = boardingUnderPressureScenario();
    expect(data.events.map((event) => event.id)).toEqual([
      "boarding_ticket",
      "boarding_phone",
      "boarding_identity",
      "boarding_luggage",
      "boarding_conflict",
      "boarding_followup",
    ]);
    expect(data.events.slice(0, 5).map((event) => event.trigger)).toEqual([
      { type: "time", atSec: 2 },
      { type: "time", atSec: 10 },
      { type: "time", atSec: 18 },
      { type: "time", atSec: 32 },
      { type: "time", atSec: 46 },
    ]);
    expect(data.events[5].trigger).toEqual({
      type: "condition",
      if: { any: [{ flag: "boarding.unverified_boarding" }, { flag: "boarding.unverified_promise" }] },
    });
  });

  it("три новых сценария валидны и несут этапы событий", () => {
    const scenarios = [boardingUnderPressureScenario(), serviceByClassEquipmentScenario(), accessibilityCommunicationScenario()];
    for (const data of scenarios) {
      expect(scenarioDataSchema.safeParse(data).success).toBe(true);
      expect(data.events.every((event) => event.stage)).toBe(true);
    }
  });

  it("доступная коммуникация начинается с ведомости, подтверждает понимание и учитывает короткую остановку", () => {
    const data = accessibilityCommunicationScenario();
    const manifest = data.events.find((event) => event.id === "boarding_manifest_check")!;
    const stop = data.events.find((event) => event.id === "stop_announcement")!;

    expect(data.gameplay).toBe("concurrent");
    expect(manifest.stage).toBe("boarding");
    expect(manifest.trigger).toEqual({ type: "time", atSec: 2 });
    expect(manifest.nodes[0].options.find((option) => option.id === "b1a")?.correct).toBe(true);
    expect(data.actors.find((actor) => actor.id === "vision_companion")?.ticket?.seat).toBe("3D");
    expect(data.actors.find((actor) => actor.id === "unconfirmed_support_requester")?.ticket?.seat).toBe("4A");
    expect(findNode(data, "hearing_message", "h2")?.options.find((option) => option.id === "h2a")?.next).toBe("h3");
    expect(findNode(data, "vision_orientation", "v2")?.options.find((option) => option.id === "v2a")?.next).toBe("v3");
    expect(findNode(data, "vision_orientation", "v1")?.options.find((option) => option.id === "v1c")?.correct).not.toBe(true);
    expect(findNode(data, "unconfirmed_support_request", "u1")?.options.find((option) => option.id === "u1a")?.correct).toBe(true);
    expect(stop.responseWindowSec).toBe(8);
    expect(stop.urgency).toBe("urgent");
  });

  it("контекст medicine усиливает один и тот же ответ после наблюдения ухудшения", () => {
    const data = onboardScenario();
    const option = findNode(data, "ev_medicine", "m3")!.options.find((item) => item.id === "m3a")!;
    const state = createSim(data);
    expect(resolveOutcome(option, state).effects.safety).toBe(10);
    state.flags.condition_worsening = true;
    expect(resolveOutcome(option, state).effects.safety).toBe(15);
  });
});

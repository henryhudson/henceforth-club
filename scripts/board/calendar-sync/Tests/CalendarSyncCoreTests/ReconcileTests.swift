import Testing
import Foundation
@testable import CalendarSyncCore

private func dc(_ d: Int) -> DateComponents { DateComponents(year: 2026, month: 7, day: d) }
private func desired(_ d: Int, _ title: String, _ notes: String = "n") -> DesiredEvent {
    DesiredEvent(date: dc(d), title: title, notes: notes)
}
private func existing(_ id: String, _ d: Int, _ title: String, _ notes: String = "n") -> ExistingEvent {
    ExistingEvent(id: id, date: dc(d), title: title, notes: notes)
}

@Suite("Reconciliation")
struct ReconcileTests {
    @Test("a planned day with no event is created")
    func creates() {
        let r = reconcile(desired: [desired(22, "Ship day")], existing: [])
        #expect(r.create == [desired(22, "Ship day")])
        #expect(r.update.isEmpty)
        #expect(r.delete.isEmpty)
    }

    @Test("running twice changes nothing the second time")
    func idempotent() {
        let d = [desired(22, "Ship day"), desired(24, "Sci Fri")]
        let e = [existing("a", 22, "Ship day"), existing("b", 24, "Sci Fri")]
        let r = reconcile(desired: d, existing: e)
        #expect(r.isEmpty)
    }

    @Test("a reworded task updates in place rather than deleting and recreating")
    func updates() {
        let r = reconcile(desired: [desired(22, "New wording")], existing: [existing("a", 22, "Old wording")])
        #expect(r.update == [EventUpdate(id: "a", event: desired(22, "New wording"))])
        #expect(r.create.isEmpty)
        #expect(r.delete.isEmpty)
    }

    @Test("changed notes alone are enough to trigger an update")
    func notesChanged() {
        let r = reconcile(desired: [desired(22, "Same", "new notes")],
                          existing: [existing("a", 22, "Same", "old notes")])
        #expect(r.update.count == 1)
    }

    @Test("an event whose date left the plan is deleted")
    func deletes() {
        let r = reconcile(desired: [desired(22, "Ship day")], existing: [existing("gone", 21, "Old day")])
        #expect(r.delete == ["gone"])
        #expect(r.create == [desired(22, "Ship day")])
    }

    @Test("two events on one date keep the first and delete the rest")
    func duplicates() {
        let r = reconcile(desired: [desired(22, "Ship day")],
                          existing: [existing("keep", 22, "Ship day"), existing("dupe", 22, "Ship day")])
        #expect(r.delete == ["dupe"])
        #expect(r.update.isEmpty)
    }

    @Test("an empty plan deletes nothing at all")
    func emptyPlanIsNeverADeletion() {
        let r = reconcile(desired: [], existing: [existing("a", 22, "Ship day"), existing("b", 24, "Sci Fri")])
        #expect(r.isEmpty)
        #expect(r.delete.isEmpty)
    }
}

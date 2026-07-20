import Testing
import Foundation
@testable import CalendarSyncCore

private func day(
    _ d: Int, ship: Bool = false, tasks: [PlannedTask], shipped: [String] = []
) -> PlannedDay {
    PlannedDay(
        date: DateComponents(year: 2026, month: 7, day: d),
        isShipDay: ship, tasks: tasks, shipped: shipped
    )
}

@Suite("Event titles")
struct EventTitleTests {
    @Test("a single short task is the whole title")
    func singleTask() {
        let t = eventTitle(for: day(24, tasks: [PlannedTask(label: "Sci Fri", done: false)]))
        #expect(t == "Sci Fri")
    }

    @Test("a ship day is announced in words, not a symbol")
    func shipDay() {
        let t = eventTitle(for: day(22, ship: true, tasks: [PlannedTask(label: "Deck 1.26", done: false)]))
        #expect(t == "Ship day, Deck 1.26")
    }

    @Test("the remaining tasks are counted in words")
    func counted() {
        let two = eventTitle(for: day(20, tasks: [
            PlannedTask(label: "First", done: false), PlannedTask(label: "Second", done: false),
        ]))
        #expect(two == "First, plus one more")

        let four = eventTitle(for: day(20, tasks: (1...4).map { PlannedTask(label: "T\($0)", done: false) }))
        #expect(four == "T1, plus three more")
    }

    @Test("a long label is cut on a word boundary, never mid-word")
    func truncation() {
        let long = "SHIP: Deck of Cards 1.26 the free app is the only real funnel this week and the listing goes with it"
        let t = eventTitle(for: day(22, tasks: [PlannedTask(label: long, done: false)]))
        #expect(t.count <= 61)                       // 60 plus the ellipsis
        #expect(t.hasSuffix("\u{2026}"))
        #expect(!t.contains("fun\u{2026}"))           // did not split a word
        #expect(long.hasPrefix(t.dropLast()))         // it is a genuine prefix
    }
}

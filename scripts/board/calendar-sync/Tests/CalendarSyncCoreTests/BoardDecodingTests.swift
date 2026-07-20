import Testing
import Foundation
@testable import CalendarSyncCore

private func decodeWeek(_ json: String) throws -> WeekRecord {
    try JSONDecoder().decode(WeekRecord.self, from: Data(json.utf8))
}

@Suite("Board decoding")
struct BoardDecodingTests {
    let weekJSON = """
    {"retro":{"weekPlan":[
      {"date":"2026-07-22","weekday":"Wed","isShipDay":true,"isReviewDay":false,
       "tasks":[{"label":"Ship Deck 1.26","done":false}]},
      {"date":"2026-07-25","weekday":"Sat","isShipDay":false,"isReviewDay":false,"tasks":[]}
    ]}}
    """

    @Test("a plan day becomes a planned day with date components, not an instant")
    func daysDecode() throws {
        let days = plannedDays(weeks: [try decodeWeek(weekJSON)], cards: [])
        #expect(days.count == 1)                       // the empty Saturday is dropped
        #expect(days[0].date.year == 2026)
        #expect(days[0].date.month == 7)
        #expect(days[0].date.day == 22)
        #expect(days[0].isShipDay)
        #expect(days[0].tasks == [PlannedTask(label: "Ship Deck 1.26", done: false)])
    }

    @Test("a day with no tasks produces no planned day at all")
    func emptyDayDropped() throws {
        let days = plannedDays(weeks: [try decodeWeek(weekJSON)], cards: [])
        #expect(!days.contains { $0.date.day == 25 })
    }

    @Test("the older review-day flag also counts as a ship marker")
    func legacyFlag() throws {
        let legacy = """
        {"retro":{"weekPlan":[{"date":"2026-07-15","weekday":"Wed","isReviewDay":true,
         "tasks":[{"label":"Old style","done":true}]}]}}
        """
        let days = plannedDays(weeks: [try decodeWeek(legacy)], cards: [])
        #expect(days[0].isShipDay)
    }

    @Test("done cards attach to the day they were finished")
    func shippedAttaches() throws {
        let cards = [
            BoardCard(id: "a", title: "VoiceOver fix", col: "done", doneAt: "2026-07-22T10:45:00+01:00", movedAt: nil),
            BoardCard(id: "b", title: "Still open", col: "review", doneAt: nil, movedAt: nil),
            BoardCard(id: "c", title: "Older card", col: "done", doneAt: nil, movedAt: "2026-07-22T09:00:00+01:00"),
        ]
        let days = plannedDays(weeks: [try decodeWeek(weekJSON)], cards: cards)
        #expect(days[0].shipped == ["VoiceOver fix", "Older card"])
    }

    @Test("duplicate dates across week records are merged, not repeated")
    func noDuplicateDates() throws {
        let days = plannedDays(weeks: [try decodeWeek(weekJSON), try decodeWeek(weekJSON)], cards: [])
        #expect(days.count == 1)
    }

    @Test("a task written as a bare string decodes alongside one written as an object")
    func mixedTaskShapes() throws {
        // Both forms appear in the live records, sometimes within one day.
        // A bare string carries no completion marker, so it reads as not done.
        let mixed = """
        {"retro":{"weekPlan":[{"date":"2026-07-18","weekday":"Sat","isReviewDay":false,
         "tasks":[{"label":"Object form","done":true},"Bare string form"]}]}}
        """
        let days = plannedDays(weeks: [try decodeWeek(mixed)], cards: [])
        #expect(days.count == 1)
        #expect(days[0].tasks == [
            PlannedTask(label: "Object form", done: true),
            PlannedTask(label: "Bare string form", done: false),
        ])
    }

    @Test("days that cross a month boundary come back in true chronological order")
    func monthBoundaryOrdering() throws {
        // "9" sorts after "1" as a string, so an unpadded string sort would
        // put October 3rd before September 30th. Supply them reversed and
        // out of order to prove the sort is numeric, not lexical.
        let crossingMonths = """
        {"retro":{"weekPlan":[
          {"date":"2026-10-03","weekday":"Sat","isShipDay":false,"isReviewDay":false,
           "tasks":[{"label":"October task","done":false}]},
          {"date":"2026-09-30","weekday":"Wed","isShipDay":false,"isReviewDay":false,
           "tasks":[{"label":"September task","done":false}]}
        ]}}
        """
        let days = plannedDays(weeks: [try decodeWeek(crossingMonths)], cards: [])
        #expect(days.count == 2)
        #expect(days[0].date.month == 9)
        #expect(days[0].date.day == 30)
        #expect(days[1].date.month == 10)
        #expect(days[1].date.day == 3)
    }
}

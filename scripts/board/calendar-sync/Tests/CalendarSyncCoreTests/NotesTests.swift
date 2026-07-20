import Testing
import Foundation
@testable import CalendarSyncCore

@Suite("Event notes")
struct EventNotesTests {
    private let sample = PlannedDay(
        date: DateComponents(year: 2026, month: 7, day: 22),
        isShipDay: true,
        tasks: [
            PlannedTask(label: "Ship Deck of Cards 1.26", done: false),
            PlannedTask(label: "Correct the store listing", done: true),
        ],
        shipped: ["Deck VoiceOver count fix", "Register binding hole closed"]
    )

    @Test("the plan is listed with each task marked in words")
    func plan() {
        let n = eventNotes(for: sample)
        #expect(n.contains("PLAN"))
        #expect(n.contains("to do   Ship Deck of Cards 1.26"))
        #expect(n.contains("done    Correct the store listing"))
    }

    @Test("what shipped that day is listed under its own heading")
    func shipped() {
        let n = eventNotes(for: sample)
        #expect(n.contains("SHIPPED TODAY"))
        #expect(n.contains("Deck VoiceOver count fix"))
    }

    @Test("the board link is always the last line")
    func link() {
        let n = eventNotes(for: sample)
        #expect(n.hasSuffix("https://henceforth.club/board/week"))
    }

    @Test("a day with nothing shipped omits that heading entirely")
    func nothingShipped() {
        let bare = PlannedDay(
            date: DateComponents(year: 2026, month: 7, day: 23),
            isShipDay: false,
            tasks: [PlannedTask(label: "Only this", done: false)],
            shipped: []
        )
        let n = eventNotes(for: bare)
        #expect(!n.contains("SHIPPED TODAY"))
        #expect(n.contains("Only this"))
    }

    @Test("no pictographic characters reach the calendar")
    func wordsOnly() {
        let n = eventNotes(for: sample) + eventTitle(for: sample)
        for scalar in n.unicodeScalars {
            // Deliberately NOT isEmoji: that property is true for the ASCII
            // digits and for # and *, since they are emoji BASE characters
            // forming keycap sequences, so a title holding "1.26" would fail.
            // isEmojiPresentation means "renders as a picture by default"; the
            // variation selector is checked separately because it is what
            // turns a plain dingbat into its emoji form.
            let isPicture = scalar.properties.isEmojiPresentation || scalar.value == 0xFE0F
            #expect(!isPicture, "found a pictographic character: \(scalar)")
        }
    }
}

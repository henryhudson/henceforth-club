import Foundation
import EventKit
import CalendarSyncCore

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data(("calendar-sync: " + message + "\n").utf8))
    exit(1)
}

// ---- environment -------------------------------------------------------
// .env.local is not exported into this process the way node's own env-file
// option does it, so read the two keys directly.
func loadEnv(_ path: String) -> [String: String] {
    guard let text = try? String(contentsOfFile: path, encoding: .utf8) else { return [:] }
    var out: [String: String] = [:]
    for line in text.split(separator: "\n") {
        // .whitespacesAndNewlines, not .whitespaces, so a trailing carriage
        // return left behind by a Windows line ending is trimmed along with
        // the surrounding spaces rather than becoming part of the value.
        var trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("export"), let afterExport = trimmed.dropFirst(6).first, afterExport.isWhitespace {
            trimmed = trimmed.dropFirst(6).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        guard !trimmed.hasPrefix("#"), let equals = trimmed.firstIndex(of: "=") else { continue }
        let key = trimmed[trimmed.startIndex..<equals].trimmingCharacters(in: .whitespaces)
        var value = trimmed[trimmed.index(after: equals)...].trimmingCharacters(in: .whitespaces)
        if value.hasPrefix("\"") && value.hasSuffix("\"") && value.count >= 2 {
            value = String(value.dropFirst().dropLast())
        }
        out[key] = value
    }
    return out
}

func setting(_ names: [String], _ env: [String: String]) -> String? {
    names.lazy
        .compactMap { ProcessInfo.processInfo.environment[$0] ?? env[$0] }
        .first { !$0.isEmpty }
}

// ---- the store, over its rest interface --------------------------------
/// Every reply arrives wrapped in a result field; a get returns a JSON string.
private struct Envelope<Payload: Decodable>: Decodable { let result: Payload? }

struct Upstash {
    let baseURL: String
    let token: String

    private func command(_ pathParts: [String]) async throws -> Data {
        let path = pathParts
            .map { $0.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? $0 }
            .joined(separator: "/")
        guard let url = URL(string: baseURL + "/" + path) else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 20
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            throw URLError(.badServerResponse)
        }
        return data
    }

    func keys(matching pattern: String) async throws -> [String] {
        let data = try await command(["keys", pattern])
        return try JSONDecoder().decode(Envelope<[String]>.self, from: data).result ?? []
    }

    /// The stored value is itself a JSON document, returned as a string.
    func document(at key: String) async throws -> String? {
        let data = try await command(["get", key])
        return try JSONDecoder().decode(Envelope<String>.self, from: data).result
    }
}

func decode<Value: Decodable>(_ type: Value.Type, from document: String) throws -> Value {
    try JSONDecoder().decode(type, from: Data(document.utf8))
}

// ---- dates -------------------------------------------------------------
// The same reduction the library performs, repeated here on purpose: the
// shell has to be able to tell a day whose date it could not read from a day
// the library dropped by design. Nothing here ever builds an instant.
func dayComponents(fromPlainDate text: String) -> DateComponents? {
    let parts = text.prefix(10).split(separator: "-")
    guard parts.count == 3,
          let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]) else { return nil }
    return DateComponents(year: year, month: month, day: day)
}

func dayKey(_ components: DateComponents) -> String {
    "\(components.year ?? 0)-\(components.month ?? 0)-\(components.day ?? 0)"
}

// ---- ad-hoc appointments ----------------------------------------------
// `calendar-sync add <YYYY-MM-DD> <title> [note]` books one all-day event
// with a morning alarm into the "Board Appointments" calendar. That is a
// SEPARATE calendar from "Morning Board" on purpose: the sync reconciler
// owns and prunes Morning Board, so an ad-hoc event placed there would be
// deleted on the next sync. Same binary as the sync, so the calendar
// permission granted once covers this path — no new prompt, and no .ics
// import click (the friction Henry asked to remove, 2026-08-21).
@MainActor
func addAppointment(dateText: String, title: String, note: String?) async {
    guard let components = dayComponents(fromPlainDate: dateText) else {
        fail("the date must be YYYY-MM-DD, got: \(dateText)")
    }
    let events = EKEventStore()
    let granted: Bool
    do { granted = try await events.requestFullAccessToEvents() }
    catch { fail("calendar access could not be requested: \(error.localizedDescription)") }
    guard granted else {
        fail("calendar access was refused. Grant it in System Settings, Privacy and Security, Calendars.")
    }

    let calendarName = "Board Appointments"
    let target: EKCalendar
    if let found = events.calendars(for: .event).first(where: { $0.title == calendarName }) {
        target = found
    } else {
        guard let source = events.sources.first(where: { $0.sourceType == .calDAV && $0.title == "iCloud" }) else {
            fail("no calendar account titled iCloud was found, so a new calendar would not reach the phone.")
        }
        let made = EKCalendar(for: .event, eventStore: events)
        made.title = calendarName
        made.source = source
        do { try events.saveCalendar(made, commit: true) }
        catch { fail("could not create the appointments calendar: \(error.localizedDescription)") }
        target = made
    }

    let calendar = Calendar.current
    guard let day = calendar.date(from: components).map({ calendar.startOfDay(for: $0) }) else {
        fail("could not resolve the date \(dateText)")
    }
    // Same day + same title is the same appointment: update it, never duplicate,
    // so a routine can re-book without checking first.
    let predicate = events.predicateForEvents(
        withStart: day,
        end: calendar.date(byAdding: .day, value: 1, to: day) ?? day,
        calendars: [target]
    )
    let found = events.events(matching: predicate).first(where: { $0.title == title })
    let event = found ?? EKEvent(eventStore: events)
    event.calendar = target
    event.title = title
    event.notes = note
    event.isAllDay = true
    event.startDate = day
    event.endDate = day
    if (event.alarms ?? []).isEmpty { event.addAlarm(EKAlarm(relativeOffset: 9 * 3600)) }
    do { try events.save(event, span: .thisEvent, commit: true) }
    catch { fail("could not save the appointment: \(error.localizedDescription)") }
    print("calendar-sync: \(found == nil ? "booked" : "updated") \(dateText) — \(title)")
}

@MainActor
func run() async {
    let calendarName = "Morning Board"
    let repoRoot = FileManager.default.currentDirectoryPath
    let env = loadEnv(repoRoot + "/.env.local")

    guard let baseURL = setting(["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"], env),
          let token = setting(["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"], env) else {
        fail("credentials for the store were not found. Run this from the henceforth-club root, where .env.local lives.")
    }
    let store = Upstash(baseURL: baseURL, token: token)

    let weekKeys: [String]
    do { weekKeys = try await store.keys(matching: "board:week:*") }
    catch { fail("could not list week records: \(error.localizedDescription)") }

    // An empty read is an error, never a deletion. See spec decision four.
    guard !weekKeys.isEmpty else { fail("no week records found. Refusing to touch the calendar.") }

    // The store's key listing order is not contractual. plannedDays overwrites
    // by date unconditionally when the same date appears in two week records,
    // so whichever record is decoded last wins that date. The keys embed an
    // ISO date, so sorting them ascending makes the newest record the one
    // decoded last, and therefore the one that deterministically wins,
    // instead of leaving the winner to whatever order the store returns.
    let sortedWeekKeys = weekKeys.sorted()

    let weeks: [WeekRecord]
    let cards: [BoardCard]
    do {
        var found: [WeekRecord] = []
        for key in sortedWeekKeys {
            // A listed key that fetches to nothing must fail loudly, not be
            // skipped. The days below are derived only from weeks that did
            // load, so the partial-loss guard further down never sees a week
            // that vanished between the listing and the fetch: it would read
            // as a week with no plan at all, and every date that belonged to
            // it would sync as no longer planned and have its events deleted.
            guard let document = try await store.document(at: key) else {
                fail("week record \(key) was listed but fetched to nothing.")
            }
            found.append(try decode(WeekRecord.self, from: document))
        }
        weeks = found
        struct Board: Decodable, Sendable { let cards: [BoardCard]? }
        cards = try await store.document(at: "board:latest")
            .map { try decode(Board.self, from: $0) }?.cards ?? []
    } catch { fail("could not read the board: \(error.localizedDescription)") }

    let days = plannedDays(weeks: weeks, cards: cards)
    guard !days.isEmpty else { fail("the plan decoded to no days. Refusing to touch the calendar.") }

    // A day lost to a date the tool could not read would sync as a quietly
    // incomplete calendar, deleting the events for the days that vanished.
    // Nothing below this point runs until every planned day is accounted for.
    let planDays = weeks.flatMap { $0.retro?.weekPlan ?? [] }
    let unreadable = planDays.map(\.date).filter { dayComponents(fromPlainDate: $0) == nil }
    guard unreadable.isEmpty else {
        fail("""
        \(unreadable.count) plan day or days carry a date this tool cannot read: \
        \(unreadable.joined(separator: ", ")). Syncing now would leave those days out of \
        the calendar and delete whatever is already sitting on them. Refusing to touch the calendar.
        """)
    }

    // A day with nothing planned gets no event by design, so it is expected to
    // be absent rather than lost. See spec decision three.
    let expected = Set(planDays.compactMap { planDay -> String? in
        guard let components = dayComponents(fromPlainDate: planDay.date),
              !(planDay.tasks ?? []).isEmpty else { return nil }
        return dayKey(components)
    })
    let produced = Set(days.map { dayKey($0.date) })
    guard produced == expected else {
        let lost = expected.subtracting(produced).sorted()
        fail("""
        the plan has \(expected.count) days to sync but \(produced.count) survived decoding, \
        missing \(lost.joined(separator: ", ")). Refusing to touch the calendar.
        """)
    }

    // ---- calendar ------------------------------------------------------
    let events = EKEventStore()
    let granted: Bool
    do { granted = try await events.requestFullAccessToEvents() }
    catch { fail("calendar access could not be requested: \(error.localizedDescription)") }
    guard granted else {
        fail("calendar access was refused. Grant it in System Settings, Privacy and Security, Calendars.")
    }

    let calendar = Calendar.current
    func startOfDay(_ components: DateComponents) -> Date? {
        calendar.date(from: components).map { calendar.startOfDay(for: $0) }
    }

    let target: EKCalendar
    if let found = events.calendars(for: .event).first(where: { $0.title == calendarName }) {
        target = found
    } else {
        let calDAVSources = events.sources.filter { $0.sourceType == .calDAV }
        guard !calDAVSources.isEmpty else {
            fail("no iCloud calendar account was found, so a new calendar would not reach the phone.")
        }
        guard let source = calDAVSources.first(where: { $0.title == "iCloud" }) else {
            let candidates = calDAVSources.map(\.title).joined(separator: ", ")
            fail("""
            no calendar account titled iCloud was found. Candidate accounts seen: \(candidates). \
            Refusing to guess which one to create the calendar in.
            """)
        }
        let made = EKCalendar(for: .event, eventStore: events)
        made.title = calendarName
        made.source = source
        do { try events.saveCalendar(made, commit: true) }
        catch { fail("could not create the calendar: \(error.localizedDescription)") }
        target = made
    }

    // Read back what is already there, across the whole span the plan covers.
    let bounds = days.compactMap { startOfDay($0.date) }
    guard let earliest = bounds.min(), let latest = bounds.max() else {
        fail("could not resolve the plan's date range.")
    }
    let predicate = events.predicateForEvents(
        withStart: calendar.date(byAdding: .day, value: -1, to: earliest) ?? earliest,
        end: calendar.date(byAdding: .day, value: 1, to: latest) ?? latest,
        calendars: [target]
    )
    let existing: [ExistingEvent] = events.events(matching: predicate).compactMap { event in
        guard let identifier = event.eventIdentifier else { return nil }
        let components = calendar.dateComponents([.year, .month, .day], from: event.startDate)
        return ExistingEvent(
            id: identifier,
            date: components,
            title: event.title ?? "",
            notes: event.notes ?? ""
        )
    }

    let desired = days.map {
        DesiredEvent(date: $0.date, title: eventTitle(for: $0), notes: eventNotes(for: $0))
    }
    // Known limitation: a recurring event manually placed in the Morning
    // Board calendar shares one identifier across every occurrence, so this
    // reconciliation can never converge on it. Nothing here detects or works
    // around that case.
    let plan = reconcile(desired: desired, existing: existing)

    // ---- apply ---------------------------------------------------------
    var failures = 0
    func apply(_ event: EKEvent, _ want: DesiredEvent) -> Bool {
        guard let start = startOfDay(want.date) else { return false }
        event.calendar = target
        event.title = want.title
        event.notes = want.notes
        event.isAllDay = true
        event.startDate = start
        event.endDate = start
        do {
            try events.save(event, span: .thisEvent, commit: false)
            return true
        } catch {
            FileHandle.standardError.write(
                Data("  could not save \(want.title): \(error.localizedDescription)\n".utf8)
            )
            return false
        }
    }

    for want in plan.create where !apply(EKEvent(eventStore: events), want) { failures += 1 }
    for change in plan.update {
        guard let event = events.event(withIdentifier: change.id) else { failures += 1; continue }
        // EventKit identifiers are not unique across calendars, so the same
        // identifier resolved here could belong to an event on a calendar
        // Henry never asked this tool to touch. Refuse rather than relocate
        // or overwrite it.
        guard event.calendar == target else { failures += 1; continue }
        if !apply(event, change.event) { failures += 1 }
    }
    for identifier in plan.delete {
        guard let event = events.event(withIdentifier: identifier) else { continue }
        // Same identifier collision risk as the update branch above: never
        // remove an event that did not resolve into the Morning Board
        // calendar.
        guard event.calendar == target else { failures += 1; continue }
        do { try events.remove(event, span: .thisEvent, commit: false) } catch { failures += 1 }
    }
    do { try events.commit() }
    catch { fail("could not commit the calendar changes: \(error.localizedDescription)") }

    print("""
    calendar-sync: \(plan.create.count) created, \(plan.update.count) updated, \
    \(plan.delete.count) removed, across \(days.count) planned days
    """)
    if failures > 0 { fail("\(failures) events failed to save") }
}

let arguments = Array(CommandLine.arguments.dropFirst())
if arguments.first == "add" {
    guard arguments.count >= 3 else {
        fail("usage: calendar-sync add <YYYY-MM-DD> <title> [note]")
    }
    await addAppointment(
        dateText: arguments[1],
        title: arguments[2],
        note: arguments.count > 3 ? arguments[3] : nil
    )
} else {
    await run()
}

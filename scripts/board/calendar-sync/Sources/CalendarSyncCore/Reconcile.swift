import Foundation

public struct ExistingEvent: Equatable, Sendable {
    public let id: String
    public let date: DateComponents
    public let title: String
    public let notes: String
    public init(id: String, date: DateComponents, title: String, notes: String) {
        self.id = id; self.date = date; self.title = title; self.notes = notes
    }
}

public struct EventUpdate: Equatable, Sendable {
    public let id: String
    public let event: DesiredEvent
    public init(id: String, event: DesiredEvent) { self.id = id; self.event = event }
}

public struct Reconciliation: Equatable, Sendable {
    public let create: [DesiredEvent]
    public let update: [EventUpdate]
    public let delete: [String]
    public init(create: [DesiredEvent], update: [EventUpdate], delete: [String]) {
        self.create = create; self.update = update; self.delete = delete
    }
    public var isEmpty: Bool { create.isEmpty && update.isEmpty && delete.isEmpty }
    public static let empty = Reconciliation(create: [], update: [], delete: [])
}

/// Compare by day, never by instant: an all-day event's stored start is an
/// instant, and comparing instants across a timezone change lands on the
/// wrong day. See spec decision 5.
private func key(_ c: DateComponents) -> String {
    "\(c.year ?? 0)-\(c.month ?? 0)-\(c.day ?? 0)"
}

/// The fields that decide whether an existing event needs updating in place.
/// This is the complete set: title and notes are the only mutable content
/// DesiredEvent carries. If a field is ever added to DesiredEvent, it must
/// be added here too, or it will silently stop being detected.
private func needsUpdate(_ keep: ExistingEvent, _ want: DesiredEvent) -> Bool {
    keep.title != want.title || keep.notes != want.notes
}

public func reconcile(desired: [DesiredEvent], existing: [ExistingEvent]) -> Reconciliation {
    // An empty plan is a failed read, not an instruction to empty the
    // calendar. Refusing here is the last line of defence; the shell also
    // refuses before it ever calls this. See spec decision 4.
    guard !desired.isEmpty else { return .empty }

    // One event per date is the invariant on the desired side too: a second
    // desired event for a date already claimed would otherwise get created,
    // then deleted and recreated forever since nothing ever consumes its
    // date. Keep the first and ignore the rest so the result converges.
    var seenDates: Set<String> = []
    let desired = desired.filter { seenDates.insert(key($0.date)).inserted }

    var byDate: [String: [ExistingEvent]] = [:]
    for event in existing { byDate[key(event.date), default: []].append(event) }

    var create: [DesiredEvent] = []
    var update: [EventUpdate] = []
    var delete: [String] = []

    for want in desired {
        let matches = byDate.removeValue(forKey: key(want.date)) ?? []
        guard let keep = matches.first else {
            create.append(want)
            continue
        }
        // One event per date is the invariant. Extras can only come from a bug
        // or a manual edit, so remove them rather than tolerate the ambiguity.
        delete.append(contentsOf: matches.dropFirst().map(\.id))
        if needsUpdate(keep, want) {
            update.append(EventUpdate(id: keep.id, event: want))
        }
    }

    // Whatever is left was on a date the plan no longer contains.
    for leftover in byDate.values.flatMap({ $0 }) { delete.append(leftover.id) }

    return Reconciliation(create: create, update: update, delete: delete.sorted())
}

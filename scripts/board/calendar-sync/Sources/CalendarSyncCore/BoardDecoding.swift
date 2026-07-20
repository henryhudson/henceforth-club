import Foundation

public struct WeekRecord: Decodable, Sendable {
    public struct Retro: Decodable, Sendable { public let weekPlan: [PlanDay]? }
    public struct PlanDay: Decodable, Sendable {
        public let date: String
        public let isShipDay: Bool?
        public let isReviewDay: Bool?
        public let tasks: [Task]?
    }
    public struct Task: Decodable, Sendable { public let label: String; public let done: Bool? }
    public let retro: Retro?
}

public struct BoardCard: Decodable, Sendable {
    public let id: String
    public let title: String
    public let col: String
    public let doneAt: String?
    public let movedAt: String?
    public init(id: String, title: String, col: String, doneAt: String?, movedAt: String?) {
        self.id = id; self.title = title; self.col = col; self.doneAt = doneAt; self.movedAt = movedAt
    }
}

/// The plan stores plain dates ("2026-07-22") and the cards store timestamps.
/// Both reduce to a year, month and day by taking the first ten characters;
/// nothing here ever builds an instant. See spec decision 5.
private func components(fromPlainDate s: String) -> DateComponents? {
    let parts = s.prefix(10).split(separator: "-")
    guard parts.count == 3,
          let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else { return nil }
    return DateComponents(year: y, month: m, day: d)
}

private func dayKey(_ c: DateComponents) -> String {
    "\(c.year ?? 0)-\(c.month ?? 0)-\(c.day ?? 0)"
}

public func plannedDays(weeks: [WeekRecord], cards: [BoardCard]) -> [PlannedDay] {
    var shippedByDay: [String: [String]] = [:]
    for card in cards where card.col == "done" {
        guard let stamp = card.doneAt ?? card.movedAt,
              let c = components(fromPlainDate: stamp) else { continue }
        shippedByDay[dayKey(c), default: []].append(card.title)
    }

    var byDate: [String: PlannedDay] = [:]
    for week in weeks {
        for planDay in week.retro?.weekPlan ?? [] {
            guard let c = components(fromPlainDate: planDay.date) else { continue }
            let tasks = (planDay.tasks ?? []).map {
                PlannedTask(label: $0.label, done: $0.done ?? false)
            }
            // A day with nothing planned gets no event. See spec decision 3.
            guard !tasks.isEmpty else { continue }
            byDate[dayKey(c)] = PlannedDay(
                date: c,
                isShipDay: (planDay.isShipDay ?? false) || (planDay.isReviewDay ?? false),
                tasks: tasks,
                shipped: shippedByDay[dayKey(c)] ?? []
            )
        }
    }
    // Sort on the numeric components, not the dayKey string: an unpadded
    // string sort orders "2026-9-3" after "2026-10-3" because "9" sorts
    // after "1", which would put a September date after an October one.
    return byDate.values.sorted { lhs, rhs in
        let lhsParts = (lhs.date.year ?? 0, lhs.date.month ?? 0, lhs.date.day ?? 0)
        let rhsParts = (rhs.date.year ?? 0, rhs.date.month ?? 0, rhs.date.day ?? 0)
        return lhsParts < rhsParts
    }
}

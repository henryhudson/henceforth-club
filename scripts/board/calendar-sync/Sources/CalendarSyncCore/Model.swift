import Foundation

public struct PlannedTask: Equatable, Sendable {
    public let label: String
    public let done: Bool
    public init(label: String, done: Bool) { self.label = label; self.done = done }
}

/// One day of the week plan, with whatever the board finished on that date.
public struct PlannedDay: Equatable, Sendable {
    public let date: DateComponents
    public let isShipDay: Bool
    public let tasks: [PlannedTask]
    public let shipped: [String]
    public init(date: DateComponents, isShipDay: Bool, tasks: [PlannedTask], shipped: [String]) {
        self.date = date; self.isShipDay = isShipDay; self.tasks = tasks; self.shipped = shipped
    }
}

public struct DesiredEvent: Equatable, Sendable {
    public let date: DateComponents
    public let title: String
    public let notes: String
    public init(date: DateComponents, title: String, notes: String) {
        self.date = date; self.title = title; self.notes = notes
    }
}

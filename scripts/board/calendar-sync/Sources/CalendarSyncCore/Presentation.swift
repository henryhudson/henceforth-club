import Foundation

/// Small counts read better as words. Above nine the numeral is clearer.
func spelled(_ n: Int) -> String {
    let words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
    return words.indices.contains(n) ? words[n] : String(n)
}

/// A month-view row shows roughly forty characters; board labels run past two
/// hundred because they are written to wrap on the board. Cut on a word.
func truncated(_ s: String, to limit: Int) -> String {
    guard s.count > limit else { return s }
    let head = s.prefix(limit)
    guard let lastSpace = head.lastIndex(of: " ") else { return head + "\u{2026}" }
    return head[head.startIndex..<lastSpace] + "\u{2026}"
}

public func eventTitle(for day: PlannedDay) -> String {
    guard let first = day.tasks.first else { return "" }
    var title = truncated(first.label, to: 60)
    if day.isShipDay { title = "Ship day, " + title }
    let rest = day.tasks.count - 1
    if rest > 0 { title += ", plus \(spelled(rest)) more" }
    return title
}

public func eventNotes(for day: PlannedDay) -> String {
    var lines: [String] = ["PLAN"]
    for task in day.tasks {
        lines.append("  \(task.done ? "done    " : "to do   ")\(task.label)")
    }
    if !day.shipped.isEmpty {
        lines.append("")
        lines.append("SHIPPED TODAY")
        for title in day.shipped { lines.append("  \(title)") }
    }
    lines.append("")
    lines.append("https://henceforth.club/board/week")
    return lines.joined(separator: "\n")
}

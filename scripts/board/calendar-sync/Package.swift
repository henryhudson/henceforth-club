// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "calendar-sync",
    platforms: [.macOS(.v14)],
    targets: [
        .target(name: "CalendarSyncCore"),
        .executableTarget(name: "calendar-sync", dependencies: ["CalendarSyncCore"]),
        .testTarget(name: "CalendarSyncCoreTests", dependencies: ["CalendarSyncCore"]),
    ]
)

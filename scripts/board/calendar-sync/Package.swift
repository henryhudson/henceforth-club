// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "calendar-sync",
    platforms: [.macOS(.v14)],
    targets: [
        .target(name: "CalendarSyncCore"),
        .executableTarget(
            name: "calendar-sync",
            dependencies: ["CalendarSyncCore"],
            // The plist is linked into __TEXT below, not copied as a resource.
            exclude: ["Info.plist"],
            // A Swift Package Manager executable carries no bundle, so it has
            // nowhere to declare NSCalendarsFullAccessUsageDescription — and
            // without that key EventKit refuses `requestFullAccessToEvents()`
            // IMMEDIATELY AND WITHOUT PROMPTING. Because it never prompts, the
            // binary never registers in System Settings, so the refusal message
            // pointing there describes a list this tool can never appear in.
            // (Diagnosed 2026-09-12 after three mornings of refusals; `otool -s
            // __TEXT __info_plist` on the old binary returned nothing.)
            // Embedding the plist into the executable's __TEXT segment is how a
            // bundle-less tool declares a purpose string.
            linkerSettings: [
                .unsafeFlags([
                    "-Xlinker", "-sectcreate",
                    "-Xlinker", "__TEXT",
                    "-Xlinker", "__info_plist",
                    "-Xlinker", "Sources/calendar-sync/Info.plist",
                ])
            ]
        ),
        .testTarget(name: "CalendarSyncCoreTests", dependencies: ["CalendarSyncCore"]),
    ]
)

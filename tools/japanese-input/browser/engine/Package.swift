// swift-tools-version: 6.4
import PackageDescription
let settings: [SwiftSetting] = [.define("ZenzaiCPU"), .define("Neural"), .enableUpcomingFeature("InternalImportsByDefault")]
let package = Package(
    name: "BrowserInput", dependencies: [
        .package(url: "https://github.com/apple/swift-algorithms", exact: "1.2.1"),
        .package(url: "https://github.com/apple/swift-collections", exact: "1.1.4")
    ], targets: [
        .target(name: "SwiftUtils", dependencies: [.product(name: "Algorithms", package: "swift-algorithms")], swiftSettings: settings),
        .target(name: "EfficientNGram"),
        .target(name: "KanaKanjiConverterModule", dependencies: ["SwiftUtils", "EfficientNGram", .product(name: "Collections", package: "swift-collections")], swiftSettings: settings),
        .target(name: "KanaKanjiConverterModuleWithDefaultDictionary", dependencies: ["KanaKanjiConverterModule"]),
        .executableTarget(name: "BrowserInput", dependencies: ["KanaKanjiConverterModuleWithDefaultDictionary"], swiftSettings: settings, linkerSettings: [.unsafeFlags(["-Xlinker", "--export=convert_json", "-Xlinker", "--export=allocate", "-Xlinker", "--export=release_buffer"])])
    ])

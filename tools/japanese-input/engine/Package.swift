// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "JournalInputEngine",
    platforms: [.iOS(.v16), .macOS(.v13)],
    traits: [.trait(name: "Neural")],
    dependencies: [
        .package(
            path: "../.engines/AzooKeyKanaKanjiConverter",
            traits: [.trait(name: "Zenzai", condition: .when(traits: ["Neural"]))]
        )
    ],
    targets: [
        .executableTarget(
            name: "InputWorker",
            dependencies: [
                .product(
                    name: "KanaKanjiConverterModuleWithDefaultDictionary",
                    package: "AzooKeyKanaKanjiConverter"
                )
            ],
            swiftSettings: [.interoperabilityMode(.Cxx, .when(traits: ["Neural"]))]
        )
    ]
)

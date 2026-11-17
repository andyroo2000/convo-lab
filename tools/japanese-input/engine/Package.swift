// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "JournalInputEngine",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(path: "../.engines/AzooKeyKanaKanjiConverter")
    ],
    targets: [
        .executableTarget(
            name: "InputWorker",
            dependencies: [
                .product(
                    name: "KanaKanjiConverterModuleWithDefaultDictionary",
                    package: "AzooKeyKanaKanjiConverter"
                )
            ]
        )
    ]
)

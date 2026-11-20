// swift-tools-version: 6.1
import PackageDescription
let flags: [SwiftSetting] = [.define("ZenzaiCPU"), .define("Neural"), .enableUpcomingFeature("InternalImportsByDefault"), .interoperabilityMode(.Cxx)]
let package = Package(name: "ServerInput", dependencies: [
    .package(url: "https://github.com/apple/swift-algorithms", exact: "1.2.1"),
    .package(url: "https://github.com/apple/swift-collections", exact: "1.1.4")
], targets: [
    .systemLibrary(name: "llama"),
    .target(name: "SwiftUtils", dependencies: [.product(name: "Algorithms", package: "swift-algorithms")], swiftSettings: flags),
    .target(name: "EfficientNGram"),
    .target(name: "KanaKanjiConverterModule", dependencies: ["SwiftUtils", "EfficientNGram", "llama", .product(name: "Collections", package: "swift-collections")], swiftSettings: flags),
    .target(name: "KanaKanjiConverterModuleWithDefaultDictionary", dependencies: ["KanaKanjiConverterModule"], exclude: ["azooKey_dictionary_storage/README.md", "azooKey_dictionary_storage/LICENSE", "azooKey_emoji_dictionary_storage/data", "azooKey_emoji_dictionary_storage/scripts", "azooKey_emoji_dictionary_storage/requirements.txt", "azooKey_emoji_dictionary_storage/README.md"], resources: [.copy("azooKey_dictionary_storage/Dictionary"), .copy("azooKey_emoji_dictionary_storage/EmojiDictionary")], swiftSettings: flags),
    .executableTarget(name: "InputWorker", dependencies: ["KanaKanjiConverterModuleWithDefaultDictionary"], swiftSettings: flags)
])

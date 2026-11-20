import Foundation
import KanaKanjiConverterModuleWithDefaultDictionary

struct ConversionInput: Decodable {
    let id: String
    let reading: String
    let expanded: Bool?
    let boundaries: [Int]?
}

struct ConversionCandidate: Encodable {
    let text: String
    let reading: String
    let sections: [ConversionSection]
    let units: [ConversionSection]
    var neuralScore: Float? = nil
}

struct ConversionOutput: Encodable {
    let id: String
    let candidates: [ConversionCandidate]
    let engineMs: Double
    let expansion: String?
}

// One sequential worker. Neural inference is an explicit experimental build trait.
let converter = KanaKanjiConverter.withDefaultDictionary()
let boundaryConverter = BoundaryCandidateConverter(dicdataStore: .withDefaultDictionary())
let scratch = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
var options = ConvertRequestOptions(
    needTypoCorrection: false,
    requireJapanesePrediction: false,
    requireEnglishPrediction: false,
    keyboardLanguage: .ja_JP,
    learningType: .nothing,
    memoryDirectoryURL: scratch,
    sharedContainerURL: scratch,
    textReplacer: .withDefaultEmojiDictionary(),
    specialCandidateProviders: KanaKanjiConverter.defaultSpecialCandidateProviders,
    metadata: .init(versionString: "ConvoLab playground")
)

#if Neural
guard CommandLine.arguments.count == 3,
      let inferenceLimit = Int(CommandLine.arguments[2]),
      [1, 5].contains(inferenceLimit),
      FileManager.default.fileExists(atPath: CommandLine.arguments[1]) else {
    fatalError("Neural worker requires a model path and inference limit of 1 or 5")
}
let neuralInferenceLimit = inferenceLimit
let modelURL = URL(fileURLWithPath: CommandLine.arguments[1])
let boundaryRanker = try NeuralBoundaryRanker(modelURL: modelURL)
options.zenzaiMode = .on(
    weight: modelURL,
    inferenceLimit: inferenceLimit,
    personalizationMode: nil,
    versionDependentMode: .v3(.init())
)
#endif

@MainActor func convert(_ request: ConversionInput) throws -> ConversionOutput {
    converter.stopComposition()
    var composition = ComposingText()
    composition.insertAtCursorPosition(request.reading, inputStyle: .direct)
    let start = ContinuousClock.now
    let results = converter.requestCandidates(composition, options: options)
    #if Neural
    // Upstream can fall back to dictionary conversion if model loading fails.
    // Do not accidentally report that fallback as a successful neural run.
    guard converter.zenzStatus == "load \(modelURL.absoluteString)" else {
        fatalError("Neural model did not load")
    }
    #endif
    var pool = results.mainResults
    if let boundaries = request.boundaries, !boundaries.isEmpty {
        pool = try boundaryCandidates(reading: request.reading, boundaries: boundaries, neural: pool, options: options)
    } else if request.expanded == true {
        pool += expandedCandidates(composition, converter: converter, options: options, reference: results.mainResults.first)
    }
    let candidates = serializeCandidates(pool, reading: request.reading, neuralRanked: isNeuralBoundaryRequest(request))
    let elapsed = start.duration(to: .now).components
    let milliseconds = Double(elapsed.seconds) * 1000 + Double(elapsed.attoseconds) / 1e15
    return ConversionOutput(id: request.id, candidates: Array(candidates.prefix(request.expanded == true ? 160 : 10)), engineMs: milliseconds, expansion: request.expanded == true ? "whole-phrase-neural-and-dictionary" : nil)
}

func isNeuralBoundaryRequest(_ request: ConversionInput) -> Bool {
    #if Neural
    return request.boundaries?.isEmpty == false
    #else
    return false
    #endif
}

struct ConversionFailure: Encodable { let id: String; let error: String }

@MainActor func conversionPayload(_ request: ConversionInput) throws -> Data {
    do {
        return try encoder.encode(convert(request))
    } catch {
        return try encoder.encode(ConversionFailure(
            id: request.id, error: "Neural ranking failed. Your text has been kept; try again."
        ))
    }
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
while let line = readLine() {
    do {
        let request = try JSONDecoder().decode(ConversionInput.self, from: Data(line.utf8))
        let output = try conversionPayload(request)
        FileHandle.standardOutput.write(output + Data([10]))
    } catch {
        FileHandle.standardError.write(Data("Invalid conversion request\n".utf8))
    }
}

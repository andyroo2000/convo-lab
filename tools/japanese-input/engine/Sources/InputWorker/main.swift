import Foundation
import KanaKanjiConverterModuleWithDefaultDictionary

struct ConversionInput: Decodable {
    let id: String
    let reading: String
}

struct ConversionCandidate: Encodable {
    let text: String
    let reading: String
}

struct ConversionOutput: Encodable {
    let id: String
    let candidates: [ConversionCandidate]
    let engineMs: Double
}

// One sequential worker. No user history, prediction, or neural rewriting.
let converter = KanaKanjiConverter.withDefaultDictionary()
let scratch = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
let options = ConvertRequestOptions(
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

@MainActor func convert(_ request: ConversionInput) -> ConversionOutput {
    converter.stopComposition()
    var composition = ComposingText()
    composition.insertAtCursorPosition(request.reading, inputStyle: .direct)
    let start = ContinuousClock.now
    let results = converter.requestCandidates(composition, options: options)
    var seen = Set<String>()
    let candidates = results.mainResults.compactMap { candidate -> ConversionCandidate? in
        let reading = candidate.data.map(\.ruby).joined()
        // Partial completions must not silently discard the remaining reading.
        guard reading == request.reading.applyingTransform(.hiraganaToKatakana, reverse: false),
              seen.insert(candidate.text).inserted else { return nil }
        return ConversionCandidate(text: candidate.text, reading: request.reading)
    }
    let elapsed = start.duration(to: .now).components
    let milliseconds = Double(elapsed.seconds) * 1000 + Double(elapsed.attoseconds) / 1e15
    return ConversionOutput(id: request.id, candidates: Array(candidates.prefix(10)), engineMs: milliseconds)
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
while let line = readLine() {
    do {
        let request = try JSONDecoder().decode(ConversionInput.self, from: Data(line.utf8))
        let output = try encoder.encode(convert(request))
        FileHandle.standardOutput.write(output + Data([10]))
    } catch {
        FileHandle.standardError.write(Data("Invalid conversion request\n".utf8))
    }
}

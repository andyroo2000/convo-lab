import Foundation
import EfficientNGram

@_extern(wasm, module: "neural", name: "request")
func neuralRequest(_ input: UnsafePointer<UInt8>, _ length: Int32, _ output: UnsafeMutablePointer<UInt8>, _ capacity: Int32) -> Int32

// The upstream dictionary/lattice/review loop remains Swift. Only model
// inference crosses this synchronous worker bridge to the browser's wllama.
final class ZenzContext {
    struct Reply: Decodable {
        let kind: String
        let score: Float?
        let scores: [Float]?
        let prefix: [UInt8]?
        let text: String?
        let alternatives: [CandidateEvaluationResult.AlternativeConstraint]?
    }
    enum CandidateEvaluationResult: Sendable, Equatable, Hashable {
        case error
        case pass(score: Float, alternativeConstraints: [AlternativeConstraint])
        case fixRequired(prefixConstraint: [UInt8])
        case wholeResult(String)
        struct AlternativeConstraint: Sendable, Equatable, Hashable, Decodable {
            var probabilityRatio: Float
            var prefixConstraint: [UInt8]
        }
    }
    static func createContext(path: String) throws -> ZenzContext { ZenzContext() }
    func reset_context() throws {}
    private func request(_ body: [String: Any]) -> Reply? {
        guard let data = try? JSONSerialization.data(withJSONObject: body) else { return nil }
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 65536)
        defer { buffer.deallocate() }
        let count = data.withUnsafeBytes { bytes in
            neuralRequest(bytes.bindMemory(to: UInt8.self).baseAddress!, Int32(data.count), buffer, 65536)
        }
        guard count > 0, count <= 65536 else { return nil }
        return try? JSONDecoder().decode(Reply.self, from: Data(bytes: buffer, count: Int(count)))
    }
    func scores(texts: [String], prompt: String) -> [Float]? {
        request(["op": "scores", "texts": texts, "prompt": prompt])?.scores
    }
    func evaluate(text: String, ignorePrompt: String = "") -> Float {
        request(["op": "score", "text": text, "prompt": ignorePrompt])?.score ?? .nan
    }
    func evaluate_candidate(
        input: String, candidate: Candidate, requestRichCandidates: Bool,
        prefixConstraint: Kana2Kanji.PrefixConstraint,
        personalizationMode: (mode: ConvertRequestOptions.ZenzaiMode.PersonalizationMode, base: EfficientNGram, personal: EfficientNGram)?,
        versionDependentConfig: ConvertRequestOptions.ZenzaiVersionDependentMode
    ) -> CandidateEvaluationResult {
        guard personalizationMode == nil, versionDependentConfig.version == .v3,
              let result = request(["op": "review", "reading": input, "text": candidate.text, "rich": requestRichCandidates]) else { return .error }
        switch result.kind {
        case "pass": return .pass(score: result.score ?? 0, alternativeConstraints: result.alternatives ?? [])
        case "fix": return .fixRequired(prefixConstraint: result.prefix ?? [])
        case "whole": return .wholeResult(result.text ?? "")
        default: return .error
        }
    }
    func predict_next_character(leftSideContext: String, count: Int) -> [(character: Character, value: Float)] { [] }
    func pure_greedy_decoding(leftSideContext: String, maxCount: Int) -> String { "" }
}

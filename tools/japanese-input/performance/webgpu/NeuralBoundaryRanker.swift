public import Foundation

#if Zenzai || ZenzaiCPU
public final class NeuralBoundaryRanker {
    private let context: ZenzContext
    public init(modelURL: URL) throws {
        // The browser bridge already owns one loaded model. No extra warmup.
        context = try ZenzContext.createContext(path: modelURL.path)
    }
    public func rank(_ candidates: [Candidate], reading: String) throws -> [Candidate] {
        var seen = Set<String>()
        let kana = reading.applyingTransform(.hiraganaToKatakana, reverse: false) ?? reading
        let shortlist = Array(candidates.filter {
            $0.data.map(\.ruby).joined() == kana && seen.insert($0.text).inserted
        }.prefix(160))
        let texts = shortlist.map { $0.text.replacingOccurrences(of: " ", with: "\u{3000}") }
        guard let scores = context.scores(texts: texts, prompt: "\u{EE00}\(kana)\u{EE01}"),
              scores.count == shortlist.count, scores.allSatisfy(\.isFinite) else { throw RankingError.invalidScore }
        return shortlist.indices.sorted {
            scores[$0] == scores[$1] ? $0 < $1 : scores[$0] > scores[$1]
        }.map {
            var candidate = shortlist[$0]
            candidate.value = PValue(scores[$0])
            return candidate
        }
    }
    private enum RankingError: Error { case invalidScore }
}
#endif

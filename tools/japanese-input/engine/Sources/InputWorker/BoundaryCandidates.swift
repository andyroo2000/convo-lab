import Foundation
import KanaKanjiConverterModuleWithDefaultDictionary

@MainActor func boundaryCandidates(
    reading: String, boundaries: [Int], neural: [Candidate], options: ConvertRequestOptions
) -> [Candidate] {
    // Keep a neural result only when its dictionary units respect every cut.
    // Otherwise use the constrained full-phrase dictionary ranking. Never split
    // a kanji token's reading by guessing how its characters should be divided.
    let compatible = neural.filter { candidate in
        var offset = 0
        let edges = Set(candidate.data.map { unit in
            offset += unit.ruby.utf16.count
            return offset
        })
        return boundaries.allSatisfy { edges.contains($0) }
    }
    return compatible + boundaryConverter.candidates(
        reading: reading, boundaries: boundaries, options: options
    )
}

import Foundation
import KanaKanjiConverterModuleWithDefaultDictionary

struct BrowserOperation: Decodable { let op: String? }

@MainActor func browserPayload(_ input: Data) throws -> Data {
    let operation = try JSONDecoder().decode(BrowserOperation.self, from: input)
    switch operation.op {
    case "learn":
        let selection = try JSONDecoder().decode(ConfirmedConversion.self, from: input)
        guard let candidate = learning.candidate(for: selection) else { return Data("{\"learned\":false}".utf8) }
        try learning.confirm(selection)
        converter.stopComposition()
        converter.updateLearningData(candidate)
        converter.commitUpdateLearningData()
        invalidateLearningCaches()
        return Data("{\"learned\":true}".utf8)
    case "resetLearning":
        try learning.clear()
        converter.resetMemory()
        invalidateLearningCaches()
        return Data("{\"reset\":true}".utf8)
    default:
        return try conversionPayload(JSONDecoder().decode(ConversionInput.self, from: input))
    }
}

@MainActor func invalidateLearningCaches() {
    converter.stopComposition()
    boundaryConverter = BoundaryCandidateConverter(dicdataStore: dictionary)
    /* invalidate cached proposals */
}

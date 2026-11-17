// ConvoLab adapter for pinned AzooKey v0.11.2. Compiled inside the upstream
// module to expose the same full-phrase query used by its bundled CLI.
extension KanaKanjiConverter {
    public func requestWholePhraseCandidates(
        _ input: ComposingText,
        options: ConvertRequestOptions
    ) -> ConversionResult {
        var wholePhraseOptions = options
        wholePhraseOptions.requestQuery = .完全一致
        return requestCandidates(input, options: wholePhraseOptions)
    }
}

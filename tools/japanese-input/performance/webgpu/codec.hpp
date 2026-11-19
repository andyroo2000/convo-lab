struct journal_codec {
    static std::vector<llama_token> tokenize(const llama_vocab *vocab, const std::string &text, bool special) {
        std::vector<llama_token> tokens(text.size() + 16);
        int n = llama_tokenize(vocab, text.data(), text.size(), tokens.data(), tokens.size(), special, true);
        if (n < 0) {
            tokens.resize(-n);
            n = llama_tokenize(vocab, text.data(), text.size(), tokens.data(), tokens.size(), special, true);
        }
        if (n < 0) throw std::runtime_error("Tokenization failed");
        tokens.resize(n); return tokens;
    }

    static std::string detokenize(const llama_vocab *vocab, const std::vector<llama_token> &tokens) {
        const int needed = llama_detokenize(vocab, tokens.data(), tokens.size(), nullptr, 0, false, true);
        std::string text(std::abs(needed), '\0');
        const int n = llama_detokenize(vocab, tokens.data(), tokens.size(), text.data(), text.size(), false, true);
        if (n < 0) throw std::runtime_error("Detokenization failed");
        text.resize(n); return text;
    }
};

// Preserve a prompt-only sequence, then share its KV rows with every candidate.
// Each candidate still receives its own suffix and all full-vocabulary scores.
struct journal_shared_scorer {
    llama_context *context;
    const journal_settings &settings;
    journal_profile &profile;
    int vocabulary;
    std::vector<float> first;

    void decode(journal_batch &batch) {
        if (!batch.value.n_tokens) return;
        const double before = journal_profile::now();
        if (llama_decode(context, batch.value)) throw std::runtime_error("Shared decode failed");
        profile.decode_ms += journal_profile::now() - before;
        profile.tokens += batch.value.n_tokens;
        profile.batches++;
    }

    void validate(const std::vector<std::vector<llama_token>> &sentences, int start) const {
        if (sentences.empty()) throw std::runtime_error("Empty candidate pool");
        if (start < 1 || size_t(start) >= sentences.front().size()) throw std::runtime_error("Invalid shared prompt");
        for (const auto &sentence : sentences) validateSentence(sentence, sentences.front(), start);
    }

    static void validateSentence(const std::vector<llama_token> &sentence, const std::vector<llama_token> &reference, int start) {
        if (sentence.size() > 512 || sentence.size() <= size_t(start)) throw std::runtime_error("Invalid sentence length");
        if (!std::equal(reference.begin(), reference.begin() + start, sentence.begin()))
            throw std::runtime_error("Candidates do not share exact prompt tokens");
    }

    void prompt(const std::vector<llama_token> &sentence, int start) {
        llama_memory_clear(llama_get_memory(context), true);
        journal_batch batch(settings.tokens);
        for (int p = 0; p < start; p++) batch.add(sentence[p], p, 0, p == start - 1);
        decode(batch);
        saveFirstScores();
    }

    void saveFirstScores() {
        const double before = journal_profile::now();
        const float *logits = llama_get_logits_ith(context, -1);
        const float norm = journal_logits{logits, vocabulary}.normalization();
        first.resize(vocabulary);
        for (int word = 0; word < vocabulary; word++) first[word] = logits[word] - norm;
        profile.normalize_ms += journal_profile::now() - before;
    }

    size_t chunkEnd(const std::vector<std::vector<llama_token>> &sentences, size_t offset, int start) const {
        size_t end = offset, count = start;
        while (end < sentences.size() && end - offset < size_t(settings.sequences)) {
            const size_t length = sentences[end].size() - start - 1;
            if (count + length > size_t(settings.tokens)) break;
            count += length; end++;
        }
        return end;
    }

    void fill(journal_batch &batch, const std::vector<std::vector<llama_token>> &sentences, journal_chunk chunk) {
        const auto memory = llama_get_memory(context);
        llama_memory_seq_keep(memory, 0);
        for (size_t i = chunk.offset; i < chunk.end; i++) {
            const int sequence = i - chunk.offset + 1;
            llama_memory_seq_cp(memory, 0, sequence, 0, chunk.start);
            fillSentence(batch, sentences[i], sequence, chunk.start);
        }
    }

    static void fillSentence(journal_batch &batch, const std::vector<llama_token> &sentence, int sequence, int start) {
        for (size_t p = start; p + 1 < sentence.size(); p++) batch.add(sentence[p], p, sequence, true);
    }

    float sentenceScore(const std::vector<llama_token> &sentence, int start, int &row) const {
        float score = first[sentence[start]];
        for (size_t p = start + 1; p < sentence.size(); p++) {
            const float *logits = llama_get_logits(context) + (row++) * vocabulary;
            score += journal_logits{logits, vocabulary}.logProbability(sentence[p]);
        }
        if (!std::isfinite(score)) throw std::runtime_error("Non-finite shared score");
        return score;
    }

    void appendScores(std::vector<float> &result, const std::vector<std::vector<llama_token>> &sentences, journal_chunk chunk) const {
        const double before = journal_profile::now();
        int row = 0;
        for (size_t i = chunk.offset; i < chunk.end; i++) result.push_back(sentenceScore(sentences[i], chunk.start, row));
        profile.normalize_ms += journal_profile::now() - before;
    }

    std::vector<float> scores(const std::vector<std::vector<llama_token>> &sentences, int start) {
        validate(sentences, start);
        prompt(sentences.front(), start);
        std::vector<float> result;
        for (size_t offset = 0; offset < sentences.size();) {
            const size_t end = chunkEnd(sentences, offset, start);
            journal_batch batch(settings.tokens);
            fill(batch, sentences, {offset, end, start});
            decode(batch);
            appendScores(result, sentences, {offset, end, start});
            offset = end;
        }
        return result;
    }
};

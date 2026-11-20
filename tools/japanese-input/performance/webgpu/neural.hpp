#include "journal-codec.hpp"
#include "journal-logits.hpp"
#include "journal-settings.hpp"
// Experimental low-level scoring bridge for wllama 3.13.0. No sampling,
// vocabulary truncation, model changes, or candidate pruning.
struct journal_batch {
    llama_batch value;
    explicit journal_batch(int capacity = 1024) : value(llama_batch_init(capacity, 0, 1)) {}
    ~journal_batch() { llama_batch_free(value); }
    void add(llama_token token, int position, int sequence, bool output) {
        const int i = value.n_tokens++;
        value.token[i] = token; value.pos[i] = position;
        value.n_seq_id[i] = 1; value.seq_id[i][0] = sequence;
        value.logits[i] = output;
    }
};

#include "journal-shared.hpp"

struct journal_scorer : journal_codec {
    llama_context *batch_context = nullptr;
    std::vector<llama_token> previous;
    journal_settings settings;
    journal_profile profile;
    ~journal_scorer() { if (batch_context) llama_free(batch_context); }

    size_t sharedPrefix(const std::vector<llama_token> &tokens) const {
        const size_t limit = std::min(previous.size(), tokens.size() - 1);
        size_t shared = 0;
        while (shared < limit) {
            if (previous[shared] != tokens[shared]) break;
            shared++;
        }
        return shared;
    }

    static void validatePrefix(const std::vector<llama_token> &tokens) {
        if (tokens.empty() || tokens.size() > 1024) throw std::runtime_error("Invalid prefix length");
    }

    void decodePrefix(llama_context *context, const std::vector<llama_token> &tokens) {
        validatePrefix(tokens);
        const size_t shared = sharedPrefix(tokens);
        if (!llama_memory_seq_rm(llama_get_memory(context), 0, shared, -1)) throw std::runtime_error("KV reset failed");
        journal_batch batch;
        for (size_t i = shared; i < tokens.size(); i++) batch.add(tokens[i], i, 0, i + 1 == tokens.size());
        if (llama_decode(context, batch.value)) throw std::runtime_error("Prefix decode failed");
        previous = tokens;
    }

    std::vector<float> probabilities(llama_context *context, const std::vector<llama_token> &tokens, int vocabulary) {
        decodePrefix(context, tokens);
        return journal_logits{llama_get_logits_ith(context, -1), vocabulary}.probabilities();
    }

    void prepare(const llama_model *model, journal_settings requested) {
        requested.validate();
        if (batch_context && settings == requested) return;
        if (batch_context) llama_free(batch_context);
        batch_context = nullptr;
        settings = requested;
        auto params = llama_context_default_params();
        params.n_ctx = settings.tokens; params.n_batch = settings.tokens; params.n_ubatch = settings.tokens;
        params.kv_unified = true; params.n_seq_max = settings.sequences + int(settings.shared_prompt); params.n_threads = 4; params.n_threads_batch = 4;
        batch_context = llama_init_from_model(const_cast<llama_model *>(model), params);
        if (!batch_context) throw std::runtime_error("Boundary context failed");
    }

    size_t chunkEnd(const std::vector<std::vector<llama_token>> &sentences, size_t offset) const {
        size_t end = offset, count = 0;
        while (end < sentences.size() && end - offset < size_t(settings.sequences)) {
            size_t length = sentences[end].size();
            if (length > 512) throw std::runtime_error("Sentence exceeds 512 tokens");
            if (count + length > size_t(settings.tokens)) break;
            count += length; end++;
        }
        return end;
    }

    void fillBatch(journal_batch &batch, const std::vector<std::vector<llama_token>> &sentences,
                   journal_chunk chunk) {
        for (size_t i = chunk.offset; i < chunk.end; i++) {
            const auto &sentence = sentences[i];
            if (chunk.start < 1 || size_t(chunk.start) >= sentence.size()) throw std::runtime_error("Invalid prompt length");
            for (size_t p = 0; p < sentence.size(); p++) {
                const bool output = p >= size_t(chunk.start - 1) && p + 1 < sentence.size();
                batch.add(sentence[p], p, i - chunk.offset, output);
            }
        }
    }

    float sentenceScore(const std::vector<llama_token> &sentence, int start, int &row, int vocabulary) {
        float score = 0;
        for (size_t p = start; p < sentence.size(); p++) {
            const float *logits = llama_get_logits(batch_context) + (row++) * vocabulary;
            score += journal_logits{logits, vocabulary}.logProbability(sentence[p]);
        }
        if (!std::isfinite(score)) throw std::runtime_error("Non-finite score");
        return score;
    }

    std::vector<float> scores(const llama_model *model, const std::vector<std::vector<llama_token>> &sentences,
                              int start, journal_settings requested) {
        prepare(model, requested);
        profile = {};
        std::vector<float> result;
        const int vocabulary = llama_vocab_n_tokens(llama_model_get_vocab(model));
        if (settings.shared_prompt) return journal_shared_scorer{batch_context, settings, profile, vocabulary, {}}.scores(sentences, start);
        for (size_t offset = 0; offset < sentences.size();) {
            const size_t end = chunkEnd(sentences, offset);
            llama_memory_clear(llama_get_memory(batch_context), true);
            journal_batch batch(settings.tokens);
            fillBatch(batch, sentences, {offset, end, start});
            const double before = journal_profile::now();
            if (llama_decode(batch_context, batch.value)) throw std::runtime_error("Boundary decode failed");
            const double decoded = journal_profile::now();
            profile.decode_ms += decoded - before;
            profile.tokens += batch.value.n_tokens;
            profile.batches++;
            int row = 0;
            for (size_t i = offset; i < end; i++) result.push_back(sentenceScore(sentences[i], start, row, vocabulary));
            profile.normalize_ms += journal_profile::now() - decoded;
            offset = end;
        }
        return result;
    }
};

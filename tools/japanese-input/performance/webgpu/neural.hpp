#include "journal-codec.hpp"
#include "journal-logits.hpp"
// Experimental low-level scoring bridge for wllama 3.13.0. No sampling,
// vocabulary truncation, model changes, or candidate pruning.
struct journal_batch {
    llama_batch value = llama_batch_init(1024, 0, 1);
    ~journal_batch() { llama_batch_free(value); }
    void add(llama_token token, int position, int sequence, bool output) {
        const int i = value.n_tokens++;
        value.token[i] = token; value.pos[i] = position;
        value.n_seq_id[i] = 1; value.seq_id[i][0] = sequence;
        value.logits[i] = output;
    }
};

struct journal_scorer : journal_codec {
    llama_context *batch_context = nullptr;
    std::vector<llama_token> previous;
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

    void prepare(const llama_model *model) {
        if (batch_context) return;
        auto params = llama_context_default_params();
        params.n_ctx = 512; params.n_batch = 512; params.n_ubatch = 512;
        params.kv_unified = true; params.n_seq_max = 16; params.n_threads = 4; params.n_threads_batch = 4;
        batch_context = llama_init_from_model(const_cast<llama_model *>(model), params);
        if (!batch_context) throw std::runtime_error("Boundary context failed");
    }

    static size_t chunkEnd(const std::vector<std::vector<llama_token>> &sentences, size_t offset, int capacity) {
        size_t end = offset, count = 0;
        while (end < sentences.size() && end - offset < size_t(capacity)) {
            size_t length = sentences[end].size();
            if (length > 512) throw std::runtime_error("Sentence exceeds 512 tokens");
            if (count + length > 512) break;
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
                              int start, int capacity) {
        prepare(model);
        std::vector<float> result;
        const int vocabulary = llama_vocab_n_tokens(llama_model_get_vocab(model));
        for (size_t offset = 0; offset < sentences.size();) {
            const size_t end = chunkEnd(sentences, offset, capacity);
            llama_memory_clear(llama_get_memory(batch_context), true);
            journal_batch batch;
            fillBatch(batch, sentences, {offset, end, start});
            if (llama_decode(batch_context, batch.value)) throw std::runtime_error("Boundary decode failed");
            int row = 0;
            for (size_t i = offset; i < end; i++) result.push_back(sentenceScore(sentences[i], start, row, vocabulary));
            offset = end;
        }
        return result;
    }
};

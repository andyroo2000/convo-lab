// Full-vocabulary normalization, matching the native Zenz scorer.
struct journal_logits {
    const float *values;
    int count;
    float normalization() const {
        float total = 0;
        for (int word = 0; word < count; word++) total += expf(values[word]);
        return logf(total);
    }
    std::vector<float> probabilities() const {
        const float norm = normalization();
        std::vector<float> result(count);
        for (int word = 0; word < count; word++) result[word] = expf(values[word] - norm);
        return result;
    }
    float logProbability(llama_token token) const { return values[token] - normalization(); }
};

struct journal_chunk {
    size_t offset;
    size_t end;
    int start;
};

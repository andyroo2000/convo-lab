struct journal_settings {
    int tokens = 512;
    int sequences = 16;
    bool shared_prompt = false;
    bool operator==(const journal_settings &other) const {
        return tokens == other.tokens && sequences == other.sequences && shared_prompt == other.shared_prompt;
    }
    void validate() const {
        if (tokens < 512 || tokens > 2048) throw std::runtime_error("Invalid batch token capacity");
        if (sequences < 1 || sequences > 160) throw std::runtime_error("Invalid batch sequence capacity");
    }
};
struct journal_profile {
    double decode_ms = 0;
    double normalize_ms = 0;
    int batches = 0;
    int tokens = 0;
    static double now() {
        return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now().time_since_epoch()).count();
    }
};

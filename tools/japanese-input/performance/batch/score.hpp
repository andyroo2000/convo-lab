// Evaluate all output-token likelihoods in one inference call. The full
// vocabulary normalizer is retained; no candidate or probability is discarded.
static float token_log_probability(const float *logits, int size, int target) {
  float largest = logits[0];
  for (int i = 1; i < size; ++i) largest = std::max(largest, logits[i]);
  double total = 0;
  for (int i = 0; i < size; ++i) total += std::exp(double(logits[i] - largest));
  return logits[target] - largest - float(std::log(total));
}

static int shared_prompt(const llama_tokens &old, const llama_tokens &tokens, int start) {
  int shared = 0;
  const int limit = std::min(int(old.size()), start - 1);
  while (shared < limit && old[shared] == tokens[shared]) ++shared;
  return shared;
}

static void validate_score_range(const llama_tokens &tokens, int start) {
  if (start < 1) throw std::runtime_error("Invalid score start");
  if (start >= int(tokens.size())) throw std::runtime_error("Empty score range");
  if (tokens.size() > 512) throw std::runtime_error("Score context too long");
}

static void validate_token_ids(const llama_tokens &tokens, int vocabulary) {
  for (auto token : tokens) {
    if (token < 0 || token >= vocabulary) throw std::runtime_error("Invalid token");
  }
}

static int decode_score(app_t &app, const llama_tokens &tokens, int start) {
  const int shared = shared_prompt(app.tokens, tokens, start);
  if (!llama_memory_seq_rm(llama_get_memory(app.ctx), 0, shared, -1))
    throw std::runtime_error("Could not update score cache");
  wcommon_batch_clear(app.batch);
  for (int i = shared; i < int(tokens.size()) - 1; ++i) {
    wcommon_batch_add(app.batch, tokens[i], i, {0}, i >= start - 1);
  }
  if (llama_decode(app.ctx, app.batch) != 0) throw std::runtime_error("Score decode failed");
  app.tokens.assign(tokens.begin(), tokens.end() - 1);
  return shared;
}

glue_msg_neural_score_res action_neural_score(app_t &app, const char *req_raw) {
  PARSE_REQ(glue_msg_neural_score_req);
  const auto &tokens = req.tokens.arr;
  const int start = req.start.value;
  const int vocab_size = llama_vocab_n_tokens(app.vocab);
  validate_score_range(tokens, start);
  validate_token_ids(tokens, vocab_size);
  const int shared = decode_score(app, tokens, start);
  float score = 0;
  std::vector<float> probabilities;
  for (int i = start; i < int(tokens.size()); ++i) {
    const float *logits = llama_get_logits_ith(app.ctx, i - 1 - shared);
    const float probability = token_log_probability(logits, vocab_size, tokens[i]);
    probabilities.push_back(probability);
    score += probability;
  }
  glue_msg_neural_score_res response;
  response.score.value = score;
  response.log_probs.arr = std::move(probabilities);
  response.n_past.value = int(tokens.size()) - 1;
  return response;
}

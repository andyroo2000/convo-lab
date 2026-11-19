  journal_scorer journal;
  json journal_operation(const char *req_raw) {
    PARSE_REQ(glue_msg_realtime_send_req);
    const auto input = json::parse(req.data_json.value);
    const std::string op = input.at("op");
    json output;
    std::vector<std::vector<llama_token>> sentences;
    if (op == "scores") for (const auto &sentence : input.at("sentences")) sentences.push_back(sentence.get<std::vector<llama_token>>());
    if (op == "tokenize") output = journal.tokenize(vocab, input.at("text"), input.value("special", false));
    else if (op == "detokenize") output = journal.detokenize(vocab, input.at("tokens").get<std::vector<llama_token>>());
    else if (op == "probabilities") output = journal.probabilities(ctx, input.at("tokens").get<std::vector<llama_token>>(), llama_vocab_n_tokens(vocab));
    else if (op == "scores") {
      journal_settings settings{input.value("batchTokens", 512), input.value("capacity", 16), input.value("sharePrompt", false)};
      output = json{{"scores", journal.scores(model, sentences, input.at("start").get<int>(), settings)},
                    {"decodeMs", journal.profile.decode_ms}, {"normalizeMs", journal.profile.normalize_ms},
                    {"batches", journal.profile.batches}, {"tokens", journal.profile.tokens}};
    }
    else throw std::runtime_error("Unknown Journal operation");
    return output;
  }

  glue_msg_get_result_res action_journal(const char *req_raw) {
    glue_msg_get_result_res result;
    result.success.value = true; result.has_more.value = false; result.is_error.value = false;
    try { result.data_json.value = journal_operation(req_raw).dump(); }
    catch (const std::exception &error) {
      result.is_error.value = true; result.data_json.value = error.what();
    }
    return result;
  }

#include <llama/llama.h>
#include <iostream>
#include <string>
#include <vector>
int main(int argc, char **argv) {
    if (argc != 2) return 1;
    llama_backend_init();
    auto params = llama_model_default_params();
    params.vocab_only = true;
    auto *model = llama_model_load_from_file(argv[1], params);
    if (!model) return 2;
    const auto *vocab = llama_model_get_vocab(model);
    std::cout << llama_vocab_bos(vocab) << " " << llama_vocab_eos(vocab) << "\n";
    std::string line;
    while (std::getline(std::cin, line)) {
        std::vector<llama_token> tokens(line.size() + 1);
        const int count = llama_tokenize(vocab, line.c_str(), line.size(), tokens.data(), tokens.size(), true, false);
        for (int i = 0; i < count; i++) std::cout << tokens[i] << (i + 1 == count ? "\n" : " ");
    }
    llama_model_free(model);
    llama_backend_free();
}

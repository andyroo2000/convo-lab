#include <algorithm>
#include <chrono>
#include <iostream>
#include <string>
#include <utility>

#include "absl/strings/escaping.h"
#include "base/system_util.h"
#include "config/config_handler.h"
#include "converter/converter_interface.h"
#include "converter/segments.h"
#include "data_manager/data_manager.h"
#include "engine/engine.h"
#include "protocol/commands.pb.h"
#include "protocol/config.pb.h"
#include "request/conversion_request.h"

namespace {
// Hex-encoded UTF-8 keeps the private benchmark protocol unambiguous even when
// a dictionary candidate contains quotes, tabs, or punctuation.
void PrintSegments(const mozc::Segments& segments) {
  for (const auto& segment : segments.conversion_segments()) {
    std::cout << '\t' << absl::BytesToHexString(segment.key()) << ':';
    const auto count = std::min<size_t>(10, segment.candidates_size());
    for (size_t i = 0; i < count; ++i) {
      if (i) std::cout << ',';
      std::cout << absl::BytesToHexString(segment.candidate(i).value);
    }
  }
}

void Convert(const std::string& reading,
             const mozc::ConverterInterface& converter,
             const mozc::config::Config& config) {
  mozc::commands::Request request;
  mozc::ConversionRequest::Options options = {
      .request_type = mozc::ConversionRequest::CONVERSION,
      .max_conversion_candidates_size = 200,
      .use_actual_converter_for_realtime_conversion = true,
      .create_partial_candidates = false,
  };
  const auto conversion = mozc::ConversionRequestBuilder()
                              .SetRequestView(request)
                              .SetConfigView(config)
                              .SetOptions(std::move(options))
                              .SetKey(reading)
                              .Build();
  // Fresh segments and incognito/no-history prevent one fixture affecting another.
  mozc::Segments segments;
  const auto start = std::chrono::steady_clock::now();
  const bool ok = converter.StartConversion(conversion, &segments);
  const double milliseconds = std::chrono::duration<double, std::milli>(
      std::chrono::steady_clock::now() - start).count();
  if (!ok) {
    std::cout << "ERROR" << std::endl;
    return;
  }
  std::cout << milliseconds;
  PrintSegments(segments);
  std::cout << std::endl;
}
}  // namespace

int main(int argc, char** argv) {
  if (argc != 3) return 2;  // Data path and isolated temporary profile directory.
  mozc::SystemUtil::SetUserProfileDirectory(argv[2]);
  auto data = mozc::DataManager::CreateFromFile(argv[1]);
  if (!data.ok()) return 3;
  auto engine = mozc::Engine::CreateEngine(*std::move(data));
  if (!engine.ok()) return 4;
  auto config = mozc::config::ConfigHandler::DefaultConfig();
  config.set_incognito_mode(true);
  config.set_history_learning_level(mozc::config::Config::NO_HISTORY);
  const auto converter = (*engine)->GetConverter();
  std::string reading;
  while (std::getline(std::cin, reading)) {
    if (!reading.empty()) Convert(reading, *converter, config);
  }
}

#!/bin/bash

echo "Testing Arabic avatar URLs..."
echo ""

urls=(
  "https://storage.googleapis.com/convolab-storage/avatars/speakers/4479f526-41c0-47b3-80c0-9c691d4771fc-ar-female-casual.jpg"
  "https://storage.googleapis.com/convolab-storage/avatars/speakers/a41645e0-2512-43fe-a197-baa504c3a222-ar-female-polite.jpg"
  "https://storage.googleapis.com/convolab-storage/avatars/speakers/ed9c5916-4a9a-4266-9e16-dac1f856544a-ar-female-formal.jpg"
  "https://storage.googleapis.com/convolab-storage/avatars/speakers/72e21d53-2bc8-4232-a323-aff55e2c3618-ar-male-casual.jpg"
)

for url in "${urls[@]}"; do
  filename=$(basename "$url")
  echo "Testing $filename..."
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$status" = "200" ]; then
    echo "  ✓ OK ($status)"
  else
    echo "  ✗ FAILED ($status)"
  fi
  echo ""
done

echo "All tests complete!"

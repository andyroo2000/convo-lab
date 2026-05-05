# Speaker Avatar Generator

This script generates realistic speaker avatars using the same OpenAI Images helper used by study-card image generation and automatically crops them to optimized headshots.

## Features

- Generates avatars for 6 different speaker types:
  - Japanese: male/female × casual/polite/formal (6 avatars)
- Automatically crops generated square portraits to avatar headshots
- Resizes to 256×256px for optimal performance
- Optimizes JPEG quality for small file sizes
- Saves originals for local reference
- Uploads cropped runtime avatars to GCS when `GCS_BUCKET_NAME` is configured

## Usage

```bash
# From the server directory
npm run generate:avatars
```

## Output

Avatars are saved to:

- **Cropped avatars**: `server/public/avatars/` (256×256, optimized)
- **Original images**: `server/public/avatars/original/` (full resolution)
- **Runtime assets**: `gs://$GCS_BUCKET_NAME/avatars/` for signed delivery via `/api/avatars/...`

## File Naming Convention

Avatars are named using the pattern: `{language}-{gender}-{tone}.jpg`

Examples:

- `ja-female-casual.jpg` - Japanese female, casual tone

## How It Works

1. **Generate**: Uses the configured OpenAI image model to generate realistic portraits
2. **Crop**: Uses square cover cropping to keep the portrait centered
3. **Resize**: Resizes to 256×256px
4. **Optimize**: Compresses to JPEG at 85% quality for small file size
5. **Save**: Saves both cropped and original versions locally
6. **Upload**: Copies cropped avatars to GCS when storage is configured

## Customization

### Adjust Crop Area

Edit the `.resize(256, 256, { fit: 'cover', position: 'center' })` options in `generate-speaker-avatars.ts`.

### Change Output Size

Edit the resize parameters:

```typescript
// Current: 256×256
.resize(256, 256, {
  fit: 'cover',
  position: 'center',
})

// Larger: 512×512
.resize(512, 512, {
  fit: 'cover',
  position: 'center',
})
```

### Modify Prompts

Edit the `AVATARS` array to customize the generation prompts for each avatar type.

## Cost Considerations

The script generates six images. Cost depends on the configured OpenAI image model and quality settings in `openAIClient.ts`.

## Troubleshooting

### "No images generated" error

- Check that `OPENAI_API_KEY` is configured in the server environment
- Verify the configured OpenAI image model supports image generation

### Images are too zoomed in/out

- Adjust the resize `position` value (see Customization section)
- Modify the prompts to request "upper body shot" or "full torso"

### File sizes too large

- Reduce the JPEG quality (currently 85%)
- Reduce output dimensions (currently 256×256)

## Integration with App

To use these avatars in your application, you can map speakers to avatar URLs:

```typescript
function getSpeakerAvatarUrl(
  language: 'ja',
  gender: 'male' | 'female',
  tone: 'casual' | 'polite' | 'formal'
) {
  return `/api/avatars/${language}-${gender}-${tone}.jpg`;
}
```

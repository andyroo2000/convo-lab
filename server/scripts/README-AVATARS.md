# Speaker Avatar Generator

This script generates realistic speaker avatars using Google's Imagen 3 (via Vertex AI) and automatically crops them to optimized headshots.

## Features

- Generates avatars for 6 different speaker types:
  - Japanese: male/female × casual/polite/formal (6 avatars)
- Automatically crops full-body images to headshots (top 60%)
- Resizes to 256×256px for optimal performance
- Optimizes JPEG quality for small file sizes
- Saves originals for reference

## Usage

```bash
# From the server directory
npm run generate:avatars
```

## Output

Avatars are saved to:

- **Cropped avatars**: `server/public/avatars/` (256×256, optimized)
- **Original images**: `server/public/avatars/original/` (full resolution)

## File Naming Convention

Avatars are named using the pattern: `{language}-{gender}-{tone}.jpg`

Examples:

- `ja-female-casual.jpg` - Japanese female, casual tone

## How It Works

1. **Generate**: Uses Imagen 3 to generate realistic portrait based on detailed prompts
2. **Crop**: Extracts top 60% of the image (captures face and upper shoulders)
3. **Resize**: Resizes to 256×256px using smart cropping (focuses on top/center)
4. **Optimize**: Compresses to JPEG at 85% quality for small file size
5. **Save**: Saves both cropped and original versions

## Customization

### Adjust Crop Area

Edit the `cropHeight` calculation in `generate-speaker-avatars.ts`:

```typescript
// Current: top 60%
const cropHeight = Math.floor(height * 0.6);

// More headshot: top 50%
const cropHeight = Math.floor(height * 0.5);

// More upper body: top 70%
const cropHeight = Math.floor(height * 0.7);
```

### Change Output Size

Edit the resize parameters:

```typescript
// Current: 256×256
.resize(256, 256, {
  fit: 'cover',
  position: 'top',
})

// Larger: 512×512
.resize(512, 512, {
  fit: 'cover',
  position: 'top',
})
```

### Modify Prompts

Edit the `AVATAR_PROMPTS` object to customize the generation prompts for each avatar type.

## Cost Considerations

Each image generation with Imagen 3 costs approximately $0.02 USD.
Generating all 12 avatars will cost approximately $0.24 USD.

## Troubleshooting

### "No images generated" error

- Check that Vertex AI API is enabled in your Google Cloud project
- Verify your Google Cloud credentials are properly configured

### Images are too zoomed in/out

- Adjust the `cropHeight` percentage (see Customization section)
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
  return `/avatars/${language}-${gender}-${tone}.jpg`;
}
```

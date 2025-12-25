# ConvoLab Design System

This document defines the design principles, visual language, and implementation guidelines for ConvoLab.

## Design Philosophy

ConvoLab embraces a **bold, editorial design language** inspired by confident print magazines. We reject timid, desaturated corporate aesthetics in favor of vibrant colors, strong visual hierarchy, and clear information architecture.

### Core Principles

1. **Be Bold, Not Safe**
   - Use saturated colors with confidence
   - Solid color blocks over gradients
   - Strong contrast and clear hierarchy
   - Large, readable text sizes

2. **Clarity Over Cleverness**
   - Immediate visual feedback for user actions
   - Contextual messaging near the point of interaction
   - Clear content type identification through color coding
   - No hidden functionality or ambiguous states

3. **Magazine Editorial Aesthetic**
   - Think Kinfolk, Monocle, or hurryupandhavefun.com
   - Bold color sidebars as visual anchors
   - Generous whitespace and breathing room
   - Typography that commands attention

4. **Minimize Friction**
   - Auto-save wherever possible
   - Inline feedback instead of distant toasts
   - Remove unnecessary navigation steps
   - No "Back to X" links on creation flows

## Color Palette

ConvoLab uses **5 core brand colors** plus neutrals. Each color has semantic meaning tied to content types.

### Brand Colors

```css
/* Periwinkle - Dialogues & Conversations */
--periwinkle: #6b7fd7;
--periwinkle-light: #e8ebfc;
--periwinkle-dark: #5a6bc4;

/* Coral - Audio Courses */
--coral: #ff8370;
--coral-light: #ffe5e0;
--coral-dark: #e66b59;

/* Strawberry - Narrow Listening */
--strawberry: #ff6b9d;
--strawberry-light: #ffe5ef;
--strawberry-dark: #e65889;

/* Keylime (Olive Green) - Processing Instruction */
--keylime: #748c00;
--keylime-light: #eef2d9;
--keylime-dark: #627600;

/* Yellow - Lexical Chunk Packs */
--yellow: #ffcc3f;
--yellow-light: #fff5dc;
--yellow-dark: #e6b835;
```

### Neutrals

```css
/* Cream - Page Background */
--cream: #faf9f6;

/* Dark Brown - Primary Text */
--dark-brown: #4b1800;

/* Grays - Secondary Elements */
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-500: #6b7280;
--gray-600: #4b5563;
--gray-700: #374151;
```

### Color Usage Guidelines

**Content Type Color Coding:**

- Dialogues = Periwinkle
- Audio Courses = Coral
- Narrow Listening = Strawberry
- Processing Instruction = Keylime (Olive Green)
- Lexical Chunk Packs = Yellow

**Avoid:**

- Never use violet/purple (removed from palette)
- No desaturated or muted versions of brand colors
- No black (#000000) for text - use dark-brown instead

## Typography

### Hierarchy

```css
/* Headings */
h1: text-5xl (48px) font-bold
h2: text-4xl (36px) font-bold
h3: text-3xl (30px) font-bold

/* Page Headers */
Page Title: text-5xl font-bold text-dark-brown
Page Subtitle: text-xl text-gray-600
Border: border-b-4 border-[brand-color]

/* Body Text */
Large Body: text-lg (18px)
Base Body: text-base (16px)
Small Text: text-sm (14px)

/* Labels */
Form Labels: text-base font-bold text-dark-brown
Section Labels: text-lg font-bold text-dark-brown
```

### Font Sizes - Key Guidelines

- **Increase, don't decrease**: When in doubt, make text larger
- **Japanese text needs extra size**: Grammar points, sentences, and kanji should be text-lg minimum
- **Description boxes**: Headings text-xl, body text-lg
- **Form inputs**: text-base minimum for better readability
- **Help text**: text-sm for secondary information

### Font Stack

```css
font-family:
  -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell',
  'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
```

## Layout Patterns

### Page Structure

```jsx
<div className="max-w-6xl mx-auto">
  {/* Page Header */}
  <div className="mb-8 pb-6 border-b-4 border-[brand-color]">
    <h1 className="text-5xl font-bold text-dark-brown mb-3">Page Title</h1>
    <p className="text-xl text-gray-600">Descriptive subtitle</p>
  </div>

  {/* Main Content Card */}
  <div className="max-w-4xl mx-auto">
    <div className="bg-white border-l-8 border-[brand-color] p-8 shadow-sm">{/* Content */}</div>
  </div>
</div>
```

### Card Components

**Standard Card:**

```jsx
<div className="bg-white border-l-8 border-[brand-color] p-8 shadow-sm">{/* Content */}</div>
```

**Info/Description Box:**

```jsx
<div className="bg-[brand-color]-light border-l-4 border-[brand-color] p-6 mb-8">
  <h2 className="text-xl font-bold text-dark-brown mb-3">Section Title</h2>
  <p className="text-lg text-gray-700 leading-relaxed">
    Description text with <strong>emphasized points</strong>.
  </p>
</div>
```

### Sidebar Pattern (Library & Create Pages)

Used for content type identification with large icons and bold colors:

```jsx
<div className="flex gap-3 cursor-pointer hover:opacity-90 transition-opacity">
  {/* 96px or 128px wide colored sidebar */}
  <div className="w-24 bg-[brand-color] flex flex-col items-center justify-center p-4">
    <Icon className="w-8 h-8 text-white mb-2" />
    <span className="text-white text-xs font-bold uppercase tracking-wide text-center">Label</span>
  </div>

  {/* Content area */}
  <div className="flex-1 bg-white p-6 border-l-8 border-[brand-color]">{/* Card content */}</div>
</div>
```

## Component Patterns

### Buttons

**Primary Action Button:**

```jsx
<button className="w-full bg-[brand-color] hover:bg-[brand-color]-dark text-white font-bold text-lg px-10 py-5 rounded-lg shadow-md transition-all">
  Button Text
</button>
```

**Selection Buttons (Active State):**

```jsx
<button
  className={`px-6 py-4 rounded-lg border-2 font-bold transition-all ${
    isActive
      ? 'border-[brand-color] bg-[brand-color] text-white shadow-md'
      : 'border-gray-200 bg-white text-gray-700 hover:border-[brand-color] hover:bg-[brand-color]-light'
  }`}
>
  Button Text
</button>
```

### Form Inputs

**Text Input:**

```jsx
<input
  type="text"
  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[brand-color] focus:outline-none text-base"
  placeholder="Placeholder text"
/>
```

**Select Dropdown:**

```jsx
<select className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-[brand-color] focus:outline-none text-base">
  <option>Option 1</option>
</select>
```

**Form Label:**

```jsx
<label className="block text-base font-bold text-dark-brown mb-3">Label Text</label>
```

### Inline Feedback

For auto-save confirmations and contextual messages:

```jsx
{
  saveMessage && (
    <p
      className={`text-sm font-medium mt-2 ${
        saveMessage === 'Saved!' ? 'text-green-600' : 'text-red-600'
      }`}
    >
      {saveMessage}
    </p>
  );
}
{
  !saveMessage && (
    <p className="text-sm text-gray-500 mt-2">Helper text when not showing save status</p>
  );
}
```

### Navigation Tabs

**Bold Button Style (Settings, etc.):**

```jsx
<button
  className={`px-6 py-3 rounded-lg border-2 font-bold transition-all ${
    isActive
      ? 'border-[brand-color] bg-[brand-color] text-white shadow-md'
      : 'border-gray-200 bg-white text-gray-700 hover:border-[brand-color] hover:bg-[brand-color]-light'
  }`}
>
  Tab Name
</button>
```

### Progress Bars

```jsx
<div className="h-2 bg-gray-200 rounded-full overflow-hidden">
  <div
    className="h-full bg-strawberry transition-all duration-300"
    style={{ width: `${progress}%` }}
  />
</div>
```

## Navigation

### Top Navigation

```jsx
<nav className="sticky top-0 z-20 bg-periwinkle shadow-lg">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex h-16">
      {/* Logo */}
      <Link
        to="/app/library"
        className="flex items-center gap-2 px-4 text-white font-bold text-xl drop-shadow-md"
      >
        ConvoLab
        <Logo size="small" />
      </Link>

      {/* Nav Items */}
      <div className="hidden sm:ml-6 sm:flex h-16 items-center gap-1">
        <Link
          className={`px-4 h-10 rounded-lg ${
            isActive ? 'bg-white text-[brand-color] shadow-md' : 'text-white hover:bg-white/20'
          }`}
        >
          Nav Item
        </Link>
      </div>
    </div>
  </div>
</nav>
```

### Logo Component

ConvoLab logo consists of text + 2 icons (MessageCircle + FlaskConical):

- Light variant (default): White icons for dark backgrounds
- Dark variant: Dark-brown icons for light backgrounds (landing page)

```jsx
<Logo variant="light" size="small" />
<Logo variant="dark" size="medium" />
```

## Interaction Patterns

### Auto-Save Pattern

**Always prefer auto-save over manual save buttons.**

```jsx
const handleFieldChange = async (value) => {
  setFieldValue(value);
  setSaveMessage(null);

  try {
    await updateUser({ fieldName: value });
    setSaveMessage('Saved!');
    setTimeout(() => setSaveMessage(null), 2000);
  } catch (err) {
    setSaveMessage('Failed to save');
    setTimeout(() => setSaveMessage(null), 3000);
  }
};
```

### Feedback Placement

- **Inline feedback**: Show "Saved!" message directly below the modified field
- **Never use corner toasts**: Too far from the point of interaction
- **Contextual errors**: Show error messages near the field that caused them

### Loading States

```jsx
{
  isLoading ? (
    <>
      <Loader className="w-5 h-5 animate-spin" />
      Loading Text...
    </>
  ) : (
    <>
      <Icon className="w-5 h-5" />
      Action Text
    </>
  );
}
```

## Creator Forms (Setup Pages)

All creator/setup pages follow this structure:

### Page Header

- Max width: `max-w-6xl`
- Title: `text-5xl font-bold text-dark-brown`
- Subtitle: `text-xl text-gray-600`
- Bottom border: `border-b-4 border-[brand-color]`

### Main Card

- Max width: `max-w-4xl mx-auto`
- Left border: `border-l-8 border-[brand-color]`
- Padding: `p-8`

### Info Box

- Background: `bg-[brand-color]-light`
- Left border: `border-l-4 border-[brand-color]`
- Heading: `text-xl font-bold`
- Body: `text-lg text-gray-700`

### Selection Grids

- Grid layouts for options
- Active state uses brand color background
- Hover state uses brand color light background

### Generate Button

- Full width
- Large padding: `px-10 py-5`
- Font: `text-lg font-bold`
- Brand color background

### No "Back" Buttons

- Never include "Back to Create" or similar navigation
- Users can use browser back or main navigation

## Library/Content Cards

### Icon Sidebars (Library Page)

- 96px wide colored sidebar
- 8x8 icon (w-8 h-8)
- Uppercase label
- Color matches content type

### Create Page Buttons

- 128px wide colored sidebar
- 12x12 icon (w-12 h-12) in white
- Simplified content: Title + one-line description
- Full width action button

## Audio Player

- Background: `bg-yellow`
- Text: `text-dark-brown`
- Progress bar: Strawberry on yellow background
- Speed selector: Gray variants (not color-coded)

## Settings Page

### Tab Navigation

- Bold button style with rounded corners
- Active tab: Brand color background with white text
- Inactive: White background with hover state

### Form Structure

- All cards have `border-l-8 border-periwinkle`
- Danger Zone uses `border-strawberry`
- All inputs auto-save with inline feedback
- No Save/Cancel buttons in auto-save sections

### Profile Tab

- Avatar with color picker
- Display name input
- Manual save required (profile changes are more significant)

### Language Preferences Tab

- All fields auto-save
- Inline "Saved!" confirmation
- No manual save buttons

### Security Tab

- Password change with manual submit
- Clear validation and error messages

## Responsive Considerations

### Breakpoints

- Mobile-first approach
- sm: 640px
- md: 768px
- lg: 1024px

### Navigation

- Stack nav items vertically on mobile
- Hide secondary navigation on small screens
- Maintain icon sidebars on all sizes (scale down if needed)

## Technical Implementation Notes

### Always-Visible Scrollbar

```css
html {
  overflow-y: scroll;
}
```

This prevents navigation shift when switching between pages with different heights.

### Z-Index Layers

- Sticky nav: `z-20`
- Modals: `z-30`
- Toasts/Notifications: `z-40`

### Transitions

- Use `transition-all` for smooth state changes
- Duration: 200-300ms for most interactions
- Longer (500ms+) for major layout shifts

## Design Anti-Patterns to Avoid

❌ **Don't:**

- Use gradients instead of solid colors
- Make text smaller than necessary
- Use corner toast notifications for save confirmations
- Add "Back to X" buttons in creation flows
- Use desaturated or muted colors
- Create Save/Cancel buttons when auto-save is possible
- Use black (#000) for text
- Include violet/purple colors
- Hide the scrollbar or let it auto-show

✅ **Do:**

- Use bold, saturated brand colors
- Make text larger and more readable
- Show inline feedback near the point of interaction
- Let users navigate freely with browser controls
- Use dark-brown for all text
- Stick to the 5-color palette
- Auto-save with inline confirmation
- Force scrollbar to always be visible

## Examples by Page Type

### Creator/Setup Pages

- Processing Instruction Setup (Keylime theme)
- Lexical Chunk Pack Setup (Yellow theme)
- Dialogue Creator (Periwinkle theme)
- Course Creator (Coral theme)
- Narrow Listening Creator (Strawberry theme)

### Content Pages

- Library Page (Icon sidebars, content type color coding)
- Create Page (Large action buttons with colored sidebars)

### Playback Pages

- PlaybackPage (Coral header, yellow audio player)
- Narrow Listening Playback (Strawberry variation buttons)

### Settings Pages

- Settings Page (Periwinkle theme, auto-save everywhere)

## Future Considerations

When designing new features:

1. **Choose the appropriate brand color** based on content type
2. **Start with large text sizes** and only decrease if absolutely necessary
3. **Plan for auto-save** instead of manual save flows
4. **Use inline feedback** for all user actions
5. **Add bold colored borders** (8px left border) to main cards
6. **Follow the sidebar pattern** for content type identification
7. **Avoid adding navigation** that removes user agency (no forced "Back" buttons)

---

**Last Updated:** November 24, 2025
**Design System Version:** 1.0 (Bold Editorial)

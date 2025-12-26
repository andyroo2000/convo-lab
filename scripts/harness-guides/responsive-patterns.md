# Responsive Design Patterns

Common patterns for fixing responsive design issues in ConvoLab.

## Tailwind Breakpoints

ConvoLab uses Tailwind CSS with the following breakpoints:

```
xs: < 640px   (mobile)
sm: >= 640px  (large mobile)
md: >= 768px  (tablet)
lg: >= 1024px (desktop)
xl: >= 1280px (large desktop)
2xl: >= 1536px (extra large)
```

## Mobile-First Approach

Always write CSS mobile-first, then add larger breakpoints:

```tsx
// Good: Mobile-first
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-xl md:text-2xl lg:text-3xl">Title</h1>
</div>

// Bad: Desktop-first
<div className="p-8 sm:p-6 xs:p-4">...</div>
```

## Common Responsive Patterns

### Stack to Row Layout

```tsx
// Stack on mobile, row on tablet+
<div className="flex flex-col md:flex-row gap-4">
  <div className="w-full md:w-1/2">Left</div>
  <div className="w-full md:w-1/2">Right</div>
</div>
```

### Hide/Show Elements

```tsx
// Hide on mobile, show on desktop
<nav className="hidden lg:block">Desktop Nav</nav>

// Show on mobile, hide on desktop
<button className="lg:hidden">Menu</button>
```

### Responsive Grid

```tsx
// 1 column mobile, 2 tablet, 3 desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map((item) => (
    <Card key={item.id} />
  ))}
</div>
```

### Responsive Text

```tsx
// Smaller text on mobile
<p className="text-sm md:text-base lg:text-lg">
  Body text that scales with viewport
</p>

// Responsive headings
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Heading
</h1>
```

### Responsive Spacing

```tsx
// Less padding on mobile
<section className="px-4 py-6 md:px-8 md:py-12 lg:px-16 lg:py-20">
  Content with responsive padding
</section>
```

## Fixing Common Issues

### Horizontal Scroll

Problem: Content causes horizontal scroll on mobile.

```tsx
// Bad: Fixed width
<div className="w-[500px]">...</div>

// Good: Max width with responsive
<div className="w-full max-w-[500px]">...</div>

// Good: Use percentage or responsive classes
<div className="w-full md:w-1/2">...</div>
```

### Images Overflowing

```tsx
// Bad: No max-width
<img src="..." />

// Good: Constrain images
<img src="..." className="w-full max-w-full h-auto" />

// Or use next/image
<Image src="..." fill className="object-cover" />
```

### Tables on Mobile

```tsx
// Make table scrollable on mobile
<div className="overflow-x-auto">
  <table className="min-w-full">...</table>
</div>

// Or stack rows on mobile
<div className="hidden md:table">
  <table>...</table>
</div>
<div className="md:hidden">
  {rows.map(row => <MobileCard data={row} />)}
</div>
```

### Long Text Wrapping

```tsx
// Prevent long URLs/text from breaking layout
<p className="break-words overflow-wrap-anywhere">
  {longText}
</p>

// Or truncate with ellipsis
<p className="truncate max-w-full">
  {longText}
</p>
```

## Container Patterns

```tsx
// Centered container with max width
<div className="container mx-auto px-4 md:px-6 lg:px-8">
  Content
</div>

// Full bleed on mobile, contained on desktop
<div className="px-0 md:container md:mx-auto md:px-6">
  Content
</div>
```

## Testing Responsive Layouts

1. Chrome DevTools: Toggle device toolbar (Cmd+Shift+M)
2. Test at these widths: 320px, 375px, 414px, 768px, 1024px, 1280px
3. Check for:
   - No horizontal scroll
   - Text is readable (min 16px body)
   - Touch targets are adequate (44x44px min)
   - Content doesn't overlap
   - Images scale properly

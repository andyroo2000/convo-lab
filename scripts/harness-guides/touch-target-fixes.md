# Touch Target Fix Patterns

Common patterns for fixing touch target issues in ConvoLab.

## Minimum Touch Target Sizes

- **Apple Guidelines**: 44x44px minimum
- **Material Design**: 48x48dp minimum
- **WCAG 2.1 AAA**: 44x44px minimum
- **Spacing between targets**: 8px minimum

## Common Problems and Fixes

### Small Buttons

```tsx
// Bad: Button too small
<button className="p-1 text-sm">
  <Icon size={16} />
</button>

// Good: Adequate touch target
<button className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center">
  <Icon size={16} />
</button>

// Good: Using Tailwind's touch target utilities
<button className="p-3 touch-manipulation">
  <Icon size={16} />
</button>
```

### Icon-Only Buttons

```tsx
// Bad: Icon with no padding
<button onClick={handleClick}>
  <TrashIcon className="w-4 h-4" />
</button>

// Good: Padded icon button
<button
  onClick={handleClick}
  className="p-3 -m-3 rounded-full hover:bg-gray-100"
  aria-label="Delete item"
>
  <TrashIcon className="w-4 h-4" />
</button>
```

### Links in Navigation

```tsx
// Bad: Small link targets
<nav>
  <a href="/home" className="text-sm">Home</a>
  <a href="/about" className="text-sm">About</a>
</nav>

// Good: Larger tap areas
<nav className="flex gap-1">
  <a href="/home" className="px-4 py-3 text-sm hover:bg-gray-100 rounded">
    Home
  </a>
  <a href="/about" className="px-4 py-3 text-sm hover:bg-gray-100 rounded">
    About
  </a>
</nav>
```

### Close Buttons (Modals/Dialogs)

```tsx
// Bad: Small X button
<button className="absolute top-1 right-1">
  <XIcon className="w-4 h-4" />
</button>

// Good: Adequately sized close button
<button
  className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
  aria-label="Close dialog"
>
  <XIcon className="w-5 h-5" />
</button>
```

### Form Checkboxes and Radio Buttons

```tsx
// Bad: Native checkbox (small)
<input type="checkbox" id="terms" />
<label htmlFor="terms">Accept terms</label>

// Good: Custom styled with larger target
<label className="flex items-center gap-3 py-2 cursor-pointer">
  <div className="relative">
    <input
      type="checkbox"
      className="peer sr-only"
      id="terms"
    />
    <div className="w-6 h-6 border-2 rounded peer-checked:bg-indigo-600 peer-checked:border-indigo-600">
      <CheckIcon className="w-4 h-4 text-white hidden peer-checked:block" />
    </div>
  </div>
  <span>Accept terms</span>
</label>
```

### Dropdown/Select Triggers

```tsx
// Bad: Small dropdown trigger
<button className="text-sm">
  Select option <ChevronDown className="w-3 h-3" />
</button>

// Good: Full-width, adequately sized
<button className="w-full px-4 py-3 flex items-center justify-between border rounded-lg min-h-[44px]">
  <span>Select option</span>
  <ChevronDown className="w-5 h-5" />
</button>
```

## Spacing Between Touch Targets

```tsx
// Bad: Buttons too close together
<div className="flex gap-1">
  <button className="p-2">Edit</button>
  <button className="p-2">Delete</button>
</div>

// Good: Adequate spacing
<div className="flex gap-2">
  <button className="px-4 py-2 min-h-[44px]">Edit</button>
  <button className="px-4 py-2 min-h-[44px]">Delete</button>
</div>

// Alternative: Combined into single target with divider
<div className="flex rounded-lg border overflow-hidden">
  <button className="px-4 py-2 min-h-[44px] hover:bg-gray-50">Edit</button>
  <div className="w-px bg-gray-200" />
  <button className="px-4 py-2 min-h-[44px] hover:bg-gray-50">Delete</button>
</div>
```

## Invisible Touch Target Expansion

Use negative margins to expand touch area without affecting visual layout:

```tsx
// Expand touch area without changing visual size
<button className="relative">
  <span className="absolute -inset-2" aria-hidden="true" />
  <span className="relative">Small visual button</span>
</button>

// Or using padding/margin trick
<button className="p-3 -m-3">
  <Icon className="w-4 h-4" />
</button>
```

## Mobile Navigation Patterns

### Bottom Navigation Bar

```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-white border-t safe-area-pb">
  <div className="flex justify-around">
    {navItems.map((item) => (
      <a
        key={item.href}
        href={item.href}
        className="flex flex-col items-center py-3 px-4 min-w-[64px] min-h-[48px]"
      >
        <item.icon className="w-6 h-6" />
        <span className="text-xs mt-1">{item.label}</span>
      </a>
    ))}
  </div>
</nav>
```

### Hamburger Menu Button

```tsx
<button className="p-3 -m-3 lg:hidden" aria-label="Open menu" aria-expanded={isOpen}>
  <MenuIcon className="w-6 h-6" />
</button>
```

## Tailwind Utilities for Touch

```tsx
// Prevent double-tap zoom on buttons
<button className="touch-manipulation">...</button>

// Full minimum size utility class
// Add to tailwind.config.js:
// theme: { extend: { minWidth: { 'touch': '44px' }, minHeight: { 'touch': '44px' } } }
<button className="min-w-touch min-h-touch">...</button>
```

## Testing Touch Targets

1. Chrome DevTools → More tools → Rendering → Show highlights for tap targets
2. Lighthouse Accessibility audit checks tap target sizes
3. Manually test on real device - can you tap without accidental taps?
4. Use browser extension like "Touch Target Size Checker"

## Exceptions

Inline text links don't need 44px targets if:

- Adequate spacing from other links
- Sentence context makes target clear
- Not in a dense list

# Accessibility (jsx-a11y) Fix Patterns

## When to Use

Apply these fixes to JSX components that violate WCAG accessibility guidelines via `eslint-plugin-jsx-a11y` rules.

## 1. Click Handler Without Keyboard Handler

**Rule**: `jsx-a11y/click-events-have-key-events`

### Before

```tsx
<div onClick={handleClick}>Click me</div>
```

### After

```tsx
<button type="button" onClick={handleClick}>Click me</button>

// Or if div is required:
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Click me
</div>
```

### Best Practice

- Prefer semantic `<button>` over `<div>` with click handlers
- Only use `role="button"` when layout constraints require a div

## 2. Non-Interactive Element with Event Handler

**Rule**: `jsx-a11y/no-noninteractive-element-interactions`

### Before

```tsx
<img src="icon.png" onClick={handleClick} />
<h2 onClick={toggleSection}>Section Title</h2>
```

### After

```tsx
<button type="button" onClick={handleClick}>
  <img src="icon.png" alt="Action icon" />
</button>

<button type="button" onClick={toggleSection} className="section-header">
  <h2>Section Title</h2>
</button>
```

## 3. Missing Label Association

**Rule**: `jsx-a11y/label-has-associated-control`

### Before

```tsx
<label>Email</label>
<input type="email" />
```

### After

```tsx
<label htmlFor="email">Email</label>
<input type="email" id="email" />

// Or implicit association:
<label>
  Email
  <input type="email" />
</label>
```

## 4. Missing Alt Text

**Rule**: `jsx-a11y/alt-text`

### Before

```tsx
<img src="photo.jpg" />
```

### After

```tsx
<img src="photo.jpg" alt="User profile photo" />

// For decorative images:
<img src="decoration.svg" alt="" role="presentation" />
```

## 5. Anchor Without href

**Rule**: `jsx-a11y/anchor-is-valid`

### Before

```tsx
<a onClick={handleClick}>Click here</a>
```

### After

```tsx
<button type="button" onClick={handleClick}>Click here</button>

// Or if anchor is required:
<a href="#" onClick={(e) => { e.preventDefault(); handleClick(); }}>
  Click here
</a>
```

### Best Practice

- Use `<button>` for actions
- Use `<a>` only for navigation with valid `href`

## 6. Redundant Role

**Rule**: `jsx-a11y/no-redundant-roles`

### Before

```tsx
<button role="button">Click</button>
<nav role="navigation">...</nav>
```

### After

```tsx
<button type="button">Click</button>
<nav>...</nav>
```

## 7. Missing Button Type

**Rule**: `react/button-has-type`

### Before

```tsx
<button onClick={handleClick}>Submit</button>
```

### After

```tsx
<button type="button" onClick={handleClick}>Submit</button>
<button type="submit">Submit Form</button>
<button type="reset">Reset</button>
```

### When to Use Each

- `type="button"` - Default for click handlers (prevents form submission)
- `type="submit"` - For form submission buttons
- `type="reset"` - For form reset buttons

## 8. Autofocus

**Rule**: `jsx-a11y/no-autofocus`

### Before

```tsx
<input autoFocus />
```

### After

```tsx
// Remove autoFocus or add disable comment if intentional:
<input /> {/* Focus managed in useEffect */}

// Or with justification:
{/* eslint-disable-next-line jsx-a11y/no-autofocus */}
<input autoFocus /> {/* Modal first field - required for UX */}
```

## 9. Interactive Element Role

**Rule**: `jsx-a11y/no-static-element-interactions`

### Before

```tsx
<div onClick={handleClick} onKeyDown={handleKeyDown}>
  Interactive content
</div>
```

### After

```tsx
<div role="button" tabIndex={0} onClick={handleClick} onKeyDown={handleKeyDown}>
  Interactive content
</div>
```

## Summary

- Use semantic HTML (`<button>`, `<a>`, `<label>`) over generic divs
- Always provide `type` attribute for buttons
- Associate labels with form controls
- Provide meaningful alt text for images
- Add keyboard handlers (`onKeyDown`) when using `onClick` on non-interactive elements
- Include ARIA roles when semantic HTML isn't possible

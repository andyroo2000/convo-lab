import { useEffect } from 'react';

interface SeoMetaOptions {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  robots?: string;
}

type SeoOption = keyof SeoMetaOptions;
type HeadTag = 'link' | 'meta';
type IdentityAttribute = 'name' | 'property' | 'rel';
type ValueAttribute = 'content' | 'href';

interface HeadBinding {
  option: SeoOption;
  tag: HeadTag;
  identityAttribute: IdentityAttribute;
  identityValue: string;
  valueAttribute: ValueAttribute;
  fixedValue?: string;
  restore?: boolean;
}

const HEAD_BINDINGS: readonly HeadBinding[] = [
  {
    option: 'title',
    tag: 'meta',
    identityAttribute: 'property',
    identityValue: 'og:type',
    valueAttribute: 'content',
    fixedValue: 'website',
    restore: false,
  },
  {
    option: 'title',
    tag: 'meta',
    identityAttribute: 'property',
    identityValue: 'og:title',
    valueAttribute: 'content',
  },
  {
    option: 'title',
    tag: 'meta',
    identityAttribute: 'name',
    identityValue: 'twitter:card',
    valueAttribute: 'content',
    fixedValue: 'summary_large_image',
  },
  {
    option: 'title',
    tag: 'meta',
    identityAttribute: 'name',
    identityValue: 'twitter:title',
    valueAttribute: 'content',
  },
  {
    option: 'description',
    tag: 'meta',
    identityAttribute: 'name',
    identityValue: 'description',
    valueAttribute: 'content',
  },
  {
    option: 'description',
    tag: 'meta',
    identityAttribute: 'property',
    identityValue: 'og:description',
    valueAttribute: 'content',
  },
  {
    option: 'description',
    tag: 'meta',
    identityAttribute: 'name',
    identityValue: 'twitter:description',
    valueAttribute: 'content',
  },
  {
    option: 'robots',
    tag: 'meta',
    identityAttribute: 'name',
    identityValue: 'robots',
    valueAttribute: 'content',
  },
  {
    option: 'canonicalUrl',
    tag: 'link',
    identityAttribute: 'rel',
    identityValue: 'canonical',
    valueAttribute: 'href',
  },
  {
    option: 'canonicalUrl',
    tag: 'meta',
    identityAttribute: 'property',
    identityValue: 'og:url',
    valueAttribute: 'content',
  },
];

function bindingSelector(binding: HeadBinding): string {
  return `${binding.tag}[${binding.identityAttribute}="${binding.identityValue}"]`;
}

function findHeadElement(binding: HeadBinding): HTMLElement | null {
  return document.head.querySelector(bindingSelector(binding));
}

function upsertHeadValue(binding: HeadBinding, value: string): void {
  let element = findHeadElement(binding);
  if (!element) {
    element = document.createElement(binding.tag);
    element.setAttribute(binding.identityAttribute, binding.identityValue);
    document.head.appendChild(element);
  }
  element.setAttribute(binding.valueAttribute, value);
}

function captureHeadValues(): ReadonlyMap<HeadBinding, string | null> {
  return new Map(
    HEAD_BINDINGS.map((binding) => [
      binding,
      findHeadElement(binding)?.getAttribute(binding.valueAttribute) ?? null,
    ])
  );
}

function applyHeadValues(options: SeoMetaOptions): void {
  HEAD_BINDINGS.forEach((binding) => {
    const optionValue = options[binding.option];
    if (!optionValue) return;
    upsertHeadValue(binding, binding.fixedValue ?? optionValue);
  });
}

function restoreHeadValue(binding: HeadBinding, previousValue: string | null | undefined): void {
  if (previousValue) {
    upsertHeadValue(binding, previousValue);
    return;
  }
  findHeadElement(binding)?.remove();
}

function restoreHeadValues(
  options: SeoMetaOptions,
  previousValues: ReadonlyMap<HeadBinding, string | null>
): void {
  HEAD_BINDINGS.forEach((binding) => {
    if (binding.restore === false) return;
    if (!options[binding.option]) return;
    restoreHeadValue(binding, previousValues.get(binding));
  });
}

export default function useSeoMeta(options: SeoMetaOptions): void {
  const { canonicalUrl, description, robots, title } = options;

  useEffect(() => {
    const currentOptions = { canonicalUrl, description, robots, title };
    const previousTitle = document.title;
    const previousHeadValues = captureHeadValues();

    if (title) document.title = title;
    applyHeadValues(currentOptions);

    return () => {
      if (title) document.title = previousTitle;
      restoreHeadValues(currentOptions, previousHeadValues);
    };
  }, [canonicalUrl, description, robots, title]);
}

import { useEffect } from 'react';

interface SeoMetaOptions {
  title: string;
  description: string;
  canonicalUrl: string;
  robots?: string;
}

function upsertNamedMeta(name: string, content: string): HTMLMetaElement {
  let element = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('name', name);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
  return element;
}

function upsertPropertyMeta(property: string, content: string): HTMLMetaElement {
  let element = document.head.querySelector(
    `meta[property="${property}"]`
  ) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute('property', property);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
  return element;
}

function upsertCanonical(url: string): HTMLLinkElement {
  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', url);
  return element;
}

export default function useSeoMeta(options: SeoMetaOptions): void {
  useEffect(() => {
    const previousTitle = document.title;

    const descriptionMeta = document.head.querySelector(
      'meta[name="description"]'
    ) as HTMLMetaElement | null;
    const previousDescription = descriptionMeta?.getAttribute('content');

    const robotsMeta = document.head.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const previousRobots = robotsMeta?.getAttribute('content');

    const canonicalLink = document.head.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement | null;
    const previousCanonical = canonicalLink?.getAttribute('href');

    const ogTitleMeta = document.head.querySelector(
      'meta[property="og:title"]'
    ) as HTMLMetaElement | null;
    const previousOgTitle = ogTitleMeta?.getAttribute('content');

    const ogDescriptionMeta = document.head.querySelector(
      'meta[property="og:description"]'
    ) as HTMLMetaElement | null;
    const previousOgDescription = ogDescriptionMeta?.getAttribute('content');

    const ogUrlMeta = document.head.querySelector(
      'meta[property="og:url"]'
    ) as HTMLMetaElement | null;
    const previousOgUrl = ogUrlMeta?.getAttribute('content');

    const twitterCardMeta = document.head.querySelector(
      'meta[name="twitter:card"]'
    ) as HTMLMetaElement | null;
    const previousTwitterCard = twitterCardMeta?.getAttribute('content');

    const twitterTitleMeta = document.head.querySelector(
      'meta[name="twitter:title"]'
    ) as HTMLMetaElement | null;
    const previousTwitterTitle = twitterTitleMeta?.getAttribute('content');

    const twitterDescriptionMeta = document.head.querySelector(
      'meta[name="twitter:description"]'
    ) as HTMLMetaElement | null;
    const previousTwitterDescription = twitterDescriptionMeta?.getAttribute('content');

    document.title = options.title;

    upsertNamedMeta('description', options.description);
    upsertNamedMeta('robots', options.robots ?? 'index,follow');

    upsertPropertyMeta('og:type', 'website');
    upsertPropertyMeta('og:title', options.title);
    upsertPropertyMeta('og:description', options.description);
    upsertPropertyMeta('og:url', options.canonicalUrl);

    upsertNamedMeta('twitter:card', 'summary_large_image');
    upsertNamedMeta('twitter:title', options.title);
    upsertNamedMeta('twitter:description', options.description);

    upsertCanonical(options.canonicalUrl);

    return () => {
      document.title = previousTitle;

      if (previousDescription) {
        upsertNamedMeta('description', previousDescription);
      }

      if (previousRobots) {
        upsertNamedMeta('robots', previousRobots);
      }

      if (previousCanonical) {
        upsertCanonical(previousCanonical);
      }

      if (previousOgTitle) {
        upsertPropertyMeta('og:title', previousOgTitle);
      }

      if (previousOgDescription) {
        upsertPropertyMeta('og:description', previousOgDescription);
      }

      if (previousOgUrl) {
        upsertPropertyMeta('og:url', previousOgUrl);
      }

      if (previousTwitterCard) {
        upsertNamedMeta('twitter:card', previousTwitterCard);
      }

      if (previousTwitterTitle) {
        upsertNamedMeta('twitter:title', previousTwitterTitle);
      }

      if (previousTwitterDescription) {
        upsertNamedMeta('twitter:description', previousTwitterDescription);
      }
    };
  }, [options.canonicalUrl, options.description, options.robots, options.title]);
}

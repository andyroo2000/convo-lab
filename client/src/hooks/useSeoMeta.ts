import { useEffect } from 'react';

interface SeoMetaOptions {
  title?: string;
  description?: string;
  canonicalUrl?: string;
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

function removeNamedMeta(name: string): void {
  const element = document.head.querySelector(`meta[name="${name}"]`);
  element?.remove();
}

function removePropertyMeta(property: string): void {
  const element = document.head.querySelector(`meta[property="${property}"]`);
  element?.remove();
}

function removeCanonical(): void {
  const element = document.head.querySelector('link[rel="canonical"]');
  element?.remove();
}

export default function useSeoMeta(options: SeoMetaOptions): void {
  useEffect(() => {
    const previousTitle = document.title;

    const previousDescriptionEl = document.head.querySelector(
      'meta[name="description"]'
    ) as HTMLMetaElement | null;
    const previousDescription = previousDescriptionEl?.getAttribute('content');

    const previousRobotsEl = document.head.querySelector(
      'meta[name="robots"]'
    ) as HTMLMetaElement | null;
    const previousRobots = previousRobotsEl?.getAttribute('content');

    const previousCanonicalEl = document.head.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement | null;
    const previousCanonical = previousCanonicalEl?.getAttribute('href');

    const previousOgTitleEl = document.head.querySelector(
      'meta[property="og:title"]'
    ) as HTMLMetaElement | null;
    const previousOgTitle = previousOgTitleEl?.getAttribute('content');

    const previousOgDescriptionEl = document.head.querySelector(
      'meta[property="og:description"]'
    ) as HTMLMetaElement | null;
    const previousOgDescription = previousOgDescriptionEl?.getAttribute('content');

    const previousOgUrlEl = document.head.querySelector(
      'meta[property="og:url"]'
    ) as HTMLMetaElement | null;
    const previousOgUrl = previousOgUrlEl?.getAttribute('content');

    const previousTwitterCardEl = document.head.querySelector(
      'meta[name="twitter:card"]'
    ) as HTMLMetaElement | null;
    const previousTwitterCard = previousTwitterCardEl?.getAttribute('content');

    const previousTwitterTitleEl = document.head.querySelector(
      'meta[name="twitter:title"]'
    ) as HTMLMetaElement | null;
    const previousTwitterTitle = previousTwitterTitleEl?.getAttribute('content');

    const previousTwitterDescriptionEl = document.head.querySelector(
      'meta[name="twitter:description"]'
    ) as HTMLMetaElement | null;
    const previousTwitterDescription = previousTwitterDescriptionEl?.getAttribute('content');

    if (options.title) {
      document.title = options.title;
      upsertPropertyMeta('og:type', 'website');
      upsertPropertyMeta('og:title', options.title);
      upsertNamedMeta('twitter:card', 'summary_large_image');
      upsertNamedMeta('twitter:title', options.title);
    }

    if (options.description) {
      upsertNamedMeta('description', options.description);
      upsertPropertyMeta('og:description', options.description);
      upsertNamedMeta('twitter:description', options.description);
    }

    if (options.robots) {
      upsertNamedMeta('robots', options.robots);
    }

    if (options.canonicalUrl) {
      upsertCanonical(options.canonicalUrl);
      upsertPropertyMeta('og:url', options.canonicalUrl);
    }

    return () => {
      if (options.title) {
        document.title = previousTitle;

        if (previousOgTitle) {
          upsertPropertyMeta('og:title', previousOgTitle);
        } else {
          removePropertyMeta('og:title');
        }

        if (previousTwitterCard) {
          upsertNamedMeta('twitter:card', previousTwitterCard);
        } else {
          removeNamedMeta('twitter:card');
        }

        if (previousTwitterTitle) {
          upsertNamedMeta('twitter:title', previousTwitterTitle);
        } else {
          removeNamedMeta('twitter:title');
        }
      }

      if (options.description) {
        if (previousDescription) {
          upsertNamedMeta('description', previousDescription);
        } else {
          removeNamedMeta('description');
        }

        if (previousOgDescription) {
          upsertPropertyMeta('og:description', previousOgDescription);
        } else {
          removePropertyMeta('og:description');
        }

        if (previousTwitterDescription) {
          upsertNamedMeta('twitter:description', previousTwitterDescription);
        } else {
          removeNamedMeta('twitter:description');
        }
      }

      if (options.robots) {
        if (previousRobots) {
          upsertNamedMeta('robots', previousRobots);
        } else {
          removeNamedMeta('robots');
        }
      }

      if (options.canonicalUrl) {
        if (previousCanonical) {
          upsertCanonical(previousCanonical);
        } else {
          removeCanonical();
        }

        if (previousOgUrl) {
          upsertPropertyMeta('og:url', previousOgUrl);
        } else {
          removePropertyMeta('og:url');
        }
      }
    };
  }, [options.canonicalUrl, options.description, options.robots, options.title]);
}

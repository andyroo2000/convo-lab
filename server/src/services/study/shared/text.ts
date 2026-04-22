import { decode } from 'html-entities';
import { parseDocument } from 'htmlparser2';

import { isRecord } from './guards.js';

interface ParsedHtmlNode {
  type?: string;
  name?: string;
  data?: string;
  children?: ParsedHtmlNode[];
}

function stripNullChars(value: string): string {
  return value.replaceAll('\0', '');
}

const BLOCK_LEVEL_TAGS = new Set([
  'p',
  'div',
  'blockquote',
  'section',
  'article',
  'header',
  'footer',
  'li',
  'ul',
  'ol',
]);

function collectHtmlText(node: ParsedHtmlNode, output: string[]) {
  if (node.type === 'text' || node.type === 'cdata') {
    output.push(node.data ?? '');
    return;
  }

  if (node.type === 'comment') {
    return;
  }

  const name = (node.name ?? '').toLowerCase();
  if (name === 'br') {
    output.push('\n');
    return;
  }

  for (const child of node.children ?? []) {
    collectHtmlText(child, output);
  }

  if (BLOCK_LEVEL_TAGS.has(name)) {
    output.push('\n');
  }
}

function collapsePlainText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToPlainText(raw: string): string {
  const document = parseDocument(stripNullChars(raw));
  const output: string[] = [];

  for (const child of document.children as ParsedHtmlNode[]) {
    collectHtmlText(child, output);
  }

  return collapsePlainText(decode(output.join('')));
}

export function stripHtml(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return htmlToPlainText(raw);
}

function appendSearchTextFragments(value: unknown, fragments: string[]) {
  if (typeof value === 'string') {
    const normalized = stripHtml(value) ?? value;
    if (normalized.trim()) {
      fragments.push(normalized.trim());
    }
    return;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    fragments.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => appendSearchTextFragments(entry, fragments));
    return;
  }

  if (isRecord(value)) {
    Object.values(value).forEach((entry) => appendSearchTextFragments(entry, fragments));
  }
}

export function toSearchText(...values: unknown[]): string {
  const fragments: string[] = [];
  values.forEach((value) => appendSearchTextFragments(value, fragments));

  return fragments.join('\n').replace(/\s+/g, ' ').trim();
}

export function noteFieldValueToString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || typeof value === 'undefined') return null;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

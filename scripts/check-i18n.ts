/**
 * i18n completeness check — AST-based hardcoded string detection
 *
 * Scans apps/web/src/**\/*.tsx for hardcoded English strings using
 * the TypeScript compiler API (not regex).
 *
 * Wired to: pnpm turbo check:i18n
 */

import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __scriptDir = dirname(fileURLToPath(import.meta.url));
const WEB_SRC = resolve(__scriptDir, '..', 'apps', 'web', 'src');

interface Violation {
  file: string;
  line: number;
  text: string;
  suggestion: string;
}

// Directories and file patterns excluded from scanning.
// These contain code that legitimately cannot use useTranslations():
// - components/ui/ — shadcn/ui primitives (project rule: do not modify)
// - design-test/ — visual verification page, not production UI
// - global-error.tsx — React error boundary renders outside i18n provider
const EXCLUDED_PATHS = [
  '/components/ui/',
  '/design-test/',
  '/global-error.tsx',
];

function isExcludedPath(filePath: string): boolean {
  return EXCLUDED_PATHS.some((p) => filePath.includes(p));
}

// Props whose string values should be translated
const I18N_PROPS = new Set([
  'placeholder',
  'title',
  'aria-label',
  'aria-description',
  'alt',
]);

// Props whose values are NOT translatable
const EXCLUDED_PROPS = new Set([
  'className',
  'class',
  'data-testid',
  'data-state',
  'data-side',
  'data-align',
  'data-orientation',
  'htmlFor',
  'id',
  'name',
  'type',
  'role',
  'key',
  'href',
  'src',
  'rel',
  'target',
  'method',
  'action',
  'autoComplete',
  'inputMode',
  'pattern',
  'style',
]);

function collectTsxFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules and test directories
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      files.push(...collectTsxFiles(fullPath));
    } else if (entry.isFile() && extname(entry.name) === '.tsx') {
      // Skip test files
      if (
        entry.name.endsWith('.test.tsx') ||
        entry.name.endsWith('.spec.tsx')
      ) {
        continue;
      }
      files.push(fullPath);
    }
  }
  return files;
}

function containsAlphabetic(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

function isSingleCharOrPunctuation(text: string): boolean {
  // Single character, or only punctuation/symbols/whitespace/digits
  if (text.length <= 1) return true;
  return !/[a-zA-Z]/.test(text);
}

function isDirectiveString(text: string): boolean {
  return text === 'use client' || text === 'use server';
}

function isHtmlEntity(text: string): boolean {
  // Matches HTML entities like &nbsp; &amp; &#123; &#x1F4A9;
  return /^(&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;)$/.test(text.trim());
}

function isCssOrTailwindClass(text: string): boolean {
  // Tailwind/CSS classes: space-separated tokens like "flex items-center gap-2"
  // Heuristic: no uppercase-starting words, contains hyphens or common CSS tokens
  const tokens = text.trim().split(/\s+/);
  if (tokens.length === 0) return false;

  const cssPatterns =
    /^(flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|overflow|bg-|text-|border-|rounded|shadow|p-|px-|py-|pt-|pb-|pl-|pr-|m-|mx-|my-|mt-|mb-|ml-|mr-|gap-|w-|h-|min-|max-|font-|leading-|tracking-|z-|top-|bottom-|left-|right-|inset-|ring-|outline-|cursor-|select-|transition|duration|ease|animate|shrink|grow|basis|col-|row-|justify|items-|self-|place-|space-|divide|sr-only|not-sr-only|truncate|touch-target|tablet:|mobile:|desktop:|hover:|focus:|active:|disabled:|dark:|group|peer|var\(--|sm:|md:|lg:|xl:|2xl:)/;

  // If most tokens look like CSS classes, treat the entire string as CSS.
  // Only count tokens as CSS if they match known patterns or contain hyphens/brackets
  // (plain lowercase words like "should" or "name" are NOT CSS classes).
  const cssTokenCount = tokens.filter(
    (t) =>
      cssPatterns.test(t) ||
      (/^[a-z][a-z0-9-]*(\[.*\])?$/.test(t) && (t.includes('-') || t.includes('['))),
  ).length;
  return cssTokenCount / tokens.length > 0.5;
}

function isInTypePosition(node: ts.Node): boolean {
  // Walk up to check if this node is inside a type annotation, interface, or type alias
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isTypeAliasDeclaration(current) ||
      ts.isInterfaceDeclaration(current) ||
      ts.isTypeNode(current) ||
      ts.isTypeLiteralNode(current) ||
      ts.isTypeParameterDeclaration(current)
    ) {
      return true;
    }
    // Property signatures in interfaces
    if (ts.isPropertySignature(current)) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isInImportOrRequire(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isImportDeclaration(current) || ts.isExportDeclaration(current)) {
      return true;
    }
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === 'require'
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isObjectKeyOrEnumValue(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;

  // Object property key: { "key": value }
  if (ts.isPropertyAssignment(parent) && parent.name === node) {
    return true;
  }

  // Computed property name
  if (ts.isComputedPropertyName(parent)) {
    return true;
  }

  // Enum member
  if (ts.isEnumMember(parent)) {
    return true;
  }

  // Property name in object destructuring
  if (ts.isBindingElement(parent)) {
    return true;
  }

  // As const array items used as keys (common pattern)
  if (ts.isPropertyDeclaration(parent) && parent.name === node) {
    return true;
  }

  return false;
}

function isDataAttribute(propName: string): boolean {
  return propName.startsWith('data-');
}

function isJsxAttributeExcluded(node: ts.StringLiteral): boolean {
  const parent = node.parent;
  if (!parent) return false;

  // Check if this is a JSX attribute value
  if (ts.isJsxAttribute(parent)) {
    const propName = parent.name.getText();

    // Excluded props (className, data-*, etc.)
    if (EXCLUDED_PROPS.has(propName) || isDataAttribute(propName)) {
      return true;
    }

    // i18n-relevant props are NOT excluded — they should trigger violations
    if (I18N_PROPS.has(propName)) {
      return false;
    }

    // Other props (e.g., onClick string handlers, key, etc.) — exclude
    // unless they're known translatable props
    return true;
  }

  // JSX expression container inside a JSX attribute
  if (ts.isJsxExpression(parent) && parent.parent && ts.isJsxAttribute(parent.parent)) {
    const propName = parent.parent.name.getText();
    if (EXCLUDED_PROPS.has(propName) || isDataAttribute(propName)) {
      return true;
    }
    if (I18N_PROPS.has(propName)) {
      return false;
    }
    return true;
  }

  return false;
}

function isToastCall(node: ts.StringLiteral): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === 'toast'
    ) {
      return true;
    }
    // toast.success(), toast.error(), etc.
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      ts.isIdentifier(current.expression.expression) &&
      current.expression.expression.text === 'toast'
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function checkFile(filePath: string, sourceFile: ts.SourceFile): Violation[] {
  const violations: Violation[] = [];
  const relPath = relative(resolve(__scriptDir, '..'), filePath);

  function visit(node: ts.Node) {
    // Check JSX text content (direct text children of JSX elements)
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (text && containsAlphabetic(text) && !isSingleCharOrPunctuation(text) && !isHtmlEntity(text)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push({
          file: relPath,
          line: line + 1,
          text: text.substring(0, 60),
          suggestion: `Use t('key') from useTranslations() instead of hardcoded "${text.substring(0, 40)}"`,
        });
      }
    }

    // Check string literals
    if (ts.isStringLiteral(node)) {
      const text = node.text;

      // Skip non-alphabetic, single-char, directives
      if (!containsAlphabetic(text)) {
        ts.forEachChild(node, visit);
        return;
      }
      if (isSingleCharOrPunctuation(text)) {
        ts.forEachChild(node, visit);
        return;
      }
      if (isDirectiveString(text)) {
        ts.forEachChild(node, visit);
        return;
      }

      // Skip CSS/Tailwind classes
      if (isCssOrTailwindClass(text)) {
        ts.forEachChild(node, visit);
        return;
      }

      // Skip imports/exports
      if (isInImportOrRequire(node)) {
        ts.forEachChild(node, visit);
        return;
      }

      // Skip type positions
      if (isInTypePosition(node)) {
        ts.forEachChild(node, visit);
        return;
      }

      // Skip object keys and enum values
      if (isObjectKeyOrEnumValue(node)) {
        ts.forEachChild(node, visit);
        return;
      }

      // Skip excluded JSX attributes (className, data-*, etc.)
      if (isJsxAttributeExcluded(node)) {
        ts.forEachChild(node, visit);
        return;
      }

      // Check for toast calls — these should be flagged
      const inToast = isToastCall(node);

      // If we're in a JSX attribute that's in I18N_PROPS, flag it
      const parent = node.parent;
      if (parent && ts.isJsxAttribute(parent)) {
        const propName = parent.name.getText();
        if (I18N_PROPS.has(propName)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            file: relPath,
            line: line + 1,
            text: text.substring(0, 60),
            suggestion: `Use t('key') for ${propName}="${text.substring(0, 40)}"`,
          });
          ts.forEachChild(node, visit);
          return;
        }
      }

      // If in a toast call, flag it
      if (inToast) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push({
          file: relPath,
          line: line + 1,
          text: text.substring(0, 60),
          suggestion: `Use t('key') in toast() instead of hardcoded "${text.substring(0, 40)}"`,
        });
        ts.forEachChild(node, visit);
        return;
      }
    }

    // Check template literals in JSX expressions for completeness
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text;
      if (containsAlphabetic(text) && !isSingleCharOrPunctuation(text) && !isCssOrTailwindClass(text)) {
        const parent = node.parent;
        // Only flag if in a JSX context or toast
        if (parent && ts.isJsxExpression(parent)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            file: relPath,
            line: line + 1,
            text: text.substring(0, 60),
            suggestion: `Use t('key') instead of hardcoded template literal "${text.substring(0, 40)}"`,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

async function main() {
  const files = collectTsxFiles(WEB_SRC);
  const allViolations: Violation[] = [];

  for (const filePath of files) {
    if (isExcludedPath(filePath)) continue;
    const content = readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true, // setParentNodes
      ts.ScriptKind.TSX,
    );
    const violations = checkFile(filePath, sourceFile);
    allViolations.push(...violations);
  }

  if (allViolations.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[check-i18n] Scanned ${files.length} .tsx file(s) in apps/web/src — no hardcoded strings found.`,
    );
    process.exit(0);
  } else {
    // eslint-disable-next-line no-console
    console.error(
      `[check-i18n] Found ${allViolations.length} hardcoded string(s) in ${files.length} file(s):\n`,
    );
    for (const v of allViolations) {
      // eslint-disable-next-line no-console
      console.error(`  ${v.file}:${v.line}`);
      // eslint-disable-next-line no-console
      console.error(`    Text: "${v.text}"`);
      // eslint-disable-next-line no-console
      console.error(`    Suggestion: ${v.suggestion}\n`);
    }
    process.exit(1);
  }
}

main();

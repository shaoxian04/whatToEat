```markdown
# whatToEat Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns, coding conventions, and workflows used in the `whatToEat` repository—a Next.js application written in TypeScript. You'll learn how to implement features, create API endpoints, build UI pages, refactor code, and write tests following the established standards of this codebase.

## Coding Conventions

- **File Naming:** Use camelCase for files and folders.
  - Example: `decisionHelper.ts`, `placesApi.ts`
- **Import Style:** Use path aliases for imports.
  ```typescript
  import decisionHelper from '@/lib/decisionHelper'
  import PlaceCard from '@/components/placeCard'
  ```
- **Export Style:** Default exports are preferred.
  ```typescript
  // src/lib/decisionHelper.ts
  export default function decisionHelper() { ... }
  ```
- **Commit Messages:** Use [Conventional Commits](https://www.conventionalcommits.org/).
  - Prefixes: `feat`, `test`, `refactor`, `chore`, `docs`
  - Example: `feat: add random decision picker`

## Workflows

### Feature Implementation with Unit Tests
**Trigger:** When adding a new feature, utility, or component  
**Command:** `/new-feature`

1. Create or update the implementation file(s) for your feature/module/component.
   - Example: `src/lib/decision/randomPicker.ts`
2. Create or update the corresponding unit test file(s) alongside the implementation.
   - Example: `src/lib/decision/randomPicker.test.ts`
3. Commit with a descriptive message:
   ```
   feat: add randomPicker utility and tests
   ```

### API Endpoint Creation with Tests
**Trigger:** When exposing new backend functionality via an API route  
**Command:** `/new-api-endpoint`

1. Create a new API route implementation under `src/app/api/`.
   - Example: `src/app/api/suggest/route.ts`
2. Create the corresponding test file for the API route.
   - Example: `src/app/api/suggest/route.test.ts`
3. If needed, create or update supporting utility files and their tests.
   - Example: `src/lib/suggestion.ts`, `src/lib/suggestion.test.ts`
4. Commit with a message like:
   ```
   feat: add suggest API endpoint with tests
   ```

### UI Page or Mode Creation with Associated Components
**Trigger:** When adding a new page or user flow to the application  
**Command:** `/new-ui-page`

1. Create or update the page file under `src/app/[mode]/page.tsx`.
   - Example: `src/app/choose/page.tsx`
2. Create or update associated component(s) in `src/components/`.
   - Example: `src/components/choiceList.tsx`
3. Add or update corresponding test files for pages and components.
   - Example: `src/app/choose/page.test.tsx`, `src/components/choiceList.test.tsx`
4. Commit with a message like:
   ```
   feat: add choose page and choiceList component with tests
   ```

### Refactor with Targeted File Updates
**Trigger:** When improving or optimizing existing code after initial implementation  
**Command:** `/refactor`

1. Identify performance or code quality improvements.
2. Update implementation file(s) to apply the refactor.
   - Example: Refactor logic in `src/components/choiceList.tsx`
3. Optionally update or verify related test files.
   - Example: `src/components/choiceList.test.tsx`
4. Commit with a message like:
   ```
   refactor: optimize choiceList rendering
   ```

## Testing Patterns

- **Framework:** [Vitest](https://vitest.dev/)
- **Test File Pattern:** Place tests alongside implementation, using `.test.ts` or `.test.tsx` suffix.
  - Example: `src/lib/places/placesApi.test.ts`
- **Test Example:**
  ```typescript
  // src/lib/decision/randomPicker.test.ts
  import randomPicker from './randomPicker'

  test('picks a random item', () => {
    const items = ['a', 'b', 'c']
    expect(items).toContain(randomPicker(items))
  })
  ```

## Commands

| Command           | Purpose                                                        |
|-------------------|----------------------------------------------------------------|
| /new-feature      | Start a new feature/module/component with tests                |
| /new-api-endpoint | Add a new API endpoint with implementation and test coverage   |
| /new-ui-page      | Create a new UI page/mode with associated components and tests |
| /refactor         | Refactor or optimize existing code                             |
```
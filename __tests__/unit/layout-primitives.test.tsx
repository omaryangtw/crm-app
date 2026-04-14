// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import fc from "fast-check";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import { CardStack } from "@/app/_components/card-stack";
import { FormGrid } from "@/app/_components/form-grid";
import { InfoGrid } from "@/app/_components/info-grid";
import { DetailLayout } from "@/app/_components/detail-layout";
import { SectionCard } from "@/app/_components/section-card";

afterEach(() => cleanup());

// Generator for valid CSS class names (alphanumeric, no spaces, no special chars)
const cssClassArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/);

// Generator for non-empty text content (alphanumeric to avoid HTML injection issues)
const textArb = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/);

// ============================================================
// Property-Based Tests
// ============================================================

/**
 * **Feature: layout-primitives, Property 1: CardStack 渲染不變量**
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * For any set of children and any className string, CardStack renders a
 * container with `space-y-6` and all children text appears in the output.
 */
describe("Feature: layout-primitives, Property 1: CardStack 渲染不變量", () => {
  it("container has space-y-6 and all children appear in output", () => {
    fc.assert(
      fc.property(
        fc.array(textArb, { minLength: 1, maxLength: 8 }),
        fc.option(cssClassArb, { nil: undefined }),
        (childTexts, extraClass) => {
          const { container, unmount } = render(
            <CardStack className={extraClass}>
              {childTexts.map((text, i) => (
                <div key={i}>{text}</div>
              ))}
            </CardStack>
          );

          const wrapper = container.firstElementChild as HTMLElement;

          // Must contain space-y-6
          expect(wrapper.className).toContain("space-y-6");

          // If extra className provided, it should be present
          if (extraClass) {
            expect(wrapper.className).toContain(extraClass);
          }

          // All children text must appear
          for (const text of childTexts) {
            expect(container.textContent).toContain(text);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: layout-primitives, Property 2: FormGrid 欄數映射不變量**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 *
 * For any columns value ("2" or "3"), any children, and any className,
 * FormGrid renders the correct grid class and `gap-4`.
 */
describe("Feature: layout-primitives, Property 2: FormGrid 欄數映射不變量", () => {
  const expectedClasses: Record<string, string[]> = {
    "2": ["grid", "grid-cols-1", "gap-4", "sm:grid-cols-2"],
    "3": ["grid", "grid-cols-1", "gap-4", "sm:grid-cols-2", "lg:grid-cols-3"],
  };

  it("columns value maps to correct grid class with gap-4", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("2" as const, "3" as const),
        fc.array(textArb, { minLength: 1, maxLength: 8 }),
        fc.option(cssClassArb, { nil: undefined }),
        (columns, childTexts, extraClass) => {
          const { container, unmount } = render(
            <FormGrid columns={columns} className={extraClass}>
              {childTexts.map((text, i) => (
                <div key={i}>{text}</div>
              ))}
            </FormGrid>
          );

          const wrapper = container.firstElementChild as HTMLElement;

          // Must contain all expected classes for this column value
          for (const cls of expectedClasses[columns]) {
            expect(wrapper.className).toContain(cls);
          }

          // If extra className provided, it should be present
          if (extraClass) {
            expect(wrapper.className).toContain(extraClass);
          }

          // All children text must appear
          for (const text of childTexts) {
            expect(container.textContent).toContain(text);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: layout-primitives, Property 3: InfoGrid 欄數映射不變量**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * For any columns value ("2" or "3"), any children, and any className,
 * InfoGrid renders the correct grid class with `gap-x-6 gap-y-2`.
 */
describe("Feature: layout-primitives, Property 3: InfoGrid 欄數映射不變量", () => {
  const expectedClasses: Record<string, string[]> = {
    "2": ["grid", "grid-cols-1", "sm:grid-cols-2", "gap-x-6", "gap-y-2"],
    "3": ["grid", "grid-cols-1", "sm:grid-cols-3", "gap-x-6", "gap-y-2"],
  };

  it("columns value maps to correct grid class with gap-x-6 gap-y-2", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("2" as const, "3" as const),
        fc.array(textArb, { minLength: 1, maxLength: 8 }),
        fc.option(cssClassArb, { nil: undefined }),
        (columns, childTexts, extraClass) => {
          const { container, unmount } = render(
            <InfoGrid columns={columns} className={extraClass}>
              {childTexts.map((text, i) => (
                <div key={i}>{text}</div>
              ))}
            </InfoGrid>
          );

          const wrapper = container.firstElementChild as HTMLElement;

          // Must contain all expected classes for this column value
          for (const cls of expectedClasses[columns]) {
            expect(wrapper.className).toContain(cls);
          }

          // If extra className provided, it should be present
          if (extraClass) {
            expect(wrapper.className).toContain(extraClass);
          }

          // All children text must appear
          for (const text of childTexts) {
            expect(container.textContent).toContain(text);
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: layout-primitives, Property 4: DetailLayout 結構不變量**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.5**
 *
 * For any sidebar content, children content, and any className,
 * DetailLayout renders sidebar in col-span-1 area and children in col-span-3 area.
 */
describe("Feature: layout-primitives, Property 4: DetailLayout 結構不變量", () => {
  it("sidebar in col-span-1 and children in col-span-3 with correct grid classes", () => {
    fc.assert(
      fc.property(
        textArb,
        textArb,
        fc.option(cssClassArb, { nil: undefined }),
        (sidebarText, childrenText, extraClass) => {
          const { container, unmount } = render(
            <DetailLayout
              sidebar={<span>{sidebarText}</span>}
              className={extraClass}
            >
              <span>{childrenText}</span>
            </DetailLayout>
          );

          const wrapper = container.firstElementChild as HTMLElement;

          // Container must have correct grid classes
          expect(wrapper.className).toContain("grid");
          expect(wrapper.className).toContain("grid-cols-1");
          expect(wrapper.className).toContain("md:grid-cols-4");
          expect(wrapper.className).toContain("gap-6");

          // If extra className provided, it should be present
          if (extraClass) {
            expect(wrapper.className).toContain(extraClass);
          }

          // Sidebar area (first child) must have col-span-1 and contain sidebar text
          const sidebarArea = wrapper.children[0] as HTMLElement;
          expect(sidebarArea.className).toContain("col-span-1");
          expect(sidebarArea.textContent).toContain(sidebarText);

          // Children area (second child) must have col-span-3 and contain children text
          const childrenArea = wrapper.children[1] as HTMLElement;
          expect(childrenArea.className).toContain("col-span-3");
          expect(childrenArea.textContent).toContain(childrenText);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: layout-primitives, Property 5: SectionCard 結構不變量**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**
 *
 * For any title, optional count, optional action, children, and className,
 * SectionCard renders Card > CardHeader > CardContent structure with correct content.
 */
describe("Feature: layout-primitives, Property 5: SectionCard 結構不變量", () => {
  it("title, count format, action, and children render correctly", () => {
    fc.assert(
      fc.property(
        textArb,
        fc.option(fc.nat({ max: 10000 }), { nil: undefined }),
        fc.boolean(),
        textArb,
        fc.option(cssClassArb, { nil: undefined }),
        (title, count, hasAction, childrenText, extraClass) => {
          const actionText = "ActionBtn";
          const { container, unmount } = render(
            <SectionCard
              title={title}
              count={count}
              action={hasAction ? <button>{actionText}</button> : undefined}
              className={extraClass}
            >
              <div>{childrenText}</div>
            </SectionCard>
          );

          // Card (outermost) should have data-slot="card"
          const card = container.querySelector('[data-slot="card"]') as HTMLElement;
          expect(card).not.toBeNull();

          // If extra className provided, it should be on the card
          if (extraClass) {
            expect(card.className).toContain(extraClass);
          }

          // CardHeader should exist
          const header = container.querySelector('[data-slot="card-header"]') as HTMLElement;
          expect(header).not.toBeNull();

          // CardTitle should contain the title
          const titleEl = container.querySelector('[data-slot="card-title"]') as HTMLElement;
          expect(titleEl).not.toBeNull();
          expect(titleEl.textContent).toContain(title);

          // Count format: when count is defined, title element should contain "(count)"
          if (count !== undefined) {
            expect(titleEl.textContent).toContain(`(${count})`);
          } else {
            expect(titleEl.textContent).not.toContain("(");
          }

          // Action: when hasAction, action text should appear in header
          if (hasAction) {
            expect(header.textContent).toContain(actionText);
          }

          // CardContent should contain children text
          const content = container.querySelector('[data-slot="card-content"]') as HTMLElement;
          expect(content).not.toBeNull();
          expect(content.textContent).toContain(childrenText);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ============================================================
// Edge Cases — 邊界情況 (Unit Tests)
// ============================================================

describe("Edge Cases — 邊界情況", () => {
  /**
   * CardStack 零子元素渲染空容器
   * **Validates: Requirements 1.4**
   */
  it("CardStack renders an empty container with zero children", () => {
    const { container } = render(<CardStack />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.className).toContain("space-y-6");
    expect(wrapper.childElementCount).toBe(0);
  });

  /**
   * FormGrid 預設 columns 為 "3"
   * **Validates: Requirements 2.1**
   */
  it("FormGrid defaults to 3-column layout when columns prop is omitted", () => {
    const { container } = render(
      <FormGrid>
        <div>field</div>
      </FormGrid>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("lg:grid-cols-3");
    expect(wrapper.className).toContain("sm:grid-cols-2");
    expect(wrapper.className).toContain("gap-4");
  });

  /**
   * InfoGrid 預設 columns 為 "2"
   * **Validates: Requirements 3.1**
   */
  it("InfoGrid defaults to 2-column layout when columns prop is omitted", () => {
    const { container } = render(
      <InfoGrid>
        <div>info</div>
      </InfoGrid>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("sm:grid-cols-2");
    expect(wrapper.className).toContain("gap-x-6");
    expect(wrapper.className).toContain("gap-y-2");
    // Should NOT contain 3-column class
    expect(wrapper.className).not.toContain("sm:grid-cols-3");
  });

  /**
   * DetailLayout 無 className 時正確渲染
   * **Validates: Requirements 4.1**
   */
  it("DetailLayout renders correctly without className prop", () => {
    const { container } = render(
      <DetailLayout sidebar={<span>sidebar</span>}>
        <span>main</span>
      </DetailLayout>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("grid");
    expect(wrapper.className).toContain("md:grid-cols-4");
    expect(wrapper.className).toContain("gap-6");

    const sidebarArea = wrapper.children[0] as HTMLElement;
    expect(sidebarArea.textContent).toBe("sidebar");

    const mainArea = wrapper.children[1] as HTMLElement;
    expect(mainArea.textContent).toBe("main");
  });

  /**
   * SectionCard count 為 undefined 時不顯示數量
   * **Validates: Requirements 5.3**
   */
  it("SectionCard does not display count when count is undefined", () => {
    const { container } = render(
      <SectionCard title="Test Title">
        <div>content</div>
      </SectionCard>
    );
    const titleEl = container.querySelector('[data-slot="card-title"]') as HTMLElement;
    expect(titleEl).not.toBeNull();
    expect(titleEl.textContent).toBe("Test Title");
    expect(titleEl.textContent).not.toContain("(");
  });

  /**
   * SectionCard action 為 undefined 時不渲染操作區域
   * **Validates: Requirements 5.4**
   */
  it("SectionCard does not render action area when action is undefined", () => {
    const { container } = render(
      <SectionCard title="No Action">
        <div>content</div>
      </SectionCard>
    );
    const header = container.querySelector('[data-slot="card-header"]') as HTMLElement;
    expect(header).not.toBeNull();
    // Header should only contain the title element, no action button
    const buttons = header.querySelectorAll("button");
    expect(buttons.length).toBe(0);
    // Title text should be present
    expect(header.textContent).toContain("No Action");
  });
});

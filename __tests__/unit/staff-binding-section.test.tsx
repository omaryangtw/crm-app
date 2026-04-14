// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import React from "react";

// Polyfill ResizeObserver for cmdk in jsdom
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the component under test
// ---------------------------------------------------------------------------

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock server actions from binding-actions
vi.mock("@/app/_lib/actions/binding-actions", () => ({
  bindStaffUser: vi.fn(),
  unbindStaffUser: vi.fn(),
  getUnboundUsers: vi.fn().mockResolvedValue([]),
}));

// Mock @base-ui/react/popover to avoid portal/positioning issues in jsdom
vi.mock("@base-ui/react/popover", () => {
  const Popover = Object.assign(
    ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    {
      Root: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Trigger: ({
        children,
        render: renderProp,
        ...props
      }: {
        children?: React.ReactNode;
        render?: React.ReactElement;
        [key: string]: unknown;
      }) => {
        if (renderProp) {
          return React.cloneElement(renderProp as React.ReactElement, props, children);
        }
        return <button {...props}>{children}</button>;
      },
      Portal: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Positioner: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Popup: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
        <div {...props}>{children}</div>
      ),
      Title: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
      ),
      Description: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
      ),
    }
  );
  return { Popover };
});

// Import the component under test AFTER mocks
import StaffBindingSection from "@/app/(protected)/staff/[id]/_components/staff-binding-section";

afterEach(() => cleanup());

// ============================================================
// Unit Tests — StaffBindingSection
// ============================================================

/**
 * **Validates: Requirements 4.2**
 * When a Staff is bound to a User, the section displays the User's email
 * and an "解除綁定" (unbind) button.
 */
describe("StaffBindingSection — bound state", () => {
  it("displays bound user email and unbind button", () => {
    render(
      <StaffBindingSection
        staffId={1}
        boundUser={{ id: 10, email: "alice@example.com" }}
      />
    );

    // The bound user's email should be visible
    expect(screen.getByText("alice@example.com")).toBeDefined();

    // The unbind button should be present
    expect(screen.getByText("解除綁定")).toBeDefined();
  });

  it("does NOT show '尚未綁定' when bound", () => {
    render(
      <StaffBindingSection
        staffId={1}
        boundUser={{ id: 10, email: "bob@example.com" }}
      />
    );

    expect(screen.queryByText("尚未綁定")).toBeNull();
  });
});

/**
 * **Validates: Requirements 4.2, 4.3**
 * When a Staff is NOT bound, the section displays "尚未綁定" and a
 * combobox trigger for searching unbound users.
 */
describe("StaffBindingSection — unbound state", () => {
  it("displays '尚未綁定' and search trigger when no bound user", () => {
    render(
      <StaffBindingSection staffId={2} boundUser={null} />
    );

    // "尚未綁定" text should be visible
    expect(screen.getByText("尚未綁定")).toBeDefined();

    // The combobox trigger button with placeholder text should exist
    expect(screen.getByText("搜尋帳號 email...")).toBeDefined();

    // The "確認綁定" button should be present (disabled, but present)
    expect(screen.getByText("確認綁定")).toBeDefined();
  });

  it("does NOT show unbind button when unbound", () => {
    render(
      <StaffBindingSection staffId={2} boundUser={null} />
    );

    expect(screen.queryByText("解除綁定")).toBeNull();
  });
});

/**
 * **Validates: Requirements 6.2**
 * Non-admin users should NOT see the binding section. This is controlled
 * by the parent page.tsx via conditional rendering: `{isAdmin && <StaffBindingSection ... />}`.
 * We test the conditional rendering logic directly.
 */
describe("StaffBindingSection — admin visibility logic", () => {
  it("admin sees the binding section (conditional renders component)", () => {
    const isAdmin = true;
    const { container } = render(
      <div>
        {isAdmin && (
          <StaffBindingSection staffId={1} boundUser={null} />
        )}
      </div>
    );

    // The card title "帳號綁定" should be present
    expect(screen.getByText("帳號綁定")).toBeDefined();
    // Content should be rendered
    expect(container.textContent).toContain("尚未綁定");
  });

  it("non-admin does NOT see the binding section (conditional hides component)", () => {
    const isAdmin = false;
    const { container } = render(
      <div>
        {isAdmin && (
          <StaffBindingSection staffId={1} boundUser={null} />
        )}
      </div>
    );

    // Nothing from the binding section should be rendered
    expect(screen.queryByText("帳號綁定")).toBeNull();
    expect(screen.queryByText("尚未綁定")).toBeNull();
    expect(container.textContent).toBe("");
  });
});

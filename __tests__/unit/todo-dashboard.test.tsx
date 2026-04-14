// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import React from "react";

// Mock server actions
vi.mock("@/app/_lib/actions/todo-actions", () => ({
  completeTodo: vi.fn(),
  deleteTodo: vi.fn(),
}));

// Mock next/link as a simple anchor
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock Button to expose variant and disabled as data attributes
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    variant = "default",
    disabled,
    ...rest
  }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button data-variant={variant} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

import { TodoDashboard } from "@/app/_components/todo-dashboard";

afterEach(() => {
  cleanup();
});

const sampleTodos = [
  {
    id: 1,
    date: "2024-01-01",
    note: "Test",
    client: { id: 1, name: "Client A" },
    staffInCharge: [{ id: 5, name: "Staff A" }],
  },
  {
    id: 2,
    date: "2024-01-02",
    note: "Test 2",
    client: { id: 2, name: "Client B" },
    staffInCharge: [],
  },
];

describe("TodoDashboard filter defaults", () => {
  /**
   * Validates: Requirements 5.4
   * WHEN Session_User 的 staffId 為 null 時，預設「全部待辦」且停用「我的待辦」
   */
  it("defaults to 全部待辦 and disables 我的待辦 when sessionStaffId is null", () => {
    render(<TodoDashboard todos={sampleTodos} sessionStaffId={null} />);

    const allButton = screen.getByText("全部待辦");
    const mineButton = screen.getByText("我的待辦");

    // 「全部待辦」should have the active (default) variant
    expect(allButton.getAttribute("data-variant")).toBe("default");
    // 「我的待辦」should be disabled
    expect((mineButton as HTMLButtonElement).disabled).toBe(true);
    // 「我的待辦」should have the outline (inactive) variant
    expect(mineButton.getAttribute("data-variant")).toBe("outline");
  });

  /**
   * Validates: Requirements 5.5
   * WHEN Session_User 的 staffId 存在時，預設「我的待辦」
   */
  it("defaults to 我的待辦 when sessionStaffId is present", () => {
    render(<TodoDashboard todos={sampleTodos} sessionStaffId={5} />);

    const mineButton = screen.getByText("我的待辦");
    const allButton = screen.getByText("全部待辦");

    // 「我的待辦」should have the active (default) variant
    expect(mineButton.getAttribute("data-variant")).toBe("default");
    // 「我的待辦」should NOT be disabled
    expect((mineButton as HTMLButtonElement).disabled).toBe(false);
    // 「全部待辦」should have the outline (inactive) variant
    expect(allButton.getAttribute("data-variant")).toBe("outline");
  });
});

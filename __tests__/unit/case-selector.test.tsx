// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, act } from "@testing-library/react";
import React from "react";

// Mock getCasesByClientId server action
const mockGetCasesByClientId = vi.fn();
vi.mock("@/app/_lib/actions/case-actions", () => ({
  getCasesByClientId: (...args: unknown[]) => mockGetCasesByClientId(...args),
}));

// Mock shadcn Select components with simple HTML equivalents
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="select-root" data-value={value} data-disabled={disabled}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement, {
              onValueChange,
              value,
              disabled,
            } as Record<string, unknown>)
          : child,
      )}
    </div>
  ),
  SelectTrigger: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    className?: string;
  }) => (
    <button data-testid="select-trigger" disabled={disabled}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="select-value">{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-group">{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => (
    <div data-testid={`select-item-${value}`} data-value={value}>
      {children}
    </div>
  ),
}));

import CaseSelector from "@/app/_components/case-selector";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CaseSelector", () => {
  beforeEach(() => {
    mockGetCasesByClientId.mockResolvedValue([]);
  });

  it("renders label and hidden input with name prop", () => {
    const { container } = render(
      <CaseSelector name="caseId" label="關聯案件" />,
    );

    expect(screen.getByText("關聯案件")).toBeDefined();

    const hiddenInput = container.querySelector(
      'input[type="hidden"][name="caseId"]',
    );
    expect(hiddenInput).not.toBeNull();
    expect((hiddenInput as HTMLInputElement).value).toBe("");
  });

  it("shows disabled placeholder when disabled prop is true", () => {
    render(<CaseSelector name="caseId" disabled />);

    expect(screen.getByText("請先選擇族人")).toBeDefined();
    expect(screen.getByTestId("select-root").dataset.disabled).toBe("true");
  });

  it("shows '此族人尚無案件' when clientId is provided but no cases exist", async () => {
    mockGetCasesByClientId.mockResolvedValue([]);

    await act(async () => {
      render(<CaseSelector name="caseId" clientId={1} />);
    });

    expect(screen.getByText("此族人尚無案件")).toBeDefined();
  });

  it("loads and displays cases with name and status labels", async () => {
    mockGetCasesByClientId.mockResolvedValue([
      { id: 10, name: "一般諮詢", status: "in_progress" },
      { id: 20, name: "法律諮詢", status: "closed" },
    ]);

    await act(async () => {
      render(<CaseSelector name="caseId" clientId={1} />);
    });

    expect(mockGetCasesByClientId).toHaveBeenCalledWith(1);
    expect(screen.getByText("一般諮詢 — 處理中")).toBeDefined();
    expect(screen.getByText("法律諮詢 — 結案")).toBeDefined();
  });

  it("always shows '不關聯案件' as first option", async () => {
    mockGetCasesByClientId.mockResolvedValue([
      { id: 10, name: "一般諮詢", status: "in_progress" },
    ]);

    await act(async () => {
      render(<CaseSelector name="caseId" clientId={1} />);
    });

    expect(screen.getByTestId("select-item-")).toBeDefined();
    expect(screen.getAllByText("不關聯案件").length).toBeGreaterThanOrEqual(1);
  });

  it("sets hidden input value from defaultValue", () => {
    const { container } = render(
      <CaseSelector name="caseId" clientId={1} defaultValue={42} />,
    );

    const hiddenInput = container.querySelector(
      'input[type="hidden"][name="caseId"]',
    );
    expect((hiddenInput as HTMLInputElement).value).toBe("42");
  });

  it("handles null case name gracefully", async () => {
    mockGetCasesByClientId.mockResolvedValue([
      { id: 10, name: null, status: "in_progress" },
    ]);

    await act(async () => {
      render(<CaseSelector name="caseId" clientId={1} />);
    });

    expect(screen.getByText("未命名案件 — 處理中")).toBeDefined();
  });
});

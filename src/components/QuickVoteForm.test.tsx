import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickVoteForm } from "@/components/QuickVoteForm";

describe("QuickVoteForm", () => {
  it("submits trimmed host name and non-empty options", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<QuickVoteForm onCreate={onCreate} />);
    await userEvent.type(screen.getByLabelText(/your name/i), "Sam");
    const optionInputs = screen.getAllByLabelText(/option/i);
    await userEvent.type(optionInputs[0], "Sushi");
    await userEvent.type(optionInputs[1], "Pizza");
    await userEvent.click(screen.getByRole("button", { name: /start vote/i }));
    expect(onCreate).toHaveBeenCalledWith("Sam", [{ name: "Sushi" }, { name: "Pizza" }]);
  });

  it("does not submit with fewer than 2 filled options", async () => {
    const onCreate = vi.fn();
    render(<QuickVoteForm onCreate={onCreate} />);
    await userEvent.type(screen.getByLabelText(/your name/i), "Sam");
    await userEvent.type(screen.getAllByLabelText(/option/i)[0], "Sushi");
    await userEvent.click(screen.getByRole("button", { name: /start vote/i }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 2 options/i)).toBeInTheDocument();
  });

  it("includes pre-filled restaurant picks in the payload", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const initialOptions = [
      { name: "Alpha", placeId: "a", snapshot: { placeId: "a", name: "Alpha" } },
      { name: "Beta", placeId: "b", snapshot: { placeId: "b", name: "Beta" } },
    ];
    render(<QuickVoteForm onCreate={onCreate} initialOptions={initialOptions} />);
    // Pre-filled picks must render as chips with remove controls.
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove alpha/i })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/your name/i), "Sam");
    await userEvent.click(screen.getByRole("button", { name: /start vote/i }));
    expect(onCreate).toHaveBeenCalledWith("Sam", initialOptions);
  });

  it("removing a pre-filled pick can drop below the 2-option minimum", async () => {
    const onCreate = vi.fn();
    const initialOptions = [
      { name: "Alpha", placeId: "a", snapshot: { placeId: "a", name: "Alpha" } },
      { name: "Beta", placeId: "b", snapshot: { placeId: "b", name: "Beta" } },
    ];
    render(<QuickVoteForm onCreate={onCreate} initialOptions={initialOptions} />);
    await userEvent.type(screen.getByLabelText(/your name/i), "Sam");
    await userEvent.click(screen.getByRole("button", { name: /remove beta/i }));
    await userEvent.click(screen.getByRole("button", { name: /start vote/i }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 2 options/i)).toBeInTheDocument();
  });
});

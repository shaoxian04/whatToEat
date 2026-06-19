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
    expect(onCreate).toHaveBeenCalledWith("Sam", ["Sushi", "Pizza"]);
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
});
